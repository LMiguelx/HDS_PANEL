import { UiFieldOption } from '../../shared/ui/field/field';
import { UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { ProductView } from '../../shared/models/catalog.models';
import {
  ReconciliationReason,
  ReconciliationResultFilter,
  StockAdvanceStatusCode,
  StockAdvanceWarningCode,
  StockReconciliationView,
  SyncProductResultFilter,
} from '../../shared/models/inventory.models';

/** Buscador de producto de la sección 4.2: código · nombre · stock, incluso en 0. */
export function toProductLookup(p: ProductView): UiLookupItem {
  return {
    id: p.productId,
    code: p.code,
    name: p.name,
    extraInfo: `${p.code} · Stock: ${p.stock}`,
  };
}

/** Tono visual de una etiqueta — doc 35, sección 2.6. */
export type BadgeTone = 'green' | 'amber' | 'gray' | 'red' | 'blue';

export const BADGE_TONE_VAR: Record<BadgeTone, string> = {
  green: '--st-vigente',
  amber: '--st-in-route',
  gray: '--st-closed',
  red: '--st-mismatch',
  blue: '--st-open',
};

// ─────────────────────────── Adelantos — doc 35, sección 3.1 ───────────────────────────

const ADVANCE_STATUS: Record<StockAdvanceStatusCode, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'Abierto', tone: 'amber' },
  COVERED: { label: 'Cubierto', tone: 'green' },
  RELEASED: { label: 'Retirado', tone: 'gray' },
  CLOSED: { label: 'Cerrado', tone: 'gray' },
};

export function advanceStatusLabel(code: StockAdvanceStatusCode): string {
  return ADVANCE_STATUS[code]?.label ?? code;
}

export function advanceStatusTone(code: StockAdvanceStatusCode): BadgeTone {
  return ADVANCE_STATUS[code]?.tone ?? 'gray';
}

// ─────────────────────────── Cuadre con el ERP — doc 35, secciones 3.3-3.6 ───────────────────────────

export type ReconciliationResult = 'FAILED' | 'INCREASED' | 'DECREASED' | 'MATCHED' | 'SUPERSEDED';

/** Deduce el resultado de una fila — doc 35, sección 3.5; `SUPERSEDED` — doc 67, sección 3.1. No es un campo del backend. */
export function reconciliationResult(row: StockReconciliationView): ReconciliationResult {
  if (row.statusCode === 'SUPERSEDED') return 'SUPERSEDED';
  if (row.statusCode === 'FAILED') return 'FAILED';
  const delta = row.appliedDelta ?? 0;
  if (delta > 0) return 'INCREASED';
  if (delta < 0) return 'DECREASED';
  return 'MATCHED';
}

const RESULT_LABEL: Record<ReconciliationResult, { label: string; tone: BadgeTone }> = {
  FAILED: { label: 'Fallida', tone: 'red' },
  INCREASED: { label: 'Entró stock', tone: 'blue' },
  DECREASED: { label: 'Sobraba', tone: 'red' },
  MATCHED: { label: 'Cuadró', tone: 'green' },
  SUPERSEDED: { label: 'Reemplazada', tone: 'gray' },
};

export function reconciliationResultLabel(row: StockReconciliationView): string {
  return RESULT_LABEL[reconciliationResult(row)].label;
}

export function reconciliationResultTone(row: StockReconciliationView): BadgeTone {
  return RESULT_LABEL[reconciliationResult(row)].tone;
}

const FAILURE_TEXT: Record<string, string> = {
  WAREHOUSE_NOT_FOUND: 'El almacén de la subida no existe o está inactivo',
  UNEXPECTED_ERROR: 'Ocurrió un error al procesar la subida',
};

export function failureReasonText(failureCode: string | null): string {
  if (!failureCode) return 'Ocurrió un error al procesar la subida';
  return FAILURE_TEXT[failureCode] ?? failureCode;
}

