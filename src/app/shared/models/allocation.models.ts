// Dotaciones (producto que el vendedor/admin puede regalar). Archivo 04.

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
