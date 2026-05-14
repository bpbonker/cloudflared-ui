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

// SSE helper for the Logs page. EventSource can't send custom headers so we
// pass the token via query string; the server re-verifies it.
export function openLogStream(onLine) {
  const es = new EventSource(`/api/logs/stream?token=${encodeURIComponent(auth.token)}`);
  es.onmessage = (ev) => onLine(ev.data);
  return () => es.close();
}
