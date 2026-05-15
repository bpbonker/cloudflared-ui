import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Pause, Play, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { openLogStream, api } from '../lib/api';

// Tag a line based on cloudflared/systemd markers. The check order matters
// because journalctl lines often contain the literal word "info" in URLs —
// we anchor on the cloudflared level markers first.
function classify(line) {
  if (/\bERR\b|level=error|\bERROR\b/.test(line)) return 'err';
  if (/\bWRN\b|level=warn|\bWARN\b/.test(line)) return 'warn';
  if (/\bINF\b|level=info|\bINFO\b/.test(line)) return 'info';
  return 'plain';
}

const COLOR = {
  err: 'text-red-300',
  warn: 'text-amber-300',
  info: 'text-ink-200',
  plain: 'text-ink-400',
};

export default function LogViewer() {
  const [lines, setLines] = useState([]);
  const [filter, setFilter] = useState('');
  const [autoscroll, setAutoscroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const ref = useRef(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const [error, setError] = useState(null);

  // Initial backfill so the user sees history without waiting for new events.
  useEffect(() => {
    api.get('/api/logs?n=200').then((r) => {
      setLines(r.lines.filter(Boolean));
      setUpdatedAt(new Date());
    }).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const close = openLogStream((line) => {
      if (pausedRef.current) return;
      setLines((prev) => {
        const next = [...prev, line];
        return next.length > 5000 ? next.slice(-5000) : next;
      });
      setUpdatedAt(new Date());
    });
    return close;
  }, []);

  // Filter without mutating the stored list so "Clear view" works as advertised.
  const filtered = useMemo(() => {
    if (!filter) return lines;
    const q = filter.toLowerCase();
    return lines.filter((l) => l.toLowerCase().includes(q));
  }, [lines, filter]);

  useEffect(() => {
    if (autoscroll && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [filtered, autoscroll]);

  return (
    <div className="card !p-0 flex flex-col h-[70dvh] sm:h-[75dvh]">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-ink-200">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter log lines…"
            className="field pl-9"
          />
        </div>
        <button onClick={() => setPaused((p) => !p)} className={paused ? 'btn-primary' : 'btn-secondary'}>
          {paused ? <><Play size={16}/> Resume</> : <><Pause size={16}/> Pause</>}
        </button>
        <button onClick={() => setLines([])} className="btn-secondary"><Trash2 size={16}/> Clear view</button>
        <label className="flex items-center gap-2 text-sm text-ink-600 ml-1">
          <input type="checkbox" checked={autoscroll} onChange={(e) => setAutoscroll(e.target.checked)} />
          Auto-scroll
        </label>
      </div>
      <div ref={ref} className="flex-1 bg-ink-900 overflow-auto p-3 font-mono text-xs leading-relaxed">
        {error ? (
          <div className="text-red-300 text-center py-10 px-4">
            <div className="font-semibold mb-1">Couldn't read the cloudflared logs.</div>
            <div className="text-ink-400">{error}</div>
            <div className="text-ink-500 mt-3 text-[11px]">
              The app user needs sudo permission to run <code>journalctl -u cloudflared</code>.
              See the sudoers section in the README.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-ink-500 text-center py-10">
            {filter ? 'No log lines match your filter.' : 'Waiting for log output…'}
          </div>
        ) : filtered.map((l, i) => (
          <div key={i} className={clsx('whitespace-pre-wrap break-all', COLOR[classify(l)])}>{l}</div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-ink-500 px-3 py-2 border-t border-ink-200">
        <span>{filtered.length} line{filtered.length === 1 ? '' : 's'}{filter && ` (filtered from ${lines.length})`}</span>
        <span>Last update: {updatedAt ? updatedAt.toLocaleTimeString() : '—'}</span>
      </div>
    </div>
  );
}
