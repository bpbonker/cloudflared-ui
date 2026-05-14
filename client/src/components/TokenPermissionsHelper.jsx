import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Copy, Check, KeyRound } from 'lucide-react';
import clsx from 'clsx';

// Inline guide that shows the user exactly which permissions, account scope
// and zone scope their Cloudflare API token needs. Renders collapsed by
// default so it doesn't fight for attention with the token input — when
// they don't have a token yet, one click expands the full recipe.
//
// Shown in the wizard step 2 and in Settings → Cloudflare credentials.

const ROWS = [
  { type: 'Account', resource: 'Cloudflare Tunnel', permission: 'Edit',
    why: 'Creates and deletes the tunnel itself.' },
  { type: 'Zone',    resource: 'DNS',               permission: 'Edit',
    why: 'Writes the CNAME records that point your subdomains at the tunnel.' },
  { type: 'Zone',    resource: 'Zone',              permission: 'Read',
    why: 'Lists your zones so we can match each hostname to its zone.' },
];

const PLAIN_TEXT = [
  'Cloudflare API token — required permissions',
  '',
  'Permissions:',
  '  • Account → Cloudflare Tunnel → Edit',
  '  • Zone → DNS → Edit',
  '  • Zone → Zone → Read',
  '',
  'Account Resources: Include → your account',
  'Zone Resources:    Include → All zones from an account → your account',
  '',
  'Create at: https://dash.cloudflare.com/profile/api-tokens',
  '(Use "Create Custom Token", not the templates.)',
].join('\n');

export default function TokenPermissionsHelper({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(PLAIN_TEXT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ink-100/60 transition"
        aria-expanded={open}
      >
        {open ? <ChevronDown size={16} className="text-ink-500"/> : <ChevronRight size={16} className="text-ink-500"/>}
        <KeyRound size={16} className="text-brand-600 shrink-0" />
        <span className="text-sm font-medium flex-1">Need help creating the token?</span>
        <span className="text-xs text-ink-500 hidden sm:inline">Step-by-step</span>
      </button>

      <div className={clsx('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 space-y-4 text-sm">
            <ol className="list-decimal pl-5 space-y-1 text-ink-700">
              <li>Open <a className="text-brand-700 hover:underline inline-flex items-center gap-1" href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer">Cloudflare → My Profile → API Tokens <ExternalLink size={12}/></a></li>
              <li>Click <b>Create Token</b>, then <b>Create Custom Token</b> (not a template).</li>
              <li>Add the three permissions below.</li>
              <li>Set <b>Account Resources</b> → Include → your account.</li>
              <li>Set <b>Zone Resources</b> → Include → All zones from an account → your account (or pick specific zones).</li>
              <li>Leave TTL and Client IP filtering blank, then create and copy the token.</li>
            </ol>

            <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-ink-100 text-ink-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-left px-3 py-2 font-medium">Resource</th>
                    <th className="text-left px-3 py-2 font-medium">Permission</th>
                    <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {ROWS.map((r) => (
                    <tr key={r.resource}>
                      <td className="px-3 py-2 font-medium text-ink-900">{r.type}</td>
                      <td className="px-3 py-2 text-ink-700">{r.resource}</td>
                      <td className="px-3 py-2">
                        <span className="badge-success">{r.permission}</span>
                      </td>
                      <td className="px-3 py-2 text-ink-500 hidden md:table-cell">{r.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-ink-500">
                <b>Account ID:</b> shown in the right sidebar of any domain's Overview page (32-char hex string).
              </p>
              <button onClick={copy} className="btn-secondary text-xs !py-1.5">
                {copied ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy permissions list</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
