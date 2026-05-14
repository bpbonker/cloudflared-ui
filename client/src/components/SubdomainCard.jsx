import { ExternalLink, Pencil, Trash2, CheckCircle2, XCircle, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function SubdomainCard({ rule, onEdit, onDelete }) {
  const [dns, setDns] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/dns/verify/${encodeURIComponent(rule.hostname)}`)
      .then((r) => !cancelled && setDns(r))
      .catch(() => !cancelled && setDns({ exists: false, error: 'unknown' }));
    return () => { cancelled = true; };
  }, [rule.hostname]);

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{rule.hostname}</h3>
            {rule.originRequest?.noTLSVerify && (
              <Lock size={14} className="text-emerald-600 shrink-0" title="HTTPS origin (noTLSVerify)" />
            )}
            <a
              href={`https://${rule.hostname}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-400 hover:text-brand-600 shrink-0"
              aria-label={`Open ${rule.hostname} in new tab`}
            >
              <ExternalLink size={16} />
            </a>
          </div>
          <div className="text-sm text-ink-600 font-mono truncate">{rule.service}</div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          {dns === null && <span className="badge-muted">Checking DNS…</span>}
          {dns && dns.exists && (
            <span className="badge-success"><CheckCircle2 size={12} /> DNS configured</span>
          )}
          {dns && !dns.exists && (
            <span className="badge-warn"><XCircle size={12} /> DNS missing</span>
          )}
        </div>
        <div className="flex gap-1">
          <button className="btn-ghost text-ink-600" onClick={() => onEdit(rule)} aria-label="Edit">
            <Pencil size={16} /> Edit
          </button>
          <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => onDelete(rule)} aria-label="Delete">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