export const RECONCILIATION_RESULT_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos' },
  { value: 'DIFFERENCE', label: 'Con diferencia' },
  { value: 'MATCHED', label: 'Cuadraron' },
  { value: 'INCREASED', label: 'Entró stock' },
  { value: 'DECREASED', label: 'Sobraba' },
  { value: 'SHORTFALL', label: 'Ventas sin respaldo' },
  { value: 'FAILED', label: 'Fallidas' },
  { value: 'SUPERSEDED', label: 'Reemplazadas' },
];

export function resultFilterLabel(value: ReconciliationResultFilter | ''): string {
  return RECONCILIATION_RESULT_OPTIONS.find((o) => o.value === value)?.label ?? 'Todos';
}

// ───────────────── Cuadre con el ERP (rediseño) — doc 56, secciones 4.2 y 4.3 ─────────────────

const REASON_LABEL: Record<ReconciliationReason, { label: string; tone: BadgeTone }> = {
  MATCHED: { label: 'Cuadró', tone: 'green' },
  ERP_INCREASE: { label: 'Entró mercadería', tone: 'blue' },
  MANUAL_ADJUSTMENT: { label: 'Ajuste manual', tone: 'amber' },
  ORDER_RETURNED: { label: 'Devuelto por pedidos', tone: 'amber' },
  UNRECORDED_CHANGE: { label: 'Cambio sin registro', tone: 'red' },
  UNEXPLAINED: { label: 'Sin causa en la app', tone: 'red' },
  FIRST_SYNC: { label: 'Primera subida', tone: 'gray' },
  FAILED: { label: 'Falló', tone: 'red' },
  SUPERSEDED: { label: 'Reemplazada', tone: 'gray' },
};

export function reasonLabel(reason: ReconciliationReason): string {
  return REASON_LABEL[reason]?.label ?? reason;
}

export function reasonTone(reason: ReconciliationReason): BadgeTone {
  return REASON_LABEL[reason]?.tone ?? 'gray';
}

export const SYNC_PRODUCT_RESULT_OPTIONS: UiFieldOption[] = [
  { value: 'DIFFERENCE', label: 'Con diferencia' },
  { value: '', label: 'Todos' },
  { value: 'INCREASED', label: 'Entró mercadería' },
  { value: 'DECREASED', label: 'La app tenía de más' },
  { value: 'FAILED', label: 'Fallidas' },
  { value: 'MATCHED', label: 'Cuadraron' },
  { value: 'SUPERSEDED', label: 'Reemplazadas' },
];

export function syncProductResultLabel(value: SyncProductResultFilter | ''): string {
  return SYNC_PRODUCT_RESULT_OPTIONS.find((o) => o.value === value)?.label ?? 'Con diferencia';
}

// ─────────────────────────── Origen de un movimiento — doc 35, sección 3.8 ───────────────────────────

export interface MovementReference {
  text: string;
  route: unknown[] | null; // null = sin enlace
}

export function movementReference(
  referenceTable: string | null,
  referenceId: string | null,
): MovementReference {
  switch (referenceTable) {
    case 'sales_order':
      return { text: `Pedido ${referenceId}`, route: ['/pedidos/detalle', referenceId] };
    case 'stock_advance':
      return { text: `Adelanto ${referenceId}`, route: ['/inventario/adelantos'] };
    case 'stock_reconciliation':
      return { text: `Cuadre ${referenceId}`, route: ['/inventario/cuadre', referenceId] };
    case 'delivery_return':
      return { text: 'Devolución de reparto', route: null };
    default:
      return { text: '—', route: null };
  }
}

// ─────────────────────────── Archivo CSV — doc 35, sección 4.4 ───────────────────────────

export interface CsvStockLine {
  productCode: string;
  warehouseId: number;
  quantity: number;
}

