// Conversión de valores para exportar — doc 43, sección 8.2 y 8.6.
import { parseISO } from 'date-fns';
import { ColumnType, ExportColumn } from './export.models';
import { dateText, dateTimeText, timeText } from '../../../features/assignments/assignment-format';
import { formatSoles } from '../../pipes/money';
import { quantityText, weightText } from '../../../features/sales-reports/sales-report-format';

/** BigDecimal que a veces llega como texto: a número finito, o `null` si no se puede. */
export function toFiniteNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Partes locales de una fecha `yyyy-MM-dd` o `yyyy-MM-ddTHH:mm[:ss]`, leídas
 * directo del texto (sin pasar por el huso horario del navegador): una
 * fecha '2026-10-21' da {y:2026,m:10,d:21}, nunca el día anterior.
 */
export function isoDateParts(
  raw: unknown,
): { y: number; m: number; d: number; hh: number; mm: number } | null {
  if (typeof raw !== 'string' || !raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(raw);
  if (!match) return null;
  return {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
    hh: Number(match[4] ?? '0'),
    mm: Number(match[5] ?? '0'),
  };
}

/**
 * Inyección de fórmulas (sección 8.6): un texto que empieza con `=`, `+`,
 * `-` o `@` se exporta con un apóstrofo delante. Aplica a Excel y CSV.
 */
export function escapeFormulaInjection(text: string): string {
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

/** Valor crudo de la columna, ya resuelto (sin formatear). */
export function rawColumnValue<T>(column: ExportColumn<T>, row: T, index: number): unknown {
  return column.value(row, index);
}

/** `true` cuando `emptyWhenZero` aplica y el valor es exactamente 0. */
export function isEmptyZero<T>(column: ExportColumn<T>, raw: unknown): boolean {
  return !!column.emptyWhenZero && toFiniteNumber(raw) === 0;
}

/**
 * Texto para pantalla (`ui-table`) de una columna — la misma regla de
 * formato que usan Excel y CSV, para que tabla y archivo nunca se
 * desacuerden (sección 8.3).
 */
export function columnScreenText<T>(column: ExportColumn<T>, row: T, index: number): string {
  const raw = rawColumnValue(column, row, index);
  return formatByType(column.type, raw, isEmptyZero(column, raw));
}

export function formatByType(type: ColumnType, raw: unknown, emptyZero = false): string {
  if (raw == null || raw === '') return '—';
  if (emptyZero) return '—';
  switch (type) {
    case 'text':
    case 'code':
      return String(raw);
    case 'integer': {
      const n = toFiniteNumber(raw);
      return n == null ? '—' : String(Math.round(n));
    }
    case 'money': {
      const n = toFiniteNumber(raw);
      return n == null ? '—' : formatSoles(n);
    }
    case 'quantity': {
      const n = toFiniteNumber(raw);
      return n == null ? '—' : quantityText(n);
    }
    case 'weight': {
      const n = toFiniteNumber(raw);
      return n == null ? '—' : weightText(n);
    }
    case 'date':
      return dateText(String(raw));
    case 'datetime':
      return dateTimeText(String(raw));
    case 'time':
      return timeText(String(raw));
  }
}

/** Reexportado para quien arme fechas reales en Excel sin desfase de huso horario. */
export { parseISO };
