'use client';

import { useEffect, useRef } from 'react';
import { useFeedback } from './FeedbackProvider';

/**
 * Remplace les bandeaux form-error / msg-ok par des modales (croix + OK).
 * Garder setError / setOk dans la page ; ce composant affiche la modale
 * dès qu’un message est défini, puis appelle onDismiss pour le vider.
 */
export function PageFeedback({
  error,
  ok,
  onDismiss,
  successTitle = 'Succès',
  errorTitle = 'Erreur',
}: {
  error?: string | null;
  ok?: string | null;
  onDismiss: () => void;
  successTitle?: string;
  errorTitle?: string;
}) {
  const { showAlert } = useFeedback();
  const last = useRef<string | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const key = error ? `e:${error}` : ok ? `o:${ok}` : null;
    if (!key || key === last.current) return;
    last.current = key;

    if (error) {
      showAlert({ variant: 'error', title: errorTitle, message: error });
      dismissRef.current();
      return;
    }
    if (ok) {
      showAlert({ variant: 'success', title: successTitle, message: ok });
      dismissRef.current();
    }
  }, [error, ok, errorTitle, successTitle, showAlert]);

  useEffect(() => {
    if (!error && !ok) last.current = null;
  }, [error, ok]);

  return null;
}
