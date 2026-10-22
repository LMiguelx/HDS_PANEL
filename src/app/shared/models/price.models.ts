// Contratos de Precios (/api/prices). Ver
// 21-panel-admin-usuarios-roles-catalogo-precios-inventario.md, sección 7,
// y 38-panel-admin-correcciones-menu-precios-perfil-mantenimiento.md,
// sección 4.2-4.4 (customerTypeId ahora tiene catálogo propio — ver
// CustomerTypeView en catalog.models.ts — y PriceView trae `updatedAt`).

export interface PriceView {
  priceId: number;
  productId: number;
  productName: string;
  paymentConditionId: number;
  paymentConditionName: string;
  customerTypeId: number;
  customerTypeName: string;
  minQuantity: number;
  unitPrice: number;
  updatedAt: string; // ISO datetime — doc 38, sección 4.2
}

export interface UpsertPriceCommand {
  productId: number; // obligatorio
  paymentConditionId: number; // obligatorio
  customerTypeId: number; // obligatorio
  minQuantity: number; // obligatorio, >= 0.001
  unitPrice: number; // obligatorio, >= 0.0001
}

export interface PriceResolved {
  productId: number;
  quantity: number;
  unitPrice: number;
  appliedMinQuantity: number;
  subtotal: number;
}
