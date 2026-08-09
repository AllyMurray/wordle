import { useEffect, useId, useRef, type ReactNode } from 'react';
import './Stats.css';

interface ModalDialogProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  titleId?: string;
}

export function ModalDialog({
  isOpen,
  title,
  onClose,
  children,
  className = '',
  titleId,
}: ModalDialogProps) {
  const generatedTitleId = useId();
  const resolvedTitleId = titleId || generatedTitleId;
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (event: React.MouseEvent): void => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusableElements?.length) return;

    const first = focusableElements[0]!;
    const last = focusableElements[focusableElements.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="stats-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby={resolvedTitleId}
    >
      <div className={`stats-modal ${className}`.trim()} ref={modalRef}>
        <button
          ref={closeButtonRef}
          className="stats-close"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
        >
          &times;
        </button>
        <h2 id={resolvedTitleId} className="stats-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
