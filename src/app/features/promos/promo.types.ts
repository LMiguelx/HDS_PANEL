import type { components } from '../../shared/models/api';

/**
 * Alias de los tipos generados en shared/models/api.ts (sección Promociones).
 * No se declaran formas a mano: esto solo nombra lo que ya está en `api.ts`
 * para no repetir `components['schemas']['X']` en cada archivo.
 */
export type PromoSummary = components['schemas']['PromoSummary'];
export type PromoPageResponse = components['schemas']['PageResponsePromoSummary'];
export type PromoDetail = components['schemas']['PromoDetail'];
export type CreatePromoCommand = components['schemas']['CreatePromoCommand'];
export type UpdatePromoCommand = components['schemas']['UpdatePromoCommand'];

export type ConditionCommand = components['schemas']['ConditionCommand'];
export type ConditionView = components['schemas']['ConditionView'];
export type TierCommand = components['schemas']['TierCommand'];
export type TierView = components['schemas']['TierView'];
export type BenefitGroupCommand = components['schemas']['BenefitGroupCommand'];
export type BenefitGroupView = components['schemas']['BenefitGroupView'];
export type BenefitCommand = components['schemas']['BenefitCommand'];
export type BenefitView = components['schemas']['BenefitView'];

export type TargetsCommand = components['schemas']['TargetsCommand'];
export type SegmentTargetCommand = components['schemas']['SegmentTargetCommand'];
export type CustomerTargetCommand = components['schemas']['CustomerTargetCommand'];
export type SegmentTargetView = components['schemas']['SegmentTargetView'];
export type CustomerTargetView = components['schemas']['CustomerTargetView'];
export type TargetReachView = components['schemas']['TargetReachView'];

export type PreviewCommand = components['schemas']['PreviewCommand'];
export type PreviewLineCommand = components['schemas']['PreviewLineCommand'];
export type PreviewResult = components['schemas']['PreviewResult'];
export type PendingChoicePreview = components['schemas']['PendingChoicePreview'];

export type PendingChoiceView = components['schemas']['PendingChoiceView'];
export type ChoiceOptionView = components['schemas']['ChoiceOptionView'];
export type PendingCountView = components['schemas']['PendingCountView'];
export type ResolveChoiceCommand = components['schemas']['ResolveChoiceCommand'];

export type LookupItem = components['schemas']['LookupItem'];
