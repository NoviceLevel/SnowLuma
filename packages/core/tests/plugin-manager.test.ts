import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PluginManager } from '../src/webui/plugin-manager';

async function createPlugin(root: string, folder: string, manifest: Record<string, unknown>) {
  const pluginDir = path.join(root, folder);
  await mkdir(pluginDir, { recursive: true });
  await writeFile(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest), 'utf8');
  return pluginDir;
}

describe('PluginManager', () => {
  it('discovers valid manifests and ignores folders without a manifest', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'snowluma-plugin-manager-'));
    await createPlugin(root, 'valid', {
      id: 'valid',
      name: 'Valid plugin',
      version: '1.0.0',
      entry: 'index.mjs',
      webui: { host: '127.0.0.1', defaultPort: 8123 },
    });
    await writeFile(path.join(root, 'valid', 'index.mjs'), 'setInterval(() => {}, 1000);', 'utf8');
    await mkdir(path.join(root, 'ignored'));

    const plugins = await new PluginManager(root).list();

    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toMatchObject({
      id: 'valid',
      name: 'Valid plugin',
      state: 'stopped',
      running: false,
      webUrl: 'http://127.0.0.1:8123',
      webPort: 8123,
    });
  });

  it('rejects manifest entry paths outside the plugin directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'snowluma-plugin-manager-'));
    await createPlugin(root, 'unsafe', {
      id: 'unsafe',
      name: 'Unsafe plugin',
      entry: '../outside.mjs',
    });

    const [plugin] = await new PluginManager(root).list();

    expect(plugin).toMatchObject({ id: 'unsafe', state: 'error', running: false });
    expect(plugin?.lastError).toContain('插件入口');
  });
  it('persists enabled state and prevents disabled plugins from starting', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'snowluma-plugin-manager-'));
    await createPlugin(root, 'toggle', {
      id: 'toggle',
      name: 'Toggle plugin',
      version: '1.0.0',
      entry: 'index.mjs',
    });
    await writeFile(path.join(root, 'toggle', 'index.mjs'), 'setInterval(() => {}, 1000);', 'utf8');
    const manager = new PluginManager(root);

    expect((await manager.list())[0]?.enabled).toBe(true);
    await manager.setEnabled('toggle', false);
    expect((await manager.list())[0]).toMatchObject({ enabled: false, state: 'stopped' });
    await expect(manager.start('toggle')).rejects.toThrow('插件已禁用');
    await manager.setEnabled('toggle', true);
    expect((await manager.list())[0]?.enabled).toBe(true);
  });

  it('starts manager-only plugins with a SnowLuma IPC channel', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'snowluma-plugin-manager-'));
    const pluginDir = await createPlugin(root, 'managed', {
      id: 'managed',
      name: 'Managed plugin',
      version: '1.0.0',
      entry: 'index.mjs',
      managerOnly: true,
    });
    await writeFile(path.join(pluginDir, 'index.mjs'), `
      if (process.env.SNOWLUMA_PLUGIN_MANAGED !== '1' ||
          process.env.SNOWLUMA_PLUGIN_ID !== 'managed' ||
          typeof process.send !== 'function' || !process.connected) process.exit(23);
      setInterval(() => {}, 1000);
    `, 'utf8');
    const manager = new PluginManager(root);

    const started = await manager.start('managed');
    expect(started).toMatchObject({ state: 'running', running: true, managed: true });

    const stopped = await manager.stop('managed');
    expect(stopped).toMatchObject({ state: 'stopped', running: false, managed: false });
  });

  it('shows WebUI ports only for currently online configured accounts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'snowluma-plugin-manager-'));
    await createPlugin(root, 'multi', {
      id: 'multi', name: 'Multi plugin', entry: 'index.mjs', multiAccount: true,
      webui: { host: '127.0.0.1', defaultPort: 8191, multiAccount: true },
    });
    await writeFile(path.join(root, 'multi', 'index.mjs'), 'setInterval(() => {}, 1000);', 'utf8');
    await mkdir(path.join(root, '..', 'config'), { recursive: true });
    for (const [uin, port] of [['10001', 3001], ['10002', 3002]] as const) {
      await writeFile(path.join(root, '..', 'config', `onebot_${uin}.json`), JSON.stringify({
        networks: { httpServers: [{ enabled: true, port }] },
      }), 'utf8');
    }
    const manager = new PluginManager(root, () => ['10002']);

    const [plugin] = await manager.list();
    expect(plugin?.instances).toMatchObject([{ uin: '10002', webPort: 8191 }]);
  });
});
