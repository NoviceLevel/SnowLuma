import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AutomationController,
  DEFAULT_CONFIG,
  OneBotHttpClient,
  ProgressStore,
  QQPetError,
  TaskFallbackError,
  buildCandidateList,
  compareRewardPerSecond,
  createWebServer,
  decideNextTask,
  estimateBestTaskRps,
  fatigueAction,
  hasFreeAvailableCourses,
  isAdventureWindowOpen,
  isFailureDiscouraged,
  isFallbackWorthy,
  isIrrecoverableSettleError,
  isRestPeriodActive,
  isWithinTimeWindow,
  normalizeConfig,
  orderCandidatesForSmart,
  parseDurationSeconds,
  parseFatigueStatus,
  parseRewardAmount,
  resolveStaticAssetPath,
  rotateSchoolAttribute,
  selectSchoolAttribute,
  selectSchoolOrWork,
  telemetryToOutdoorRecords,
  updateAdventureMoneyBagStreak,
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

  test('migrates legacy visit minutes and normalizes new automation fields', () => {
    const config = normalizeConfig({
      visitDelayMinMinutes: 2,
      visitDelayMaxMinutes: 5,
      pkDelayMinSeconds: 90,
      pkDelayMaxSeconds: 10,
      pkCandidateScanLimit: 999,
      adventureNoMoneyBagLimit: 0,
    });
    assert.equal(config.visitDelayMinSeconds, 120);
    assert.equal(config.visitDelayMaxSeconds, 300);
    assert.equal(config.pkDelayMaxSeconds, 90);
    assert.equal(config.pkCandidateScanLimit, 100);
    assert.equal(config.adventureNoMoneyBagLimit, 1);
  });

  test('detects normal, cross-midnight and all-day rest periods', () => {
    const base = { ...DEFAULT_CONFIG, restPeriodEnabled: true };
    assert.equal(isRestPeriodActive({ ...base, restStartTime: '01:00', restEndTime: '07:00' }, new Date('2026-08-11T03:00:00')), true);
    assert.equal(isRestPeriodActive({ ...base, restStartTime: '22:00', restEndTime: '02:00' }, new Date('2026-08-11T23:00:00')), true);
    assert.equal(isRestPeriodActive({ ...base, restStartTime: '22:00', restEndTime: '02:00' }, new Date('2026-08-11T12:00:00')), false);
    assert.equal(isRestPeriodActive({ ...base, restStartTime: '00:00', restEndTime: '00:00' }, new Date('2026-08-11T12:00:00')), true);
  });

  test('tracks adventure money-bag streaks', () => {
    assert.deepEqual(updateAdventureMoneyBagStreak(3, 100, 120, 5), { dropped: true, goldGain: 20, streak: 0, paused: false });
    assert.deepEqual(updateAdventureMoneyBagStreak(4, 100, 100, 5), { dropped: false, goldGain: 0, streak: 5, paused: true });
  });

  test('quick adventure without a money bag does not create a pending task', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'miku-quick-adventure-'));
    const store = new ProgressStore(path.join(directory, 'daily-progress.json'));
    const controller = new AutomationController({ log: () => {}, updateStatus: () => {} }, store);
    const started = await controller.startTaskByKind({
      startAdventure: async () => { throw new QQPetError('no money bag', 'coin_bag_not_found'); },
    }, { ...DEFAULT_CONFIG, quickAdventureEnabled: true }, {}, 'adventure');
    assert.equal(started, false);
    assert.equal(store.snapshot().pending, null);
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
    assert.equal(decideNextTask(config, { gold: 100 }, { adventure: 0, work: 0 }, evening, []), 'adventure');
    assert.equal(decideNextTask(config, { gold: 100 }, { adventure: 3, work: 0 }, evening, []), 'school');
    assert.equal(decideNextTask(config, { gold: 100 }, { adventure: 0, work: 0 }, afternoon, []), 'school');
  });

  test('recognizes irrecoverable settle errors', () => {
    assert.equal(isIrrecoverableSettleError(new Error('任务已结算')), true);
    assert.equal(isIrrecoverableSettleError(new Error('宠物结算条件不满足')), true);
    assert.equal(isIrrecoverableSettleError(new Error('settle already completed')), true);
    assert.equal(isIrrecoverableSettleError(new Error('网络超时')), false);
  });

  test('detects free available courses from cost text', () => {
    assert.equal(hasFreeAvailableCourses([{ cost: '' }, { cost: '100 金币' }]), true);
    assert.equal(hasFreeAvailableCourses([{ cost: '0' }]), true);
    assert.equal(hasFreeAvailableCourses([{ cost: '免费' }]), true);
    assert.equal(hasFreeAvailableCourses([{ cost: 'free' }]), true);
    assert.equal(hasFreeAvailableCourses([{ cost: '100 金币' }, { cost: '50 金币' }]), false);
    assert.equal(hasFreeAvailableCourses(null), false);
    assert.equal(hasFreeAvailableCourses([]), false);
  });

  test('builds candidate list with smart priority and failure avoidance', () => {
    const base = {
      ...DEFAULT_CONFIG,
      schoolEnabled: true,
      workEnabled: true,
      adventureEnabled: true,
      adventureStartTime: '20:00',
      adventureEndTime: '22:00',
      adventureTimesPerDay: 3,
      workTimesPerDay: 0,
      taskPriority: 'smart',
    };
    const evening = new Date('2026-08-10T21:00:00');
    const candidates = buildCandidateList(base, { gold: 100 }, { adventure: 0, work: 0 }, [], evening);
    assert.ok(candidates.includes('adventure'));
    assert.ok(candidates.includes('school'));
    assert.ok(candidates.includes('work'));
    assert.equal(candidates[0], 'adventure');

    const singleFailure = [{ kind: 'school', at: new Date(Date.now() - 60000).toISOString() }];
    const afterOne = buildCandidateList(base, { gold: 100 }, { adventure: 0, work: 0 }, singleFailure, evening);
    assert.ok(afterOne.indexOf('school') < afterOne.indexOf('work'), 'single failure should not discourage school');

    const recentFailures = [
      { kind: 'school', at: new Date(Date.now() - 120000).toISOString() },
      { kind: 'school', at: new Date(Date.now() - 60000).toISOString() },
    ];
    const discouraged = buildCandidateList(base, { gold: 100 }, { adventure: 0, work: 0 }, recentFailures, evening);
    const schoolIdx = discouraged.indexOf('school');
    const workIdx = discouraged.indexOf('work');
    assert.ok(schoolIdx > workIdx, 'school should be sorted after work when discouraged twice');
    assert.equal(isFailureDiscouraged('school', recentFailures), true);
    assert.equal(isFailureDiscouraged('school', singleFailure), false);
  });

  test('records and checks recent failures with rollover', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'miku-failures-'));
    const filePath = path.join(directory, 'daily-progress.json');
    const store = new ProgressStore(filePath);
    store.recordFailure('school');
    assert.equal(store.isTaskDiscouraged('school'), false);
    store.recordFailure('school');
    assert.equal(store.isTaskDiscouraged('school'), true);
    assert.equal(store.isTaskDiscouraged('work'), false);
    assert.equal(store.snapshot().recentFailures.length, 2);
  });

  test('tracks daily gold gain and ignores zero-collapse glitches', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'miku-gold-'));
    const store = new ProgressStore(path.join(directory, 'daily-progress.json'));
    store.recordAttributes({ strength: 1, intelligence: 1, charm: 1, gold: 1000 });
    store.recordAttributes({ strength: 1, intelligence: 1, charm: 1, gold: 800 });
    store.recordAttributes({ strength: 1, intelligence: 1, charm: 1, gold: 900 });
    assert.equal(store.snapshot().dailyGoldGain, 100);
    store.recordAttributes({ strength: 1, intelligence: 1, charm: 1, gold: 0 });
    store.recordAttributes({ strength: 1, intelligence: 1, charm: 1, gold: 900 });
    assert.equal(store.snapshot().dailyGoldGain, 100);
    assert.equal(store.snapshot().goldFloor, 900);
    store.recordAttributes({ strength: 1, intelligence: 1, charm: 1, gold: 950 });
    assert.equal(store.snapshot().dailyGoldGain, 150);
  });

  test('clears recentFailures on daily rollover', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'miku-rollover-'));
    const filePath = path.join(directory, 'daily-progress.json');
    const store = new ProgressStore(filePath);
    store.recordFailure('adventure');
    store.recordFailure('school');
    assert.equal(store.snapshot().recentFailures.length, 2);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');
    store.rollover(tomorrowKey);
    assert.equal(store.snapshot().recentFailures.length, 0);
  });

  test('fallback chain tries at most 2 candidates', () => {
    const config = {
      ...DEFAULT_CONFIG,
      schoolEnabled: true,
      workEnabled: true,
      adventureEnabled: true,
      adventureStartTime: '20:00',
      adventureEndTime: '22:00',
      adventureTimesPerDay: 3,
      workTimesPerDay: 0,
      taskPriority: 'smart',
    };
    const evening = new Date('2026-08-10T21:00:00');
    const candidates = buildCandidateList(config, { gold: 100 }, { adventure: 0, work: 0 }, []);
    assert.ok(candidates.length >= 2, 'should have multiple candidates');
    const maxAttempts = Math.min(2, candidates.length);
    assert.equal(maxAttempts, 2, 'fallback chain should try at most 2');
  });

  test('TaskFallbackError marks degradable failures and isFallbackWorthy detects game-state errors', () => {
    const fallbackError = new TaskFallbackError('课程当前不可用');
    assert.equal(fallbackError.name, 'TaskFallbackError');
    assert.equal(isFallbackWorthy(fallbackError), true);
    assert.equal(isFallbackWorthy(new Error('课程当前不可用')), true);
    assert.equal(isFallbackWorthy(new Error('职业尚未开放')), true);
    assert.equal(isFallbackWorthy(new Error('当前暂无可用的力量课程')), true);
    assert.equal(isFallbackWorthy(new Error('服务器当前没有开放的职业')), true);
    assert.equal(isFallbackWorthy(new Error('服务器当前没有可执行的打工岗位')), true);
    assert.equal(isFallbackWorthy(new Error('服务器当前没有可执行的冒险')), true);
    assert.equal(isFallbackWorthy(new Error('settle already completed')), false);
    assert.equal(isFallbackWorthy(new Error('网络超时')), false);
    assert.equal(isFallbackWorthy(new Error('OneBot send_packet 失败')), false);
  });

  test('orders smart candidates once and keeps preferred inside allowed set', async () => {
    assert.deepEqual(orderCandidatesForSmart(['adventure', 'school', 'work'], 'work'), ['adventure', 'work', 'school']);
    assert.deepEqual(orderCandidatesForSmart(['school', 'work'], 'work'), ['work', 'school']);
    assert.deepEqual(orderCandidatesForSmart(['school', 'work'], 'adventure'), ['school', 'work']);

    const api = {
      querySchoolCourses: async () => [{ canDo: true, subEventType: 1, reward: '金币 10', duration: '10分钟' }],
      queryWorkOverview: async () => ({ careers: [{ available: true, careerType: 1 }] }),
      queryWorkJobs: async () => [{ canDo: true, subEventType: 2, reward: '金币 100', duration: '1分钟' }],
    };
    assert.equal(await estimateBestTaskRps(api, { ...DEFAULT_CONFIG, schoolEnabled: true, workEnabled: true }, ['school']), 'school');
    assert.equal(await estimateBestTaskRps(api, { ...DEFAULT_CONFIG, schoolEnabled: false, workEnabled: true }), 'work');
    assert.equal(await estimateBestTaskRps(api, { ...DEFAULT_CONFIG, schoolEnabled: true, workEnabled: true }, ['work']), 'work');
  });

  test('decideNextTask uses candidate list and respects coin threshold', () => {
    const evening = new Date('2026-08-10T21:00:00');
    const base = {
      ...DEFAULT_CONFIG,
      schoolEnabled: true,
      workEnabled: true,
      adventureEnabled: true,
      adventureStartTime: '20:00',
      adventureEndTime: '22:00',
      adventureTimesPerDay: 3,
      coinThreshold: 50,
      taskPriority: 'smart',
    };
    assert.equal(decideNextTask(base, { gold: 100 }, { adventure: 0, work: 0 }, evening, []), 'adventure');
    assert.equal(decideNextTask({ ...base, adventureEnabled: false }, { gold: 10 }, { adventure: 0, work: 0 }, evening, []), 'work');
    assert.equal(decideNextTask({ ...base, adventureEnabled: false, workEnabled: false }, { gold: 10 }, { adventure: 0, work: 0 }, evening, []), null);
  });
});

