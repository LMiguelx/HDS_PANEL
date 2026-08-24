import { differenceInCalendarDays, format, parseISO } from 'date-fns';

/** "01/12/26 – 28/02/27" · "Sin fecha de inicio" si no hay startDate. */
export function vigenciaText(startDate?: string | null, endDate?: string | null): string {
  if (!startDate && !endDate) return 'Sin fecha de inicio';
  const from = startDate ? format(parseISO(startDate), 'dd/MM/yy') : '—';
  const to = endDate ? format(parseISO(endDate), 'dd/MM/yy') : '—';
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
