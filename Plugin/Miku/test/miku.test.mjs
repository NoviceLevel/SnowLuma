import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_CONFIG,
  ProgressStore,
  createWebServer,
  normalizeConfig,
  resolveStaticAssetPath,
  selectSchoolAttribute,
} from '../index.mjs';
import { configuredAccounts } from '../multi.mjs';

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Miku configuration and persistence', () => {
  test('starts in manual, attribute-first mode by default', () => {
    assert.equal(DEFAULT_CONFIG.autoStart, false);
    assert.equal(DEFAULT_CONFIG.safeMode, false);
    assert.equal(DEFAULT_CONFIG.coinThreshold, 0);
    assert.equal(DEFAULT_CONFIG.schoolRotationEnabled, true);
    assert.equal(DEFAULT_CONFIG.schoolSelectionMode, 'lowest');
    assert.equal(DEFAULT_CONFIG.adventureEnabled, false);
    assert.equal(normalizeConfig({ intervalSeconds: 1 }).intervalSeconds, 3);
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

describe('Miku account discovery', () => {
  test('keeps enabled tokenless HTTP servers', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'miku-config-'));
    await writeFile(path.join(directory, 'onebot_12345.json'), JSON.stringify({
      networks: { httpServers: [{ enabled: true, host: '127.0.0.1', port: 3000 }] },
    }), 'utf8');
    const accounts = configuredAccounts(directory, '');
    assert.deepEqual(accounts, [{ uin: '12345', url: 'http://127.0.0.1:3000', token: '' }]);
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
