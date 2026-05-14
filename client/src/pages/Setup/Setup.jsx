import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { FullPageSpinner } from '../../components/Spinner.jsx';
import Step1Welcome from './Step1Welcome.jsx';
import Step2Credentials from './Step2Credentials.jsx';
import Step3Tunnel from './Step3Tunnel.jsx';
import Step4Target from './Step4Target.jsx';
import Step5Subdomains from './Step5Subdomains.jsx';
import Step6Install from './Step6Install.jsx';
import { Cloud, Check } from 'lucide-react';
import clsx from 'clsx';

const STEPS = [
  { key: 'welcome',     label: 'Welcome',      Cmp: Step1Welcome },
  { key: 'credentials', label: 'Credentials',  Cmp: Step2Credentials },
  { key: 'tunnel',      label: 'Tunnel',       Cmp: Step3Tunnel },
  { key: 'target',      label: 'Target',       Cmp: Step4Target },
  { key: 'subdomains',  label: 'Subdomains',   Cmp: Step5Subdomains },
  { key: 'install',     label: 'Install',      Cmp: Step6Install },
];

export default function Setup() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    apiToken: '',
    accountId: '',
    tunnelName: 'cloudpanel-tunnel',
    tunnelId: '',
    target: { kind: 'this-machine', host: 'localhost', port: 80 },
    hostnames: [],
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // If the wizard is reached but setup already finished, bounce back to the
  // dashboard so the user doesn't reconfigure by accident.
  useEffect(() => {
    api.get('/api/setup/status').then((r) => {
      if (r.configured) navigate('/dashboard', { replace: true });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [navigate]);

  if (loading) return <FullPageSpinner />;

  const Current = STEPS[step].Cmp;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-dvh bg-gradient-to-br from-ink-50 to-brand-50">
      <header className="bg-white border-b border-ink-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center">
            <Cloud size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Setup Wizard</div>
            <div className="text-xs text-ink-500">Step {step + 1} of {STEPS.length} · {STEPS[step].label}</div>
          </div>
        </div>
        <div className="h-1 bg-ink-100">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="hidden sm:flex max-w-3xl mx-auto px-6 py-3 gap-2 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={s.key} className={clsx('flex items-center gap-2 text-xs whitespace-nowrap', i < step ? 'text-emerald-700' : i === step ? 'text-brand-700 font-medium' : 'text-ink-400')}>
              <span className={clsx('w-5 h-5 rounded-full flex items-center justify-center text-[10px]', i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-ink-200')}>
                {i < step ? <Check size={12} /> : i + 1}
              </span>
              {s.label}
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24">
        <Current
          data={data}
          setData={(patch) => setData((d) => ({ ...d, ...patch }))}
          next={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
          back={() => setStep((s) => Math.max(s - 1, 0))}
          finish={() => navigate('/dashboard', { replace: true })}
        />
      </main>
    </div>
  );
}
