import { useState } from 'react';
import { Plus, Trash2, Lock, Globe2 } from 'lucide-react';

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export default function Step5Subdomains({ data, setData, next, back }) {
  const t = data.target;
  const host = t.kind === 'this-machine' ? 'localhost' : t.host;
  const [draft, setDraft] = useState({
    hostname: '',
    port: data.target.port,
    httpsOrigin: false,
    createDns: true,
  });

  function buildRule(d) {
    const port = d.httpsOrigin ? 443 : Number(d.port);
    const service = d.httpsOrigin ? `https://${host}:443` : `http://${host}:${port}`;
    const rule = {
      hostname: d.hostname.trim().toLowerCase(),
      port,
      service,
    };
    if (d.httpsOrigin) {
      rule.originRequest = { noTLSVerify: true, originServerName: rule.hostname };
    }
    return rule;
  }

  function add() {
    if (!HOSTNAME_RE.test(draft.hostname)) return;
    setData({ hostnames: [...data.hostnames, buildRule(draft)] });
    setDraft({ hostname: '', port: t.port, httpsOrigin: draft.httpsOrigin, createDns: draft.createDns });
  }

  function remove(i) {
    setData({ hostnames: data.hostnames.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Add your first subdomain</h2>
        <p className="text-sm text-ink-600">
          For each subdomain you list, we'll create a Cloudflare DNS record pointing to your tunnel
          and write a matching ingress rule so the traffic reaches your server.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label">Subdomain</label>
          <input
            className="field"
            placeholder="app1.example.com"
            value={draft.hostname}
            onChange={(e) => setDraft({ ...draft, hostname: e.target.value })}
          />
          {draft.hostname && !HOSTNAME_RE.test(draft.hostname) && (
            <p className="helper text-red-600">That doesn't look like a valid hostname yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.httpsOrigin}
              onChange={(e) => setDraft({ ...draft, httpsOrigin: e.target.checked })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-sm flex items-center gap-2">
                {draft.httpsOrigin ? <Lock size={14} className="text-emerald-600"/> : <Globe2 size={14} className="text-ink-500"/>}
                Origin uses HTTPS (CloudPanel / self-signed)
              </div>
              <p className="text-xs text-ink-500 mt-1">
                Recommended for CloudPanel sites because the default vhost forces HTTP → HTTPS.
                We'll send the right SNI and skip cert verification.
              </p>
            </div>
          </label>
        </div>

        {!draft.httpsOrigin && (
          <div>
            <label className="label">Target port</label>
            <input
              type="number"
              className="field max-w-[160px]"
              value={draft.port}
              onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) })}
            />
          </div>
        )}

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.createDns}
            onChange={(e) => setDraft({ ...draft, createDns: e.target.checked })}
            className="mt-1"
          />
          <span>Automatically create the DNS record in Cloudflare.</span>
        </label>

        <div className="rounded-lg bg-ink-900 text-ink-200 font-mono text-xs p-3 overflow-x-auto">
          <div className="text-ink-500"># ingress rule that will be added</div>
          <div>- hostname: <span className="text-brand-300">{draft.hostname || 'app1.example.com'}</span></div>
          <div>  service: <span className="text-emerald-300">
            {draft.httpsOrigin
              ? `https://${host}:443`
              : `http://${host}:${draft.port || t.port}`}
          </span></div>
          {draft.httpsOrigin && (
            <>
              <div>  originRequest:</div>
              <div>    noTLSVerify: <span className="text-amber-300">true</span></div>
              <div>    originServerName: <span className="text-brand-300">{draft.hostname || 'app1.example.com'}</span></div>
            </>
          )}
        </div>

        <button
          onClick={add}
          disabled={!HOSTNAME_RE.test(draft.hostname)}
          className="btn-secondary"
        >
          <Plus size={16} /> Add another
        </button>
      </div>

      {data.hostnames.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3">Subdomains to add ({data.hostnames.length})</h3>
          <ul className="divide-y divide-ink-100">
            {data.hostnames.map((h, i) => (
              <li key={h.hostname} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {h.hostname}
                    {h.originRequest?.noTLSVerify && <Lock size={12} className="text-emerald-600" title="HTTPS origin"/>}
                  </div>
                  <div className="text-xs text-ink-500 font-mono truncate">{h.service}</div>
                </div>
                <button onClick={() => remove(i)} className="btn-ghost text-red-600">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={back} className="btn-ghost">Back</button>
        <button onClick={next} disabled={data.hostnames.length === 0} className="btn-primary">
          Continue
        </button>
      </div>
    </div>
  );
}
