import { ExternalLink, CheckCircle2 } from 'lucide-react';

// Plain-English checklist. Each entry has a short bold title and an
// optional muted sub-line so the longer "but what does that mean?"
// detail doesn't elbow the link off the row. The wizard's step 2 has
// the full permissions cheat-sheet, so we don't need to spell it out here.
const CHECKLIST = [
  {
    title: 'A free Cloudflare account',
    href: 'https://dash.cloudflare.com/sign-up',
  },
  {
    title: 'A domain added to that account',
    href: 'https://dash.cloudflare.com/',
  },
  {
    title: 'A Cloudflare API token',
    sub: "We'll show you exactly which permissions to tick on the next step.",
    href: 'https://dash.cloudflare.com/profile/api-tokens',
  },
];

export default function Step1Welcome({ next }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-semibold mb-2">Let's get your tunnel running.</h1>
        <p className="text-ink-600">
          This app sets up a Cloudflare Tunnel so subdomains like <span className="font-mono text-ink-800">app1.example.com</span> reach
          your CloudPanel server — even though it's behind a home or office router with no port forwarding.
          No terminal needed. Everything happens right here.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">What you'll need</h2>
        <ul className="space-y-3">
          {CHECKLIST.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-500" size={18} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-medium">{item.title}</span>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline whitespace-nowrap"
                  >
                    Open <ExternalLink size={12} />
                  </a>
                </div>
                {item.sub && <p className="text-sm text-ink-500 mt-0.5">{item.sub}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <button onClick={next} className="btn-primary">I'm ready, let's go</button>
      </div>
    </div>
  );
}
