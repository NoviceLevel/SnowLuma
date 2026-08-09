import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WebuiAuth } from '../src/webui/auth';

describe('WebuiAuth bootstrap credentials', () => {
  it('keeps an unrotated bootstrap password valid across restarts', () => {
    const previousCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snowluma-auth-'));
    try {
      process.chdir(tempDir);
      const first = WebuiAuth.load();
      const password = first.takeInitialPassword();
      expect(password).toBeTruthy();

      const beforeRestart = fs.readFileSync(path.join('config', 'webui.json'), 'utf8');
      const second = WebuiAuth.load();

      expect(second.takeInitialPassword()).toBeNull();
      expect(second.mustChangePassword()).toBe(true);
      expect(second.verify(password!)).toBe(true);
      expect(fs.readFileSync(path.join('config', 'webui.json'), 'utf8')).toBe(beforeRestart);
    } finally {
      process.chdir(previousCwd);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
