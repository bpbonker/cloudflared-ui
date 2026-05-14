import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Cloud, Eye, EyeOff } from 'lucide-react';
import { api, auth } from '../lib/api';
import { useToast } from '../components/Toast.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const toast = useToast();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post('/api/auth/login', { username, password });
      auth.set(r.token);
      const next = params.get('next') || '/dashboard';
      navigate(next, { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-ink-50 to-brand-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-200">
            <Cloud size={28} />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-center mb-2">Cloudflare Tunnel Manager</h1>
        <p className="text-sm text-ink-500 text-center mb-6">Sign in to manage your tunnel.</p>

        {params.get('expired') && (
          <div className="card border-amber-200 bg-amber-50 text-amber-900 text-sm mb-4">
            Your session expired. Please sign in again.
          </div>
        )}

        <form className="card flex flex-col gap-4" onSubmit={submit}>
          <div>
            <label className="label">Username</label>
            <input className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                className="field pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-500" aria-label="Toggle password visibility">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button disabled={loading} className="btn-primary w-full justify-center">
            {loading && <Spinner size={16} />} Sign in
          </button>
          <p className="text-xs text-ink-500 text-center">
            Default credentials are configured in <code className="font-mono">.env</code>. Change them under Settings after first login.
          </p>
        </form>
      </div>
    </div>
  );
}
