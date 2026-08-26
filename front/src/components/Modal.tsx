'use client';

import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  eyebrow?: string;
  subtitle?: string;
  wide?: boolean;
  footer?: React.ReactNode;
  footerLeft?: React.ReactNode;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  eyebrow = 'NOUVEAU',
  subtitle,
  wide,
  footer,
  footerLeft,
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-root" role="presentation">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className={`modal-dialog${wide ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-dialog-head">
          <div className="modal-dialog-head-text">
            {eyebrow ? <p className="modal-eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="modal-dialog-close"
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="modal-head-rule" aria-hidden />
        <div className="modal-dialog-body">{children}</div>
        {footer || footerLeft ? (
          <footer className={`modal-dialog-foot${footerLeft ? ' has-left' : ' is-equal'}`}>
            {footerLeft ? <div className="modal-dialog-foot-left">{footerLeft}</div> : null}
            <div className="modal-dialog-foot-right">{footer}</div>
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function ModalCloseButton({
  onClick,
  label = 'Annuler',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" className="btn-modal btn-modal-ghost" onClick={onClick}>
      {label}
    </button>
  );
}

export function ModalSubmitButton({
  form,
  disabled,
  children,
}: {
  form: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      form={form}
      className="btn-modal btn-modal-primary"
      disabled={disabled}
    >
      {children}
    </button>
  );
}
