// Textos, insignias y formato de Conteo de inventario — doc 82, sección 6.
import { parseISO, format } from 'date-fns';
import { BrandCountBoardRow, CountLineStatus, StockCountView } from './stock-count.models';

export type BadgeTone = 'gray' | 'green' | 'amber' | 'blue' | 'violet';

export const BADGE_TONE_VAR: Record<BadgeTone, string> = {
  gray: '--st-closed',
  green: '--st-vigente',
  amber: '--st-in-route',
  blue: '--st-open',
  violet: '--accent',
};

/** Estado visible de una marca en la pizarra — sección 6.2. No es un campo del backend. */
export type BoardRowDisplayStatus = 'FREE' | 'COUNTING' | 'IDLE' | 'RELEASED' | 'CLOSED';

export function boardRowDisplayStatus(row: BrandCountBoardRow): BoardRowDisplayStatus {
  if (row.status === 'IN_PROGRESS') return row.active ? 'COUNTING' : 'IDLE';
  if (row.status === 'FREE') return 'FREE';
  if (row.status === 'RELEASED') return 'RELEASED';
  return 'CLOSED';
}

const DISPLAY_STATUS_LABEL: Record<BoardRowDisplayStatus, string> = {
  FREE: 'Libre',
  COUNTING: 'Contando',
  IDLE: 'Sin actividad',
  RELEASED: 'Liberada',
  CLOSED: 'Finalizada · espera ERP',
};

const DISPLAY_STATUS_TONE: Record<BoardRowDisplayStatus, BadgeTone> = {
  FREE: 'gray',
  COUNTING: 'green',
  IDLE: 'amber',
  RELEASED: 'blue',
  CLOSED: 'violet',
};

export function boardRowStatusLabel(row: BrandCountBoardRow): string {
  return DISPLAY_STATUS_LABEL[boardRowDisplayStatus(row)];
}

export function boardRowStatusTone(row: BrandCountBoardRow): BadgeTone {
  return DISPLAY_STATUS_TONE[boardRowDisplayStatus(row)];
}

/** Insignia de un estado visible, directo (tarjetas de resumen) — sección 6.2. */
export function displayStatusLabel(status: BoardRowDisplayStatus): string {
  return DISPLAY_STATUS_LABEL[status];
}

export function displayStatusToneVar(status: BoardRowDisplayStatus): string {
  return `var(${BADGE_TONE_VAR[DISPLAY_STATUS_TONE[status]]})`;
}

/** Orden de la tabla — sección 6.2: Sin actividad → Contando → Liberadas → Finalizadas → Libres. */
const DISPLAY_STATUS_ORDER: Record<BoardRowDisplayStatus, number> = {
  IDLE: 0,
  COUNTING: 1,
  RELEASED: 2,
  CLOSED: 3,
  FREE: 4,
};

export function boardRowSortKey(row: BrandCountBoardRow): [number, string] {
  return [DISPLAY_STATUS_ORDER[boardRowDisplayStatus(row)], row.brandName];
}

/**
 * Insignia de la cabecera del detalle — sección 6.3, igual que la pizarra,
 * + `erpTaken`. `active` viene de `StockCountDetailResponse.active`, no de
 * `StockCountView` (el "escaneó en los últimos 10 minutos" es del detalle).
 */
export function headerDisplayStatus(
  header: StockCountView,
  active: boolean,
): BoardRowDisplayStatus {
  if (header.erpTaken) return 'CLOSED';
  if (header.status === 'CLOSED') return 'CLOSED';
  if (!header.userName) return 'RELEASED';
  return active ? 'COUNTING' : 'IDLE';
}

export function headerStatusLabel(header: StockCountView, active: boolean): string {
  if (header.erpTaken) return 'Tomada por el ERP';
  return DISPLAY_STATUS_LABEL[headerDisplayStatus(header, active)];
}

export function headerStatusTone(header: StockCountView, active: boolean): BadgeTone {
  return DISPLAY_STATUS_TONE[headerDisplayStatus(header, active)];
}

const LINE_STATUS_LABEL: Record<CountLineStatus, string> = {
  PENDING: 'Pendiente',
  DONE: 'Realizado',
  NOT_FOUND: 'No encontrado',
};

const LINE_STATUS_TONE: Record<CountLineStatus, BadgeTone> = {
  PENDING: 'gray',
  DONE: 'green',
  NOT_FOUND: 'amber',
};

export function lineStatusLabel(status: CountLineStatus): string {
  return LINE_STATUS_LABEL[status];
}

export function lineStatusTone(status: CountLineStatus): BadgeTone {
  return status === 'NOT_FOUND' ? 'amber' : LINE_STATUS_TONE[status];
}

/** Rojo real (no un token de estado) para "No encontrado" — sección 6.3, tabla de estados. */
export function lineStatusColor(status: CountLineStatus): string {
  return status === 'NOT_FOUND'
    ? 'var(--st-mismatch)'
    : `var(${BADGE_TONE_VAR[lineStatusTone(status)]})`;
}

/** "dd/MM HH:mm", con año solo si no es el año en curso — sección 6.2 y 6.3. */
export function shortDateTimeText(iso: string | null): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, sameYear ? 'dd/MM HH:mm' : 'dd/MM/yyyy HH:mm');
}

/** "hace 5 min" / "hace 2 h" / "hace 1 día" — sección 6.2, nota bajo la tabla de estados. */
export function relativeTimeText(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - parseISO(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? '' : 's'}`;
}

/** Números sin ceros sobrantes, con separador de miles — sección 6.3. */
export function countNumberText(value: number | null): string {
  if (value == null) return '—';
  const rounded = Math.round(value * 1000) / 1000;
  return rounded.toLocaleString('es-PE', { maximumFractionDigits: 3 });
}

/** "Caja x{unitsPerPackage} · {unitOfMeasure}" — columna Presentación, sección 6.3. */
export function presentationText(unitsPerPackage: number | null, unitOfMeasure: string): string {
  if (unitsPerPackage == null) return unitOfMeasure;
  return `Caja x${countNumberText(unitsPerPackage)} · ${unitOfMeasure}`;
}

/** Columna Contado: "{paquetes} cj + {unidades} = {total}" — sección 6.3. */
export function countedText(
  packages: number | null,
  units: number | null,
  quantity: number | null,
): string {
  if (quantity == null) return '—';
  return `${countNumberText(packages)} cj + ${countNumberText(units)} = ${countNumberText(quantity)}`;
}

/** Origen de la línea — sección 6.3: Escaneo (SCAN) o Manual (MANUAL). */
export function entryMethodLabel(method: string | null): string {
  if (method === 'SCAN') return 'Escaneo';
  if (method === 'MANUAL') return 'Manual';
  return '—';
}
