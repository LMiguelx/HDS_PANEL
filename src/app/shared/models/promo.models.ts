export interface PromoBenefit {
  benefitType: string;
  productId?: number | null;
  productName?: string | null;
  quantity?: number | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  label?: string | null;
}

export interface PromoTier {
  tier: number;
  fromQuantity: number;
  fromAmount: number;
  benefits: PromoBenefit[];
}

export interface PromoCondition {
  scope: string;
  productId?: number | null;
  productName?: string | null;
  familyId?: number | null;
  familyName?: string | null;
  brandId?: number | null;
  brandName?: string | null;
  minQuantity?: number | null;
  minAmount?: number | null;
}

export interface PromoSummary {
  promoId: number;
  code: string;
  name: string;
  promoType: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface PromoDetail extends PromoSummary {
  description?: string | null;
  salesChannelId?: number | null;
  repeats: boolean;
  conditions: PromoCondition[];
  tiers: PromoTier[];
}

// ── Creación ────────────────────────────────────────────────────────────
export interface CreatePromoCondition {
  scope: string;
  productId?: number;
  familyId?: number;
  brandId?: number;
  minQuantity?: number;
  minAmount?: number;
}
export interface CreatePromoBenefit {
  benefitType: string;
  productId?: number;
  quantity?: number;
  discountAmount?: number;
  discountPercent?: number;
  label?: string;
}
export interface CreatePromoTier {
  tier: number;
  fromQuantity: number;
  fromAmount: number;
  benefits: CreatePromoBenefit[];
}
export interface CreatePromoCommand {
  code: string;
  name: string;
  description?: string;
  promoType: string;
  salesChannelId?: number | null;
  repeats: boolean;
  startDate: string;
  endDate: string;
  conditions: CreatePromoCondition[];
  tiers: CreatePromoTier[];
}

export interface PromoCreatedResult {
  promoId: number;
}

// ── Targeting ───────────────────────────────────────────────────────────
export interface PromoTargetSegment {
  segmentId: number;
  mode: string;
} // INCLUDE | EXCLUDE
export interface PromoTargetCustomer {
  customerId: number;
  mode: string;
  maxQuantity?: number;
}
export interface PromoTargets {
  segments: PromoTargetSegment[];
  customers: PromoTargetCustomer[];
}
