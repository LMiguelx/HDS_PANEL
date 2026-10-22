import type { components } from '../../shared/models/api';

/**
 * Alias de los tipos generados en shared/models/api.ts (sección Promociones).
 * No se declaran formas a mano: esto solo nombra lo que ya está en `api.ts`
 * para no repetir `components['schemas']['X']` en cada archivo.
 */
export type PromoSummary = components['schemas']['PromoSummary'];
export type PromoPageResponse = components['schemas']['PageResponsePromoSummary'];
export type CreatePromoCommand = components['schemas']['CreatePromoCommand'];
export type UpdatePromoCommand = components['schemas']['UpdatePromoCommand'];

/**
 * `PromoDetail` gana `usage`, `definitionEditable` y `editBlockReason` —
 * doc 44, sección 6.1. `api.ts` (generado) todavía no los trae, así que se
 * extiende a mano en vez de tocar el archivo generado.
 */
export interface PromoUsageView {
  orderCount: number; // pedidos en los que se aplicó (NO anulados)
  grantedUnits: number; // unidades de producto bonificadas
  discountAmount: number; // soles descontados
  lastAppliedAt: string | null; // última aplicación; null = nunca
}

export type PromoDetail = components['schemas']['PromoDetail'] & {
  usage: PromoUsageView;
  definitionEditable: boolean; // true cuando usage.orderCount = 0
  editBlockReason: string | null; // por qué no se puede editar todo (null si definitionEditable)
};

/** Edición básica — doc 44, sección 7.3: PATCH /promos/{id}/basics, siempre permitido. */
export interface UpdatePromoBasicsCommand {
  name: string; // obligatorio, máx. 150
  endDate: string | null; // null = sin fecha de fin; no anterior a startDate
  priority: number; // obligatorio, 1 a 999
}

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

// POST /promos/{id}/preview ya no existe (doc 44, sección 11.5): la prueba
// de una promoción se hace con Simular pedido + `promoId` (sección 9).

export type PendingChoiceView = components['schemas']['PendingChoiceView'];
export type ChoiceOptionView = components['schemas']['ChoiceOptionView'];
export type PendingCountView = components['schemas']['PendingCountView'];
export type ResolveChoiceCommand = components['schemas']['ResolveChoiceCommand'];
export type ApplicationView = components['schemas']['ApplicationView'];

export type LookupItem = components['schemas']['LookupItem'];
