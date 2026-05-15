// Tiny fetch wrapper. Pulls the JWT out of localStorage, sets headers, and
// throws a typed error so callers can `try { ... } catch (e) { toast(e.message) }`.

const KEY = 'cf-ui-token';

export const auth = {
  get token() { return localStorage.getItem(KEY) || ''; },
  set(token) { localStorage.setItem(KEY, token); },
  clear() { localStorage.removeItem(KEY); },
  get isSignedIn() { return !!localStorage.getItem(KEY); },
};

export class ApiError extends Error {
  constructor(message, { status, code, detail } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { message: text }; } })() : {};
  if (res.status === 401 && data.code === 'BAD_TOKEN') {
    auth.clear();
    // Defer the reload a tick so the throw still propagates first.
    setTimeout(() => { window.location.href = '/login?expired=1'; }, 0);
  }
  if (!res.ok) {
    throw new ApiError(data.message || 'Request failed.', { status: res.status, code: data.code, detail: data.detail });
  }
  return data;
}

export const api = {
  get:  (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put:  (p, b) => request('PUT', p, b),
  del:  (p) => request('DELETE', p),
};

// WebSocket-backed log stream. We use WebSockets (not EventSource) because
// they have a proper RFC-6455 close handshake — cloudflared records an
// "unexpected EOF" error every time an SSE long-poll disconnects, since
// SSE just closes the TCP socket. WS closes look like normal completed
// requests to the proxy.
export function openLogStream(onLine) {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${scheme}://${location.host}/api/logs/stream?token=${encodeURIComponent(auth.token)}`;
  const ws = new WebSocket(url);
  ws.addEventListener('message', (ev) => onLine(ev.data));
  // Auto-reconnect on unexpected close. We back off briefly and only
  // re-open if the page hasn't navigated away (the caller's cleanup will
  // run before that and set the flag).
  let closedByCaller = false;
  ws.addEventListener('close', () => {
    if (closedByCaller) return;
    setTimeout(() => {
      // The caller can use the returned function to close cleanly; if we
      // simply reconnect here we'd leak. So we let the LogViewer remount
      // handle reconnects via React's effect lifecycle instead.
    }, 2000);
  });
  return () => {
    closedByCaller = true;
    try { ws.close(1000, 'page-left'); } catch {}
  };
}
