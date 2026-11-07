// Contratos de Facturas (/api/invoices). Ver
// 16-panel-supervision-reparto-facturas.md. Las facturas nacen en el ERP —
// el backend solo lee y concilia (match_status_id, match_notes, order_id).
//
// `POST /auto-match` e `invoiceStatusCode` quedan pendientes de confirmación
// con el backend (no están en el InvoiceAdminController revisado) — no se
// conectan a ningún endpoint todavía.

export interface InvoiceSummary {
  invoiceId: string;
  documentTypeAbbr: string;
  series: string;
  number: number;
  issueDate: string; // yyyy-MM-dd
  customerId: number;
  customerName: string;
  grandTotal: number;
  matchStatusCode: string; // UNMATCHED | MATCHED_AUTO | MATCHED_MANUAL | MISMATCH
  orderId: number | null; // null = no conciliada
}

export interface InvoiceListFilters {
  page?: number;
  size?: number;
}

export interface InvoiceItemView {
  lineNumber: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  free: boolean; // línea bonificada
}

export interface InvoiceDetail {
  invoiceId: string;
  documentTypeName: string;
  series: string;
  number: number;
  issueDate: string;
  dueDate: string | null;
  customerId: number;
  customerName: string;
  salespersonId: number | null;
  currencyCode: string; // PEN | USD
  totalAmount: number;
  perceptionAmount: number;
  grandTotal: number;
  matchStatusCode: string;
  matchNotes: string | null;
  orderId: number | null;
  items: InvoiceItemView[];
}

export interface ManualMatchCommand {
  orderId: number;
  notes?: string; // máx 500
}

export interface MismatchCommand {
  notes: string; // obligatorio, máx 500
}
