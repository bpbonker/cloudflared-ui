import { useEffect, useState } from 'react';
import { Lock, Globe2, Info } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import { useToast } from '../components/Toast.jsx';

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

// Returns the originRequest object we attach to ingress rules when the user
// turns on "Origin uses HTTPS." We always pin originServerName to the public
// hostname — without it, cloudflared sends SNI=`localhost` and CloudPanel's
// nginx replies "unrecognized name" (502).
function buildHttpsOriginRequest(hostname) {
  return { noTLSVerify: true, originServerName: hostname };
}

// Detects whether an existing rule is in HTTPS-origin mode so the edit form
// can pre-fill the toggle correctly.
function isHttpsOrigin(rule) {
  return !!(rule?.service?.startsWith('https://') && rule?.originRequest?.noTLSVerify);
}

export default function SubdomainsAdd({ onClose, initial, mode = 'create' }) {
  const [target, setTarget] = useState({ host: 'localhost', port: 80 });
  const [hostname, setHostname] = useState(initial?.hostname || '');
  const [httpsOrigin, setHttpsOrigin] = useState(isHttpsOrigin(initial));
  const [serviceUrl, setServiceUrl] = useState(initial?.service || '');
  const [createDns, setCreateDns] = useState(true);
  const [override, setOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/api/settings').then((r) => {
      setTarget(r.target);
      if (!serviceUrl) {
        setServiceUrl(httpsOrigin ? `https://${r.target.host}:443` : `http://${r.target.host}:${r.target.port}`);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the user toggles HTTPS-origin, swap the URL to the matching default
  // unless they've manually typed something other than our autofills.
  function toggleHttps(next) {
    setHttpsOrigin(next);
    const autoHttp  = `http://${target.host}:${target.port}`;
    const autoHttps = `https://${target.host}:443`;
    if (!serviceUrl || serviceUrl === autoHttp || serviceUrl === autoHttps) {
      setServiceUrl(next ? autoHttps : autoHttp);
    }
  }

  const valid = HOSTNAME_RE.test(hostname) && /^https?:\/\//.test(serviceUrl);

  async function submit() {
    setSubmitting(true);
    try {
      const body = {
        service: serviceUrl,
        originRequest: httpsOrigin ? buildHttpsOriginRequest(hostname) : null,
      };
      if (mode === 'edit') {
        await api.put(`/api/ingress/${encodeURIComponent(hostname)}`, body);
        toast.success('Subdomain updated.');
      } else {
        await api.post('/api/ingress', { hostname, createDns, override, ...body });
        toast.success('Subdomain added.');
      }
      onClose?.();
    } catch (err) {
      if (err.status === 409 && err.message.includes('DNS')) {
        toast.warn(err.message + ' Toggle override and try again.');
        setOverride(true);
      } else {
        toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={submitting ? undefined : onClose}
      title={mode === 'edit' ? 'Edit subdomain' : 'Add subdomain'}
      footer={<>
        <button onClick={onClose} disabled={submitting} className="btn-ghost">Cancel</button>
        <button onClick={submit} disabled={!valid || submitting} className="btn-primary">
          {submitting && <Spinner size={16}/>} {mode === 'edit' ? 'Save changes' : 'Add subdomain'}
        </button>
      </>}
    >
      <div className="space-y-4">
        <div>
          <label className="label">Hostname</label>
          <input
            className="field"
            placeholder="app1.example.com"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            disabled={mode === 'edit'}
          />
          {hostname && !HOSTNAME_RE.test(hostname) && (
            <p className="helper text-red-600">Doesn't look like a valid hostname yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={httpsOrigin}
              onChange={(e) => toggleHttps(e.target.checked)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-sm flex items-center gap-2">
                {httpsOrigin ? <Lock size={14} className="text-emerald-600"/> : <Globe2 size={14} className="text-ink-500"/>}
                Origin uses HTTPS (CloudPanel / self-signed)
              </div>
              <p className="text-xs text-ink-500 mt-1">
                Tick this when the local site forces HTTP→HTTPS (the default for CloudPanel sites).
                We'll send <code className="font-mono">noTLSVerify</code> + the right SNI so the self-signed cert isn't a problem.
              </p>
            </div>
          </label>
        </div>

        <div>
          <label className="label">Target URL</label>
          <input
            className="field font-mono"
            value={serviceUrl}
            onChange={(e) => setServiceUrl(e.target.value)}
            placeholder={httpsOrigin ? `https://${target.host}:443` : `http://${target.host}:${target.port}`}
          />
          <p className="helper">Must start with <code>http://</code> or <code>https://</code>.</p>
        </div>

        {mode === 'create' && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={createDns} onChange={(e) => setCreateDns(e.target.checked)} className="mt-1" />
            <span>Also create the Cloudflare DNS record for this hostname.</span>
          </label>
        )}
        {override && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Existing DNS record will be overridden.
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-ink-500">Preview ingress rule</span>
            {httpsOrigin && (
              <span className="text-xs text-ink-500 inline-flex items-center gap-1">
                <Info size={11}/> SNI auto-set to hostname
              </span>
            )}
          </div>
          <div className="rounded-lg bg-ink-900 text-ink-200 font-mono text-xs p-3 overflow-x-auto">
            <div>- hostname: <span className="text-brand-300">{hostname || 'app1.example.com'}</span></div>
            <div>  service: <span className="text-emerald-300">{serviceUrl}</span></div>
            {httpsOrigin && (
              <>
                <div>  originRequest:</div>
                <div>    noTLSVerify: <span className="text-amber-300">true</span></div>
                <div>    originServerName: <span className="text-brand-300">{hostname || 'app1.example.com'}</span></div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
