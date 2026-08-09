import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(pluginDir, 'index.mjs');
const configDir = path.resolve(
  pluginDir,
  process.env.QQPET_CONFIG_DIR?.trim() || '../../config',
);
const primaryUin = process.env.QQPET_BOT_UIN?.trim() || '';

function configuredAccounts() {
  if (!existsSync(configDir)) return [];
  return readdirSync(configDir, { withFileTypes: true })
    .filter((item) => item.isFile() && /^onebot_\d+\.json$/.test(item.name))
    .map((item) => {
      const uin = item.name.slice('onebot_'.length, -'.json'.length);
      try {
        const config = JSON.parse(readFileSync(path.join(configDir, item.name), 'utf8'));
        const server = config.networks?.httpServers?.find((candidate) => (
          candidate && Number.isInteger(Number(candidate.port)) && candidate.accessToken
        ));
        if (!server) return null;
        const host = typeof server.host === 'string' ? server.host : '127.0.0.1';
        const url = new URL(`http://${host}:${Number(server.port)}${server.path || '/'}`);
        return { uin, url: url.toString().replace(/\/$/, ''), token: String(server.accessToken) };
      } catch {
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

const accounts = configuredAccounts();
const fallback = accounts.length > 0
  ? accounts
  : [{
      uin: process.env.QQPET_BOT_UIN?.trim() || 'single',
      url: process.env.QQPET_ONEBOT_URL?.trim() || 'http://127.0.0.1:3000',
      token: process.env.QQPET_ONEBOT_TOKEN || '',
    }];
const baseWebPort = Number(process.env.QQPET_WEB_PORT || 8091);
const baseDataDir = process.env.QQPET_DATA_DIR?.trim();
const workers = [];

for (const [index, account] of fallback.entries()) {
  const env = {
    ...process.env,
    QQPET_ONEBOT_URL: account.url,
    QQPET_ONEBOT_TOKEN: account.token,
    QQPET_WEB_PORT: String(baseWebPort + index),
    QQPET_DESKTOP_BOT_ID: account.uin,
    ...(baseDataDir ? { QQPET_DATA_DIR: path.resolve(pluginDir, baseDataDir, account.uin) } : {}),
  };
  const child = spawn(process.execPath, [entry], {
    cwd: pluginDir,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  workers.push(child);
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of workers) child.kill(signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM');
  await Promise.all(workers.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    setTimeout(resolve, 3000);
  })));
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGHUP', () => void shutdown('SIGTERM'));

await Promise.all(workers.map((child) => new Promise((resolve) => {
  child.once('exit', (code) => {
    if (!shuttingDown && code !== 0) process.exitCode = code ?? 1;
    resolve();
  });
})));
