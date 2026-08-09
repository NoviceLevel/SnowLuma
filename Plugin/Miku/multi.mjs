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

function reportOnce(key, message) {
  if (reportedIssues.has(key)) return;
  reportedIssues.add(key);
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

async function main() {
  const baseWebPort = validateBasePort();
  const baseDataDir = process.env.QQPET_DATA_DIR?.trim();
  const workers = new Map();
  let shuttingDown = false;
  let syncing = false;
  let lastSignature = '';
  let syncTimer;

  function desiredAccounts() {
    const accounts = configuredAccounts();
    if (accounts.length > 0) return accounts;
    reportOnce('fallback', '没有可用的 SnowLuma 账号配置，使用 QQPET_ONEBOT_URL 单账号回退模式');
    return fallbackAccounts();
  }

  function spawnWorker(account, index) {
    const env = {
      ...process.env,
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
      stdio: 'inherit',
      windowsHide: true,
    });
    const record = { account, child, restarts: (workers.get(key)?.restarts ?? 0) };
    workers.set(key, record);
    child.once('error', (error) => {
      reportOnce(`${key}:error:${error.message}`, `账号 ${key} 子进程错误：${error.message}`);
    });
    child.once('exit', (code, signal) => {
      if (workers.get(key)?.child === child) {
        workers.get(key).child = null;
      }
      if (shuttingDown || syncing) return;
      const next = workers.get(key);
      if (next) next.restarts += 1;
      reportOnce(`${key}:exit:${code ?? signal ?? 'unknown'}`, `账号 ${key} 子进程退出（${code ?? signal ?? 'unknown'}），将自动重启`);
      const delay = Math.min(30000, 1000 * (2 ** Math.min(5, next?.restarts ?? 1)));
      setTimeout(() => void syncWorkers(), delay).unref?.();
    });
  }

  async function stopWorkers() {
    const records = [...workers.values()];
    for (const record of records) {
      if (record.child && record.child.exitCode === null) {
        record.child.kill('SIGTERM');
      }
    }
    await Promise.all(records.map((record) => new Promise((resolve) => {
      const child = record.child;
      if (!child || child.exitCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
        resolve();
      }, 5000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    })));
    workers.clear();
  }

  async function syncWorkers() {
    if (shuttingDown || syncing) return;
    syncing = true;
    try {
      const accounts = desiredAccounts();
      const signature = accounts.map(accountKey).join('\n');
      const alive = accounts.every((account) => {
        const child = workers.get(account.uin)?.child;
        return child && child.exitCode === null;
      });
      if (signature === lastSignature && alive) return;
      await stopWorkers();
      accounts.forEach((account, index) => spawnWorker(account, index));
      lastSignature = signature;
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
  await syncWorkers();
  syncTimer = setInterval(() => void syncWorkers(), 5000);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`[Miku] 启动失败：${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { configuredAccounts };
