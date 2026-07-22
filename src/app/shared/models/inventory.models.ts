// Inventario / Kardex (admin). Archivo 07. Stock REFERENCIAL (el oficial está en el ERP).
import { PageResponse } from './api.models';

export interface MovementView {
  stockMovementId: number;
  warehouseId: number;
  warehouseName: string;
  productId: number;
  movementTypeCode: string; // SALE_PROMISE | INVOICE_SYNC | RETURN | BONUS_OUT | BONUS_SUBSTITUTION | MANUAL_ADJUSTMENT | ERP_SYNC
  quantity: number; // ± (positivo entra, negativo sale)
  referenceTable: string;
  referenceId: string;
  note: string;
  createdBy: number;
  createdAt: string;
}

export interface KardexResponse {
  productId: number;
  productName: string;
  referenceStock: number;
  movements: PageResponse<MovementView>;
}

export interface WarehouseView {
  warehouseId: number;
  code?: string | null;
  name: string;
}

export interface CreateMovementCommand {
  warehouseId: number;
  productId: number;
  quantity: number; // negativo para merma
  note: string;
}
