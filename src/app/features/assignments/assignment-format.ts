import { format, parseISO } from 'date-fns';

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
  7: 'Dom',
};

export function weekdaysText(weekdays: number[] | null | undefined): string {
  if (!weekdays || weekdays.length === 0) return 'Sin días';
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d] ?? d)
    .join(', ');
}

export function weeksOfCycleText(weeks: number[] | null | undefined): string {
  if (!weeks || weeks.length === 0) return 'Sin semanas';
  return [...weeks].sort((a, b) => a - b).join(', ');
}

const WEEKDAY_FULL_NAMES: Record<number, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  7: 'domingo',
};

const ALL_CYCLE_WEEKS = [1, 2, 3, 4];

/** "y" entre los dos últimos elementos, comas entre el resto — "lunes y jueves" / "lunes, martes y jueves". */
function joinWithY(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/**
 * "Visita los lunes, todas las semanas" · "Visita los lunes y jueves, en
 * las semanas 1 y 3" — doc 33, sección 3.3. Vacío si falta algún lado
 * (horario incompleto): no hay resumen que armar todavía.
 */
export function scheduleSummaryText(
  weekdays: number[] | null | undefined,
  weeksOfCycle: number[] | null | undefined,
): string {
  if (!weekdays?.length || !weeksOfCycle?.length) return '';
  const days = joinWithY(
    [...weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_FULL_NAMES[d] ?? String(d)),
  );
  const sortedWeeks = [...weeksOfCycle].sort((a, b) => a - b);
  const allWeeks = ALL_CYCLE_WEEKS.every((w) => sortedWeeks.includes(w));
  const weeksText = allWeeks
    ? 'todas las semanas'
    : `en las semanas ${joinWithY(sortedWeeks.map(String))}`;
  return `Visita los ${days}, ${weeksText}`;
}

/** "01/12/2026" a partir de una fecha ISO (yyyy-MM-dd o datetime). */
export function dateText(value?: string | null): string {
  return value ? format(parseISO(value), 'dd/MM/yyyy') : '—';
}

/** "01/12/2026 08:15" a partir de un datetime ISO. */
export function dateTimeText(value?: string | null): string {
  return value ? format(parseISO(value), 'dd/MM/yyyy HH:mm') : '—';
}

/** "08:15" a partir de un datetime ISO. */
export function timeText(value?: string | null): string {
  return value ? format(parseISO(value), 'HH:mm') : '—';
}

/**
 * Variable CSS del token de color para cada estado de visita (mapa/bitácora)
 * — se resuelve en runtime con getComputedStyle porque Leaflet pinta sus
 * paths como atributos SVG, no como CSS, y `var()` no se interpreta ahí.
 */
export function visitStatusColorVar(visitStatusCode: string | null | undefined): string {
  const vars: Record<string, string> = {
    PENDING: '--st-pending',
    ATTENDED: '--st-attended',
    CLOSED: '--st-closed',
    NO_PURCHASE: '--st-no-purchase',
  };
  return (visitStatusCode && vars[visitStatusCode]) || '--st-pending';
}

/** "16 min" · "1 h 05 min" — minutos entre dos horas de la bitácora. */
export function durationText(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h} h ${String(m).padStart(2, '0')} min`;
}
