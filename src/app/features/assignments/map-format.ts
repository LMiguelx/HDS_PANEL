import {
  MapAlertSummary,
  MapAlertType,
  MapPointStatus,
  MapRouteStatus,
} from '../../shared/models/assignment-map.models';
import { dateText } from './assignment-format';

/** Color fijo del vendedor (sección 3.1): paleta de 25 + gris para null + oscurecido para mapColor > 25. */
export function mapVendorColorVar(mapColor: number | null): string {
  if (mapColor == null) return 'var(--map-vendor-none)';
  const index = ((mapColor - 1) % 25) + 1;
  const base = `var(--map-vendor-${String(index).padStart(2, '0')})`;
  return mapColor > 25 ? `color-mix(in srgb, ${base} 75%, black)` : base;
}

export interface PointStatusInfo {
  label: string;
  longLabel: string;
  tone: string; // token CSS, ej. "--status-ok"
}

const POINT_STATUS: Record<MapPointStatus, PointStatusInfo> = {
  PENDING: {
    label: 'Pendiente',
    longLabel: 'Programado · pendiente de visitar',
    tone: '--ink-muted',
  },
  ORDERED: { label: 'Atendido', longLabel: 'Atendido · con pedido', tone: '--status-ok' },
  NO_ORDER: { label: 'No compró', longLabel: 'Visitado sin pedido', tone: '--status-warn' },
  CLOSED: { label: 'Cerrado', longLabel: 'Local cerrado', tone: '--ink-muted' },
};

export function pointStatusInfo(status: MapPointStatus): PointStatusInfo {
  return POINT_STATUS[status];
}

/** Color del marcador por estado (sección 3.3): usa los tokens --map-status-*, no --status-*. */
const MAP_STATUS_COLOR_VAR: Record<MapPointStatus, string> = {
  PENDING: '--map-status-pending',
  ORDERED: '--map-status-ordered',
  NO_ORDER: '--map-status-no-order',
  CLOSED: '--map-status-closed',
};

export function mapStatusColorVar(status: MapPointStatus): string {
  return `var(${MAP_STATUS_COLOR_VAR[status]})`;
}

/** Jornada del vendedor — sección 3.6. `hasPlan` colorea "Sin iniciar ruta" en ámbar cuando tiene plan hoy. */
export function routeStatusLabel(
  status: MapRouteStatus,
  hasPlan: boolean,
): { label: string; tone: string } {
  if (status === 'NOT_STARTED') {
    return { label: 'Sin iniciar ruta', tone: hasPlan ? '--status-warn' : '--ink-muted' };
  }
  if (status === 'IN_ROUTE') return { label: 'En ruta', tone: '--status-ok' };
  return { label: 'Ruta cerrada', tone: '--ink-muted' };
}

/** "Ruta 07:42 – en curso" / "Ruta 07:42 – 18:10" — sección 3.6. */
export function routeTimeRangeText(
  status: MapRouteStatus,
  startedAt: string | null,
  endedAt: string | null,
): string {
  if (!startedAt) return '';
  const start = timeOf(startedAt);
  if (status === 'FINISHED' && endedAt) return `Ruta ${start} – ${timeOf(endedAt)}`;
  return `Ruta ${start} – en curso`;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Distancias — sección 3.9. Sin prefijo "a ": lo agrega quien arma la frase. */
export function distanceText(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Minutos — sección 3.9. */
export function minutesText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} h ${rem} min` : `${h} h`;
}

const WEEKDAY_SHORT: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
  7: 'Dom',
};
const WEEKDAY_FULL: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

function joinWithY(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** "Lun y Jue · semanas 1 y 3" — sección 3.8. "Sin horario" si falta algo. */
export function scheduleText(weekdays: number[], weeksOfCycle: number[]): string {
  if (weekdays.length === 0 || weeksOfCycle.length === 0) return 'Sin horario';
  const days = joinWithY(weekdays.map((d) => WEEKDAY_SHORT[d] ?? String(d)));
  const weeks = joinWithY(weeksOfCycle.map(String));
  const weeksLabel = weeksOfCycle.length === 1 ? `semana ${weeks}` : `semanas ${weeks}`;
  return `${days} · ${weeksLabel}`;
}

/** "Martes 20/10/2026 · semana 1 del ciclo" — sección 2.1, cabecera de la pantalla. */
export function headerDateText(weekday: number, weekOfCycle: number, dateIso: string): string {
  const day = WEEKDAY_FULL[weekday] ?? '';
  return `${day} ${dateText(dateIso)} · semana ${weekOfCycle} del ciclo`;
}

const ALERT_LABELS: Record<MapAlertType, string> = {
  OFF_PLAN: 'Fuera de plan',
  FAR_FROM_CUSTOMER: 'Registrada a {d} del cliente',
  LONG_PAUSE: '+{m} desde la anterior',
  NO_LOCATION: 'Visita sin GPS',
};

/** Etiqueta de una alerta en la bitácora — sección 3.7. */
export function alertLabel(
  type: MapAlertType,
  entry: { distanceMeters?: number | null; minutesSincePrevious?: number | null },
): string {
  const template = ALERT_LABELS[type];
  return template
    .replace('{d}', `a ${distanceText(entry.distanceMeters ?? 0)}`)
    .replace('{m}', minutesText(entry.minutesSincePrevious ?? 0));
}

/** Resumen de alertas de la cabecera de la bitácora — sección 3.7. */
export function alertSummaryText(alerts: MapAlertSummary): string {
  const parts: string[] = [];
  if (alerts.offPlan > 0) {
    parts.push(`${alerts.offPlan} fuera de plan`);
  }
  if (alerts.farFromCustomer > 0) {
    parts.push(
      `${alerts.farFromCustomer} visita${alerts.farFromCustomer === 1 ? '' : 's'} lejos del cliente`,
    );
  }
  if (alerts.longPause > 0) {
    parts.push(
      `${alerts.longPause} pausa${alerts.longPause === 1 ? '' : 's'} larga${alerts.longPause === 1 ? '' : 's'}`,
    );
  }
  if (alerts.noLocation > 0) {
    parts.push(`${alerts.noLocation} sin GPS`);
  }
  return parts.length ? parts.join(' · ') : 'Sin alertas';
}

/** Nombre del estado del pedido para la bitácora (sección 6.6) — el pedido en sí se traduce en otras pantallas. */
export function orderStatusBadge(code: string | null): string {
  switch (code) {
    case 'OPEN':
      return 'Abierto';
    case 'SENT_TO_BILLING':
      return 'Enviado a facturación';
    case 'CANCELLED':
      return 'Anulado';
    case 'COUNTER_DELIVERED':
      return 'Entregado en mostrador';
    default:
      return '—';
  }
}
