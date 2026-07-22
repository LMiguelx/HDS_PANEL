// Facturación / conciliación. Archivo 08. Confirma shapes con el Swagger.

export interface InvoiceSummary {
  invoiceId: string;
  customerId: number;
  customerName: string;
  issueDate: string;
  totalAmount: number;
  matchStatus: string; // UNMATCHED | MATCHED_AUTO | MATCHED_MANUAL | MISMATCH
  orderId?: number | null;
}

export interface InvoiceItemView {
  lineNumber: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceDetail {
  invoiceId: string;
  customerId: number;
  customerName: string;
  issueDate: string;
  totalAmount: number;
  matchStatus: string;
  orderId?: number | null;
  items: InvoiceItemView[];
}

// Resultados (shape asumido → confirmar)
export interface AutoMatchResult {
  matched: number;
}
export interface ImportResult {
  imported: number;
  skipped: number;
}

// Emparejado manual
export interface MatchCommand {
  orderId: number;
}

// Cruce con bonificaciones del pedido (8.8)
export interface PromoApplicationView {
  promoId: number;
  promoName?: string | null;
  benefitType: string; // FREE_PRODUCT | DISCOUNT_AMOUNT | DISCOUNT_PERCENT
  productId?: number | null;
  productName?: string | null;
  quantity?: number | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
}
