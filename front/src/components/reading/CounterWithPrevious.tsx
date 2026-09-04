import type { PreviousReading } from '@/lib/types';

type CounterKey =
  | 'c112'
  | 'c113'
  | 'c122'
  | 'c123'
  | 'c501'
  | 'scanNoir'
  | 'scanCouleur'
  | 'envoi';

function fmtCounter(v: number | null | undefined) {
  return v != null ? String(v) : '—';
}

export function previousCounterValue(
  previous: PreviousReading | null | undefined,
  key: CounterKey,
): string {
  if (!previous) return '—';
  return fmtCounter(previous[key] as number | null | undefined);
}

export function previousReadingSummary(previous: PreviousReading | null | undefined) {
  if (!previous) return 'Premier relevé (base initiale)';
  return `${previous.code} · ${previous.moisFacture} · N ${previous.totalNoir} · C ${previous.totalCouleur}`;
}

type CounterWithPreviousProps = {
  previous: PreviousReading | null | undefined;
  counterKey: CounterKey;
  value: string | number | null | undefined;
  onChange?: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  inputWidth?: number;
};

/** Compteur actuel éditable + valeur précédente en lecture seule (au-dessus). */
export function CounterWithPrevious({
  previous,
  counterKey,
  value,
  onChange,
  disabled,
  compact,
  inputWidth,
}: CounterWithPreviousProps) {
  const prevVal = previousCounterValue(previous, counterKey);
  const currentVal = value ?? '';
  const widthStyle = inputWidth != null ? { width: inputWidth } : undefined;

  if (compact) {
    return (
      <div className="counter-pair counter-pair--compact">
        <input
          className="input input-readonly counter-pair-input"
          style={widthStyle}
          readOnly
          tabIndex={-1}
          title={`Ancien ${counterKey}: ${prevVal}`}
          value={prevVal}
          aria-label={`Ancien ${counterKey}`}
        />
        <input
          className="input counter-pair-input"
          style={widthStyle}
          type="number"
          min={0}
          disabled={disabled}
          value={currentVal}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={!onChange}
          aria-label={`Nouveau ${counterKey}`}
        />
      </div>
    );
  }

  return (
    <div className="counter-pair">
      <div className="counter-pair-prev">
        <span className="counter-pair-label">Ancien</span>
        <input
          className="input input-readonly modal-input"
          readOnly
          tabIndex={-1}
          value={prevVal}
          aria-label={`Ancien ${counterKey}`}
        />
      </div>
      <div className="counter-pair-new">
        <span className="counter-pair-label">Nouveau</span>
        <input
          className="input modal-input"
          type="number"
          min={0}
          disabled={disabled}
          value={currentVal}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={!onChange}
          aria-label={`Nouveau ${counterKey}`}
        />
      </div>
    </div>
  );
}

type PreviousReadingBannerProps = {
  previous: PreviousReading | null | undefined;
  moisFacture?: string;
};

/** Bandeau récapitulatif de l'ancien relevé (informatif, sans contrainte). */
export function PreviousReadingBanner({ previous, moisFacture }: PreviousReadingBannerProps) {
  if (!previous) {
    return (
      <p className="previous-reading-banner previous-reading-banner--empty">
        Aucun relevé antérieur — ce sera une <strong>base initiale</strong>
        {moisFacture ? ` pour ${moisFacture}` : ''}.
      </p>
    );
  }

  const prevMonth = moisFacture ? shiftMois(moisFacture, -1) : null;
  const notStrictPrev =
    prevMonth && previous.moisFacture !== prevMonth
      ? ` (dernier relevé connu, pas ${prevMonth})`
      : '';

  return (
    <div className="previous-reading-banner panel">
      <h2 style={{ marginBottom: '0.35rem' }}>Ancien relevé {previous.code}</h2>
      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-soft)' }}>
        {previous.moisFacture}
        {notStrictPrev}
        {' · '}
        N {previous.totalNoir} · C {previous.totalCouleur}
        {' · '}
        ΔN {previous.copiesNoirFacturer ?? '—'} · ΔC {previous.copiesCouleurFacturer ?? '—'}
      </p>
    </div>
  );
}

function shiftMois(mois: string, delta: number) {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
