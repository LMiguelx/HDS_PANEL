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

/**
 * `visitStatusCode` puede ser null (sin visita hoy) o un código ya
 * "resuelto" del vocabulario de Visita que usa el resto del sistema
 * (ATTENDED / CLOSED / NO_PURCHASE...) — PENDIENTE también es un código
 * válido y significa que hay visita agendada pero todavía no atendida.
 * Se considera "visitado" cualquier código que no sea null ni PENDIENTE.
 */
export function isVisited(visitStatusCode: string | null | undefined): boolean {
  return !!visitStatusCode && visitStatusCode !== 'PENDIENTE';
}

export function visitStatusLabel(visitStatusCode: string | null | undefined): string {
  if (!visitStatusCode) return 'Sin visita hoy';
  const labels: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    ATTENDED: 'Atendido',
    CLOSED: 'Cerrado',
    NO_PURCHASE: 'No compró',
  };
  return labels[visitStatusCode] ?? visitStatusCode;
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
    map((rows): ResolvedNames => {
      const customers = new Map<number, string>();
      const vendors = new Map<number, string>();
      for (const row of rows) {
        customers.set(row.customerId, row.customerName);
        if (row.userId != null && row.userName) vendors.set(row.userId, row.userName);
      }
      return { customers, vendors };
    }),
  );
}
