export function currentMois() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMois(mois: string, delta: number) {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function lastMonths(count: number, from = currentMois()) {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    out.push(shiftMois(from, -i));
  }
  return out;
}

export function formatMoisLabel(mois: string) {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('fr-FR');
}

export function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(date?: string | null, time?: string | null) {
  const d = formatDate(date);
  const t = formatTime(time);
  if (d === '—' && t === '—') return '—';
  if (t === '—') return d;
  return `${d} · ${t}`;
}

export function toInputTime(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatMoney(value: string | number | null | undefined) {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toLocaleString('fr-FR')} XOF`;
}

export function toInputDate(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}
