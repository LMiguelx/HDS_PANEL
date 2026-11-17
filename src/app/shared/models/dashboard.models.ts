// Contratos del Dashboard (home) — GET /api/admin/dashboard/today y
// GET /api/admin/dashboard/pending. Ver
// 24-panel-admin-solicitudes-reparto-flota-asignaciones-dashboard-pedidos.md
// y 66-panel-admin-inicio-dashboard-usuarios.md. `report.view`.
import { ItemStatusCounts } from './delivery.models';

export interface OrderStatusCount {
  statusCode: string; // OPEN | SENT_TO_BILLING | CANCELLED | COUNTER_DELIVERED — NO mostrar
  statusName: string; // mostrar
  count: number;
  netAmount: number;
}

export interface OrderOriginCount {
  originCode: string; // FIELD | TELESALES | COUNTER — NO mostrar
  originName: string; // mostrar
  count: number;
  netAmount: number;
}

export interface DashboardOrdersSummaryView {
  date: string;
  totalOrders: number; // excluye CANCELLED
  totalAmount: number; // monto bruto, sin anulados
  totalBonusLines: number; // sin anulados
  totalBonusUnits: number; // sin anulados
  topBrandName: string | null; // null si no hubo ventas en el día
  topBrandAmount: number | null;
  netAmount: number; // bruto − descuentos, sin anulados
  byStatus: OrderStatusCount[]; // TODOS los estados (anulados incluidos), con 0 si no hubo
  byOrigin: OrderOriginCount[]; // TODOS los orígenes, solo no anulados, con 0 si no hubo
  erpUploadedCount: number; // pedidos no anulados que el ERP ya tomó para facturar
  pendingStockBonusLines: number; // bonificaciones del día que siguen sin stock
  pendingStockBonusUnits: number;
}

export interface BatchStatusCount {
  statusCode: string; // OPEN | IN_ROUTE | SETTLED
  count: number;
}

export interface DashboardDeliverySummaryView {
  date: string;
  totalBatches: number;
  totalAmount: number;
  returnedAmount: number;
  netAmount: number;
  batchesByStatus: BatchStatusCount[];
  totalItems: number;
  itemStatusCounts: ItemStatusCounts;
}

/** role.code es una lista abierta (sembrada por tenant) — no hardcodear un set fijo. */
export interface RoleActiveCount {
  roleCode: string; // NO mostrar; sirve para navegar a Usuarios
  roleName: string;
  activeCount: number; // usuarios del rol que ABRIERON JORNADA en la fecha
}

export interface DashboardActiveUsersView {
  date: string;
  byRole: RoleActiveCount[];
}

export interface TopSalespersonView {
  userId: number;
  fullName: string;
  branchName: string | null; // informativo (sede), no es un filtro
  salesChannelName: string; // canal del vendedor
  netAmount: number;
}

export interface TopProductView {
  productId: number;
  productName: string;
  totalQuantity: number;
}

/** doc 66, sección 2.3 — reemplaza la forma anterior (customersWithOrder/totalActiveCustomers/coveragePercentage). */
export interface DashboardCustomersView {
  date: string;
  scheduled: number; // programados en la fecha, entre todos los vendedores
  visited: number; // de ellos, visitados (= ordered + noOrder + closed)
  ordered: number; // con pedido (no anulado)
  noOrder: number; // visitados sin compra (o con pedido anulado)
  closed: number; // encontrados cerrados
  pending: number; // sin visitar (= scheduled − visited)
  visitPercentage: number; // visited / scheduled × 100, un decimal
  orderPercentage: number; // ordered / scheduled × 100, un decimal
}

export interface DashboardTodayView {
  date: string;
  orders: DashboardOrdersSummaryView;
  delivery: DashboardDeliverySummaryView;
  activeUsers: DashboardActiveUsersView;
  topSalespeople: TopSalespersonView[]; // top 5, fijo
  topProducts: TopProductView[]; // top 5, fijo
  customers: DashboardCustomersView;
}

/** doc 66, sección 2.5 — GET /api/admin/dashboard/pending. Siempre a hoy, sin parámetros. */
export interface RequestCounts {
  pending: number; // solicitudes pendientes
  readyToApprove: number; // de ellas, las que el ERP ya registró
}

export interface DashboardPendingView {
  creationRequests: RequestCounts;
  fieldChangeRequests: RequestCounts;
  closureRequests: RequestCounts;
  incompleteSchedules: number; // asignaciones de venta vigentes sin días o sin semanas del ciclo
  orphanCustomers: number; // clientes activos sin vendedor asignado
  pendingStockBonusOrders: number; // pedidos abiertos con alguna bonificación sin stock
  negativeStockProducts: number; // productos vendidos HOY cuyo stock del ERP no alcanza
}
