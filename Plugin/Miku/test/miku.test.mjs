import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_CONFIG,
  ProgressStore,
  compareRewardPerSecond,
  createWebServer,
  decideNextTask,
  fatigueAction,
  isAdventureWindowOpen,
  isIrrecoverableSettleError,
  isWithinTimeWindow,
  normalizeConfig,
  parseDurationSeconds,
  parseFatigueStatus,
  parseRewardAmount,
  resolveStaticAssetPath,
  rotateSchoolAttribute,
  selectSchoolAttribute,
  selectSchoolOrWork,
} from '../index.mjs';
import { accountKey, configuredAccounts } from '../multi.mjs';

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Miku configuration and persistence', () => {
  test('starts in manual, attribute-first mode by default', () => {
    assert.equal(DEFAULT_CONFIG.autoStart, false);
    assert.equal(DEFAULT_CONFIG.safeMode, false);
    assert.equal(DEFAULT_CONFIG.coinThreshold, 0);
    assert.equal(DEFAULT_CONFIG.schoolRotationEnabled, true);
    assert.equal(DEFAULT_CONFIG.schoolSelectionMode, 'lowest');
    assert.equal(DEFAULT_CONFIG.adventureEnabled, false);
    assert.equal(DEFAULT_CONFIG.adventureEndTime, '23:59');
    assert.equal(normalizeConfig({ intervalSeconds: 1 }).intervalSeconds, 3);
  });

  test('normalizes adventure window and advanced timing knobs', () => {
    const config = normalizeConfig({
      adventureStartTime: '25:00',
      adventureEndTime: 'nope',
      verifyDelaySeconds: 99,
      settleRetrySeconds: 0,
      startConfirmSeconds: 1,
    });
    assert.equal(config.adventureStartTime, '20:00');
    assert.equal(config.adventureEndTime, '23:59');
    assert.equal(config.verifyDelaySeconds, 30);
    assert.equal(config.settleRetrySeconds, 1);
    assert.equal(config.startConfirmSeconds, 5);
  });

  test('backs up corrupted progress before resetting it', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'miku-progress-'));
    const filePath = path.join(directory, 'daily-progress.json');
    await writeFile(filePath, '{broken', 'utf8');
    const store = new ProgressStore(filePath);
    assert.equal(store.snapshot().counts.school, 0);
    const files = await readdir(directory);
    assert.ok(files.some((file) => file.startsWith('daily-progress.json.corrupt-')));
  });

  test('selects the lowest live attribute in adaptive mode', () => {
    const config = { ...DEFAULT_CONFIG, schoolSelectionMode: 'lowest', schoolAttribute: 'physical' };
    assert.equal(selectSchoolAttribute(config, { strength: 236, intelligence: 334, charm: 302 }), 'physical');
    assert.equal(selectSchoolAttribute(config, { strength: 90, intelligence: 40, charm: 70 }), 'culture');
  });

  test('rotates school attributes from the configured base', () => {
    const config = { ...DEFAULT_CONFIG, schoolAttribute: 'physical', schoolRotationEnabled: true };
    assert.equal(rotateSchoolAttribute(config, 0), 'physical');
    assert.equal(rotateSchoolAttribute(config, 1), 'culture');
    assert.equal(rotateSchoolAttribute(config, 2), 'art');
    assert.equal(rotateSchoolAttribute({ ...config, schoolRotationEnabled: false }, 2), 'physical');
  });

  test('records bounded task telemetry', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'miku-telemetry-'));
    const store = new ProgressStore(path.join(directory, 'daily-progress.json'));
    for (let index = 0; index < 105; index += 1) {
      store.recordTelemetry({ kind: 'school', status: 'settled', index });
    }
    assert.equal(store.snapshot().telemetry.length, 100);
    assert.equal(store.snapshot().telemetry[0].index, 5);
  });
});

