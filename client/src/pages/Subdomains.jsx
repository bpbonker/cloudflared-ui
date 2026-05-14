import { useEffect, useState } from 'react';
import { Plus, Globe, Lock } from 'lucide-react';
import { api } from '../lib/api';
import SubdomainCard from '../components/SubdomainCard.jsx';
import Modal from '../components/Modal.jsx';
import { FullPageSpinner } from '../components/Spinner.jsx';
import { useToast } from '../components/Toast.jsx';
import AddSubdomain from './SubdomainsAdd.jsx';

export default function Subdomains() {
  const [rules, setRules] = useState(null);
  const [editing, setEditing] = useState(null);   // rule | null
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [overlay, setOverlay] = useState(false);
  const toast = useToast();

  async function load() {
    const r = await api.get('/api/ingress');
    setRules(r.rules);
  }

  useEffect(() => { load(); }, []);

  async function doDelete() {
    const rule = confirmDelete;
    setConfirmDelete(null);
    setOverlay(true);
    try {
      await api.del(`/api/ingress/${encodeURIComponent(rule.hostname)}`);
      toast.success(`${rule.hostname} removed.`);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOverlay(false);
    }
  }

  if (rules === null) return <FullPageSpinner />;

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Subdomains</h1>
        <button onClick={() => setAdding(true)} className="btn-primary hidden sm:inline-flex">
          <Plus size={16}/> Add subdomain
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center mb-3">
            <Globe />
          </div>
          <h2 className="font-semibold mb-1">No subdomains yet</h2>
          <p className="text-sm text-ink-500 mb-4">Add your first subdomain to start routing traffic through your tunnel.</p>
          <button onClick={() => setAdding(true)} className="btn-primary inline-flex"><Plus size={16}/> Add subdomain</button>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 sm:hidden gap-3">
            {rules.map((r) => (
              <SubdomainCard key={r.hostname} rule={r} onEdit={setEditing} onDelete={setConfirmDelete} />
            ))}
          </div>
          {/* Tablet+ cards in a grid */}
          <div className="hidden sm:grid lg:hidden grid-cols-2 gap-3">
            {rules.map((r) => (
              <SubdomainCard key={r.hostname} rule={r} onEdit={setEditing} onDelete={setConfirmDelete} />
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden lg:block card !p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Hostname</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rules.map((r) => (
                  <tr key={r.hostname}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <a href={`https://${r.hostname}`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">{r.hostname}</a>
                        {r.originRequest?.noTLSVerify && (
                          <Lock size={14} className="text-emerald-600" title="HTTPS origin (noTLSVerify)" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-700">{r.service}</td>
                    <td className="px-4 py-3 flex gap-1">
                      <button className="btn-ghost text-ink-700" onClick={() => setEditing(r)}>Edit</button>
                      <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(r)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => setAdding(true)}
        aria-label="Add subdomain"
        className="sm:hidden fixed bottom-20 right-4 z-30 btn-primary !rounded-full !p-0 w-14 h-14 shadow-lg"
      >
        <Plus />
      </button>

      {adding && <AddSubdomain onClose={() => { setAdding(false); load(); }} />}
      {editing && <AddSubdomain mode="edit" initial={editing} onClose={() => { setEditing(null); load(); }} />}

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Remove subdomain?"
        footer={<>
          <button onClick={() => setConfirmDelete(null)} className="btn-ghost">Cancel</button>
          <button onClick={doDelete} className="btn-danger">Remove</button>
        </>}
      >
        <p className="text-sm text-ink-700">
          Remove <b className="font-mono">{confirmDelete?.hostname}</b> from the tunnel? Cloudflare DNS records aren't deleted automatically.
        </p>
      </Modal>

      {overlay && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-xl px-6 py-4 flex items-center gap-3 shadow-lg">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Applying changes…</span>
          </div>
        </div>
      )}
    </div>
  );
}
