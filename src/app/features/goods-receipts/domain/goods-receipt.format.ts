// Catálogos y textos de Recepción de mercadería — doc 58, secciones 2, 4 y 9.
// Los nombres (statusName, documentTypeName…) llegan listos del servidor;
// estas tablas solo dan el tono visual y arman lo que el panel sí debe
// construir (insignias combinadas, filtros locales).
import { UiFieldOption } from '../../../shared/ui/field/field';
import {
  DocumentTypeCode,
  ReceiptIssueSeverity,
  ReceiptStatusCode,
  ReceiptUnitType,
} from './goods-receipt.models';

export type BadgeTone = 'amber' | 'red' | 'green' | 'blue' | 'gray';

export const BADGE_TONE_VAR: Record<BadgeTone, string> = {
  amber: '--st-in-route',
  red: '--st-mismatch',
  green: '--st-vigente',
  blue: '--st-open',
  gray: '--st-closed',
};

// ─────────────────────────── Estado de la entrega — sección 4.1 ───────────────────────────

export const STATUS_TONE: Record<ReceiptStatusCode, BadgeTone> = {
  IN_REVIEW: 'amber',
  CONFIRMED: 'green',
  CANCELLED: 'gray',
};

export const STATUS_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos' },
  { value: 'IN_REVIEW', label: 'En revisión' },
  { value: 'CONFIRMED', label: 'Confirmada' },
  { value: 'CANCELLED', label: 'Anulada' },
];

// ─────────────────────────── Tipo de documento — sección 4.3 ───────────────────────────

export const DOCUMENT_TYPE_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Elegir tipo…' },
  { value: 'INVOICE', label: 'Factura' },
  { value: 'DELIVERY_NOTE', label: 'Guía de remisión' },
  { value: 'CREDIT_NOTE', label: 'Nota de crédito' },
  { value: 'ENTRY_NOTE', label: 'Nota de ingreso' },
];

export function documentTypeName(code: DocumentTypeCode | string | null | undefined): string {
  return DOCUMENT_TYPE_OPTIONS.find((o) => o.value === code)?.label ?? '—';
}

// ─────────────────────────── Unidad de la planilla — sección 4.4 ───────────────────────────

export const UNIT_TYPE_OPTIONS: UiFieldOption[] = [
  { value: 'UNIT', label: 'Unidades' },
  { value: 'PACKAGE', label: 'Paquetes' },
];

export function unitTypeLabel(unitType: ReceiptUnitType | string | null | undefined): string {
  return UNIT_TYPE_OPTIONS.find((o) => o.value === unitType)?.label ?? '—';
}

// ─────────────────────────── Origen de la línea — sección 4.5 ───────────────────────────

export interface LineOrigin {
  label: string;
  tone: BadgeTone;
}

export function lineOrigin(aiRead: boolean, edited: boolean): LineOrigin {
  if (!aiRead) return { label: 'Manual', tone: 'gray' };
  return edited ? { label: 'Corregida', tone: 'amber' } : { label: 'IA', tone: 'blue' };
}

// ─────────────────────────── Observaciones — sección 4.6 ───────────────────────────

export const SEVERITY_LABEL: Record<ReceiptIssueSeverity, string> = {
  BLOCKING: 'Por corregir',
  WARNING: 'Aviso',
};

export const SEVERITY_TONE: Record<ReceiptIssueSeverity, BadgeTone> = {
  BLOCKING: 'red',
  WARNING: 'amber',
};

/** Campo al que apunta un código de observación — sección 4.6. Solo para ubicar el foco. */
export type IssueField =
  | 'supplierName'
  | 'ruc'
  | 'documentTypeCode'
  | 'documentNumber'
  | 'lines'
  | 'productCode'
  | 'quantity'
  | 'unitCost'
  | 'subtotal'
  | 'totals';

const ISSUE_FIELD: Record<string, IssueField> = {
  SUPPLIER_NAME_MISSING: 'supplierName',
  RUC_MISSING: 'ruc',
  RUC_MISMATCH: 'ruc',
  DOCUMENT_TYPE_MISSING: 'documentTypeCode',
  DOCUMENT_NUMBER_MISSING: 'documentNumber',
  DOCUMENT_ALREADY_LOADED: 'documentNumber',
  NO_LINES: 'lines',
  PRODUCT_NOT_MATCHED: 'productCode',
  PRODUCT_NOT_IN_BRAND: 'productCode',
  PRODUCT_DUPLICATED: 'productCode',
  QUANTITY_MISSING: 'quantity',
  UNIT_COST_MISSING: 'unitCost',
  SUBTOTAL_MISSING: 'subtotal',
  SUBTOTAL_MISMATCH: 'subtotal',
  BONUS_WITH_AMOUNT: 'subtotal',
  COST_DEVIATION: 'unitCost',
  DOCUMENT_TOTAL_MISMATCH: 'totals',
  DOCUMENT_TAX_MISMATCH: 'totals',
};

export function issueField(code: string): IssueField | null {
  return ISSUE_FIELD[code] ?? null;
}

// ─────────────────────────── Textos varios — sección 9 ───────────────────────────

export function documentSummaryText(
  documentTypeName: string | null,
  documentNumber: string | null,
): string {
  if (!documentTypeName && !documentNumber) return '— sin número —';
  return [documentTypeName, documentNumber].filter(Boolean).join(' ');
}

/** Costo unitario — hasta 4 decimales sin ceros sobrantes (sección 2). */
export function unitCostText(value: number | null | undefined): string {
  if (value == null) return '—';
  return `S/ ${Number(Math.round(value * 10000) / 10000)}`;
}

export function quantityInUnitsText(value: number | null | undefined): string {
  if (value == null) return '';
  const n = Math.round(value * 1000) / 1000;
  return `= ${n} und.`;
}
