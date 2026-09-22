// Contratos del Dashboard (home) — GET /api/admin/dashboard/today. Ver
// 24-panel-admin-solicitudes-reparto-flota-asignaciones-dashboard-pedidos.md,
// sección 6. `report.view`.
import { ItemStatusCounts } from './delivery.models';

export interface DashboardOrdersSummaryView {
  date: string;
  totalOrders: number; // excluye CANCELLED
  totalAmount: number; // excluye CANCELLED
  totalBonusLines: number;
  totalBonusUnits: number;
  topBrandName: string | null; // null si no hubo ventas en el día
  topBrandAmount: number | null;
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
  roleCode: string;
  roleName: string;
  activeCount: number;
}

export interface DashboardActiveUsersView {
  date: string;
  byRole: RoleActiveCount[];
}

export interface TopSalespersonView {
  userId: number;
  fullName: string;
  branchName: string | null; // informativo (sede), no es un filtro
  netAmount: number;
}

export interface TopProductView {
  productId: number;
  productName: string;
  totalQuantity: number;
}

export interface DashboardCustomersView {
  date: string;
  customersWithOrder: number;
  totalActiveCustomers: number;
  coveragePercentage: number;
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
