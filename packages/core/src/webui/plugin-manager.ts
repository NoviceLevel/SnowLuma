import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface PluginHealth {
  status: 'ok';
  [key: string]: unknown;
}

export interface PluginInstanceState {
  uin: string | null;
  webUrl: string;
  webPort: number;
  health: PluginHealth | null;
}

export interface PluginState {
  id: string;
  name: string;
  version: string;
  description: string;
  protocol: string;
  botUin: string | null;
  multiAccount: boolean;
  authorizationRequired: boolean;
  enabled: boolean;
  folderName: string;
  state: 'running' | 'external' | 'stopped' | 'error';
  running: boolean;
  managed: boolean;
  pid: number | null;
  webUrl: string | null;
  webPort: number | null;
  instances: PluginInstanceState[];
  health: PluginHealth | null;
  startedAt: string | null;
  lastExitCode: number | null;
  lastError: string | null;
  lastLog: string;
}

interface PluginDescriptor {
  id: string;
  name: string;
  version: string;
  description: string;
  protocol: string;
  botUin: string | null;
  multiAccount: boolean;
  authorizationRequired: boolean;
  folderName: string;
  pluginDir: string;
  entryPath: string | null;
  configPath: string | null;
  webUrl: string | null;
  webPort: number | null;
  manifestError?: string;
}

interface ManagedRecord {
  child: ChildProcess;
  startedAt: string;
  lastExitCode: number | null;
  lastError: string | null;
  lastLog: string;
}

interface PluginSettings {
  enabled?: boolean;
}

type PluginSettingsFile = Record<string, PluginSettings>;

