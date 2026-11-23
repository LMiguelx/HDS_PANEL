// Formato y lógica de color de "Sugerido de compra" — doc 94, sección 4.
// El backend NO envía un estado: el color lo decide el panel con
// consumptionPerDay, erpStock, coverageDays y coverageTargetDays (los días a
// cubrir DE LA RESPUESTA, no los del input).
import { PurchaseSuggestionRow } from './purchase-suggestion.models';

export type StockLevel = 'NO_MOVEMENT' | 'CRITICAL' | 'ORDER' | 'OVERSTOCK' | 'OK';

/** Cobertura crítica = la mitad de los días a cubrir; sobrestock = 4 veces. */
export const CRITICAL_COVERAGE_FACTOR = 0.5;
export const OVERSTOCK_COVERAGE_FACTOR = 4;

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  NO_MOVEMENT: 'Sin movimiento',
  CRITICAL: 'Crítico',
  ORDER: 'Pedir',
  OVERSTOCK: 'Sobrestock',
  OK: 'OK',
};

/** Variable CSS del color semántico de cada nivel — nunca un color fijo. */
export const STOCK_LEVEL_COLOR_VAR: Record<StockLevel, string> = {
  NO_MOVEMENT: '--ink-muted',
  CRITICAL: '--status-danger',
  ORDER: '--status-warn',
  OVERSTOCK: '--st-open',
  OK: '--status-ok',
};

/** Orden en que se listan los niveles en chips y en "Pedir con N días". */
export const STOCK_LEVEL_ORDER: StockLevel[] = [
  'CRITICAL',
  'ORDER',
  'OK',
  'OVERSTOCK',
  'NO_MOVEMENT',
];

/**
 * Nivel de un producto — doc 94, sección 4, en este orden exacto. `row` trae
 * su propia `coverageDays` (ya calculada por el backend); `targetDays` son
 * los días a cubrir de la respuesta (`report.coverageTargetDays`).
 */
export function stockLevel(
  row: Pick<PurchaseSuggestionRow, 'consumptionPerDay' | 'erpStock' | 'coverageDays'>,
  targetDays: number,
): StockLevel {
  if (row.consumptionPerDay === 0) return 'NO_MOVEMENT';
  if (
    row.erpStock === 0 ||
    (row.coverageDays != null && row.coverageDays < targetDays * CRITICAL_COVERAGE_FACTOR)
  ) {
    return 'CRITICAL';
  }
  if (row.coverageDays != null && row.coverageDays < targetDays) return 'ORDER';
  if (row.coverageDays != null && row.coverageDays > targetDays * OVERSTOCK_COVERAGE_FACTOR) {
    return 'OVERSTOCK';
  }
  return 'OK';
}

export type TrendTone = 'pos' | 'neg' | 'neutral' | 'new';

const TREND_UP_THRESHOLD = 10;
const TREND_DOWN_THRESHOLD = -10;

export function trendTone(trendPercent: number | null): TrendTone {
  if (trendPercent == null) return 'new';
  if (trendPercent >= TREND_UP_THRESHOLD) return 'pos';
  if (trendPercent <= TREND_DOWN_THRESHOLD) return 'neg';
  return 'neutral';
}

const TREND_COLOR_VAR: Record<TrendTone, string> = {
  pos: '--status-ok',
  neg: '--status-danger',
  neutral: '--ink-muted',
  new: '--ink-muted',
};

export function trendColorVar(trendPercent: number | null): string {
  return TREND_COLOR_VAR[trendTone(trendPercent)];
}

/** "↑ +18.1 %", "↓ −15.0 %", "→ +2.0 %" o "Nuevo" — doc 94, sección 4. */
export function trendText(trendPercent: number | null): string {
  if (trendPercent == null) return 'Nuevo';
  const tone = trendTone(trendPercent);
  const arrow = tone === 'pos' ? '↑' : tone === 'neg' ? '↓' : '→';
  const sign = trendPercent > 0 ? '+' : '';
  return `${arrow} ${sign}${trendPercent.toFixed(1)} %`;
}

const HOUR_MS = 60 * 60 * 1000;
const STALE_AFTER_HOURS = 24;

/** `true` si la última subida del ERP tiene más de 24 horas — doc 94, sección 4. */
export function isErpStockStale(erpStockAt: string | null, now = new Date()): boolean {
  if (!erpStockAt) return false;
  return now.getTime() - new Date(erpStockAt).getTime() > STALE_AFTER_HOURS * HOUR_MS;
}

/** "Sin subida del ERP" cuando nunca subió; si no, nada (la antigüedad va aparte). */
export function erpStockMissingText(erpStockAt: string | null): string {
  return erpStockAt ? '' : 'Sin subida del ERP';
}

const NUMBER_2DEC = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUMBER_1DEC = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const NUMBER_INT = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });

export function consumptionText(value: number): string {
  return NUMBER_2DEC.format(value);
}

/** "2.9 d" o "—" sin consumo. */
export function coverageText(coverageDays: number | null): string {
  return coverageDays == null ? '—' : `${NUMBER_1DEC.format(coverageDays)} d`;
}

export function integerText(value: number): string {
  return NUMBER_INT.format(value);
}

/** "50 paq" / "600 und" si maneja paquetes; solo unidades si no. "—" si es 0. */
export function suggestedMainText(
  suggestedUnits: number,
  suggestedPackages: number | null,
): string {
  if (suggestedUnits === 0) return '—';
  return suggestedPackages != null
    ? `${integerText(suggestedPackages)} paq`
    : `${integerText(suggestedUnits)} und`;
}

export function suggestedSubText(suggestedUnits: number, suggestedPackages: number | null): string {
  if (suggestedUnits === 0 || suggestedPackages == null) return '';
  return `${integerText(suggestedUnits)} und`;
}

/** Mini barra de cobertura — ancho relativo a los días a cubrir, acotado. */
export function coveragePct(coverageDays: number | null, targetDays: number): number {
  if (coverageDays == null || targetDays <= 0) return 0;
  return Math.max(4, Math.min(100, (coverageDays / targetDays) * 100));
}

/**
 * Texto de la fórmula aplicada, para el panel lateral — doc 94, sección 5.5:
 * "49.00 × 15 días − 140 = 595 → 50 paq de 12 = 600 und". Solo informativo:
 * el front no recalcula el sugerido, reconstruye cómo se llegó a él.
 */
export function purchaseFormulaText(
  row: Pick<
    PurchaseSuggestionRow,
    'consumptionPerDay' | 'erpStock' | 'suggestedUnits' | 'suggestedPackages' | 'unitsPerPackage'
  >,
  targetDays: number,
): string {
  const needRaw = row.consumptionPerDay * targetDays - row.erpStock;
  const needRounded = integerText(Math.round(Math.max(0, needRaw)));
  const base = `${consumptionText(row.consumptionPerDay)} × ${targetDays} días − ${integerText(row.erpStock)} = ${needRounded}`;
  if (row.suggestedUnits === 0) return `${base} → no hace falta pedir`;
  if (row.suggestedPackages != null && row.unitsPerPackage) {
    return `${base} → ${integerText(row.suggestedPackages)} paq de ${integerText(row.unitsPerPackage)} = ${integerText(row.suggestedUnits)} und`;
  }
  return `${base} → ${integerText(row.suggestedUnits)} und`;
}
