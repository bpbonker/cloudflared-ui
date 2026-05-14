import { useState } from 'react';
import { Eye, EyeOff, HelpCircle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import Spinner from '../../components/Spinner.jsx';
import { useToast } from '../../components/Toast.jsx';
import TokenPermissionsHelper from '../../components/TokenPermissionsHelper.jsx';

export default function Step2Credentials({ data, setData, next, back }) {
  const [show, setShow] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const toast = useToast();

  async function verify() {
    setVerifying(true);
    setVerified(false);
    try {
      await api.post('/api/setup/verify-token', { apiToken: data.apiToken, accountId: data.accountId });
      setVerified(true);
      toast.success('Token verified.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Cloudflare credentials</h2>
        <p className="text-sm text-ink-600">
          We use your API token to create DNS records and verify your account.
          Tokens are stored only on this server.
        </p>
      </div>

      <TokenPermissionsHelper defaultOpen={!data.apiToken} />

      <div className="card space-y-4">
        <div>
          <label className="label flex items-center gap-1">
            API Token
            <span title="Create one at dash.cloudflare.com → My Profile → API Tokens. Grant Zone:DNS:Edit and Account:Cloudflare Tunnel:Edit.">
              <HelpCircle size={14} className="text-ink-400" />
            </span>
          </label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className="field pr-10 font-mono"
              value={data.apiToken}
              onChange={(e) => { setData({ apiToken: e.target.value }); setVerified(false); }}
              placeholder="cf_pat_..."
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-500">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="helper">
            Required permissions: <b>Zone → DNS → Edit</b> and <b>Account → Cloudflare Tunnel → Edit</b>.
          </p>
        </div>

        <div>
          <label className="label flex items-center gap-1">
            Account ID
            <span title="On the Cloudflare dashboard right sidebar under your domain overview. It's a 32-character hex string.">
              <HelpCircle size={14} className="text-ink-400" />
            </span>
          </label>
          <input
            className="field font-mono"
            value={data.accountId}
            onChange={(e) => { setData({ accountId: e.target.value }); setVerified(false); }}
            placeholder="a1b2c3..."
          />
          <p className="helper">
            Find it in your Cloudflare dashboard, in the right sidebar of any domain's overview page.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={verify} disabled={!data.apiToken || verifying} className="btn-secondary">
            {verifying && <Spinner size={16} />} Verify token
          </button>
          {verified && <span className="badge-success"><CheckCircle2 size={12}/> Verified</span>}
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={back} className="btn-ghost">Back</button>
        <button onClick={next} disabled={!verified} className="btn-primary">Continue</button>
      </div>
    </div>
  );
}
