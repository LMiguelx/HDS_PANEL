export interface Product {
  productId: number;
  code?: string | null;
  name: string;
  familyName?: string | null;
  brandName?: string | null;
}

export interface PaymentCondition {
  paymentConditionId: number;
  code?: string | null;
  name: string;
}

export interface Family {
  familyId: number;
  name: string;
}
export interface Brand {
  brandId: number;
  name: string;
}
