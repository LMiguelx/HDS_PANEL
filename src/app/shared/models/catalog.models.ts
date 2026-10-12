// Contratos de Catálogo/Productos (/api/catalog). Ver
// 21-panel-admin-usuarios-roles-catalogo-precios-inventario.md, secciones 5-6.

export interface BrandView {
  brandId: number;
  code: string;
  name: string;
}

export interface FamilyView {
  familyId: number;
  brandId: number;
  brandName: string;
  code: number;
  name: string;
}

export interface PaymentConditionView {
  paymentConditionId: number;
  code: string;
  name: string;
  termDays: number;
}

/** Catálogo global de tipos de cliente — GET /catalog/customer-types (doc 38, sección 4.1). */
export interface CustomerTypeView {
  customerTypeId: number;
  code: string;
  name: string;
}

export interface ProductView {
  productId: number;
  code: string;
  name: string;
  barcode: string | null;
  unitOfMeasure: string;
  unitsPerPackage: number;
  weightKg: number;
  stock: number; // real, del warehouseId pedido
  isBonusEligible: boolean;
  familyId: number;
  familyName: string;
  brandName: string;
  active: boolean;
}

export interface ProductListFilters {
  q?: string;
  familyId?: number;
  brandId?: number;
  warehouseId: number; // obligatorio
  page?: number;
  size?: number;
}

export interface CreateProductCommand {
  code: string; // obligatorio, max 10, único — inmutable después
  name: string; // obligatorio, max 120
  familyId: number; // obligatorio
  barcode?: string; // max 20
  unitOfMeasure?: string; // max 10
  unitsPerPackage?: number;
  weightKg?: number;
  isBonusEligible: boolean;
}

export interface UpdateProductCommand {
  name: string; // obligatorio, max 120
  familyId: number; // obligatorio
  barcode?: string;
  unitOfMeasure?: string;
  unitsPerPackage?: number;
  weightKg?: number;
  isBonusEligible: boolean;
}

export interface ProductCreatedResult {
  productId: number;
  code: string;
}
