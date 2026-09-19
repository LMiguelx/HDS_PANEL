// Contratos de Inventario/Stock (/api/inventory). Ver
// 21-panel-admin-usuarios-roles-catalogo-precios-inventario.md, sección 8.
import { PageResponse } from './api.models';

export interface WarehouseView {
  warehouseId: number;
  branchId: number;
  code: string;
  name: string;
}

export interface MovementView {
  stockMovementId: number;
  warehouseId: number;
  warehouseName: string;
  productId: number;
  movementTypeCode: string; // SALE_PROMISE | INVOICE_SYNC | RETURN | BONUS_OUT | BONUS_SUBSTITUTION | MANUAL_ADJUSTMENT | ERP_SYNC | ORDER_EDIT | BONUS_REVERSAL
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
  currentStock: number;
  movements: PageResponse<MovementView>;
}

export type AdjustmentMode = 'INCREASE' | 'DECREASE' | 'SET';

export interface StockAdjustmentLine {
  productCode: string; // código, no el id
  warehouseId: number;
  quantity: number; // siempre positivo, el mode define el signo
}

export interface BulkStockAdjustmentCommand {
  mode: AdjustmentMode; // aplica a toda la lista
  note?: string; // max 255
  lines: StockAdjustmentLine[];
}

export interface LineResult {
  lineIndex: number;
  productCode: string;
  warehouseId: number;
  applied: boolean;
  appliedDelta: number | null;
  errorReason: string | null;
}

export interface BulkStockAdjustmentResult {
  totalLines: number;
  appliedCount: number;
  lines: LineResult[];
}

export interface WarehouseStockItem {
  productId: number;
  productCode: string;
  productName: string;
  familyId: number;
  familyName: string;
  brandId: number;
  brandName: string;
  unitOfMeasure: string;
  unitsPerPackage: number;
  weightKg: number;
  isBonusEligible: boolean;
  quantity: number;
  updatedAt: string;
}

export interface WarehouseStockResponse {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  items: WarehouseStockItem[];
}
