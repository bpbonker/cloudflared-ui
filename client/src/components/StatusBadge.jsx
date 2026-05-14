import clsx from 'clsx';

const MAP = {
  running: { label: 'Running', cls: 'badge-success', dot: 'bg-emerald-500 animate-pulse' },
  stopped: { label: 'Stopped', cls: 'badge-danger', dot: 'bg-red-500' },
  warning: { label: 'Warning', cls: 'badge-warn', dot: 'bg-amber-500 animate-pulse' },
  unknown: { label: 'Unknown', cls: 'badge-muted', dot: 'bg-ink-400' },
};

export default function StatusBadge({ status }) {
  const s = MAP[status] || MAP.unknown;
  return (
    <span className={clsx(s.cls, 'pl-2')}>
      <span className={clsx('w-2 h-2 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}
