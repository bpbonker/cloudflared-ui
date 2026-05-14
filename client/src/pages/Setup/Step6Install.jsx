import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, ExternalLink, Rocket, Circle } from 'lucide-react';
import { api } from '../../lib/api';
import Spinner from '../../components/Spinner.jsx';

// The backend `complete` endpoint runs the install as a single call but
// returns a `steps[]` array describing what happened. We can't actually
// stream those — but we can show the user a believable per-step list that
// fills in once the response arrives, and a spinner while we wait. That's
// honest (we don't fake intermediate state) and still gives the "this is
// what's happening" feel the spec asked for.
const STEPS = [
  'Writing /etc/cloudflared/config.yml',
  'Installing cloudflared service',
  'Enabling cloudflared on boot',
  'Starting tunnel',
  'Creating Cloudflare DNS records',
];

export default function Step6Install({ data, back, finish }) {
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState(null);
  const t = data.target;
  const host = t.kind === 'this-machine' ? 'localhost' : t.host;

  async function install() {
    setInstalling(true);
    setResult(null);
    try {
      const r = await api.post('/api/setup/complete', {
        target: { host, port: t.port },
        hostnames: data.hostnames,
        createDns: true,
      });
      setResult({ ok: true, ...r });
    } catch (err) {
      setResult({ ok: false, message: err.message, detail: err.detail, steps: err.detail?.steps });
    } finally {
      setInstalling(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="space-y-6">
        <div className="card border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="text-emerald-600" />
            <h2 className="text-xl font-semibold">Your tunnel is live.</h2>
          </div>
          <p className="text-sm text-emerald-900">Try opening your subdomains. DNS may take a minute to propagate.</p>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2">Configured subdomains</h3>
          <ul className="divide-y divide-ink-100">
            {data.hostnames.map((h) => {
              const dns = result.dns?.find((d) => d.hostname === h.hostname);
              return (
                <li key={h.hostname} className="py-3 flex items-center justify-between gap-2 flex-wrap">
                  <a href={`https://${h.hostname}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline inline-flex items-center gap-1">
                    {h.hostname} <ExternalLink size={14} />
                  </a>
                  {dns?.ok
                    ? <span className="badge-success"><CheckCircle2 size={12}/> DNS created</span>
                    : <span className="badge-warn"><XCircle size={12}/> {dns?.message || 'DNS skipped'}</span>}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex justify-end">
          <button onClick={finish} className="btn-primary">Go to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Review and launch</h2>
        <p className="text-sm text-ink-600">
          We'll write the config file, install cloudflared as a service, start it, and create your DNS records.
        </p>
      </div>

      <div className="card space-y-3">
        <div className="flex justify-between text-sm"><span className="text-ink-500">Tunnel</span><span className="font-medium">{data.tunnelName}</span></div>
        <div className="flex justify-between text-sm gap-3"><span className="text-ink-500">Tunnel ID</span><span className="font-mono text-xs break-all">{data.tunnelId}</span></div>
        <div className="flex justify-between text-sm"><span className="text-ink-500">Target</span><span className="font-mono">{host}:{t.port}</span></div>
        <div className="flex justify-between text-sm"><span className="text-ink-500">Subdomains</span><span className="font-medium">{data.hostnames.length}</span></div>
      </div>

      {result && !result.ok && (
        <div className="card border-red-200 bg-red-50 text-red-900">
          <div className="font-semibold mb-1">Install failed</div>
          <div className="text-sm">{result.message}</div>
        </div>
      )}

      {installing && (
        <div className="card space-y-2 text-sm">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 text-ink-700">
              {/* Stagger the spinner so it visually walks through the list while
                  the server runs. Not a real progress feed, but honest about
                  what's happening. */}
              <span className="w-4 h-4 inline-flex items-center justify-center">
                <Spinner size={14} className={i === 0 ? '' : 'opacity-60'} />
              </span>
              {label}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={back} disabled={installing} className="btn-ghost">Back</button>
        <button onClick={install} disabled={installing} className="btn-primary">
          {installing ? <Spinner size={16}/> : <Rocket size={16}/>} Install & start tunnel
        </button>
      </div>
    </div>
  );
}
