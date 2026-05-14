import { useEffect, useState } from 'react';
import { Play, Square, RefreshCw, Globe, Clock, AlertTriangle, Plus, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import { useToast } from '../components/Toast.jsx';
import AddSubdomain from './SubdomainsAdd.jsx';

function formatUptime(since) {
  if (!since) return '—';
  const d = new Date(since);
  if (isNaN(d.getTime())) return since;
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [ingress, setIngress] = useState([]);
  const [health, setHealth] = useState(null);
  const [me, setMe] = useState(null);
  const [acting, setActing] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  async function load() {
    try {
      const [s, ing, h, m] = await Promise.all([
        api.get('/api/tunnel/status'),
        api.get('/api/ingress'),
        api.get('/api/system/health'),
        api.get('/api/auth/me'),
      ]);
      setStatus(s);
      setIngress(ing.rules);
      setHealth(h);
      setMe(m);
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  async function act(action) {
    setActing(true);
    try {
      await api.post(`/api/tunnel/${action}`);
      toast.success(`Tunnel ${action}ed.`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActing(false);
    }
  }

  if (!status) return <Spinner />;

  return (
    <div className="space-y-6">
      {me?.usingDefaultPassword && (
        <div className="card border-amber-200 bg-amber-50 text-amber-900 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <KeyRound className="text-amber-600 shrink-0"/>
            <span className="text-sm">You're signed in with the default password. Anyone on the LAN can guess it — change it now.</span>
          </div>
          <Link to="/settings" className="btn-primary">Change password</Link>
        </div>
      )}

      {health && !health.cloudflared.installed && (
        <div className="card border-amber-200 bg-amber-50 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="shrink-0 text-amber-600" />
            <div className="text-sm flex-1">
              <div className="font-semibold mb-1">cloudflared isn't installed on this server.</div>
              <p>Run this on the server, then refresh:</p>
              <div className="mt-2 bg-ink-900 text-ink-100 rounded-lg p-3 font-mono text-xs flex items-start justify-between gap-2">
                <code className="whitespace-pre-wrap break-all">{health.installHint}</code>
                <button onClick={() => { navigator.clipboard.writeText(health.installHint); toast.info('Copied'); }} className="text-xs text-brand-300 shrink-0">Copy</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {status.badge === 'stopped' && (
        <div className="card border-red-200 bg-red-50 text-red-900 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3"><AlertTriangle className="text-red-600"/><span className="text-sm">Your tunnel is stopped. Subdomains won't load until you restart it.</span></div>
          <button onClick={() => act('start')} className="btn-primary"><Play size={16}/> Start tunnel</button>
        </div>
      )}

      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold">{status.tunnel?.name || 'Tunnel'}</h1>
              <StatusBadge status={status.badge} />
            </div>
            <div className="text-xs text-ink-500 font-mono">{status.tunnel?.id}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => act('start')}  disabled={acting || status.badge === 'running'} className="btn-secondary"><Play size={16}/> Start</button>
            <button onClick={() => setConfirmStop(true)} disabled={acting || status.badge !== 'running'} className="btn-secondary"><Square size={16}/> Stop</button>
            <button onClick={() => act('restart')} disabled={acting} className="btn-primary"><RefreshCw size={16}/> Restart</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-1 text-ink-500"><span className="text-xs uppercase tracking-wide">Subdomains</span><Globe size={16}/></div>
          <div className="text-2xl font-semibold">{ingress.length}</div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-1 text-ink-500"><span className="text-xs uppercase tracking-wide">Uptime</span><Clock size={16}/></div>
          <div className="text-2xl font-semibold">{formatUptime(status.activeSince)}</div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-1 text-ink-500"><span className="text-xs uppercase tracking-wide">Last start</span><Clock size={16}/></div>
          <div className="text-sm font-medium truncate">{status.activeSince || '—'}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold">Quick add subdomain</h2>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16}/> Add subdomain</button>
        </div>
        <p className="text-sm text-ink-500">Need to manage existing subdomains? <button className="text-brand-600 hover:underline" onClick={() => navigate('/subdomains')}>Open Subdomains →</button></p>
      </div>

      <Modal open={confirmStop} onClose={() => setConfirmStop(false)} title="Stop the tunnel?"
        footer={<>
          <button onClick={() => setConfirmStop(false)} className="btn-ghost">Cancel</button>
          <button onClick={() => { setConfirmStop(false); act('stop'); }} className="btn-danger">Stop tunnel</button>
        </>}
      >
        <p className="text-sm text-ink-700">All your subdomains will go offline until you start the tunnel again. Continue?</p>
      </Modal>

      {showAdd && <AddSubdomain onClose={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}
