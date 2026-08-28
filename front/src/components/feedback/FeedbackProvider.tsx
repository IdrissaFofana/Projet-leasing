'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type AlertVariant = 'error' | 'success' | 'info';

type AlertState = {
  variant: AlertVariant;
  title: string;
  message: string;
  children?: ReactNode;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type FeedbackContextValue = {
  showAlert: (opts: {
    variant?: AlertVariant;
    title?: string;
    message: string;
    children?: ReactNode;
  }) => void;
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const DEFAULT_TITLES: Record<AlertVariant, string> = {
  error: 'Erreur',
  success: 'Succès',
  info: 'Information',
};

function AlertDialog({
  alert,
  onClose,
}: {
  alert: AlertState;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="modal-root feedback-modal-root" role="presentation">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className={`modal-dialog feedback-dialog is-${alert.variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="feedback-alert-title"
      >
        <header className="modal-dialog-head">
          <div className="modal-dialog-head-text">
            <p className="modal-eyebrow">
              {alert.variant === 'error'
                ? 'ERREUR'
                : alert.variant === 'success'
                  ? 'SUCCÈS'
                  : 'INFO'}
            </p>
            <h2 id="feedback-alert-title">{alert.title}</h2>
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
        <div className="modal-dialog-body">
          <p className="feedback-message">{alert.message}</p>
          {alert.children}
        </div>
        <footer className="modal-dialog-foot is-equal">
          <div className="modal-dialog-foot-right">
            <button type="button" className="btn-modal btn-modal-primary" onClick={onClose}>
              OK
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function ConfirmDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="modal-root feedback-modal-root" role="presentation">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Annuler"
        onClick={onCancel}
      />
      <div
        className="modal-dialog feedback-dialog is-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="feedback-confirm-title"
      >
        <header className="modal-dialog-head">
          <div className="modal-dialog-head-text">
            <p className="modal-eyebrow">CONFIRMATION</p>
            <h2 id="feedback-confirm-title">{state.title}</h2>
          </div>
          <button
            type="button"
            className="modal-dialog-close"
            aria-label="Fermer"
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div className="modal-head-rule" aria-hidden />
        <div className="modal-dialog-body">
          <p className="feedback-message">{state.message}</p>
        </div>
        <footer className="modal-dialog-foot is-equal">
          <div className="modal-dialog-foot-right">
            <button type="button" className="btn-modal btn-modal-ghost" onClick={onCancel}>
              {state.cancelLabel}
            </button>
            <button
              type="button"
              className={`btn-modal ${state.danger ? 'btn-modal-danger' : 'btn-modal-primary'}`}
              onClick={onConfirm}
            >
              {state.confirmLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);

  const showAlert = useCallback(
    (opts: {
      variant?: AlertVariant;
      title?: string;
      message: string;
      children?: ReactNode;
    }) => {
      const variant = opts.variant ?? 'info';
      setAlert({
        variant,
        title: opts.title ?? DEFAULT_TITLES[variant],
        message: opts.message,
        children: opts.children,
      });
    },
    [],
  );

  const showError = useCallback(
    (message: string, title = 'Erreur') => {
      showAlert({ variant: 'error', title, message });
    },
    [showAlert],
  );

  const showSuccess = useCallback(
    (message: string, title = 'Succès') => {
      showAlert({ variant: 'success', title, message });
    },
    [showAlert],
  );

  const showInfo = useCallback(
    (message: string, title = 'Information') => {
      showAlert({ variant: 'info', title, message });
    },
    [showAlert],
  );

  const resolveConfirm = useCallback((value: boolean) => {
    confirmResolver.current?.(value);
    confirmResolver.current = null;
    setConfirmState(null);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    const options = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmState({
        title: options.title ?? 'Confirmation',
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmer',
        cancelLabel: options.cancelLabel ?? 'Annuler',
        danger: options.danger,
      });
    });
  }, []);

  const value = useMemo(
    () => ({ showAlert, showError, showSuccess, showInfo, confirm }),
    [showAlert, showError, showSuccess, showInfo, confirm],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {alert ? <AlertDialog alert={alert} onClose={() => setAlert(null)} /> : null}
      {confirmState ? (
        <ConfirmDialog
          state={confirmState}
          onCancel={() => resolveConfirm(false)}
          onConfirm={() => resolveConfirm(true)}
        />
      ) : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return ctx;
}
