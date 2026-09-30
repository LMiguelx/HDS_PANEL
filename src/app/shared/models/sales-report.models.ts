// Contratos de Reportes de ventas (OrderReportController, /api/orders/reports).
// Ver 27-panel-admin-pedidos-reportes-ventas-dashboard.md, secciones 9-10.
import { PageResponse } from './api.models';

export interface SalespersonSettlementRow {
  date: string; // yyyy-MM-dd
  salespersonId: number; // para abrir Pedidos filtrado
  salespersonCode: string;
  salespersonName: string;
  orderCount: number;
  weightKg: number; // 1 decimal
  netAmount: number;
  firstOrderAt: string; // "Hora Inicio"
  lastOrderAt: string; // "Hora Fin"
}

export interface SalespersonSettlementReport {
  from: string;
  to: string;
  totalOrders: number; // "Sumas" — cuadra exacto con las filas
  totalWeightKg: number;
  totalNetAmount: number;
  lastOrderAt: string | null; // último pedido del período; null si no hubo pedidos
  rows: SalespersonSettlementRow[];
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
}
