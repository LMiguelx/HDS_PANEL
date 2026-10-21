import { differenceInCalendarDays, format, parseISO } from 'date-fns';

/** "01/12/26 – 28/02/27" · "Sin fecha de inicio" si no hay startDate. */
export function vigenciaText(startDate?: string | null, endDate?: string | null): string {
  if (!startDate && !endDate) return 'Sin fecha de inicio';
  const from = startDate ? format(parseISO(startDate), 'dd/MM/yy') : '—';
  const to = endDate ? format(parseISO(endDate), 'dd/MM/yy') : '—';
  return `${from} – ${to}`;
}

/**
 * Vigencia para la cabecera del detalle — doc 44, sección 6.2: cada lado
 * dice explícitamente que no tiene fecha, en vez de un guion.
 */
export function vigenciaFullText(startDate?: string | null, endDate?: string | null): string {
  const from = startDate ? format(parseISO(startDate), 'dd/MM/yyyy') : 'Sin fecha de inicio';
  const to = endDate ? format(parseISO(endDate), 'dd/MM/yyyy') : 'Sin fecha de fin';
  return `${from} – ${to}`;
}

/** "01/12/2026" para mostrar en campos de formulario/resumen. */
export function dateText(value?: string | null): string {
  return value ? format(parseISO(value), 'dd/MM/yyyy') : '—';
}

/** "Hoy" · "Espera 1 día" · "Espera 3 días" a partir de una fecha ISO. */
export function waitingText(createdAt: string): string {
  const days = differenceInCalendarDays(new Date(), parseISO(createdAt));
  if (days <= 0) return 'Hoy';
  return days === 1 ? 'Espera 1 día' : `Espera ${days} días`;
}

/**
 * Insignia del detalle — doc 44, sección 3.1. `PromoDetail` no trae
 * `statusLabel` (a diferencia de `PromoSummary`): se calcula en el panel.
 */
export function promoStatusLabel(p: {
  active?: boolean | null;
  startDate?: string | null;
  endDate?: string | null;
}): string {
  if (!p.active) return 'Apagada';
  const today = format(new Date(), 'yyyy-MM-dd');
  if (p.startDate && p.startDate > today) return 'Programada';
  if (p.endDate && p.endDate < today) return 'Vencida';
  return 'Vigente';
}

/** Valores fijos del selector de prioridad — sección 3.8 del doc 28. */
export const PRIORITY_OPTIONS = [
  { value: '50', label: 'Alta' },
  { value: '100', label: 'Media' },
  { value: '200', label: 'Baja' },
];

/** "Alta" / "Media" / "Baja" · el número tal cual si no es uno de los fijos. */
export function priorityText(priority?: number | null): string {
  if (priority == null) return '—';
  const match = PRIORITY_OPTIONS.find((o) => Number(o.value) === priority);
  return match ? match.label : String(priority);
}

/** "Sí (tope 3 por pedido)" / "No". */
export function repeatsText(repeats?: boolean | null, maxRepeatsPerOrder?: number | null): string {
  if (!repeats) return 'No';
  return maxRepeatsPerOrder != null ? `Sí (tope ${maxRepeatsPerOrder} por pedido)` : 'Sí';
}

/** "N" / "Ilimitado". */
export function applicationsPerCustomerText(value?: number | null): string {
  return value != null ? String(value) : 'Ilimitado';
}
