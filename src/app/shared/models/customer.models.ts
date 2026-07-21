export interface CustomerSummary {
  customerId: number;
  businessName: string;
  documentNumber: string;
  address: string | null;
  customerTypeName: string | null;
  active: boolean;
}

export interface CustomerMetrics {
  lastPurchaseAt: string | null;
  orders30: number;
  amount30: number;
  orders90: number;
  amount90: number;
  orders365: number;
  amount365: number;
  avgDaysBetweenOrders: number | null;
  favoriteFamily: string | null;
}

export interface CustomerDetail {
  customerId: number;
  businessName: string;
  documentTypeName: string | null;
  documentNumber: string;
  address: string | null;
  customerTypeName: string | null;
  salesChannelName: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  metrics: CustomerMetrics | null;
}

export interface CustomerInvoiceSummary {
  invoiceId: string;
  issueDate: string; // ISO
  totalAmount: number;
  matchStatus: string; // UNMATCHED | MATCHED_AUTO | MATCHED_MANUAL | MISMATCH
}
