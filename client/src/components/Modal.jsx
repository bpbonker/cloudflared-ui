import { X } from 'lucide-react';
import { useEffect } from 'react';

// On mobile it slides up from the bottom and fills the screen. On desktop
// it centers as a card. Same component, controlled by Tailwind breakpoints.
export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl animate-slide-up max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-ink-500 hover:text-ink-900 p-1">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-ink-200 flex flex-wrap gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}