const PLUGIN_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function readEnvValue(configPath: string | null, key: string): string {
  if (!configPath || !existsSync(configPath)) return '';
  try {
    const match = readFileSync(configPath, 'utf8').match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`, 'm'));
    return match ? match[1]!.trim().replace(/^("|')(.*)\1$/, '$2') : '';
  } catch {
    return '';
  }
}

function isWithin(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent + path.sep);
}

export class PluginManager {
  private readonly records = new Map<string, ManagedRecord>();
  private readonly root: string;
  private readonly settingsPath: string;

  constructor(root = path.resolve(process.cwd(), 'Plugin')) {
    this.root = root;
    this.settingsPath = path.resolve(root, '..', 'config', 'plugins.json');
  }

  async list(): Promise<PluginState[]> {
    return Promise.all(this.readDescriptors().map((descriptor) => this.state(descriptor)));
  }

  async start(id: string): Promise<PluginState> {
    const descriptor = this.requireDescriptor(id);
    if (!this.isEnabled(id)) throw new Error('插件已禁用，请先在插件设置中启用');
    const current = this.records.get(id);
    if (current?.child.exitCode === null && !current.child.killed) return this.state(descriptor);
    if (await this.probeHealth(descriptor)) throw new Error('插件已经在外部运行，不能重复启动');
    if (!descriptor.entryPath) throw new Error(descriptor.manifestError || '插件入口无效');
    const args = descriptor.configPath && existsSync(descriptor.configPath)
      ? [`--env-file-if-exists=${descriptor.configPath}`, descriptor.entryPath]
      : [descriptor.entryPath];
    const child = spawn(process.execPath, args, {
      cwd: descriptor.pluginDir,
      env: this.spawnEnv(descriptor),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const record: ManagedRecord = {
      child,
      startedAt: new Date().toISOString(),
      lastExitCode: null,
      lastError: null,
      lastLog: '',
    };
    const capture = (chunk: Buffer) => { record.lastLog = (record.lastLog + chunk.toString('utf8')).slice(-8000); };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);
    child.once('error', (error) => { record.lastError = error.message; });
    child.once('exit', (code, signal) => {
      record.lastExitCode = code;
      if (code !== 0 && !record.lastError) record.lastError = `进程退出：${code ?? signal ?? 'unknown'}`;
    });
    this.records.set(id, record);
    const result = await this.waitForStartup(descriptor, record);
    if (!result) {
      await this.stopManagedRecord(record);
      throw new Error(record.lastLog.trim() || record.lastError || '插件启动后未达到健康状态');
    }
    return result;
  }

  async stop(id: string): Promise<PluginState> {
    const descriptor = this.requireDescriptor(id);
    const record = this.records.get(id);
    if (!record?.child || record.child.exitCode !== null || record.child.killed) {
      if (await this.probeHealth(descriptor)) throw new Error('插件由外部程序启动，请从原启动位置停止');
      return this.state(descriptor);
    }
    await this.stopManagedRecord(record);
    return this.state(descriptor);
  }

  async restart(id: string): Promise<PluginState> {
    await this.stop(id).catch((error) => {
      if (!(error instanceof Error && error.message.includes('外部程序'))) throw error;
    });
    return this.start(id);
  }

  async setEnabled(id: string, enabled: boolean): Promise<PluginState> {
    const descriptor = this.requireDescriptor(id);
    if (!enabled) {
      const record = this.records.get(id);
      const managed = Boolean(record?.child && record.child.exitCode === null && !record.child.killed);
      if (managed) await this.stop(id);
      else if (await this.probeHealth(descriptor)) {
        this.saveEnabled(id, false);
        throw new Error('插件由外部进程运行，已保存禁用状态；请从原启动位置停止它');
      }
    }
    this.saveEnabled(id, enabled);
    return this.state(descriptor);
  }

  private readDescriptors(): PluginDescriptor[] {
    if (!existsSync(this.root)) return [];
    const result: PluginDescriptor[] = [];
    for (const entry of readdirSync(this.root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !PLUGIN_ID_PATTERN.test(entry.name)) continue;
      const pluginDir = path.resolve(this.root, entry.name);
      const manifestPath = path.join(pluginDir, 'plugin.json');
      if (!existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
        const id = typeof manifest.id === 'string' && PLUGIN_ID_PATTERN.test(manifest.id) ? manifest.id : entry.name;
        const entryName = typeof manifest.entry === 'string' ? manifest.entry : 'index.mjs';
        const entryPath = path.resolve(pluginDir, entryName);
        if (!isWithin(entryPath, pluginDir) || !existsSync(entryPath)) throw new Error('插件入口不存在');
        const webui = typeof manifest.webui === 'object' && manifest.webui !== null ? manifest.webui as Record<string, unknown> : {};
        const port = Number(webui.defaultPort);
        const host = typeof webui.host === 'string' ? webui.host : '127.0.0.1';
        const botUin = typeof manifest.botUin === 'string' && /^\d{5,20}$/.test(manifest.botUin)
          ? manifest.botUin
          : null;
        result.push({ id, name: typeof manifest.displayName === 'string' ? manifest.displayName : typeof manifest.name === 'string' ? manifest.name : entry.name, version: typeof manifest.version === 'string' ? manifest.version : '0.0.0', description: typeof manifest.description === 'string' ? manifest.description : '', protocol: typeof manifest.protocol === 'string' ? manifest.protocol : '', botUin, multiAccount: manifest.multiAccount === true || webui.multiAccount === true, authorizationRequired: manifest.authorizationRequired === true, folderName: entry.name, pluginDir, entryPath, configPath: path.join(pluginDir, 'config.env'), webUrl: Number.isInteger(port) && port > 0 && port <= 65535 ? `http://${host}:${port}` : null, webPort: Number.isInteger(port) && port > 0 && port <= 65535 ? port : null });
      } catch (error) {
        result.push({ id: entry.name, name: entry.name, version: '-', description: '', protocol: '', botUin: null, multiAccount: false, authorizationRequired: false, folderName: entry.name, pluginDir, entryPath: null, configPath: null, webUrl: null, webPort: null, manifestError: error instanceof Error ? error.message : String(error) });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  private requireDescriptor(id: string): PluginDescriptor {
    if (!PLUGIN_ID_PATTERN.test(id)) throw new Error('插件 ID 无效');
    const descriptor = this.readDescriptors().find((item) => item.id === id);
    if (!descriptor) throw new Error('插件不存在');
    return descriptor;
  }

  private readSettings(): PluginSettingsFile {
    if (!existsSync(this.settingsPath)) return {};
    try {
      const parsed = JSON.parse(readFileSync(this.settingsPath, 'utf8')) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed as PluginSettingsFile;
    } catch {
      return {};
    }
  }

  private isEnabled(id: string): boolean {
    return this.readSettings()[id]?.enabled !== false;
  }

  private saveEnabled(id: string, enabled: boolean): void {
    const settings = this.readSettings();
    settings[id] = { ...settings[id], enabled };
    mkdirSync(path.dirname(this.settingsPath), { recursive: true });
    writeFileSync(this.settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  }

  private async probeHealth(descriptor: PluginDescriptor): Promise<PluginHealth | null> {
    if (!descriptor.webUrl) return null;
    try {
      const response = await fetch(`${descriptor.webUrl}/healthz`, { signal: AbortSignal.timeout(800) });
      if (!response.ok) return null;
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;
      return body?.status === 'ok' ? body as PluginHealth : null;
    } catch { return null; }
  }

  private async state(descriptor: PluginDescriptor): Promise<PluginState> {
    const record = this.records.get(descriptor.id);
    const managed = Boolean(record?.child && record.child.exitCode === null && !record.child.killed);
    const targets = await this.webTargets(descriptor);
    const health = targets.find((target) => target.health)?.health ?? null;
    const running = managed || Boolean(health);
    return { id: descriptor.id, name: descriptor.name, version: descriptor.version, description: descriptor.description, protocol: descriptor.protocol, botUin: descriptor.botUin, multiAccount: descriptor.multiAccount, authorizationRequired: descriptor.authorizationRequired, enabled: this.isEnabled(descriptor.id), folderName: descriptor.folderName, state: descriptor.manifestError ? 'error' : running ? managed ? 'running' : 'external' : 'stopped', running, managed, pid: managed ? record!.child.pid ?? null : null, webUrl: targets[0]?.url ?? descriptor.webUrl, webPort: targets[0]?.port ?? descriptor.webPort, instances: targets.map(({ uin, url, port, health: instanceHealth }) => ({ uin, webUrl: url, webPort: port, health: instanceHealth })), health, startedAt: record?.startedAt ?? null, lastExitCode: record?.lastExitCode ?? null, lastError: descriptor.manifestError || record?.lastError || null, lastLog: record?.lastLog || '' };
  }

  private async webTargets(descriptor: PluginDescriptor): Promise<Array<{ uin: string | null; url: string; port: number; health: PluginHealth | null }>> {
    if (!descriptor.webPort || !descriptor.webUrl) return [];
    const accounts = descriptor.multiAccount ? this.configAccounts() : [{ uin: descriptor.botUin, index: 0 }];
    const host = new URL(descriptor.webUrl).hostname;
    return Promise.all(accounts.map(async ({ uin, index }) => {
      const port = descriptor.webPort! + index;
      const url = `http://${host}:${port}`;
      return { uin, url, port, health: await this.probeUrl(url) };
    }));
  }

  private configAccounts(): Array<{ uin: string; index: number }> {
    const isValidPort = (value: unknown): boolean => {
      const port = Number(value);
      return Number.isSafeInteger(port) && port >= 1 && port <= 65535;
    };
    try {
      const configDir = path.resolve(this.root, '..', 'config');
      const accounts = readdirSync(configDir)
        .flatMap((name) => {
          const uin = name.match(/^onebot_(\d+)\.json$/)?.[1];
          if (!uin) return [];
          try {
            const raw = JSON.parse(readFileSync(path.join(configDir, name), 'utf8')) as {
              networks?: { httpServers?: Array<{ enabled?: boolean; port?: number }> };
            };
            const hasEnabledHttp = raw.networks?.httpServers?.some((server) => (
              server?.enabled !== false && isValidPort(server?.port)
            ));
            return hasEnabledHttp ? [uin] : [];
          } catch {
            return [];
          }
        })
        .sort((a, b) => a.localeCompare(b));
      const primary = readEnvValue(path.join(this.root, 'Miku', 'config.env'), 'QQPET_BOT_UIN');
      if (primary && accounts.includes(primary)) {
        accounts.sort((a, b) => a === primary ? -1 : b === primary ? 1 : a.localeCompare(b));
      }
      return accounts.length > 0
        ? accounts.map((uin, index) => ({ uin, index }))
        : [{ uin: '', index: 0 }];
    } catch {
      return [{ uin: '', index: 0 }];
    }
  }

  private spawnEnv(descriptor: PluginDescriptor): NodeJS.ProcessEnv {
    const env = { ...process.env };
    if (descriptor.protocol !== 'onebot-http-v11' || env.QQPET_ONEBOT_TOKEN || readEnvValue(descriptor.configPath, 'QQPET_ONEBOT_TOKEN')) return env;
    let port = 3000;
    try { const url = new URL(readEnvValue(descriptor.configPath, 'QQPET_ONEBOT_URL')); port = Number(url.port || (url.protocol === 'https:' ? 443 : 80)); } catch { /* optional */ }
    try {
      const configDir = path.resolve(this.root, '..', 'config');
      const candidates = readdirSync(configDir, { withFileTypes: true }).filter((item) => item.isFile() && /^onebot_\d+\.json$/.test(item.name)).map((item) => ({ path: path.join(configDir, item.name), name: item.name, mtime: statSync(path.join(configDir, item.name)).mtimeMs })).sort((a, b) => {
        if (descriptor.botUin) {
          const aMatch = a.name === `onebot_${descriptor.botUin}.json`;
          const bMatch = b.name === `onebot_${descriptor.botUin}.json`;
          if (aMatch !== bMatch) return aMatch ? -1 : 1;
        }
        return b.mtime - a.mtime;
      });
      for (const candidate of candidates) {
        const config = JSON.parse(readFileSync(candidate.path, 'utf8')) as { networks?: { httpServers?: Array<{ port?: number; accessToken?: string }> } };
        const server = config.networks?.httpServers?.find((item) => Number(item.port) === port && item.accessToken);
        if (server?.accessToken) { env.QQPET_ONEBOT_TOKEN = server.accessToken; break; }
      }
    } catch { /* no config yet */ }
    return env;
  }

  private async probeUrl(url: string): Promise<PluginHealth | null> {
    try {
      const response = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(800) });
      if (!response.ok) return null;
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;
      return body?.status === 'ok' ? body as PluginHealth : null;
    } catch { return null; }
  }

  private async waitForStartup(
    descriptor: PluginDescriptor,
    record: ManagedRecord,
  ): Promise<PluginState | null> {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (record.child.exitCode !== null || record.child.killed) return null;
      const current = await this.state(descriptor);
      if (!descriptor.webUrl || current.health || current.instances.some((instance) => instance.health)) {
        return current;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  private async stopManagedRecord(record: ManagedRecord): Promise<void> {
    const child = record.child;
    if (child.exitCode !== null || child.killed) return;
    child.kill('SIGTERM');
    if (await this.waitForChildExit(child, 3000)) return;
    await this.forceTerminateTree(child);
    if (!(await this.waitForChildExit(child, 1000))) {
      throw new Error('插件进程停止超时');
    }
  }

  private async forceTerminateTree(child: ChildProcess): Promise<void> {
    if (process.platform !== 'win32' || !child.pid) {
      child.kill('SIGKILL');
      return;
    }
    await new Promise<void>((resolve) => {
      execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => resolve());
    });
  }

  private async waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
    if (child.exitCode !== null) return true;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(child.exitCode !== null), timeoutMs);
      child.once('exit', () => finish(true));
    });
  }
}
