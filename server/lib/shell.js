// Thin wrapper around child_process so route handlers don't sprinkle exec
// callbacks. Returns a uniform { ok, stdout, stderr, code } shape and never
// throws; route code can branch on `ok` without try/catch noise.
//
// In MOCK_MODE every call resolves to a canned response. That lets the UI run
// on a dev box that doesn't have cloudflared/systemctl installed (e.g. a
// Windows laptop) without the routes lying about success.

const { exec, spawn } = require('node:child_process');

const MOCK = process.env.MOCK_MODE === 'true';

const mockResponses = {
  // crude regex -> response table; matched in order
  patterns: [
    { re: /cloudflared\s+--version/, stdout: 'cloudflared version 2024.10.0 (mock)\n' },
    { re: /cloudflared\s+tunnel\s+create\s+(\S+)/, stdout: (m) =>
        `Tunnel credentials written to /etc/cloudflared/00000000-0000-0000-0000-000000000000.json.\nCreated tunnel ${m[1]} with id 00000000-0000-0000-0000-000000000000\n` },
    { re: /cloudflared\s+tunnel\s+list/, stdout: 'ID                                   NAME              CREATED\n00000000-0000-0000-0000-000000000000 cloudpanel-tunnel 2024-01-01\n' },
    { re: /cloudflared\s+service\s+install/, stdout: 'cloudflared service installed (mock)\n' },
    { re: /cloudflared\s+service\s+uninstall/, stdout: 'cloudflared service uninstalled (mock)\n' },
    { re: /systemctl\s+(start|stop|restart|enable|disable)\s+cloudflared/, stdout: '' },
    { re: /systemctl\s+is-active\s+cloudflared/, stdout: 'active\n' },
    { re: /systemctl\s+show\s+cloudflared/, stdout: 'ActiveState=active\nSubState=running\nActiveEnterTimestamp=Mon 2024-01-01 12:00:00 UTC\n' },
  ],
};

function mockRun(cmd) {
  for (const p of mockResponses.patterns) {
    const m = cmd.match(p.re);
    if (m) {
      const stdout = typeof p.stdout === 'function' ? p.stdout(m) : p.stdout;
      return Promise.resolve({ ok: true, stdout, stderr: '', code: 0 });
    }
  }
  return Promise.resolve({ ok: true, stdout: `(mock) ${cmd}\n`, stderr: '', code: 0 });
}

function run(cmd, { timeout = 30000 } = {}) {
  if (MOCK) return mockRun(cmd);
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          ok: false,
          stdout: stdout?.toString() || '',
          stderr: stderr?.toString() || err.message,
          code: typeof err.code === 'number' ? err.code : 1,
        });
        return;
      }
      resolve({ ok: true, stdout: stdout.toString(), stderr: stderr.toString(), code: 0 });
    });
  });
}

// Long-running stream (journalctl -f). Returns the child process so the
// caller can wire stdout into an SSE response.
function streamCommand(cmd, args) {
  if (MOCK) {
    // Fake a periodic log line so the Logs page has something to render in dev.
    const { Readable } = require('node:stream');
    const stream = new Readable({ read() {} });
    let i = 0;
    const interval = setInterval(() => {
      i++;
      stream.push(`${new Date().toISOString()} INF (mock) tunnel heartbeat #${i}\n`);
      if (i % 7 === 0) stream.push(`${new Date().toISOString()} WRN (mock) simulated warning\n`);
    }, 1500);
    return {
      stdout: stream,
      stderr: new Readable({ read() {} }),
      kill: () => clearInterval(interval),
    };
  }
  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    stdout: proc.stdout,
    stderr: proc.stderr,
    kill: () => proc.kill(),
  };
}

module.exports = { run, streamCommand, MOCK };
