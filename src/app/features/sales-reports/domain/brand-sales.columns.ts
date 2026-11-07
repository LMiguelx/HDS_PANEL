// Columnas de Marcas y productos — doc 43, sección 6 y 8.3.
import { ExportColumn } from '../../../shared/utils/export/export.models';
import { ProductSalesRow } from '../../../shared/models/sales-report.models';

export function brandSalesColumns(): ExportColumn<ProductSalesRow>[] {
  return [
    { key: 'productCode', header: 'Código', type: 'code', value: (r) => r.productCode },
    { key: 'productName', header: 'Producto', type: 'text', value: (r) => r.productName },
    { key: 'orderCount', header: 'Pedidos', type: 'integer', value: (r) => r.orderCount },
    { key: 'quantity', header: 'Unidades', type: 'quantity', value: (r) => r.quantity },
    { key: 'grossAmount', header: 'Bruto', type: 'money', value: (r) => r.grossAmount },
    { key: 'discountAmount', header: 'Descuento', type: 'money', value: (r) => r.discountAmount },
    { key: 'netAmount', header: 'Neto', type: 'money', bold: true, value: (r) => r.netAmount },
  ];
}
