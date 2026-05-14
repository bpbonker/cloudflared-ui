import { useState } from 'react';
import { Server, Network, CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import Spinner from '../../components/Spinner.jsx';

export default function Step4Target({ data, setData, next, back }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null); // null | true | false
  const t = data.target;

  function setTarget(patch) {
    setData({ target: { ...t, ...patch } });
    setResult(null);
  }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const host = t.kind === 'this-machine' ? 'localhost' : t.host;
      const r = await api.post('/api/setup/test-target', { host, port: t.port });
      setResult(!!r.reachable);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Where is your CloudPanel server?</h2>
        <p className="text-sm text-ink-600">Pick whichever describes your setup.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setTarget({ kind: 'this-machine', host: 'localhost' })}
          className={clsx('card text-left transition', t.kind === 'this-machine' && 'ring-2 ring-brand-500 border-brand-300')}
        >
          <Server className="text-brand-600 mb-2" />
          <div className="font-semibold">This machine</div>
          <div className="text-sm text-ink-600">CloudPanel is on the same server as this app.</div>
        </button>
        <button
          onClick={() => setTarget({ kind: 'remote', host: t.host === 'localhost' ? '' : t.host })}
          className={clsx('card text-left transition', t.kind === 'remote' && 'ring-2 ring-brand-500 border-brand-300')}
        >
          <Network className="text-brand-600 mb-2" />
          <div className="font-semibold">Another device on my network</div>
          <div className="text-sm text-ink-600">CloudPanel runs on a different machine reachable by IP.</div>
        </button>
      </div>

      <div className="card space-y-4">
        {t.kind === 'remote' && (
          <div>
            <label className="label">CloudPanel IP or hostname</label>
            <input
              className="field"
              placeholder="192.168.1.50"
              value={t.host}
              onChange={(e) => setTarget({ host: e.target.value })}
            />
          </div>
        )}
        <div>
          <label className="label">Port</label>
          <input
            type="number"
            className="field max-w-[160px]"
            value={t.port}
            onChange={(e) => setTarget({ port: Number(e.target.value) })}
          />
          <p className="helper">CloudPanel typically listens on <code>80</code> (HTTP), <code>443</code> (HTTPS), and <code>8443</code> (admin UI).</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={test} disabled={testing || (t.kind === 'remote' && !t.host)} className="btn-secondary">
            {testing && <Spinner size={16} />} Test connection
          </button>
          {result === true && <span className="badge-success"><CheckCircle2 size={12}/> Reachable</span>}
          {result === false && <span className="badge-danger"><XCircle size={12}/> Not reachable</span>}
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={back} className="btn-ghost">Back</button>
        <button onClick={next} className="btn-primary">Continue</button>
      </div>
    </div>
  );
}