/** Parseo liviano del CSV compartido por Adelantos y Ajuste de stock. */
export function parseStockCsv(text: string): { lines: CsvStockLine[]; invalidRows: number } {
  const lines: CsvStockLine[] = [];
  let invalidRows = 0;
  const rows = text.split(/\r?\n/).filter((r) => r.trim());
  for (const row of rows) {
    const [codeRaw, warehouseRaw, quantityRaw] = row.split(',').map((c) => c.trim());
    if (!codeRaw || codeRaw.toLowerCase() === 'productcode') continue; // encabezado
    const warehouseId = Number(warehouseRaw);
    const quantity = Number(quantityRaw);
    if (!codeRaw || !warehouseId || !Number.isFinite(quantity) || quantity <= 0) {
      invalidRows++;
      continue;
    }
    lines.push({ productCode: codeRaw, warehouseId, quantity });
  }
  return { lines, invalidRows };
}

export function downloadCsvTemplate() {
  const csv = 'productCode,warehouseId,quantity\n0000000662,1,50\n0000000707,1,24\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-stock.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ───────────────── Avisos de un adelanto — doc 69, secciones 2 y 5.2 ─────────────────

const WARNING_ICON: Record<StockAdvanceWarningCode, string> = {
  RECENT_ERP_INCREASE: '⚠',
  ERP_UPLOAD_PENDING: '⏳',
};
const WARNING_TONE_VAR: Record<StockAdvanceWarningCode, string> = {
  RECENT_ERP_INCREASE: '--status-warn',
  ERP_UPLOAD_PENDING: '--accent',
};

export function advanceWarningIcon(code: StockAdvanceWarningCode): string {
  return WARNING_ICON[code] ?? '⚠';
}

export function advanceWarningToneVar(code: StockAdvanceWarningCode): string {
  return WARNING_TONE_VAR[code] ?? '--status-warn';
}

// ───────────────── CSV de Adelantos (mejorado) — doc 69, sección 6 ─────────────────
// Formato propio, separado de parseStockCsv/downloadCsvTemplate (que siguen
// siendo los de Ajuste de stock, sin cambios en este doc): una columna de
// código y una de cantidad — el almacén se elige en el formulario, no en el
// archivo — con compatibilidad hacia el formato viejo de 3 columnas.

export interface AdvanceCsvRow {
  rowNumber: number; // número de fila del archivo (cuenta el encabezado si lo hay)
  productCode: string;
  warehouseId: number | null; // solo si el archivo trae el formato antiguo con esa columna
  quantity: number | null; // null si no se pudo leer
  formatError: string | null; // motivo si la fila no se puede usar (código vacío, cantidad inválida)
}

export interface ParseAdvancesCsvResult {
  rows: AdvanceCsvRow[]; // una por producto — las filas repetidas ya se sumaron
  mergedCount: number; // cuántas filas de más se sumaron a otra por código repetido
  totalFileRows: number; // filas de datos leídas (antes de sumar repetidos)
  error: string | null; // archivo vacío, sin encabezado reconocible o más de 500 filas
}

const MAX_ADVANCE_CSV_ROWS = 500;
const ADVANCE_CSV_CODE_HEADERS = ['codigo', 'código', 'productcode'];
const ADVANCE_CSV_QTY_HEADERS = ['cantidad', 'quantity'];
const ADVANCE_CSV_WAREHOUSE_HEADERS = ['warehouseid', 'almacenid', 'almacénid'];

function normalizeCsvHeader(h: string): string {
  return h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Acepta "10", "10.5" y "10,5"; > 0 y hasta 2 decimales. */
function parseAdvanceQuantity(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (Math.round(n * 100) / 100 !== n) return null;
  return n;
}

/** Excel suele borrar los ceros a la izquierda: "21502" → "0000021502". */
function padAdvanceCode(code: string): string {
  const trimmed = code.trim();
  return /^\d+$/.test(trimmed) && trimmed.length < 10 ? trimmed.padStart(10, '0') : trimmed;
}

export function parseAdvancesCsv(text: string): ParseAdvancesCsvResult {
  const allLines = text.split(/\r?\n/).filter((r) => r.trim().length > 0);
  if (allLines.length === 0) {
    return { rows: [], mergedCount: 0, totalFileRows: 0, error: 'El archivo no tiene filas.' };
  }

  const separator = allLines[0].includes(';') ? ';' : ',';
  const firstCols = allLines[0].split(separator).map(normalizeCsvHeader);

  let codeIdx = firstCols.findIndex((c) => ADVANCE_CSV_CODE_HEADERS.includes(c));
  let qtyIdx = firstCols.findIndex((c) => ADVANCE_CSV_QTY_HEADERS.includes(c));
  let whIdx = firstCols.findIndex((c) => ADVANCE_CSV_WAREHOUSE_HEADERS.includes(c));
  const hasHeader = codeIdx >= 0 || qtyIdx >= 0;

  let dataLines: string[];
  if (hasHeader) {
    dataLines = allLines.slice(1);
    if (codeIdx < 0) codeIdx = 0;
    if (qtyIdx < 0) qtyIdx = 1;
  } else if (firstCols.length >= 3) {
    // Formato antiguo sin encabezado: productCode,warehouseId,quantity.
    codeIdx = 0;
    whIdx = 1;
    qtyIdx = 2;
    dataLines = allLines;
  } else if (firstCols.length === 2) {
    codeIdx = 0;
    qtyIdx = 1;
    dataLines = allLines;
  } else {
    return {
      rows: [],
      mergedCount: 0,
      totalFileRows: 0,
      error: 'No se reconocen las columnas. Usa la plantilla: codigo;cantidad.',
    };
  }

  if (dataLines.length > MAX_ADVANCE_CSV_ROWS) {
    return {
      rows: [],
      mergedCount: 0,
      totalFileRows: dataLines.length,
      error: `El archivo tiene ${dataLines.length} filas; el máximo es ${MAX_ADVANCE_CSV_ROWS}. Divídalo en varios archivos.`,
    };
  }

  const parsedRows: AdvanceCsvRow[] = dataLines.map((line, i) => {
    const cols = line.split(separator).map((c) => c.trim());
    const codeRaw = cols[codeIdx] ?? '';
    const qtyRaw = cols[qtyIdx] ?? '';
    const whRaw = whIdx >= 0 ? (cols[whIdx] ?? '') : '';
    const productCode = padAdvanceCode(codeRaw);
    const quantity = parseAdvanceQuantity(qtyRaw);
    const warehouseId = whRaw && Number(whRaw) > 0 ? Number(whRaw) : null;
    let formatError: string | null = null;
    if (!productCode) formatError = 'Código vacío';
    else if (quantity == null) formatError = 'Cantidad inválida (mayor a 0, hasta 2 decimales)';
    return {
      rowNumber: i + 1 + (hasHeader ? 1 : 0),
      productCode,
      warehouseId,
      quantity,
      formatError,
    };
  });

  // Filas con el mismo código: se suman en una sola línea.
  const rows: AdvanceCsvRow[] = [];
  const byCode = new Map<string, AdvanceCsvRow>();
  let mergedCount = 0;
  for (const row of parsedRows) {
    if (row.formatError || row.quantity == null) {
      rows.push(row);
      continue;
    }
    const existing = byCode.get(row.productCode);
    if (existing) {
      existing.quantity = (existing.quantity ?? 0) + row.quantity;
      mergedCount++;
    } else {
      const copy = { ...row };
      byCode.set(row.productCode, copy);
      rows.push(copy);
    }
  }

  return { rows, mergedCount, totalFileRows: dataLines.length, error: null };
}

export function downloadAdvancesCsvTemplate() {
  const csv = 'codigo;cantidad;nota_fila\n0000021502;10;\n0000023158;5;\n';
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-adelantos.csv';
  a.click();
  URL.revokeObjectURL(url);
}