describe('Miku decision helpers', () => {
  test('parses reward text with total and gold fallbacks', () => {
    assert.equal(parseRewardAmount('总收益 128'), 128);
    assert.equal(parseRewardAmount('金币 42 · 其他'), 42);
    assert.equal(parseRewardAmount('经验 15'), 15);
    assert.equal(parseRewardAmount('无数字'), 0);
  });

  test('parses mixed duration text', () => {
    assert.equal(parseDurationSeconds('1小时30分钟'), 5400);
    assert.equal(parseDurationSeconds('45分钟'), 2700);
    assert.equal(parseDurationSeconds('20秒'), 20);
    assert.equal(parseDurationSeconds('2h 5m'), 7500);
  });

  test('prefers higher reward-per-second catalog items', () => {
    const slow = { duration: '2小时', reward: '金币 100' };
    const fast = { duration: '30分钟', reward: '金币 40' };
    // Ascending sort keeps the higher rps item first when comparator returns > 0 for (slow, fast).
    assert.ok(compareRewardPerSecond(slow, fast) > 0);
    assert.deepEqual([slow, fast].sort(compareRewardPerSecond)[0], fast);
  });

  test('detects fatigue tiers from warning copy', () => {
    assert.equal(parseFatigueStatus('非常累，收益降低至10%').tier, 12);
    assert.equal(parseFatigueStatus('宠物已疲惫，收益减少').tier, 8);
    assert.equal(parseFatigueStatus('状态良好').fatigued, false);
  });

  test('maps fatigue actions from config', () => {
    const config = {
      ...DEFAULT_CONFIG,
      fatigue8HourAction: 'work',
      fatigue12HourAction: 'rest',
    };
    assert.equal(fatigueAction(config, { fatigued: true, tier: 8 }), 'work');
    assert.equal(fatigueAction(config, { fatigued: true, tier: 12 }), 'rest');
    assert.equal(fatigueAction(config, { fatigued: false, tier: 0 }), null);
  });

  test('selects school or work by priority and limits', () => {
    const base = {
      ...DEFAULT_CONFIG,
      schoolEnabled: true,
      workEnabled: true,
      coinThreshold: 10,
      workTimesPerDay: 2,
      taskPriority: 'school',
    };
    assert.equal(selectSchoolOrWork(base, { gold: 50 }, { work: 0 }), 'school');
    assert.equal(selectSchoolOrWork(base, { gold: 5 }, { work: 0 }), 'work');
    assert.equal(selectSchoolOrWork({ ...base, taskPriority: 'work' }, { gold: 50 }, { work: 0 }), 'work');
    assert.equal(selectSchoolOrWork(base, { gold: 5 }, { work: 2 }), null);
  });

  test('opens adventure only inside the configured window', () => {
    assert.equal(isWithinTimeWindow('21:00', '20:00', '23:59'), true);
    assert.equal(isWithinTimeWindow('19:59', '20:00', '23:59'), false);
    assert.equal(isWithinTimeWindow('01:00', '22:00', '02:00'), true);
    assert.equal(isWithinTimeWindow('12:00', '22:00', '02:00'), false);

    const config = normalizeConfig({
      ...DEFAULT_CONFIG,
      adventureEnabled: true,
      adventureStartTime: '20:00',
      adventureEndTime: '22:00',
      adventureTimesPerDay: 3,
    });
    const evening = new Date('2026-08-10T21:00:00');
    const afternoon = new Date('2026-08-10T15:00:00');
    assert.equal(isAdventureWindowOpen(config, evening), true);
    assert.equal(isAdventureWindowOpen(config, afternoon), false);
    assert.equal(decideNextTask(config, { gold: 100 }, { adventure: 0, work: 0 }, evening), 'adventure');
    assert.equal(decideNextTask(config, { gold: 100 }, { adventure: 3, work: 0 }, evening), 'school');
    assert.equal(decideNextTask(config, { gold: 100 }, { adventure: 0, work: 0 }, afternoon), 'school');
  });

  test('recognizes irrecoverable settle errors', () => {
    assert.equal(isIrrecoverableSettleError(new Error('任务已结算')), true);
    assert.equal(isIrrecoverableSettleError(new Error('宠物结算条件不满足')), true);
    assert.equal(isIrrecoverableSettleError(new Error('settle already completed')), true);
    assert.equal(isIrrecoverableSettleError(new Error('网络超时')), false);
  });
});

describe('Miku account discovery', () => {
  test('keeps enabled tokenless HTTP servers', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'miku-config-'));
    await writeFile(path.join(directory, 'onebot_12345.json'), JSON.stringify({
      networks: { httpServers: [{ enabled: true, host: '127.0.0.1', port: 3000 }] },
    }), 'utf8');
    const accounts = configuredAccounts(directory, '');
    assert.deepEqual(accounts, [{ uin: '12345', url: 'http://127.0.0.1:3000', token: '' }]);
    assert.equal(accountKey(accounts[0]), '12345|http://127.0.0.1:3000|');
  });
});

describe('Miku Web API', () => {
  let server;
  let baseUrl;
  const plugin = {
    snapshot: () => ({ connected: true }),
    getConfig: () => ({ safeMode: true }),
    updateConfig: () => {},
    scheduler: {
      runOnce: async () => 'noop',
      refreshReadonly: async () => {},
      stopAndWait: async () => true,
      start: () => true,
      catalogs: async () => ({ courses: [], careers: [], adventures: [], bathItems: [] }),
    },
  };

  before(async () => {
    server = createWebServer(plugin, {
      webuiPath: path.join(pluginDir, 'webui'),
      runtimeName: 'Test',
      runtimeKind: 'test',
      uin: '12345',
      apiToken: 'test-token',
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('requires the per-process API token', async () => {
    const unauthorized = await fetch(`${baseUrl}/api/status`);
    assert.equal(unauthorized.status, 401);
    const authorized = await fetch(`${baseUrl}/api/status`, {
      headers: { Authorization: 'Bearer test-token' },
    });
    assert.equal(authorized.status, 200);
  });

  test('rejects encoded Windows traversal', async () => {
    const response = await fetch(`${baseUrl}/static/%5c..%5cpackage.json`);
    assert.ok([400, 404].includes(response.status));
    if (process.platform === 'win32') assert.equal(response.status, 400);
    const body = await readFile(path.join(pluginDir, 'package.json'), 'utf8');
    assert.match(body, /miku-qqpet/);
    assert.equal(resolveStaticAssetPath(path.join(pluginDir, 'webui'), 'app.js').endsWith('app.js'), true);
  });
});