describe('Miku OneBot HTTP client', () => {
  const okResponse = (data = {}) => ({
    ok: true,
    status: 200,
    json: async () => ({ status: 'ok', retcode: 0, data }),
  });

  test('retries transient network failures until success', async () => {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('fetch failed');
      return okResponse({ delivered: true });
    };
    const client = new OneBotHttpClient(
      { baseUrl: 'http://127.0.0.1:3002', maxRetries: 2, retryDelayMs: 100 },
      fetchImpl,
    );
    const data = await client.call('send_packet', {});
    assert.equal(attempts, 3);
    assert.deepEqual(data, { delivered: true });
  });

  test('throws after exhausting network retries', async () => {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      throw new Error('fetch failed');
    };
    const client = new OneBotHttpClient(
      { baseUrl: 'http://127.0.0.1:3002', maxRetries: 2, retryDelayMs: 100 },
      fetchImpl,
    );
    await assert.rejects(() => client.call('send_packet', {}), /OneBot 请求失败：fetch failed/);
    assert.equal(attempts, 3);
  });

  test('does not retry business-level failures', async () => {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'failed', retcode: 1, message: '暂无可执行的冒险' }),
      };
    };
    const client = new OneBotHttpClient({ baseUrl: 'http://127.0.0.1:3002' }, fetchImpl);
    await assert.rejects(() => client.call('send_packet', {}), /暂无可执行的冒险/);
    assert.equal(attempts, 1);
  });
});

