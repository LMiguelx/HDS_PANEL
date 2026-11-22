// Columnas de exportación de "Marcas por mes" — doc 93, secciones 3.6 y 3.7.
import { ExportColumn } from '../../../shared/utils/export/export.models';
import { BrandMonthlyRow, ProductMonthlyRow } from '../../../shared/models/sales-report.models';
import {
  MONTH_SHORT_NAMES,
  peakText,
  peakUnitsText,
  variationPctText,
} from './brand-monthly.format';

export function brandMonthlyColumns(showCompare: boolean): ExportColumn<BrandMonthlyRow>[] {
  const monthColumns: ExportColumn<BrandMonthlyRow>[] = MONTH_SHORT_NAMES.map((name, i) => ({
    key: `month${i + 1}`,
    header: name,
    type: 'money',
    value: (r) => r.months[i]?.netAmount ?? null,
  }));
  const columns: ExportColumn<BrandMonthlyRow>[] = [
    { key: 'rank', header: '#', type: 'integer', value: (r) => r.rank },
    { key: 'brandName', header: 'Marca', type: 'text', value: (r) => r.brandName },
    ...monthColumns,
    { key: 'totalNet', header: 'Total', type: 'money', bold: true, value: (r) => r.totalNet },
    { key: 'share', header: '%', type: 'text', value: (r) => `${r.share}%` },
    {
      key: 'peak',
      header: 'Pico',
      type: 'text',
      value: (r) => peakText(r.peakMonth, r.peakNetAmount),
    },
  ];
  if (showCompare) {
    columns.push({
      key: 'variation',
      header: 'vs año anterior',
      type: 'text',
      value: (r) => variationPctText(r.totalNet, r.previousYearTotalNet),
    });
  }
  return columns;
}

export function productMonthlyColumns(byUnits: boolean): ExportColumn<ProductMonthlyRow>[] {
  const monthColumns: ExportColumn<ProductMonthlyRow>[] = MONTH_SHORT_NAMES.map((name, i) => ({
    key: `month${i + 1}`,
    header: name,
    type: byUnits ? 'quantity' : 'money',
    value: (r) => (byUnits ? (r.months[i]?.units ?? null) : (r.months[i]?.netAmount ?? null)),
  }));
  return [
    { key: 'productCode', header: 'Código', type: 'code', value: (r) => r.productCode },
    { key: 'productName', header: 'Producto', type: 'text', value: (r) => r.productName },
    ...monthColumns,
    { key: 'totalUnits', header: 'Unidades', type: 'quantity', value: (r) => r.totalUnits },
    { key: 'totalNet', header: 'S/', type: 'money', bold: true, value: (r) => r.totalNet },
    {
      key: 'totalBonusUnits',
      header: 'Bonif.',
      type: 'quantity',
      emptyWhenZero: true,
      value: (r) => r.totalBonusUnits,
    },
    {
      key: 'peak',
      header: 'Pico',
      type: 'text',
      value: (r) => peakUnitsText(r.peakMonth, r.peakUnits),
    },
  ];
}
