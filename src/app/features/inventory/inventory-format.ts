import { UiFieldOption } from '../../shared/ui/field/field';
import { UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { ProductView } from '../../shared/models/catalog.models';
import {
  ReconciliationResultFilter,
  StockAdvanceStatusCode,
  StockReconciliationView,
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

export type ReconciliationResult = 'FAILED' | 'INCREASED' | 'DECREASED' | 'MATCHED';

/** Deduce el resultado de una fila — doc 35, sección 3.5. No es un campo del backend. */
export function reconciliationResult(row: StockReconciliationView): ReconciliationResult {
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
];

export function resultFilterLabel(value: ReconciliationResultFilter | ''): string {
  return RECONCILIATION_RESULT_OPTIONS.find((o) => o.value === value)?.label ?? 'Todos';
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