describe('Miku QQPet protocol', () => {
  test('projects settled telemetry into sorted local outdoor records', () => {
    const records = telemetryToOutdoorRecords([
      { status: 'settled', kind: 'work', storyId: 'work-1', settledAt: '2026-08-11T01:00:00.000Z', elapsedSeconds: 60, item: { name: '搬砖', reward: '金币 65' }, delta: { strength: 0, intelligence: 0, charm: 0 }, after: {} },
      { status: 'pending', kind: 'school', storyId: 'pending', settledAt: '2026-08-11T03:00:00.000Z' },
      { status: 'settled', kind: 'school', storyId: 'school-1', settledAt: '2026-08-11T02:00:00.000Z', elapsedSeconds: 120, item: { name: '体育课' }, delta: { strength: 2, intelligence: 0, charm: 0 }, after: { strength: 66 } },
      { status: 'settled', kind: 'school', storyId: 'school-1', settledAt: '2026-08-11T02:00:00.000Z', item: { name: '重复记录' } },
    ], 10);

    assert.deepEqual(records.map((record) => record.storyId), ['school-1', 'work-1']);
    assert.equal(records[0].eventType, 6100);
    assert.equal(records[0].source, 'local');
    assert.equal(records[0].results[0].name, '力量');
    assert.equal(records[0].results[0].difference, 2);
    assert.match(records[0].detail, /120 秒/);
    assert.match(records[1].detail, /金币 65/);
  });

  test('uses only local settled telemetry for task records', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'miku-outdoor-fallback-'));
    const store = new ProgressStore(path.join(directory, 'daily-progress.json'));
    store.recordTelemetry({
      status: 'settled',
      kind: 'school',
      storyId: 'local-story',
      settledAt: '2026-08-11T02:00:00.000Z',
      item: { name: '体育课' },
      delta: { strength: 2 },
      after: { strength: 66 },
    });
    const controller = new AutomationController({ log: () => {} }, store);
    assert.equal((await controller.refreshOutdoorRecords()).length, 1);
    assert.equal((await controller.refreshOutdoorRecords()).length, 1);
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
