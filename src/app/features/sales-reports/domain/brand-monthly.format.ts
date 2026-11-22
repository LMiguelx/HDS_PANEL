// Formato de "Marcas por mes" — doc 93, sección 3. Los cálculos (picos,
// participación, totales) vienen del backend; aquí solo se da formato.
import { formatSoles } from '../../../shared/pipes/money';

export const MONTH_SHORT_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export function monthShortName(month: number | null | undefined): string {
  if (!month || month < 1 || month > 12) return '—';
  return MONTH_SHORT_NAMES[month - 1];
}

/** "+12.3 %" / "−8.1 %"; "—" sin información o sin base para comparar. */
export function variationPctText(current: number, previous: number | null | undefined): string {
  if (previous == null || previous === 0) return '—';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(1)} %`;
}

export type VariationTone = 'pos' | 'neg' | 'neutral';

export function variationTone(current: number, previous: number | null | undefined): VariationTone {
  if (previous == null || previous === 0) return 'neutral';
  if (current > previous) return 'pos';
  if (current < previous) return 'neg';
  return 'neutral';
}

/** "Mar · S/ 182,400.00"; "—" si no vendió. */
export function peakText(
  month: number | null | undefined,
  amount: number | null | undefined,
): string {
  if (!month || amount == null) return '—';
  return `${monthShortName(month)} · ${formatSoles(amount)}`;
}

/** "Mar · 420 u."; variante en unidades para la tabla de productos (sección 3.7). */
export function peakUnitsText(
  month: number | null | undefined,
  units: number | null | undefined,
): string {
  if (!month || units == null) return '—';
  return `${monthShortName(month)} · ${units} u.`;
}
