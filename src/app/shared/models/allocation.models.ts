export interface AllocationView {
  allocationId: number;
  promoId: number | null;
  promoName: string | null; // NUEVO (doc 36, sección 4.2) — "—" si no tiene
  userId: number;
  userName: string; // NUEVO — el vendedor dueño del cupo
  productId: number;
  productName: string;
  productCode: string; // NUEVO
  allocatedQuantity: number;
  usedQuantity: number; // incluye lo usado en el pedido que se edita
  availableQuantity: number; // saldo (calculado por el backend); ya descuenta el pedido en edición
  periodStart: string;
  periodEnd: string | null;
}

// ── Creación (supervisor) ────────────────────────────────────────────────
export interface CreateAllocationCommand {
  userId: number;
  productId: number;
  quantity: number;
  periodStart: string;
  periodEnd?: string;
  promoId?: number;
}
