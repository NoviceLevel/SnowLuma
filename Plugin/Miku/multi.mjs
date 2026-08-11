import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(pluginDir, 'index.mjs');
const defaultConfigDir = path.resolve(
  pluginDir,
  process.env.QQPET_CONFIG_DIR?.trim() || '../../config',
);
const defaultPrimaryUin = process.env.QQPET_BOT_UIN?.trim() || '';
const reportedIssues = new Set();

function isSnowLumaManagedLaunch(
  env = process.env,
  hasIpc = typeof process.send === 'function' && process.connected,
) {
  return env.SNOWLUMA_PLUGIN_MANAGED === '1'
    && env.SNOWLUMA_PLUGIN_ID === 'miku'
    && hasIpc;
}

function assertSnowLumaManagedLaunch() {
  if (!isSnowLumaManagedLaunch()) {
    throw new Error('Miku 必须从 SnowLuma 插件页面启动，禁止直接运行 multi.mjs、index.mjs 或启动脚本');
  }
}

function reportOnce(key, message) {
  if (reportedIssues.has(key)) return;
  reportedIssues.add(key);
  process.stderr.write(`[Miku] ${message}\n`);
}

function report(message) {
  process.stderr.write(`[Miku] ${message}\n`);
}

function isValidPort(value) {
  const port = Number(value);
  return Number.isSafeInteger(port) && port >= 1 && port <= 65535;
}

function configuredAccounts(configDir = defaultConfigDir, primaryUin = defaultPrimaryUin) {
  if (!existsSync(configDir)) return [];
  return readdirSync(configDir, { withFileTypes: true })
    .filter((item) => item.isFile() && /^onebot_\d+\.json$/.test(item.name))
    .map((item) => {
      const uin = item.name.slice('onebot_'.length, -'.json'.length);
      const configPath = path.join(configDir, item.name);
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        const server = config.networks?.httpServers?.find((candidate) => (
          candidate && candidate.enabled !== false
          && isValidPort(candidate.port)
        ));
        if (!server) {
          reportOnce(`${configPath}:server`, `跳过 ${item.name}：没有启用且端口有效的 HTTP Server`);
          return null;
        }
        const host = typeof server.host === 'string' && server.host.trim()
          ? server.host.trim()
          : '127.0.0.1';
        const urlHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
        const url = new URL(`http://${urlHost}:${Number(server.port)}${server.path || '/'}`);
        const token = typeof server.accessToken === 'string' ? server.accessToken.trim() : '';
        return { uin, url: url.toString().replace(/\/$/, ''), token };
      } catch (error) {
        reportOnce(`${configPath}:parse`, `跳过 ${item.name}：配置解析失败（${error instanceof Error ? error.message : String(error)}）`);
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (primaryUin) {
        if (a.uin === primaryUin) return -1;
        if (b.uin === primaryUin) return 1;
      }
      return a.uin.localeCompare(b.uin);
    });
}

function fallbackAccounts() {
  return [{
    uin: process.env.QQPET_BOT_UIN?.trim() || 'single',
    url: process.env.QQPET_ONEBOT_URL?.trim() || 'http://127.0.0.1:3000',
    token: process.env.QQPET_ONEBOT_TOKEN?.trim() || '',
  }];
}

function accountKey(account) {
  return `${account.uin}|${account.url}|${account.token}`;
}

function validateBasePort() {
  const value = Number(process.env.QQPET_WEB_PORT || 8091);
  if (!Number.isSafeInteger(value) || value < 1 || value > 65535) {
    throw new Error('QQPET_WEB_PORT 必须是 1～65535 的端口');
  }
  return value;
}

