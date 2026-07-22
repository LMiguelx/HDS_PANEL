
export interface AllocationView {
  allocationId: number;
  promoId: number | null;
  userId: number;
  productId: number;
  productName: string;
  allocatedQuantity: number;
  usedQuantity: number;
  availableQuantity: number; // saldo (calculado por el backend)
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
