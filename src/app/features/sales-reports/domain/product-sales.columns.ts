// Columnas del detalle de producto — doc 43, sección 7 y 8.3.
import { ExportColumn } from '../../../shared/utils/export/export.models';
import { ProductOrderRow } from '../../../shared/models/sales-report.models';
import { orderStatusName } from '../../orders/order-format';

/**
 * `includeOrderId`: "N.° pedido" sale **solo en el archivo** (sección 7) —
 * en pantalla, esa fila ya tiene el botón "Ver pedido".
 */
export function productSalesColumns(opts: {
  includeOrderId: boolean;
}): ExportColumn<ProductOrderRow>[] {
  const columns: ExportColumn<ProductOrderRow>[] = [
    { key: 'orderDate', header: 'Fecha', type: 'datetime', value: (r) => r.orderDate },
  ];
  if (opts.includeOrderId) {
    columns.push({
      key: 'orderId',
      header: 'N.° pedido',
      type: 'integer',
      value: (r) => r.orderId,
    });
  }
  columns.push(
    { key: 'customerName', header: 'Cliente', type: 'text', value: (r) => r.customerName },
    { key: 'salespersonName', header: 'Vendedor', type: 'text', value: (r) => r.salespersonName },
    {
      key: 'statusCode',
      header: 'Estado',
      type: 'text',
      value: (r) => orderStatusName(r.statusCode),
    },
    { key: 'quantity', header: 'Cantidad', type: 'quantity', value: (r) => r.quantity },
    { key: 'grossAmount', header: 'Bruto', type: 'money', value: (r) => r.grossAmount },
    { key: 'discountAmount', header: 'Descuento', type: 'money', value: (r) => r.discountAmount },
    { key: 'netAmount', header: 'Neto', type: 'money', bold: true, value: (r) => r.netAmount },
  );
  return columns;
}
