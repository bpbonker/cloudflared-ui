import { useEffect, useState } from 'react';
import { Github, AlertTriangle, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { api, auth } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import Spinner, { FullPageSpinner } from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import TokenPermissionsHelper from '../components/TokenPermissionsHelper.jsx';

export default function Settings() {
  const [s, setS] = useState(null);
  const [target, setTarget] = useState({ host: '', port: 80 });
  const [creds, setCreds] = useState({ apiToken: '', accountId: '' });
  const [tunnel, setTunnel] = useState({ name: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  async function load() {
    const r = await api.get('/api/settings');
    setS(r);
    setTarget(r.target);
    setCreds({ apiToken: '', accountId: r.cloudflare.accountId || '' });
    setTunnel({ name: r.tunnel.name || '' });
  }
  useEffect(() => { load(); }, []);

  async function saveTarget() {
    try {
      await api.put('/api/settings/target', target);
      toast.success('Target saved.');
    } catch (err) { toast.error(err.message); }
  }

  async function testTarget() {
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch(`/api/target/test?host=${encodeURIComponent(target.host)}&port=${target.port}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      }).then((r) => r.json());
      setTestResult(!!r.reachable);
    } finally { setTesting(false); }
  }

  async function saveCreds() {
    try {
      await api.put('/api/settings/credentials', creds);
      toast.success('Credentials updated.');
      setCreds({ apiToken: '', accountId: creds.accountId });
      load();
    } catch (err) { toast.error(err.message); }
  }

  async function savePassword() {
    if (pw.newPassword !== pw.confirm) { toast.error('New passwords don\'t match.'); return; }
    if (pw.newPassword.length < 8) { toast.error('New password must be at least 8 characters.'); return; }
    try {
      await api.put('/api/settings/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast.success('Password updated.');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(err.message); }
  }

  async function saveTunnel() {
    try {
      await api.put('/api/settings/tunnel', tunnel);
      toast.success('Tunnel name updated.');
      load();
    } catch (err) { toast.error(err.message); }
  }

  async function uninstall() {
    setConfirmUninstall(false);
    try {
      await api.post('/api/service/uninstall');
      toast.success('Service uninstalled.');
      navigate('/setup', { replace: true });
    } catch (err) { toast.error(err.message); }
  }

  async function deleteTunnel() {
    setConfirmDelete(false);
    try {
      await api.del('/api/settings/tunnel');
      toast.success('Tunnel deleted.');
      navigate('/setup', { replace: true });
    } catch (err) { toast.error(err.message); }
  }

  if (!s) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="card space-y-4">
        <header>
          <h2 className="font-semibold">CloudPanel target</h2>
          <p className="text-sm text-ink-500">Where the tunnel should send traffic by default.</p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Host</label>
            <input className="field" value={target.host} onChange={(e) => setTarget({ ...target, host: e.target.value })} />
          </div>
          <div>
            <label className="label">Port</label>
            <input type="number" className="field" value={target.port} onChange={(e) => setTarget({ ...target, port: Number(e.target.value) })} />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={saveTarget} className="btn-primary">Save target</button>
          <button onClick={testTarget} disabled={testing} className="btn-secondary">
            {testing && <Spinner size={16}/>} Test connection
          </button>
          {testResult === true && <span className="badge-success"><CheckCircle2 size={12}/> Reachable</span>}
          {testResult === false && <span className="badge-danger"><XCircle size={12}/> Not reachable</span>}
        </div>
      </section>

      <section className="card space-y-4">
        <header>
          <h2 className="font-semibold">Cloudflare credentials</h2>
          <p className="text-sm text-ink-500">
            Current token: {s.cloudflare.hasToken ? <span className="font-mono">{s.cloudflare.tokenHint}</span> : <span className="text-amber-700">not set</span>}
          </p>
        </header>
        <TokenPermissionsHelper />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">New API Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                className="field pr-10 font-mono"
                value={creds.apiToken}
                onChange={(e) => setCreds({ ...creds, apiToken: e.target.value })}
                placeholder="Leave blank to keep current"
              />
              <button type="button" onClick={() => setShowToken((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-500">
                {showToken ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Account ID</label>
            <input className="field font-mono" value={creds.accountId} onChange={(e) => setCreds({ ...creds, accountId: e.target.value })} />
          </div>
        </div>
        <button onClick={saveCreds} disabled={!creds.apiToken} className="btn-primary">Verify & save</button>
      </section>

      <section className="card space-y-4">
        <header>
          <h2 className="font-semibold">Tunnel</h2>
          <p className="text-sm text-ink-500">Tunnel ID: <span className="font-mono">{s.tunnel.id || '—'}</span></p>
        </header>
        <div>
          <label className="label">Tunnel name (display only)</label>
          <input className="field" value={tunnel.name} onChange={(e) => setTunnel({ name: e.target.value })} />
        </div>
        <button onClick={saveTunnel} className="btn-primary">Save name</button>
      </section>

      <section className="card space-y-4" id="password">
        <header>
          <h2 className="font-semibold flex items-center gap-2">
            Admin password
            {s.usingDefaultPassword && <span className="badge-warn">Default in use</span>}
          </h2>
          {s.usingDefaultPassword && (
            <p className="text-sm text-amber-800 mt-1">
              You're still on the default password from <code>.env</code>. Change it to lock down access.
            </p>
          )}
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Current</label>
            <input type="password" className="field" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" />
          </div>
          <div>
            <label className="label">New</label>
            <input type="password" className="field" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirm</label>
            <input type="password" className="field" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
          </div>
        </div>
        <button onClick={savePassword} disabled={!pw.currentPassword || !pw.newPassword} className="btn-primary">Update password</button>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">About</h2>
        <p className="text-sm text-ink-600">App version <span className="font-mono">{s.appVersion}</span></p>
        <a href="https://github.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline">
          <Github size={16}/> View on GitHub
        </a>
      </section>

      <section className="card border-red-200">
        <h2 className="font-semibold text-red-700 mb-1 flex items-center gap-2"><AlertTriangle size={16}/> Danger zone</h2>
        <p className="text-sm text-ink-600 mb-4">These actions can take your subdomains offline. Be careful.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => setConfirmDelete(true)} className="btn-danger">Delete tunnel</button>
          <button onClick={() => setConfirmUninstall(true)} className="btn-danger">Uninstall cloudflared service</button>
        </div>
      </section>

      <Modal open={confirmUninstall} onClose={() => setConfirmUninstall(false)} title="Uninstall cloudflared service?"
        footer={<>
          <button onClick={() => setConfirmUninstall(false)} className="btn-ghost">Cancel</button>
          <button onClick={uninstall} className="btn-danger">Uninstall</button>
        </>}
      >
        <p className="text-sm text-ink-700">This stops the systemd service and unregisters cloudflared from boot. Your tunnel config is kept; you can reinstall later from this app.</p>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete tunnel?"
        footer={<>
          <button onClick={() => setConfirmDelete(false)} className="btn-ghost">Cancel</button>
          <button onClick={deleteTunnel} className="btn-danger">Delete tunnel</button>
        </>}
      >
        <p className="text-sm text-ink-700">
          Permanently delete tunnel <b className="font-mono">{s.tunnel.name}</b>? All subdomains will stop working. You'll need to run setup again.
        </p>
      </Modal>
    </div>
  );
}
