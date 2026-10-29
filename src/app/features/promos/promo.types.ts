import type { components } from '../../shared/models/api';

/**
 * Alias de los tipos generados en shared/models/api.ts (sección Promociones).
 * No se declaran formas a mano: esto solo nombra lo que ya está en `api.ts`
 * para no repetir `components['schemas']['X']` en cada archivo.
 */
export type PromoPageResponse = Omit<
  components['schemas']['PageResponsePromoSummary'],
  'content'
> & { content: PromoSummary[] };
/**
 * `combineTiers` ("Sumar tramos") — doc 57, sección 4.1. `api.ts` todavía
 * no lo trae, así que se extiende a mano, igual que `CreatePromoCommand`.
 */
export type UpdatePromoCommand = Omit<components['schemas']['UpdatePromoCommand'], 'conditions'> & {
  combineTiers: boolean; // NUEVO — doc 57
  conditions?: ConditionCommand[];
};

/**
 * `featured` (destacada en la app del vendedor) — doc 49, secciones 5.1 y
 * 8.1. `api.ts` todavía no lo trae en estos tres, así que se extiende a
 * mano. `UpdatePromoCommand` (edición con el asistente) NO lleva
 * `featured`: destacar no es parte de la regla (doc 49, sección 8.2).
 *
 * `rewardStatus`/`rewardStatusLabel` — doc 51, sección 11.2: solo llegan en
 * `GET /promos/current`; en el listado general (`GET /promos`) llegan en
 * `null` y no se pinta insignia.
 */
export type PromoSummary = components['schemas']['PromoSummary'] & {
  featured: boolean;
  rewardStatus: 'AVAILABLE' | 'PARTIAL' | 'SOLD_OUT' | null;
  rewardStatusLabel: string | null;
};
/**
 * `combineTiers` ("Sumar tramos") — doc 57, sección 4.1. `api.ts` todavía
 * no lo trae, así que se extiende a mano. `conditions` se reescribe para
 * que use el `ConditionCommand` local (con `required`/`minQuantity`) en
 * vez del generado, que aún no los tiene.
 */
export type CreatePromoCommand = Omit<components['schemas']['CreatePromoCommand'], 'conditions'> & {
  featured?: boolean;
  combineTiers?: boolean; // NUEVO — doc 57. Si no se envía: false
  conditions?: ConditionCommand[];
};

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

export type PromoDetail = Omit<components['schemas']['PromoDetail'], 'conditions'> & {
  usage: PromoUsageView;
  definitionEditable: boolean; // true cuando usage.orderCount = 0
  editBlockReason: string | null; // por qué no se puede editar todo (null si definitionEditable)
  featured: boolean; // doc 49, sección 6.1 — destacada en la app del vendedor
  combineTiers: boolean; // doc 57, sección 4.2 — la promoción suma tramos
  conditions?: ConditionView[];
};

/** Edición básica — doc 44, sección 7.3: PATCH /promos/{id}/basics, siempre permitido. */
export interface UpdatePromoBasicsCommand {
  name: string; // obligatorio, máx. 150
  endDate: string | null; // null = sin fecha de fin; no anterior a startDate
  priority: number; // obligatorio, 1 a 999
  featured: boolean | null; // doc 49, sección 7.1 — enviar siempre true/false; null = no se cambia
}

/**
 * `required`/`minQuantity` ("producto obligatorio") — doc 57, sección 4.1.
 * `api.ts` todavía no los trae, así que se extienden a mano.
 */
export type ConditionCommand = components['schemas']['ConditionCommand'] & {
  required?: boolean; // NUEVO. Si no se envía: false
  minQuantity?: number | null; // NUEVO — obligatorio si required = true, > 0; si no, enviar null
};

/** `required`/`minQuantity`/`requiredText` — doc 57, sección 4.2. `requiredText` llega listo. */
export type ConditionView = components['schemas']['ConditionView'] & {
  required: boolean; // NUEVO
  minQuantity: number | null; // NUEVO — null si no es obligatoria
  requiredText: string | null; // NUEVO — "Obligatorio: al menos N unidad(es)"; null si no es obligatoria
};
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

/**
 * `ApplicationView` gana `customerName`, `benefitTypeName`, `status` y
 * `statusLabel` — doc 47, sección 12.2 ("Promociones del pedido"). `api.ts`
 * todavía no los trae.
 */
export type ApplicationView = components['schemas']['ApplicationView'] & {
  customerName: string;
  benefitTypeName: string;
  status: string; // GRANTED | PENDING_CHOICE | DECLINED | REVERSED
  statusLabel: string;
};

export type LookupItem = components['schemas']['LookupItem'];
