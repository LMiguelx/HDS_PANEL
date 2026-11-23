// Columnas de exportación de "Sugerido de compra" — doc 94, sección 5.7.
import { ExportColumn } from '../../../shared/utils/export/export.models';
import { PurchaseSuggestionRow } from './purchase-suggestion.models';
import { STOCK_LEVEL_LABEL, stockLevel } from './purchase-suggestion.format';

export function purchaseSuggestionColumns(
  targetDays: number,
): ExportColumn<PurchaseSuggestionRow>[] {
  return [
    { key: 'productCode', header: 'Código', type: 'code', value: (r) => r.productCode },
    { key: 'productName', header: 'Producto', type: 'text', value: (r) => r.productName },
    { key: 'brandName', header: 'Marca', type: 'text', value: (r) => r.brandName },
    { key: 'unitOfMeasure', header: 'Unidad', type: 'text', value: (r) => r.unitOfMeasure },
    {
      key: 'unitsPerPackage',
      header: 'Und/paq',
      type: 'quantity',
      value: (r) => r.unitsPerPackage,
    },
    {
      key: 'consumptionPerDay',
      header: 'Cons./día',
      type: 'quantity',
      value: (r) => r.consumptionPerDay,
    },
    {
      key: 'consumptionPerWeek',
      header: 'Cons./sem.',
      type: 'quantity',
      value: (r) => r.consumptionPerWeek,
    },
    {
      key: 'consumptionLast4Weeks',
      header: '4 semanas',
      type: 'quantity',
      value: (r) => r.consumptionLast4Weeks,
    },
    {
      key: 'trendPercent',
      header: 'Tendencia %',
      type: 'text',
      value: (r) => (r.trendPercent != null ? `${r.trendPercent.toFixed(1)}%` : 'Nuevo'),
    },
    { key: 'erpStock', header: 'Stock ERP', type: 'quantity', value: (r) => r.erpStock },
    { key: 'erpStockAt', header: 'Fecha stock ERP', type: 'datetime', value: (r) => r.erpStockAt },
    {
      key: 'coverageDays',
      header: 'Cobertura (días)',
      type: 'quantity',
      value: (r) => r.coverageDays,
    },
    {
      key: 'level',
      header: 'Estado',
      type: 'text',
      value: (r) => STOCK_LEVEL_LABEL[stockLevel(r, targetDays)],
    },
    {
      key: 'suggestedPackages',
      header: 'Sugerido paq',
      type: 'quantity',
      value: (r) => r.suggestedPackages,
    },
    {
      key: 'suggestedUnits',
      header: 'Sugerido und',
      type: 'quantity',
      bold: true,
      value: (r) => r.suggestedUnits,
    },
    { key: 'unitCost', header: 'Costo unit.', type: 'money', value: (r) => r.unitCost },
    {
      key: 'estimatedCost',
      header: 'Costo estimado',
      type: 'money',
      bold: true,
      value: (r) => r.estimatedCost,
    },
  ];
}
