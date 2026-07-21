
export interface CreationRequest {
  requestId: number;
  businessName: string;
  documentTypeName: string | null;
  documentNumber: string;
  customerTypeName: string | null;
  address: string | null;
  businessActivity: string | null;
  phone: string | null;
  requestedByName: string | null;
  requestedAt: string; // ISO
}

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface FieldChangeRequest {
  requestId: number;
  customerId: number;
  businessName: string; // cliente afectado
  changes: FieldChange[];
  requestedByName: string | null;
  requestedAt: string;
}

export interface ClosureRequest {
  requestId: number;
  customerId: number;
  businessName: string;
  reason: string | null;
  requestedByName: string | null;
  requestedAt: string;
}
