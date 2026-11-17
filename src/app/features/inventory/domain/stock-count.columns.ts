// Columnas del detalle de un conteo — doc 82, sección 6.3 ("Exportar"):
// exportador compartido del doc 43, sin llamadas extra, con las filas de la
// pestaña activa (o todas si se elige "Todos").
import { ExportColumn, ExportTable } from '../../../shared/utils/export/export.models';
import { exportFileName } from '../../../shared/utils/export/export-file-name';
import { CountProductLine, CountSummary, StockCountView } from './stock-count.models';
import { entryMethodLabel, lineStatusLabel } from './stock-count.format';
import { dateTimeText } from '../../assignments/assignment-format';

export const STOCK_COUNT_COLUMNS: ExportColumn<CountProductLine>[] = [
  { key: 'item', header: 'Ítem', type: 'integer', value: (_, index) => index + 1 },
  { key: 'productCode', header: 'Código', type: 'code', value: (r) => r.productCode },
  { key: 'productName', header: 'Producto', type: 'text', value: (r) => r.productName },
  { key: 'unitOfMeasure', header: 'Und.', type: 'text', value: (r) => r.unitOfMeasure },
  { key: 'unitsPerPackage', header: 'Und/caja', type: 'quantity', value: (r) => r.unitsPerPackage },
  { key: 'erpStock', header: 'Stock ERP', type: 'quantity', value: (r) => r.erpStock },
  {
    key: 'erpStockAt',
    header: 'Fecha ERP',
    type: 'text',
    value: (r) => (r.erpStockAt ? dateTimeText(r.erpStockAt) : 'Sin subida'),
  },
  { key: 'countedPackages', header: 'Paquetes', type: 'quantity', value: (r) => r.countedPackages },
  { key: 'countedUnits', header: 'Unidades', type: 'quantity', value: (r) => r.countedUnits },
  {
    key: 'countedQuantity',
    header: 'Total contado',
    type: 'quantity',
    bold: true,
    value: (r) => r.countedQuantity,
  },
  {
    key: 'difference',
    header: 'Diferencia',
    type: 'quantity',
    value: (r) => r.difference,
  },
  { key: 'status', header: 'Estado', type: 'text', value: (r) => lineStatusLabel(r.status) },
  {
    key: 'countedByName',
    header: 'Contado por',
    type: 'text',
    value: (r) => r.countedByName ?? '—',
  },
  {
    key: 'entryMethod',
    header: 'Origen',
    type: 'text',
    value: (r) => entryMethodLabel(r.entryMethod),
  },
];

/** `ExportTable` del detalle de un conteo — doc 82, sección 6.3. */
export function stockCountExportTable(
  header: StockCountView,
  summary: CountSummary,
  rows: CountProductLine[],
): ExportTable<CountProductLine> {
  return {
    title: `CONTEO DE INVENTARIO · ${header.brandName}`,
    subtitle: `${header.warehouseName} · Conteo N.° ${header.stockCountId} · ${
      header.userName ?? 'Sin responsable'
    } · Inicio ${dateTimeText(header.startedAt)} · ${
      header.closedAt ? 'Finalizado ' + dateTimeText(header.closedAt) : 'En curso'
    }`,
    filters: [],
    columns: STOCK_COUNT_COLUMNS,
    rows,
    footnote: `Totales: ${summary.totalProducts} productos · ${summary.done} realizados · ${summary.notFound} no encontrados · ${summary.pending} pendientes`,
    fileName: exportFileName(['conteo', header.brandName, String(header.stockCountId)]),
    sheetName: 'Conteo',
  };
}
