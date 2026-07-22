// Precios (admin). Archivo 07. Confirma con el Swagger.

export interface PriceRow {
  priceId: number;
  productId: number;
  paymentConditionId: number;
  paymentConditionName?: string | null;
  customerTypeId: number;
  customerTypeName?: string | null;
  minQuantity: number;
  unitPrice: number;
}

export interface UpsertPriceCommand {
  productId: number;
  paymentConditionId: number;
  customerTypeId: number;
  minQuantity: number;
  unitPrice: number;
}
