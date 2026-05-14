import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import Spinner from '../../components/Spinner.jsx';
import { useToast } from '../../components/Toast.jsx';

export default function Step3Tunnel({ data, setData, next, back }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function create() {
    setBusy(true);
    try {
      const r = await api.post('/api/setup/create-tunnel', { name: data.tunnelName });
      setData({ tunnelId: r.id, tunnelName: r.name });
      toast.success('Tunnel created.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Create a tunnel</h2>
        <p className="text-sm text-ink-600">
          A tunnel is a secure outbound connection from this server to Cloudflare. Once it's up,
          traffic to your subdomains flows through it — no inbound ports needed.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label">Tunnel name</label>
          <input
            className="field"
            value={data.tunnelName}
            onChange={(e) => setData({ tunnelName: e.target.value })}
            disabled={!!data.tunnelId}
          />
          <p className="helper">Letters, numbers, dashes and underscores only.</p>
        </div>

        {data.tunnelId ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
            <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
            <div className="text-sm">
              <div className="font-medium text-emerald-900">Tunnel created.</div>
              <div className="font-mono text-emerald-800 break-all">{data.tunnelId}</div>
            </div>
          </div>
        ) : (
          <button onClick={create} disabled={busy || !data.tunnelName} className="btn-primary w-full sm:w-auto justify-center">
            {busy && <Spinner size={16} />} Create tunnel
          </button>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={back} className="btn-ghost">Back</button>
        <button onClick={next} disabled={!data.tunnelId} className="btn-primary">Continue</button>
      </div>
    </div>
  );
}
