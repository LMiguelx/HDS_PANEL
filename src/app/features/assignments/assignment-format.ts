import { format, parseISO } from 'date-fns';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AssignmentAdminService } from './assignment-admin';

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

export function visitStatusLabel(visitStatusCode: string | null | undefined): string {
  if (!visitStatusCode) return 'Sin visita hoy';
  const labels: Record<string, string> = {
    ATTENDED: 'Atendido',
    CLOSED: 'Cerrado',
    NO_PURCHASE: 'No compró',
  };
  return labels[visitStatusCode] ?? visitStatusCode;
}

/**
 * Variable CSS del token de color para cada estado de visita (mapa) — se
 * resuelve en runtime con getComputedStyle porque Leaflet pinta sus paths
 * como atributos SVG, no como CSS, y `var()` no se interpreta ahí.
 */
export function visitStatusColorVar(visitStatusCode: string | null | undefined): string {
  const vars: Record<string, string> = {
    ATTENDED: '--st-attended',
    CLOSED: '--st-closed',
    NO_PURCHASE: '--st-no-purchase',
  };
  return (visitStatusCode && vars[visitStatusCode]) || '--ink-muted';
}

export interface ResolvedNames {
  customers: Map<number, string>;
  vendors: Map<number, string>;
}

/**
 * Decisión tomada para el "pendiente de UX" del documento: `GET /` y
 * `GET /pending-schedule` solo traen IDs. Como todo customerId de una fila
 * pertenece por definición a la cartera de su userId, se resuelven los
 * nombres reutilizando `GET /map?userIds=...` con los vendedores distintos
 * ya cargados en la página — un único request extra, sin endpoint nuevo ni
 * duplicar el lookup por nombre que ya usa Promociones (ese es para buscar,
 * no para resolver IDs conocidos).
 */
export function resolveNames(svc: AssignmentAdminService, userIds: number[]) {
  const distinct = Array.from(new Set(userIds)).filter((id) => id != null);
  if (distinct.length === 0) {
    return of<ResolvedNames>({ customers: new Map(), vendors: new Map() });
  }
  return svc.map({ userIds: distinct }).pipe(
    map(({ customers: rows, vendorStarts }): ResolvedNames => {
      const customers = new Map<number, string>();
      const vendors = new Map<number, string>();
      for (const row of rows) {
        customers.set(row.customerId, row.customerName);
        if (row.userId != null && row.userName) vendors.set(row.userId, row.userName);
      }
      // vendorStarts trae un nombre por cada userId pedido, aunque ese
      // vendedor no tenga cartera (ninguna fila en customers).
      for (const v of vendorStarts) {
        vendors.set(v.userId, v.userName);
      }
      return { customers, vendors };
    }),
  );
}