function waitForExit(child, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  assertSnowLumaManagedLaunch();
  const baseWebPort = validateBasePort();
  const baseDataDir = process.env.QQPET_DATA_DIR?.trim();
  /** @type {Map<string, { account: any, child: import('node:child_process').ChildProcess | null, restarts: number, index: number, key: string, restartTimer?: NodeJS.Timeout }>} */
  const workers = new Map();
  let shuttingDown = false;
  let syncing = false;
  let syncTimer;

  function desiredAccounts() {
    const accounts = configuredAccounts();
    if (accounts.length > 0) return accounts;
    reportOnce('fallback', '没有可用的 SnowLuma 账号配置，使用 QQPET_ONEBOT_URL 单账号回退模式');
    return fallbackAccounts();
  }

  function clearRestartTimer(record) {
    if (record?.restartTimer) {
      clearTimeout(record.restartTimer);
      record.restartTimer = undefined;
    }
  }

  function spawnWorker(account, index, restarts = 0) {
    const existing = workers.get(account.uin);
    clearRestartTimer(existing);
    const env = {
      ...process.env,
      SNOWLUMA_PLUGIN_MANAGED: '',
      SNOWLUMA_PLUGIN_WORKER: '1',
      QQPET_ONEBOT_URL: account.url,
      QQPET_ONEBOT_TOKEN: account.token,
      QQPET_WEB_PORT: String(baseWebPort + index),
      QQPET_DESKTOP_BOT_ID: account.uin,
      ...(baseDataDir ? { QQPET_DATA_DIR: path.resolve(pluginDir, baseDataDir, account.uin) } : {}),
    };
    const key = account.uin;
    const child = spawn(process.execPath, [entry], {
      cwd: pluginDir,
      env,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      windowsHide: true,
    });
    const record = {
      account,
      child,
      restarts,
      index,
      key: accountKey(account),
    };
    workers.set(key, record);
    child.once('error', (error) => {
      report(`账号 ${key} 子进程错误：${error.message}`);
    });
    child.once('exit', (code, signal) => {
      const current = workers.get(key);
      if (!current || current.child !== child) return;
      current.child = null;
      // Still schedule a solo restart while syncing; spawnWorker clears any pending timer.
      if (shuttingDown) return;
      current.restarts += 1;
      const delay = Math.min(30000, 1000 * (2 ** Math.min(5, current.restarts)));
      report(`账号 ${key} 子进程退出（${code ?? signal ?? 'unknown'}），${delay}ms 后单独重启（第 ${current.restarts} 次）`);
      clearRestartTimer(current);
      current.restartTimer = setTimeout(() => {
        if (shuttingDown) return;
        const latest = workers.get(key);
        if (!latest || latest.child) return;
        const accounts = desiredAccounts();
        const nextIndex = accounts.findIndex((item) => item.uin === key);
        if (nextIndex < 0) {
          workers.delete(key);
          return;
        }
        const nextAccount = accounts[nextIndex];
        spawnWorker(nextAccount, nextIndex, latest.restarts);
      }, delay);
      current.restartTimer.unref?.();
    });
  }

  async function stopWorker(uin, { remove = true } = {}) {
    const record = workers.get(uin);
    if (!record) return;
    clearRestartTimer(record);
    const child = record.child;
    if (remove) workers.delete(uin);
    else record.child = null;
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await waitForExit(child, 5000);
    }
  }

  async function stopWorkers() {
    const uins = [...workers.keys()];
    await Promise.all(uins.map((uin) => stopWorker(uin)));
  }

  async function syncWorkers() {
    if (shuttingDown || syncing) return;
    syncing = true;
    try {
      const accounts = desiredAccounts();
      const desiredUins = new Set(accounts.map((account) => account.uin));

      for (const uin of [...workers.keys()]) {
        if (!desiredUins.has(uin)) {
          report(`账号 ${uin} 已从配置中移除，停止对应工作进程`);
          await stopWorker(uin);
        }
      }

      for (let index = 0; index < accounts.length; index += 1) {
        const account = accounts[index];
        const record = workers.get(account.uin);
        const nextKey = accountKey(account);
        const alive = Boolean(record?.child && record.child.exitCode === null);
        const sameConfig = record?.key === nextKey;
        const samePort = record?.index === index;

        if (alive && sameConfig && samePort) {
          continue;
        }

        if (record) {
          const reason = !sameConfig
            ? '配置变更'
            : !samePort
              ? `端口序号调整（${record.index}→${index}）`
              : '进程未运行';
          if (alive || record.child) {
            report(`账号 ${account.uin} ${reason}，仅重启该账号`);
          }
          await stopWorker(account.uin);
        }

        spawnWorker(account, index, record?.restarts ?? 0);
      }
    } finally {
      syncing = false;
    }
  }

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(syncTimer);
    await stopWorkers();
    process.exit(0);
  }

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGHUP', () => void shutdown());
  process.once('disconnect', () => void shutdown());
  await syncWorkers();
  syncTimer = setInterval(() => void syncWorkers(), 5000);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`[Miku] 启动失败：${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { accountKey, configuredAccounts, isSnowLumaManagedLaunch };
