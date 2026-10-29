// Contratos de Reportes de ventas (OrderReportController, /api/orders/reports).
// Ver 27-panel-admin-pedidos-reportes-ventas-dashboard.md, secciones 9-10.
import { PageResponse } from './api.models';

/** `GroupBy` de la liquidación — doc 43, sección 3.2. */
export type SettlementGroupBy = 'DAY' | 'SALESPERSON';

export interface SalespersonSettlementRow {
  date: string | null; // yyyy-MM-dd; null en la vista por vendedor (doc 43)
  salespersonId: number; // para abrir Pedidos filtrado
  salespersonCode: string;
  salespersonName: string;
  orderCount: number;
  weightKg: number; // 1 decimal
  netAmount: number;
  firstOrderAt: string | null; // "Hora Inicio" — campo y televentas; null en la vista por vendedor o si ese día no hubo campo ni televentas
  lastOrderAt: string | null; // "Hora Fin"
  fieldOrderCount: number; // NUEVO (doc 42): ahora solo campo, antes incluía todo lo que no era mostrador
  fieldNetAmount: number;
  counterOrderCount: number;
  counterNetAmount: number;
  telesalesOrderCount: number; // NUEVO (doc 42, sección 12.2)
  telesalesNetAmount: number;
  workedDays: number; // NUEVO (doc 43) — días con campo o televentas; por fila de día, 1 o 0
}

export interface SalespersonSettlementReport {
  from: string;
  to: string;
  totalOrders: number; // "Sumas" — cuadra exacto con las filas
  totalWeightKg: number;
  totalNetAmount: number;
  lastOrderAt: string | null; // último pedido de campo o televentas del período; null si no hubo
  rows: SalespersonSettlementRow[];
  originCode: string | null; // el filtro aplicado (FIELD | TELESALES | COUNTER); null = todos
  totalFieldOrders: number;
  totalFieldNetAmount: number;
  totalCounterOrders: number;
  totalCounterNetAmount: number;
  totalTelesalesOrders: number; // NUEVO (doc 42, sección 12.2)
  totalTelesalesNetAmount: number;
  salespersonId: number | null; // NUEVO (doc 43) — filtro aplicado; null = todos
  salespersonName: string | null; // NUEVO — para el título y el archivo
  groupBy: SettlementGroupBy; // NUEVO
}

export interface ProductSalesRow {
  productId: number;
  productCode: string;
  productName: string;
  orderCount: number; // pedidos distintos con este producto
  quantity: number; // unidades vendidas
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
}

/**
 * orderCount de la marca NO es la suma de los orderCount de sus productos
 * — un mismo pedido puede llevar varios productos de la marca y a nivel
 * marca cuenta una sola vez. products ya viene ordenado por netAmount desc.
 */
export interface BrandSalesReport {
  brandId: number;
  brandName: string;
  from: string;
  to: string;
  orderCount: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  products: ProductSalesRow[];
  salespersonId: number | null; // null si no se filtró
  salespersonName: string | null;
}

/** Un pedido donde se vendió el producto — montos solo de ESE producto dentro del pedido. */
export interface ProductOrderRow {
  orderId: number;
  orderDate: string;
  statusCode: string; // sección 3.1 (nunca CANCELLED)
  customerId: number;
  customerName: string;
  salespersonId: number;
  salespersonName: string;
  quantity: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
}

export interface ProductSalesReport {
  productId: number;
  productCode: string;
  productName: string;
  brandName: string;
  from: string;
  to: string;
  orderCount: number; // del rango completo, no de la página
  quantity: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  orders: PageResponse<ProductOrderRow>;
  salespersonId: number | null; // null si no se filtró
  salespersonName: string | null;
}

// ─────────────────────── Validación de stock — doc 56, sección 6 ───────────────────────
// Reemplaza "Ventas con stock" (doc 30): /orders/reports/sales-stock ya no existe.

/** `status` de una fila — doc 56, sección 4.1. */
export type StockValidationStatus = 'SHORTFALL' | 'NO_ERP_STOCK' | 'OK';

export interface StockValidationRow {
  productId: number; // NO mostrar — sirve para abrir sus pedidos
  productCode: string;
  productName: string;
  unitOfMeasure: string;
  toBillQuantity: number; // Por facturar
  pendingQuantity: number; // Bonificación pendiente
  erpStock: number | null; // Stock ERP; null si el ERP nunca lo subió
  erpStockAt: string | null; // hora de esa subida; null si nunca
  erpStale: boolean; // no vino en la última actualización del ERP
  availableQuantity: number | null; // Disponible; null sin stock del ERP
  shortfallQuantity: number; // Faltan (0 si alcanza)
  openAdvanceQuantity: number; // adelantos abiertos del producto
  advanceNotBacked: boolean; // hay faltante Y adelanto abierto
  systemStock: number; // stock actual de la app (referencia)
  nextAdjustment: number | null; // próximo ajuste; negativo = la app tiene de más; null sin stock del ERP
  status: StockValidationStatus;
}

export interface StockValidationReport {
  warehouseId: number; // NO mostrar
  warehouseName: string;
  onlyIssues: boolean;
  lastErpUploadAt: string | null; // última actualización del ERP en el almacén; null si nunca
  pendingUploads: number; // subidas del ERP aún en proceso (> 0 = el reporte aún no refleja la última)
  productCount: number; // productos con algo por facturar (todos, aunque onlyIssues filtre)
  shortfallCount: number;
  noErpStockCount: number;
  staleCount: number;
  appExcessCount: number;
  advanceNotBackedCount: number;
  rows: StockValidationRow[];
}

/** Panel "Pedidos de un producto" — doc 56, sección 7. */
export interface StockValidationOrderRow {
  orderId: number; // mostrar como "N.° de pedido"
  orderDate: string;
  statusCode: string; // OPEN | SENT_TO_BILLING | COUNTER_DELIVERED
  originCode: string; // FIELD | TELESALES | COUNTER
  customerId: number; // NO mostrar
  customerName: string;
  salespersonId: number; // NO mostrar
  salespersonName: string;
  saleQuantity: number;
  bonusQuantity: number;
  pendingQuantity: number; // de bonusQuantity, pendiente de stock
  editable: boolean; // true = sigue abierto: se puede editar
}

export interface StockValidationProductDetail {
  warehouseId: number; // NO mostrar
  warehouseName: string;
  product: StockValidationRow; // cabecera del panel
  orders: StockValidationOrderRow[]; // del más antiguo al más nuevo
}
