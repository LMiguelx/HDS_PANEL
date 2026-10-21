// Contratos del pedido de mostrador, jornada y simulación — doc 30
// (panel-admin-pedido-mostrador-simulacion-reportes.md), con los campos de
// "Venta para" del doc 44 (atribución a otro vendedor y estado de ruta).
// Escritos a mano: son endpoints nuevos que api.ts (generado) todavía no incluye.

// ---- Jornada de mostrador (RouteController, /api/routes) ----

export interface RouteView {
  routeId: number;
  routeDate: string; // yyyy-MM-dd
  startTime: string; // ISO datetime
  endTime: string | null; // null = sigue abierta
  startLocation: string | null; // null en mostrador
  endLocation: string | null;
}

// ---- Contexto del cliente para un pedido de mostrador ----

export interface CounterAssignmentView {
  assignmentId: number; // se envía al registrar si la venta va al vendedor
  salespersonId: number; // se envía como excludeUserId al pedir la lista de "otro vendedor"
  salespersonCode: string;
  salespersonName: string;
  salesChannelId: number | null;
  salesChannelName: string | null;
  salespersonActive: boolean; // doc 44 — false: deshabilitar "Vendedor asignado"
  onRoute: boolean; // doc 44 — tiene la jornada de hoy abierta
  routeStartedAt: string | null; // doc 44 — ISO datetime; null si no está en ruta
}

/** "Otro vendedor" — doc 44, sección 5.3: GET /orders/counter/salespeople. */
export interface CounterSalespersonView {
  salespersonId: number; // se envía como salespersonId en la opción "Otro vendedor"
  salespersonCode: string;
  salespersonName: string;
  salesChannelId: number | null;
  salesChannelName: string | null;
  onRoute: boolean;
  routeStartedAt: string | null;
}

export interface CounterTodayOrderView {
  orderId: number;
  statusCode: string;
  originCode: string;
  salespersonId: number;
  salespersonName: string;
}

export interface CounterCustomerContext {
  customerId: number;
  code: string;
  businessName: string;
  documentNumber: string;
  address: string | null;
  customerTypeId: number | null; // define la lista de precios
  customerTypeName: string | null;
  active: boolean;
  salesAssignment: CounterAssignmentView | null;
  todayOrder: CounterTodayOrderView | null;
  canCreateOrder: boolean;
  blockReason: string | null;
}

// ---- Registrar / editar ----

export interface OrderItemCommand {
  productId: number;
  quantity: number; // mínimo 0.001
}

export interface CreateCounterOrderCommand {
  customerId: number;
  paymentConditionId: number;
  assignmentId?: number; // opción 1: dar la venta al vendedor asignado
  salesChannelId?: number | null; // opción 2 (mostrador): obligatorio
  deliverNow: boolean;
  note?: string; // máx. 255
  idempotencyKey: string; // máx. 36
  catalogItems: OrderItemCommand[];
  predictedItems: OrderItemCommand[];
  salespersonId?: number; // doc 44 — opción 3: dar la venta a otro vendedor activo
}

export interface OrderCreatedResult {
  orderId: number;
  totalAmount: number; // bruto
  statusCode: string; // OPEN | COUNTER_DELIVERED
  duplicate: boolean;
  bonusLines: number;
  pendingBonusLines: number;
  promoDiscountTotal: number;
  pendingChoiceCount: number;
}

// ---- Sugerido / predicción ----

export interface SuggestedItem {
  productId: number;
  productName: string;
  purchaseCount: number;
  lastPurchasedAt: string | null; // yyyy-MM-dd
  avgQuantity: number; // cantidad propuesta
}
