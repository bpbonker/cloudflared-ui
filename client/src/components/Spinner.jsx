import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

export default function Spinner({ size = 18, className }) {
  return <Loader2 className={clsx('animate-spin', className)} size={size} />;
}

export function FullPageSpinner({ label }) {
  return (
    <div className="min-h-[50dvh] flex flex-col items-center justify-center text-ink-500 gap-3">
      <Spinner size={28} />
      {label && <div className="text-sm">{label}</div>}
    </div>
  );
}
