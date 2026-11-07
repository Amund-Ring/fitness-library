import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({
  title,
  children,
  onClose,
  sheet = false,
  error,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  sheet?: boolean;
  error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={sheet ? 'dialog sheet' : 'dialog'}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <header className="dialog-header">
        <div>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={21} />
        </button>
      </header>
      <div className="dialog-body">
        {error && (
          <p role="alert" className="error-text dialog-error">
            {error}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
