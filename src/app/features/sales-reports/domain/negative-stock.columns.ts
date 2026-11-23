// Columnas del reporte de negativos — doc 63, sección 7.1. Compartidas
// entre Validación de stock (pestaña Negativos del día) y la tarjeta
// Negativos de Validación de pedidos: mismo archivo desde las dos pantallas.
import { ExportColumn, ExportTable } from '../../../shared/utils/export/export.models';
import { exportFileName } from '../../../shared/utils/export/export-file-name';
import { NegativeStockReport, NegativeStockRow } from '../../../shared/models/sales-report.models';
import { erpUploadFileText } from '../stock-validation-format';
import { dateText, dateTimeText } from '../../assignments/assignment-format';

export const NEGATIVE_STOCK_COLUMNS: ExportColumn<NegativeStockRow>[] = [
  { key: 'item', header: 'Item', type: 'integer', value: (_, index) => index + 1 },
  { key: 'productCode', header: 'Código', type: 'code', value: (r) => r.productCode },
  { key: 'productName', header: 'Descripción', type: 'text', value: (r) => r.productName },
  { key: 'unitOfMeasure', header: 'Und.', type: 'text', value: (r) => r.unitOfMeasure },
  { key: 'soldQuantity', header: 'Vendido', type: 'quantity', value: (r) => r.soldQuantity },
  { key: 'systemStock', header: 'Stock app', type: 'quantity', value: (r) => r.systemStock },
  { key: 'erpStock', header: 'Stock ERP', type: 'quantity', value: (r) => r.erpStock },
  { key: 'erpStockAt', header: 'Subida ERP', type: 'text', value: (r) => erpUploadFileText(r) },
  {
    key: 'difference',
    header: 'Diferencia',
    type: 'quantity',
    redText: true,
    value: (r) => r.difference,
  },
];

/** `ExportTable` del reporte de negativos — doc 63, secciones 7.1 y 7.4. */
export function negativeStockExportTable(
  report: NegativeStockReport,
): ExportTable<NegativeStockRow> {
  return {
    title: 'REPORTE DE VENTAS CON STOCK INSUFICIENTE',
    subtitle: `${report.warehouseName} · Pedidos del ${dateText(report.date)} · Stock ERP al ${
      report.lastErpUploadAt ? dateTimeText(report.lastErpUploadAt) : 'sin subida'
    }`,
    filters: [],
    columns: NEGATIVE_STOCK_COLUMNS,
    rows: report.rows,
    footnote: report.rows.some((r) => r.erpStale)
      ? '* No vino en la última actualización del ERP.'
      : undefined,
    fileName: exportFileName(['negativos', report.warehouseName, report.date]),
    sheetName: 'Negativos',
    generatedAt: report.generatedAt,
  };
}
