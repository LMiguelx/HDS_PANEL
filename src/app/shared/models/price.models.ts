// Contratos de Precios (/api/prices). Ver
// 21-panel-admin-usuarios-roles-catalogo-precios-inventario.md, sección 7.
// No hay catálogo documentado de tipos de cliente (customerTypeId) — el
// formulario de precio lo pide como número, no como selector con nombre.

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
}

export interface UpsertPriceCommand {
  productId: number; // obligatorio
  paymentConditionId: number; // obligatorio
  customerTypeId: number; // obligatorio
  minQuantity: number; // obligatorio, > 0
  unitPrice: number; // obligatorio, > 0
}

export interface PriceResolved {
  productId: number;
  quantity: number;
  unitPrice: number;
  appliedMinQuantity: number;
  subtotal: number;
}
