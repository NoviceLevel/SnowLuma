import net from 'net';

function isPortAvailable(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    let settled = false;
    const finalize = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try {
        server.close(() => resolve(ok));
      } catch {
        resolve(ok);
      }
    };
    server.once('error', () => finalize(false));
    server.once('listening', () => finalize(true));
    try {
      server.listen(port, host);
    } catch {
      finalize(false);
    }
  });
}

/**
 * Verify the requested TCP port is available. Ports are never incremented:
 * the WebUI has a fixed endpoint and a collision must be reported.
 */
export async function findAvailablePort(
  start: number,
  options: { maxTries?: number; host?: string } = {},
): Promise<number> {
  const { maxTries = 1, host = '127.0.0.1' } = options;
  let port = Math.max(1, Math.min(65535, Math.trunc(start)));
  if (maxTries < 1 || port > 65535 || !(await isPortAvailable(port, host))) {
    throw new Error(`WebUI port ${String(start)} is already in use or unavailable`);
  }
  return port;
}
