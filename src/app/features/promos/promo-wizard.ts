import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiCheckbox } from '../../shared/ui/checkbox/checkbox';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiCard } from '../../shared/ui/card/card';
import { UiBadge } from '../../shared/ui/badge/badge';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { UiWizardSteps, UiWizardStep } from './ui/wizard-steps/wizard-steps';
import { PromoConditionsTable } from './ui/promo-conditions-table';
import { PromoTiersTable } from './ui/promo-tiers-table';
import { PromoConfigList, PromoConfigRow } from './ui/promo-config-list';
import { PromoTargetsBlock } from './ui/promo-targets-block';
import { PromoService } from './promo';
import { LookupService } from './lookup';
import {
  ConditionView,
  CreatePromoCommand,
  CustomerTargetView,
  LookupItem,
  PromoDetail,
  SegmentTargetView,
  TierView,
  UpdatePromoCommand,
} from './promo.types';
import {
  applicationsPerCustomerText,
  dateText,
  PRIORITY_OPTIONS,
  priorityText,
  repeatsText,
} from './promo-format';
import {
  benefitText,
  measureModeText,
  requiredConditionText,
  tierPhraseText,
  whatCountsText,
} from './domain/promo-texts';
import { ToastService } from '../../core/ui/toast';
import { formatSoles } from '../../shared/pipes/money';
import { quantityText } from '../sales-reports/sales-report-format';
import {
  ImportMembersDialog,
  ImportMembersDialogResult,
} from '../segments/ui/import-members-dialog';

// ─── Borrador local (vive solo en el navegador hasta guardar) ──────────────

interface ConditionDraft {
  scope: 'PRODUCT' | 'FAMILY' | 'BRAND';
  productId?: number;
  familyId?: number;
  brandId?: number;
  name: string;
  code?: string; // doc 44, sección 8.3 — solo tiene sentido para PRODUCT
  required?: boolean; // doc 57, sección 5.1 — "Obligatorio"
  minQuantity?: number; // doc 57, sección 5.1 — en unidades, > 0 si required
}

interface BenefitDraft {
  key: number;
  benefitType: 'FREE_PRODUCT' | 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENT';
  catalog: boolean; // true = producto de catálogo (productId); false = material promocional (label)
  productId?: number;
  productCode?: string; // doc 44, sección 8.3 — se guarda junto con el id, nunca solo el id
  productName?: string;
  quantity?: number;
  discountAmount?: number;
  discountPercent?: number;
  label?: string;
}

interface BenefitGroupDraft {
  key: number;
  benefitGroup: number;
  selectionMode: 'ALL' | 'CHOOSE';
  chooseCount: number;
  benefits: BenefitDraft[];
}

interface TierDraft {
  key: number;
  tier: number;
  /** Interpretado según el `measureType` del asistente (único, no por tramo) — doc 47, sección 6.1. */
  threshold: number | null;
  /** El backend trajo el umbral en la columna que no corresponde al measureType actual — sección 7.2. */
  thresholdMismatch?: boolean;
  benefitGroups: BenefitGroupDraft[];
}

interface AudienceDraft {
  kind: 'segment' | 'customer';
  id: number;
  name: string;
  mode: 'INCLUDE' | 'EXCLUDE';
  maxQuantity?: number; // solo clientes directos
}

let benefitKeySeq = 0;
let tierKeySeq = 0;
let groupKeySeq = 0;

function slugCode(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .slice(0, 14);
  return `${base || 'PROMO'}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function emptyBenefit(): BenefitDraft {
  return { key: benefitKeySeq++, benefitType: 'FREE_PRODUCT', catalog: true, quantity: 1 };
}

/**
 * Un tramo nace con un solo grupo "Recibe todo" y un premio vacío listo para
 * completar — doc 47, sección 6.3. Nunca se crea un grupo "Elige" por
 * defecto: nace al pulsar "+ Agregar premio a elegir".
 */
function emptyTier(tierNumber: number): TierDraft {
  return {
    key: tierKeySeq++,
    tier: tierNumber,
    threshold: null,
    benefitGroups: [
      {
        key: groupKeySeq++,
        benefitGroup: 1,
        selectionMode: 'ALL',
        chooseCount: 1,
        benefits: [emptyBenefit()],
      },
    ],
  };
}

@Component({
  selector: 'app-promo-wizard',
  imports: [
    NgTemplateOutlet,
    UiButton,
    UiField,
    UiToggle,
    UiCheckbox,
    UiTypeahead,
    UiWizardSteps,
    HasPermissionDirective,
    UiCard,
    UiBadge,
    PromoConditionsTable,
    PromoTiersTable,
    PromoConfigList,
    PromoTargetsBlock,
  ],
  template: `
    <section class="wizard-page">
      <div class="wizard-head">
        <div>
          <div class="wizard-eyebrow">
            {{ editingId() ? 'Editar promoción' : 'Nueva promoción'
            }}{{ code() ? ' · ' + code() : '' }}
          </div>
          <h1>{{ name() || 'Sin nombre todavía' }}</h1>
        </div>
        @if (step() === 4 && draftId()) {
          <div class="wizard-saved-badge">
            <span class="material-icons" aria-hidden="true">check_circle</span>
            Guardada · apagada
          </div>
        }
      </div>

      <ui-wizard-steps
        [steps]="stepDefs"
        [current]="step()"
        [visited]="visited()"
        [errorSteps]="errorSteps()"
        (stepChange)="goToStep($event)"
      />

      <div class="wizard-body">
        @switch (step()) {
          @case (0) {
            <div class="wizard-step1-grid">
              <div class="wizard-col">
                <div class="wizard-2col">
                  <ui-field label="Código" [value]="code()" [readonly]="true" />
                  <ui-field
                    label="Nombre de la promoción"
                    [(value)]="name"
                    [error]="fieldError('name')"
                  />
                </div>
                <ui-field
                  label="Descripción (la ve el vendedor en el celular)"
                  type="textarea"
                  [(value)]="description"
                />
                <div class="wizard-2col">
                  <ui-field
                    label="Canal de ventas"
                    type="select"
                    [(value)]="salesChannelId"
                    [options]="channelOptions()"
                    hint="Canal del vendedor que toma el pedido"
                  />
                  <ui-field
                    label="Prioridad"
                    type="select"
                    [(value)]="priority"
                    [options]="priorityOptions"
                  />
                </div>
                <div class="wizard-2col">
                  <ui-field label="Desde" type="date" [(value)]="startDate" />
                  <ui-field
                    label="Hasta"
                    type="date"
                    [(value)]="endDate"
                    [error]="dateRangeError()"
                  />
                </div>
                <ui-field
                  label="Veces por cliente"
                  type="number"
                  [(value)]="maxApplicationsPerCustomer"
                  hint="Vacío = ilimitado"
                />
              </div>
              <div>
                <div class="wizard-toggle-card">
                  <ui-toggle label="Se combina con otras promociones" [(checked)]="stackable" />
                  <hr class="wizard-hr" />
                  <p class="wizard-toggle-text">
                    <strong>Activado:</strong> si el pedido también califica para otra campaña, el
                    cliente recibe los premios de las dos.
                  </p>
                  <p class="wizard-toggle-text wizard-toggle-text-muted">
                    <strong>Desactivado:</strong> solo se aplica esta y se descartan las demás. Se
                    usa cuando la campaña ya regala mucho y no quiere sumarse a un descuento.
                  </p>
                </div>
                @if (!editingId()) {
                  <div class="wizard-toggle-card">
                    <ui-checkbox label="Destacar en la app" [(checked)]="featured" />
                    <p class="wizard-toggle-text">
                      El vendedor la verá entre las primeras al atender a sus clientes. No cambia
                      cómo se aplica la promoción.
                    </p>
                  </div>
                } @else {
                  <div class="wizard-toggle-card">
                    <p class="wizard-toggle-text">
                      Destacada en la app: <strong>{{ featured() ? 'Sí' : 'No' }}</strong> · se
                      cambia desde el detalle de la promoción.
                    </p>
                  </div>
                }
              </div>
            </div>
          }
          @case (1) {
            <div class="wizard-q-block">
              <h3 class="wizard-q-title">¿La promoción exige una compra?</h3>
              <p class="wizard-lede">El tipo no se puede cambiar después de crear la promoción.</p>

              <div class="wizard-mode-cards">
                <button
                  type="button"
                  class="wizard-mode-card"
                  [class.selected]="requiresPurchase()"
                  [disabled]="!!editingId()"
                  (click)="requiresPurchase.set(true)"
                >
                  <span class="wizard-mode-title">Por compra</span>
                  <span class="wizard-mode-body"
                    >Se gana comprando: elige qué productos cuentan y los tramos.</span
                  >
                </button>
                <button
                  type="button"
                  class="wizard-mode-card"
                  [class.selected]="!requiresPurchase()"
                  [disabled]="!!editingId()"
                  (click)="requiresPurchase.set(false)"
                >
                  <span class="wizard-mode-title">Por lista de clientes</span>
                  <span class="wizard-mode-body"
                    >Se otorga por estar en la lista, sin condición de compra.</span
                  >
                </button>
              </div>
            </div>

            @if (!requiresPurchase()) {
              <div class="wizard-toggle-card">
                <p class="wizard-toggle-text">
                  Se otorga por estar en la lista: no se mide ninguna compra. En el paso 4 elige a
                  qué clientes o segmentos llega.
                </p>
              </div>
            } @else {
              <div class="wizard-q-block">
                <h3 class="wizard-q-title">¿Qué productos cuentan?</h3>
                <p class="wizard-lede">Si eliges varios, se suman entre sí.</p>

                <div class="wizard-mode-cards">
                  <button
                    type="button"
                    class="wizard-mode-card"
                    [class.selected]="mode() === 'ambito'"
                    (click)="mode.set('ambito')"
                  >
                    <span class="wizard-mode-title">Una marca o familia completa</span>
                    <span class="wizard-mode-body"
                      >Incluye los productos que se den de alta más adelante.</span
                    >
                  </button>
                  <button
                    type="button"
                    class="wizard-mode-card"
                    [class.selected]="mode() === 'surtido'"
                    (click)="mode.set('surtido')"
                  >
                    <span class="wizard-mode-title">Productos específicos</span>
                    <span class="wizard-mode-body"
                      >Una lista de productos que se suman entre sí.</span
                    >
                  </button>
                </div>

                @if (mode() === 'surtido') {
                  <div class="wizard-2col-wide">
                    <div>
                      <ui-typeahead
                        label="Agregar producto, familia o marca — busca escribiendo el nombre"
                        placeholder="Ej. Inca Kola"
                        [clearOnPick]="true"
                        [search]="scopeSearch"
                        (picked)="addCondition($event)"
                      />
                      <div class="wizard-condition-block">
                        <div class="wizard-condition-eyebrow">
                          Estas cantidades se suman entre sí
                        </div>
                        <div class="wizard-condition-list">
                          @for (c of conditions(); track c.name + c.scope) {
                            <div class="wizard-condition-row">
                              <div>
                                <div class="wizard-condition-name">{{ c.name }}</div>
                                <div class="wizard-condition-meta">{{ scopeLabel(c.scope) }}</div>
                              </div>
                              <div class="wizard-condition-required">
                                <ui-checkbox
                                  label="Obligatorio"
                                  [checked]="!!c.required"
                                  (checkedChange)="setRequired(c, $event)"
                                />
                                @if (c.required) {
                                  <ui-field
                                    label="Cantidad mínima"
                                    type="number"
                                    [hasSuffix]="true"
                                    [value]="String(c.minQuantity ?? 1)"
                                    (valueChange)="setMinQuantity(c, $event)"
                                    [error]="requiredFieldError(c)"
                                  >
                                    <span fieldSuffix class="wizard-field-suffix">unidades</span>
                                  </ui-field>
                                }
                              </div>
                              <div class="wizard-condition-actions">
                                <button
                                  uiButton
                                  variant="icon"
                                  title="Quitar"
                                  (click)="removeCondition(c)"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          }
                        </div>
                        @if (conditions().length > 0) {
                          <p class="wizard-condition-help">
                            Con una línea obligatoria, el pedido debe llevar al menos su cantidad
                            mínima para ganar la promoción, aunque los demás productos ya sumen el
                            tramo.
                          </p>
                        }
                        @if (allConditionsRequired()) {
                          <p class="wizard-condition-help">
                            Todas las líneas son obligatorias: el pedido debe llevar todas.
                          </p>
                        }
                      </div>
                    </div>
                    <div class="wizard-side-card">
                      <div class="wizard-side-eyebrow">Productos que cuentan hoy</div>
                      @if (conditions().length === 0) {
                        <p class="wizard-side-text wizard-side-muted">
                          Agrega al menos un producto.
                        </p>
                      } @else {
                        <p class="wizard-side-text">
                          <strong>{{ conditions().length }}</strong> producto{{
                            conditions().length === 1 ? '' : 's'
                          }}
                          de {{ code() }}.
                        </p>
                      }
                    </div>
                  </div>
                } @else {
                  <div class="wizard-2col-wide">
                    <div>
                      <ui-typeahead
                        label="Marca o familia — busca escribiendo el nombre"
                        placeholder="Ej. Gaseosas Andinas"
                        [clearOnPick]="false"
                        [search]="brandFamilySearch"
                        [selected]="ambitoSelected()"
                        (picked)="setAmbito($event)"
                      />
                      @if (ambitoSelected()) {
                        <div class="wizard-ambito-hint">
                          Los productos que se den de alta más adelante entran solos, sin tocar la
                          campaña.
                        </div>
                      }
                    </div>
                    <div class="wizard-side-card">
                      <div class="wizard-side-eyebrow">Productos que cuentan hoy</div>
                      @if (!ambitoSelected()) {
                        <p class="wizard-side-text wizard-side-muted">
                          Elige una marca o familia para ver cuáles.
                        </p>
                      } @else if (ambitoIsFamily()) {
                        <p class="wizard-side-text">
                          Todos los productos de la familia
                          <strong>{{ ambitoSelected()!.name }}</strong
                          >, incluso los que se den de alta más adelante.
                        </p>
                      } @else if (ambitoProducts() === null) {
                        <p class="wizard-side-text wizard-side-muted">Cargando…</p>
                      } @else {
                        <p class="wizard-side-text">
                          <strong>{{ ambitoProducts()!.length }}</strong>
                          producto{{ ambitoProducts()!.length === 1 ? '' : 's' }} de
                          {{ ambitoSelected()!.name }}.
                        </p>
                        <ul class="wizard-products-today-list">
                          @for (
                            p of ambitoProducts()!.slice(
                              0,
                              ambitoProductsExpanded() ? undefined : 3
                            );
                            track p.id
                          ) {
                            <li>
                              <span class="wizard-side-muted">{{ p.code }}</span> {{ p.name }}
                            </li>
                          }
                        </ul>
                        @if (ambitoProducts()!.length > 3 && !ambitoProductsExpanded()) {
                          <button
                            type="button"
                            class="wizard-card-edit"
                            (click)="ambitoProductsExpanded.set(true)"
                          >
                            Ver los {{ ambitoProducts()!.length }} productos
                          </button>
                        }
                      }
                    </div>
                  </div>
                }
              </div>

              <div class="wizard-q-block">
                <h3 class="wizard-q-title">¿Cómo se cuenta la compra?</h3>
                <div class="wizard-mode-cards">
                  <button
                    type="button"
                    class="wizard-mode-card"
                    [class.selected]="measureType() === 'QUANTITY'"
                    (click)="selectMeasureType('QUANTITY')"
                  >
                    <span class="wizard-mode-title">Por unidades</span>
                    <span class="wizard-mode-body"
                      >Se suman las unidades de todos los productos que cuentan.</span
                    >
                  </button>
                  <button
                    type="button"
                    class="wizard-mode-card"
                    [class.selected]="measureType() === 'AMOUNT'"
                    (click)="selectMeasureType('AMOUNT')"
                  >
                    <span class="wizard-mode-title">Por importe (S/)</span>
                    <span class="wizard-mode-body"
                      >Se suma lo que vale cada producto que cuenta, a su precio de lista.</span
                    >
                  </button>
                </div>

                @if (measureType()) {
                  <div class="wizard-tier-phrase">
                    <strong>Así se cuenta</strong><br />
                    {{ measureModePhrase() }}.
                  </div>
                }
              </div>
            }
          }
          @case (2) {
            <div class="wizard-tramos-grid">
              <div class="wizard-tramos-main">
                <h2>Tramos y premios</h2>
                <p class="wizard-lede">
                  @if (combineTiers()) {
                    Con "Sumar tramos": se toma el tramo más alto todas las veces que entre y
                    <strong>lo que sobra se cuenta con los tramos menores</strong>.
                  } @else {
                    Se otorga solo el tramo más alto que alcance el pedido:
                    <strong>los tramos no se suman</strong>.
                  }
                </p>

                <div class="wizard-measure-strip">
                  <span>
                    @if (requiresPurchase()) {
                      Se cuenta por {{ measureType() === 'AMOUNT' ? 'importe (S/)' : 'unidades' }} ·
                      {{ whatCountsPhrase() }}
                      @if (requiredConditionsCount() > 0) {
                        · {{ requiredConditionsCount() }} obligatorio{{
                          requiredConditionsCount() === 1 ? '' : 's'
                        }}
                      }
                    } @else {
                      Se otorga por estar en la lista
                    }
                  </span>
                  @if (requiresPurchase()) {
                    <button type="button" class="wizard-card-edit" (click)="goToStep(1)">
                      Cambiar en el paso 2 →
                    </button>
                  }
                </div>

                @if (requiresPurchase()) {
                  <div class="wizard-toggle-card">
                    <ui-toggle label="Se repite por múltiplos" [(checked)]="repeats" />
                    <p class="wizard-toggle-text wizard-toggle-text-muted">
                      Cada vez que el pedido junta otro mínimo, el premio se entrega otra vez.
                    </p>
                    <hr class="wizard-hr" />
                    <ui-toggle
                      label="Sumar tramos"
                      [(checked)]="combineTiers"
                      [disabled]="!!combineTiersDisabledReason()"
                    />
                    <p class="wizard-toggle-text wizard-toggle-text-muted">
                      {{ combineTiersDisabledReason() || combineTiersHelpText() }}
                    </p>
                    @if (repeats()) {
                      <hr class="wizard-hr" />
                      <ui-field
                        label="Tope por pedido"
                        type="number"
                        [(value)]="maxRepeatsPerOrder"
                        [error]="repeatsError()"
                      />
                      <p class="wizard-toggle-text wizard-toggle-text-muted">
                        {{ repeatsHelpText() }}
                      </p>
                      <div class="wizard-sim-line">
                        <ui-field label="Si compra" type="number" [(value)]="simRepeatQuantity" />
                        <span class="wizard-total-text">{{ simRepeatResult() }}</span>
                      </div>
                    }
                  </div>

                  <div class="wizard-tier-ladder">
                    @for (t of tiers(); track t.key; let i = $index) {
                      <button
                        type="button"
                        class="wizard-tier-step"
                        [class.selected]="i === selectedTier()"
                        (click)="selectedTier.set(i)"
                      >
                        <span class="wizard-tier-step-eyebrow">Tramo {{ t.tier }}</span>
                        <span class="wizard-tier-step-value">{{ tierThresholdShort(t) }}</span>
                        <span class="wizard-tier-step-hint">{{ tierBenefitSummary(t) }}</span>
                      </button>
                    }
                    <button type="button" class="wizard-add-tier-ladder" (click)="addTier()">
                      + Agregar tramo
                    </button>
                  </div>
                }

                @if (currentTier(); as t) {
                  <div class="wizard-tier-editor">
                    @if (requiresPurchase()) {
                      <div class="wizard-tier-editor-head">
                        <h3>Tramo {{ t.tier }}</h3>
                        <button uiButton variant="secondary" (click)="duplicateTier()">
                          Duplicar tramo
                        </button>
                      </div>
                      <div class="wizard-tier-editor-from">
                        @if (measureType() === 'AMOUNT') {
                          <ui-field
                            label="Desde"
                            type="number"
                            prefix="S/"
                            [(value)]="tierThresholdModel"
                          />
                        } @else {
                          <ui-field
                            label="Desde"
                            type="number"
                            [hasSuffix]="true"
                            [(value)]="tierThresholdModel"
                          >
                            <span fieldSuffix class="wizard-field-suffix">unidades</span>
                          </ui-field>
                        }
                        <span class="wizard-total-text"
                          >de compra en los productos que cuentan</span
                        >
                      </div>
                      @if (t.thresholdMismatch) {
                        <div class="wizard-save-error">Revisa el mínimo de este tramo.</div>
                      }
                      @if (tierValidationError(t, selectedTier())) {
                        <div class="wizard-save-error">
                          {{ tierValidationError(t, selectedTier()) }}
                        </div>
                      }
                    }

                    @if (allGroup(t); as ag) {
                      <div class="wizard-group-card">
                        <div class="wizard-group-head">
                          <ui-badge tone="success">Siempre</ui-badge>
                          <span>Recibe todo</span>
                          <span class="wizard-group-hint"
                            >se entregan todos los premios de este grupo</span
                          >
                        </div>
                        <div class="wizard-group-body">
                          @for (b of ag.benefits; track b.key) {
                            <div class="wizard-benefit-row">
                              <ng-container
                                *ngTemplateOutlet="benefitEditor; context: { $implicit: b }"
                              />
                            </div>
                          }
                        </div>
                      </div>
                    }

                    @for (cg of chooseGroups(t); track cg.key) {
                      <div class="wizard-group-card">
                        <div class="wizard-group-head">
                          <ui-badge tone="neutral"
                            >Elige {{ cg.chooseCount }} de {{ cg.benefits.length }}</ui-badge
                          >
                          <span>Premio a elegir</span>
                          <span class="wizard-group-hint">
                            El cliente elige
                            <input
                              type="number"
                              class="wizard-choose-count"
                              min="1"
                              [max]="cg.benefits.length"
                              [value]="cg.chooseCount"
                              (change)="setChooseCount(cg, $event)"
                            />
                            de {{ cg.benefits.length }}
                          </span>
                        </div>
                        <div class="wizard-group-body">
                          @for (b of cg.benefits; track b.key) {
                            <div class="wizard-benefit-row">
                              <ng-container
                                *ngTemplateOutlet="benefitEditor; context: { $implicit: b }"
                              />
                            </div>
                          }
                          <p class="wizard-group-note">
                            Lo elige el vendedor al tomar el pedido. Si no elige, lo resuelve
                            supervisión en Premios pendientes.
                          </p>
                          <button uiButton variant="ghost" (click)="addChoiceOption(cg)">
                            + Agregar opción
                          </button>
                        </div>
                      </div>
                    }

                    <div class="wizard-tier-actions">
                      <button uiButton variant="ghost" (click)="addPremio(t)">
                        + Agregar premio
                      </button>
                      @if (!combineTiers()) {
                        <button uiButton variant="ghost" (click)="addPremioAElegir(t)">
                          + Agregar premio a elegir
                        </button>
                      }
                    </div>

                    <div class="wizard-tier-phrase">
                      <strong>Así lo verá el vendedor</strong><br />
                      {{ tierPhrase(t) }}
                      @if (combineTiers() && isHighestTier(t)) {
                        <br />Además, lo que sobre se cuenta con los tramos menores.
                      }
                    </div>
                  </div>
                }
              </div>

              <div class="wizard-tramos-side">
                <div class="wizard-side-card">
                  <div class="wizard-side-eyebrow">Cómo se aplican los tramos</div>
                  @for (t of tiers(); track t.key) {
                    <div class="wizard-tier-pill">
                      <span class="wizard-tier-pill-label">Tramo {{ t.tier }}</span>
                      <span>{{ tierThresholdShort(t) }} · {{ tierBenefitSummary(t) }}</span>
                    </div>
                  }
                  @if (combineTiers() && combineTiersExampleText()) {
                    <p class="wizard-side-text">{{ combineTiersExampleText() }}</p>
                  }
                </div>
                <div class="wizard-side-card">
                  <div class="wizard-side-eyebrow">Antes de continuar</div>
                  <ul class="wizard-checklist">
                    <li>Cada tramo pide más que el anterior.</li>
                    <li>Cada tramo tiene al menos un premio.</li>
                    <li>El premio a elegir ofrece al menos dos opciones.</li>
                    <li>
                      Los mínimos están en
                      {{ measureType() === 'AMOUNT' ? 'soles' : 'unidades' }}, como pide el paso 2.
                    </li>
                    @if (combineTiers()) {
                      <li>Sumar tramos: sin descuento en % ni premios a elegir.</li>
                    }
                  </ul>
                </div>
              </div>
            </div>
          }
          @case (3) {
            <div class="wizard-audience-grid">
              <div>
                <h2>¿A quiénes llega?</h2>
                @if (hasIncludeTarget()) {
                  <div class="wizard-audience-banner">
                    <strong>Llega solo a los clientes incluidos.</strong>
                  </div>
                } @else {
                  <div class="wizard-audience-banner">
                    <strong>Llega a todos los clientes.</strong>
                    Si la promoción tiene canal, solo cuando el pedido lo toma un vendedor de ese
                    canal.
                  </div>
                }
                @if (!requiresPurchase() && errorSteps().includes(3)) {
                  <div class="wizard-save-error">
                    Incluye al menos un segmento o cliente: esta promoción se otorga por lista.
                  </div>
                }
                <div class="wizard-audience-toolbar">
                  <ui-typeahead
                    label="Agregar segmento o cliente — busca escribiendo el nombre"
                    placeholder="Ej. Bodegas Lima Norte"
                    [clearOnPick]="true"
                    [search]="audienceSearch"
                    (picked)="addAudience($event)"
                  />
                  <button
                    uiButton
                    variant="secondary"
                    *hasPermission="'segment.manage'"
                    (click)="openCreateSegmentFromFile()"
                  >
                    Crear segmento desde archivo
                  </button>
                </div>
                <p class="wizard-audience-hint">
                  Para muchos clientes, usa un segmento. Los clientes sueltos son para excepciones.
                </p>
                <div class="wizard-audience-list">
                  @for (a of audience(); track a.kind + a.id) {
                    <div class="wizard-condition-row">
                      <div>
                        <div class="wizard-condition-name">{{ a.name }}</div>
                        <div class="wizard-condition-meta">
                          {{ a.kind === 'segment' ? 'Segmento' : 'Cliente' }}
                        </div>
                      </div>
                      <div class="wizard-condition-actions">
                        @if (a.kind === 'customer') {
                          <ui-field
                            label="Tope de cantidad"
                            type="number"
                            [value]="String(a.maxQuantity ?? '')"
                            (valueChange)="setAudienceMaxQuantity(a, $event)"
                          />
                        }
                        <button uiButton variant="secondary" (click)="toggleAudienceMode(a)">
                          {{ a.mode === 'INCLUDE' ? 'Incluir' : 'Excluir' }}
                        </button>
                        <button uiButton variant="icon" title="Quitar" (click)="removeAudience(a)">
                          ✕
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
              <div class="wizard-side-card">
                <div class="wizard-side-eyebrow">Clientes alcanzados</div>
                @if (reachLoading()) {
                  <div class="wizard-metric">…</div>
                } @else if (reach(); as r) {
                  <div class="wizard-metric">{{ r.reachedCustomers ?? 0 }}</div>
                  <div class="wizard-side-text wizard-side-muted">
                    {{ r.fromSegments ?? 0 }} por segmento ·
                    {{ r.fromDirectCustomers ?? 0 }} directos
                    @if (r.excluded) {
                      · {{ r.excluded }} excluidos
                    }
                  </div>
                } @else {
                  <div class="wizard-side-text wizard-side-muted">
                    Se recalcula al agregar o quitar.
                  </div>
                }
              </div>
            </div>
          }
          @case (4) {
            <div class="wizard-step5">
              <div class="wizard-how">
                <span class="material-icons" aria-hidden="true">auto_awesome</span>
                <div>
                  <p>{{ firstTierPhrase() }}</p>
                  @if (extraTiersCount() > 0) {
                    <p class="wizard-how-extra">
                      +{{ extraTiersCount() }} tramo{{ extraTiersCount() === 1 ? '' : 's' }} más
                    </p>
                  }
                </div>
              </div>

              <div class="wizard-step5-grid">
                <div class="wizard-step5-main">
                  <ui-card>
                    <div class="wizard-card-head">
                      <div>
                        <div class="wizard-card-eyebrow">Paso 2</div>
                        <h3 class="wizard-card-title">
                          Qué debe comprar
                          @if (conditionsAsViews().length) {
                            <ui-badge tone="neutral"
                              >{{ conditionsAsViews().length }} producto{{
                                conditionsAsViews().length === 1 ? '' : 's'
                              }}</ui-badge
                            >
                          }
                        </h3>
                      </div>
                      <button type="button" class="wizard-card-edit" (click)="goToStep(1)">
                        Editar
                      </button>
                    </div>
                    <app-promo-conditions-table
                      [conditions]="conditionsAsViews()"
                      [promoType]="requiresPurchase() ? 'TIERED' : 'CUSTOMER_LIST'"
                    />
                    @if (requiresPurchase()) {
                      <p class="wizard-card-note">{{ measureModePhrase() }}.</p>
                    }
                  </ui-card>

                  <ui-card>
                    <div class="wizard-card-head">
                      <div>
                        <div class="wizard-card-eyebrow">Paso 3</div>
                        <h3 class="wizard-card-title">
                          Tramos y premios
                          @if (tiers().length) {
                            <ui-badge tone="neutral"
                              >{{ tiers().length }} tramo{{
                                tiers().length === 1 ? '' : 's'
                              }}</ui-badge
                            >
                          }
                        </h3>
                      </div>
                      <button type="button" class="wizard-card-edit" (click)="goToStep(2)">
                        Editar
                      </button>
                    </div>
                    <app-promo-tiers-table
                      [tiers]="tiersAsViews()"
                      [measureType]="measureType()"
                      [promoType]="requiresPurchase() ? 'TIERED' : 'CUSTOMER_LIST'"
                    />
                  </ui-card>

                  <ui-card>
                    <div class="wizard-card-head">
                      <div>
                        <div class="wizard-card-eyebrow">Paso 4</div>
                        <h3 class="wizard-card-title">A quiénes llega</h3>
                      </div>
                      <button type="button" class="wizard-card-edit" (click)="goToStep(3)">
                        Editar
                      </button>
                    </div>
                    <app-promo-targets-block
                      [segments]="segmentsAsViews()"
                      [customers]="customersAsViews()"
                      [salesChannelName]="selectedChannelName()"
                    />
                  </ui-card>
                </div>

                <div class="wizard-step5-side">
                  <ui-card>
                    <div class="wizard-card-head">
                      <div>
                        <div class="wizard-card-eyebrow">Paso 1</div>
                        <h3 class="wizard-card-title">Datos generales</h3>
                      </div>
                      <button type="button" class="wizard-card-edit" (click)="goToStep(0)">
                        Editar
                      </button>
                    </div>
                    <app-promo-config-list [rows]="datosGeneralesRows()" />
                  </ui-card>

                  <ui-card title="Antes de activar">
                    <p class="wizard-activate-text">
                      Simula un pedido para confirmar que la promoción se aplica como esperas antes
                      de encenderla.
                    </p>
                    @if (combineTiers()) {
                      <p class="wizard-activate-text">
                        Pruebe con una cantidad que pase el tramo más alto{{
                          combineTiersSimSuggestion()
                            ? ' (por ejemplo, ' + combineTiersSimSuggestion() + ')'
                            : ''
                        }}
                        para ver la suma.
                      </p>
                    }
                    @if (requiredConditionsCount() > 0) {
                      <p class="wizard-activate-text">
                        Pruebe un pedido sin el producto obligatorio: no debe ganar.
                      </p>
                    }
                    <button
                      uiButton
                      variant="secondary"
                      *hasPermission="'order.manage'"
                      (click)="goSimulate()"
                    >
                      Simular pedido
                    </button>
                  </ui-card>
                </div>
              </div>
            </div>
          }
        }
      </div>

      <div class="wizard-footer">
        <button uiButton variant="secondary" [disabled]="step() === 0" (click)="prevStep()">
          Atrás
        </button>
        <div class="wizard-footer-hint">{{ stepHint() }}</div>
        @if (step() < 4) {
          <button uiButton variant="primary" (click)="nextStep()">Continuar</button>
        } @else {
          <div class="wizard-footer-actions">
            <button uiButton variant="secondary" [loading]="savingDraft()" (click)="saveOff()">
              Guardar apagada
            </button>
            <button
              uiButton
              variant="primary"
              *hasPermission="'promo.approve'"
              [loading]="activating()"
              (click)="activatePromo()"
            >
              Activar promoción
            </button>
          </div>
        }
      </div>
    </section>

    <ng-template #benefitEditor let-b>
      <div class="wizard-benefit-editor">
        <ui-field
          label="Tipo de premio"
          type="select"
          [options]="benefitTypeOptionsAvailable()"
          [(value)]="b.benefitType"
        />
        @if (b.benefitType === 'FREE_PRODUCT') {
          <div class="wizard-benefit-catalog-toggle">
            <button
              type="button"
              uiButton
              [variant]="b.catalog ? 'secondary' : 'ghost'"
              (click)="b.catalog = true"
            >
              Del catálogo
            </button>
            <button
              type="button"
              uiButton
              [variant]="!b.catalog ? 'secondary' : 'ghost'"
              (click)="b.catalog = false"
            >
              Material promocional
            </button>
          </div>
          @if (b.catalog) {
            <ui-typeahead
              label="Producto"
              [clearOnPick]="false"
              [search]="scopeProductSearch"
              [selected]="benefitProductSelected(b)"
              (picked)="setBenefitProduct(b, $event)"
            />
          } @else {
            <ui-field
              label="Nombre del material"
              [value]="b.label || ''"
              (valueChange)="b.label = $event"
            />
          }
          <ui-field
            label="Cantidad"
            type="number"
            [value]="String(b.quantity ?? 1)"
            (valueChange)="b.quantity = numberOr(1, $event)"
          />
        } @else if (b.benefitType === 'DISCOUNT_AMOUNT') {
          <ui-field
            label="Monto (S/)"
            type="number"
            [value]="String(b.discountAmount ?? '')"
            (valueChange)="b.discountAmount = numberOr(0, $event)"
          />
        } @else {
          <ui-field
            label="Porcentaje (%)"
            type="number"
            [value]="String(b.discountPercent ?? '')"
            (valueChange)="b.discountPercent = numberOr(0, $event)"
          />
        }
        <button uiButton variant="icon" title="Quitar" (click)="removeBenefit(b)">✕</button>
        <p class="wizard-benefit-help">{{ benefitHelpText(b) }}</p>
      </div>
    </ng-template>
  `,
  styles: [
    `
      .wizard-page {
        width: 100%;
        box-sizing: border-box;
      }
      .wizard-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 22px var(--sp-8) 18px;
      }
      .wizard-eyebrow {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 2px 0 0;
        color: var(--ink);
      }
      .wizard-saved-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: none;
        padding: var(--sp-2) var(--sp-3);
        border-radius: var(--radius-pill);
        border: 1px solid color-mix(in srgb, var(--status-ok) 40%, var(--hairline));
        background: color-mix(in srgb, var(--status-ok) 10%, transparent);
        font-size: var(--fs-meta);
        font-weight: 700;
        color: var(--ink);
      }
      .wizard-saved-badge .material-icons {
        font-size: 16px;
        color: var(--status-ok);
      }
      .wizard-body {
        padding: var(--sp-8);
        width: 100%;
        box-sizing: border-box;
      }
      h2 {
        font-size: 24px;
        margin: 0 0 4px;
        color: var(--ink);
      }
      .wizard-lede {
        color: var(--ink-muted);
        max-width: 620px;
        font-size: 14px;
      }
      .wizard-step1-grid {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 40px;
      }
      .wizard-col {
        display: grid;
        gap: 18px;
      }
      .wizard-2col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }
      .wizard-2col-wide {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 32px;
        align-items: start;
      }
      .wizard-toggle-card {
        border: 1px solid var(--divider);
        padding: 18px;
      }
      .wizard-hr {
        border: 0;
        border-top: var(--border-hair);
        margin: 16px 0;
      }
      .wizard-toggle-text {
        font-size: 14px;
        margin: 0 0 10px;
        color: var(--ink);
      }
      .wizard-toggle-text-muted {
        color: var(--ink-muted);
        margin: 0;
      }
      .wizard-mode-cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin: 20px 0 28px;
      }
      .wizard-mode-card {
        text-align: left;
        border: 1px solid var(--divider);
        background: var(--bg);
        padding: 16px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .wizard-mode-card.selected {
        border: 2px solid var(--accent);
      }
      .wizard-mode-eyebrow {
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .wizard-mode-title {
        font-weight: 800;
        font-size: 18px;
      }
      .wizard-mode-body {
        font-size: 14px;
        color: var(--ink-muted);
        line-height: 1.5;
      }
      /* La barra roja del mockup es el borde izquierdo; los hijos (rótulo,
         lista y bloque «=») se apilan, no van en fila. */
      .wizard-condition-block {
        margin-top: 22px;
        border-left: 3px solid var(--accent);
        padding-left: 16px;
      }
      .wizard-condition-eyebrow {
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--accent-ink);
        font-weight: 800;
        margin-bottom: 10px;
      }
      .wizard-condition-list {
        display: grid;
        gap: 2px;
      }
      .wizard-condition-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 14px;
        background: var(--faint);
        border: 1px solid var(--hairline);
        min-height: 56px;
      }
      .wizard-condition-name {
        font-weight: 800;
      }
      .wizard-condition-meta {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .wizard-condition-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .wizard-condition-required {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      .wizard-condition-required ui-field {
        width: 150px;
      }
      .wizard-condition-help {
        margin: 10px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .wizard-total-text {
        font-size: 15px;
      }
      .wizard-q-block {
        margin-bottom: 32px;
      }
      .wizard-q-title {
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .wizard-products-today-list {
        list-style: none;
        margin: 10px 0 0;
        padding: 0;
        display: grid;
        gap: 6px;
        font-size: 13px;
      }
      .wizard-field-suffix {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        font-size: var(--fs-dense);
        font-weight: 700;
        color: var(--ink-muted);
        pointer-events: none;
      }
      .wizard-ambito-hint {
        margin-top: 16px;
        font-size: 13px;
        color: var(--ink-muted);
        border-left: 3px solid var(--hairline);
        padding-left: 12px;
      }
      .wizard-side-card {
        border: 1px solid var(--divider);
        padding: 18px;
      }
      .wizard-side-eyebrow {
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .wizard-side-text {
        font-size: 14px;
        margin: 10px 0 0;
        line-height: 1.5;
      }
      .wizard-side-muted {
        color: var(--ink-muted);
      }
      .wizard-metric {
        font-size: 44px;
        font-weight: 800;
        line-height: 1.05;
        margin: 6px 0 2px;
        font-variant-numeric: var(--tnum);
      }
      .wizard-tier-ladder {
        display: flex;
        align-items: stretch;
        gap: 0;
        margin: 24px 0 28px;
        border: 1px solid var(--hairline);
      }
      .wizard-tier-step {
        text-align: left;
        border: 0;
        border-right: 1px solid var(--hairline);
        background: var(--bg);
        padding: 14px 18px;
        cursor: pointer;
        min-width: 130px;
      }
      .wizard-tier-step.selected {
        background: var(--faint);
        box-shadow: inset 0 -3px 0 var(--accent);
      }
      .wizard-tier-step-eyebrow {
        display: block;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .wizard-tier-step-value {
        display: block;
        font-size: 26px;
        font-weight: 800;
        margin-top: 2px;
      }
      .wizard-tier-step-hint {
        display: block;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .wizard-add-tier-ladder {
        flex: none;
        align-self: stretch;
        border: 0;
        border-left: 1px dashed var(--hairline);
        background: var(--faint);
        padding: 14px 18px;
        font-size: 13px;
        font-weight: 700;
        color: var(--accent-ink);
        cursor: pointer;
        white-space: nowrap;
      }
      .wizard-measure-strip {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-4);
        background: var(--surface-sunk);
        border: 1px solid var(--hairline);
        font-size: var(--fs-dense);
        color: var(--ink);
        margin-top: var(--sp-4);
        flex-wrap: wrap;
      }
      .wizard-tramos-grid {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 32px;
        align-items: start;
      }
      .wizard-tramos-main {
        min-width: 0;
      }
      .wizard-tramos-side {
        display: grid;
        gap: var(--sp-5);
        position: sticky;
        top: var(--sp-6);
      }
      .wizard-tier-pill {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--sp-2) 0;
        border-bottom: 1px solid var(--hairline);
        font-size: 13px;
        color: var(--ink-muted);
      }
      .wizard-tier-pill:last-child {
        border-bottom: 0;
      }
      .wizard-tier-pill-label {
        font-weight: 800;
        color: var(--ink);
      }
      .wizard-checklist {
        margin: 10px 0 0;
        padding: 0 0 0 18px;
        font-size: 13px;
        color: var(--ink-muted);
        display: grid;
        gap: 6px;
      }
      .wizard-tier-editor {
        border: 2px solid var(--divider);
        padding: 22px;
      }
      .wizard-tier-editor-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
      }
      .wizard-tier-editor-head h3 {
        margin: 0;
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        color: var(--ink);
      }
      .wizard-tier-editor-from {
        display: flex;
        align-items: flex-end;
        gap: 14px;
        margin-top: 14px;
      }
      .wizard-group-card {
        border: 1px solid var(--divider);
        margin-top: 22px;
      }
      .wizard-group-head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--hairline);
        background: var(--faint);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .wizard-group-hint {
        text-transform: none;
        font-weight: 400;
        font-size: 12px;
        color: var(--ink-muted);
        letter-spacing: normal;
      }
      .wizard-choose-count {
        width: 40px;
        text-align: center;
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 800;
        border: 1px solid var(--divider);
        border-radius: var(--radius-control, 0);
        background: var(--surface-sunk);
        color: var(--ink);
      }
      .wizard-group-body {
        padding: 14px 16px;
        display: grid;
        gap: 10px;
      }
      .wizard-group-note {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .wizard-benefit-row {
        border: 1px solid var(--hairline);
        padding: 12px 14px;
      }
      .wizard-benefit-editor {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 10px;
        align-items: end;
      }
      .wizard-benefit-catalog-toggle {
        display: flex;
        gap: 6px;
        grid-column: 1 / -1;
      }
      .wizard-benefit-help {
        grid-column: 1 / -1;
        margin: 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .wizard-tier-actions {
        display: flex;
        gap: var(--sp-3);
        margin-top: 18px;
      }
      .wizard-tier-phrase {
        margin-top: 18px;
        padding: 14px 16px;
        background: var(--faint);
        border-left: 3px solid var(--accent);
        font-size: 15px;
      }
      .wizard-audience-grid {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 32px;
        align-items: start;
      }
      .wizard-audience-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 18px;
        border: 2px solid var(--divider);
        margin: 16px 0 24px;
        font-size: 15px;
      }
      .wizard-audience-toolbar {
        display: flex;
        align-items: flex-end;
        gap: 12px;
      }
      .wizard-audience-toolbar ui-typeahead {
        flex: 1;
      }
      .wizard-audience-hint {
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .wizard-audience-list {
        display: grid;
        gap: 2px;
        margin-top: 20px;
      }
      .wizard-condition-actions ui-field {
        width: 130px;
      }
      .wizard-step5 {
        display: grid;
        gap: var(--sp-5);
      }
      .wizard-how {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-3);
        padding: var(--sp-4);
        border-radius: var(--radius-card);
        border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--hairline));
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }
      .wizard-how .material-icons {
        color: var(--accent-ink);
        font-size: 20px;
      }
      .wizard-how p {
        margin: 0;
        font-size: var(--fs-body);
        line-height: 1.5;
        color: var(--ink);
      }
      .wizard-how .wizard-how-extra {
        margin-top: 4px;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .wizard-step5-grid {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: var(--sp-6);
        align-items: start;
      }
      .wizard-step5-main {
        display: grid;
        gap: var(--sp-5);
        min-width: 0;
      }
      .wizard-step5-side {
        display: grid;
        gap: var(--sp-5);
        position: sticky;
        top: var(--sp-6);
      }
      .wizard-card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--sp-3);
        flex-wrap: wrap;
        margin-bottom: var(--sp-4);
      }
      .wizard-card-eyebrow {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        margin-bottom: 2px;
      }
      .wizard-card-title {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        color: var(--ink);
        margin: 0;
      }
      .wizard-card-note {
        margin: var(--sp-3) 0 0;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .wizard-card-edit {
        flex: none;
        background: none;
        border: none;
        padding: 0;
        font-size: var(--fs-meta);
        font-weight: 700;
        color: var(--accent-ink);
        cursor: pointer;
      }
      .wizard-card-edit:hover {
        text-decoration: underline;
      }
      .wizard-activate-text {
        margin: 0 0 var(--sp-4);
        font-size: var(--fs-dense);
        color: var(--ink-muted);
      }

      @media (max-width: 900px) {
        .wizard-step5-grid {
          grid-template-columns: 1fr;
        }
        .wizard-step5-side {
          position: static;
        }
      }
      .wizard-save-error {
        margin-top: 14px;
        color: var(--accent-ink);
        font-size: 13px;
      }
      .wizard-sim-line {
        display: grid;
        grid-template-columns: 1fr 96px;
        gap: 10px;
        align-items: end;
        margin-top: 10px;
      }
      .wizard-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        border-top: var(--border-rule);
        padding: 16px var(--sp-8);
        position: sticky;
        bottom: 0;
        background: var(--bg);
      }
      .wizard-footer-hint {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .wizard-footer-actions {
        display: flex;
        gap: 10px;
      }

      @media (max-width: 900px) {
        .wizard-step1-grid,
        .wizard-2col-wide,
        .wizard-audience-grid,
        .wizard-tramos-grid {
          grid-template-columns: 1fr;
        }
        .wizard-tramos-side {
          position: static;
        }
      }

      @media (max-width: 767px) {
        .wizard-head,
        .wizard-body,
        .wizard-footer {
          padding-left: var(--sp-4);
          padding-right: var(--sp-4);
        }
        .wizard-2col,
        .wizard-mode-cards,
        .wizard-benefit-editor,
        .wizard-sim-line {
          grid-template-columns: 1fr;
        }
        /* La escalera envuelve en vez de desplazarse de lado (regla 4). */
        .wizard-tier-ladder {
          flex-wrap: wrap;
        }
        .wizard-tier-step {
          flex: 1 0 auto;
          min-width: 108px;
        }
        .wizard-add-tier-ladder {
          flex: 1 0 100%;
          border-left: 0;
          border-top: 1px solid var(--hairline);
        }
        .wizard-tier-editor-from {
          flex-wrap: wrap;
        }
        .wizard-tier-actions {
          flex-wrap: wrap;
        }
        .wizard-footer-hint {
          display: none;
        }
        .wizard-footer-actions {
          flex-wrap: wrap;
          justify-content: flex-end;
        }
      }
    `,
  ],
})
export class PromoWizardPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private promoSvc = inject(PromoService);
  private lookupSvc = inject(LookupService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected stepDefs: UiWizardStep[] = [
    { label: 'Datos generales' },
    { label: 'Qué debe comprar' },
    { label: 'Tramos y premios' },
    { label: 'A quiénes llega' },
    { label: 'Resumen y simulación' },
  ];
  protected step = signal(0);
  protected visited = signal<number[]>([0]);
  protected errorSteps = signal<number[]>([]);

  // Paso 1
  protected code = signal('');
  protected name = signal('');
  protected description = signal('');
  protected salesChannelId = signal('');
  protected priority = signal('100');
  protected priorityOptions: UiFieldOption[] = PRIORITY_OPTIONS;
  protected startDate = signal('');
  protected endDate = signal('');
  protected maxApplicationsPerCustomer = signal('');
  protected stackable = signal(true);
  /** Solo se usa al crear/duplicar — doc 49, sección 8.2: editar no cambia `featured`. */
  protected featured = signal(false);
  protected channelOptions = signal<UiFieldOption[]>([]);

  // Paso 2
  protected requiresPurchase = signal(true); // No → CUSTOMER_LIST
  protected mode = signal<'surtido' | 'ambito'>('surtido');
  protected conditions = signal<ConditionDraft[]>([]);
  protected ambitoSelected = signal<UiLookupItem | null>(null);
  protected ambitoProducts = signal<LookupItem[] | null>(null);
  protected ambitoProductsExpanded = signal(false);
  protected ambitoIsFamily = computed(() => this.ambitoSelected()?.extraInfo === 'Familia');
  /** Sin valor por defecto en una promoción nueva — doc 47, sección 6.2: el usuario elige. */
  protected measureType = signal<'QUANTITY' | 'AMOUNT' | ''>('');

  // Paso 3
  protected repeats = signal(false);
  protected maxRepeatsPerOrder = signal('');
  protected combineTiers = signal(false); // doc 57, sección 6.1 — "Sumar tramos"
  protected simRepeatQuantity = signal('30');
  protected tiers = signal<TierDraft[]>([emptyTier(1)]);
  protected selectedTier = signal(0);
  protected benefitTypeOptions: UiFieldOption[] = [
    { value: 'FREE_PRODUCT', label: 'Producto gratis' },
    { value: 'DISCOUNT_AMOUNT', label: 'Descuento en soles' },
    { value: 'DISCOUNT_PERCENT', label: 'Descuento en %' },
  ];

  // Paso 4
  protected audience = signal<AudienceDraft[]>([]);
  protected reach = signal<{
    reachedCustomers?: number;
    fromSegments?: number;
    fromDirectCustomers?: number;
    excluded?: number;
  } | null>(null);
  protected reachLoading = signal(false);

  // Paso 5
  protected draftId = signal<number | null>(null);
  protected savedAt = signal<Date | null>(null);
  protected savingDraft = signal(false);
  protected activating = signal(false);
  protected saveError = signal('');

  protected editingId = signal<number | null>(null);

  protected scopeSearch = (q: string) => this.combinedScopeSearch(q);
  protected brandFamilySearch = (q: string) => this.combinedBrandFamilySearch(q);
  protected scopeProductSearch = (q: string) =>
    this.lookupSvc.products(q).pipe(map((items) => this.toLookup(items)));
  protected audienceSearch = (q: string) => this.combinedAudienceSearch(q);

  protected String = String;

  constructor() {
    this.lookupSvc.salesChannels().subscribe((items) => {
      // Primera opción explícita: sin ella el navegador pinta el primer canal
      // aunque el modelo esté vacío, y la promo se guardaría sin canal.
      // "Ninguno" (id 0) no se ofrece aquí — doc 57, sección 9: el backend
      // rechaza salesChannelId=0 en promociones; "Todos los vendedores"
      // (sin canal) ya cubre ese caso con value=''.
      this.channelOptions.set([
        { value: '', label: 'Todos los vendedores' },
        ...items
          .filter((i) => i.id !== 0)
          .map((i) => ({ value: String(i.id), label: i.name ?? '' })),
      ]);
    });

    effect(() => {
      const brand = this.ambitoSelected();
      this.ambitoProductsExpanded.set(false);
      this.ambitoProducts.set(null);
      // El lookup de productos solo filtra por marca (no por familia) — para
      // una familia se muestra el nombre elegido, sin lista (ver plantilla).
      if (this.mode() === 'ambito' && brand && brand.name && brand.extraInfo !== 'Familia') {
        this.lookupSvc.products('', { brandId: brand.id, limit: 50 }).subscribe((items) => {
          this.ambitoProducts.set(items);
        });
      }
    });

    effect(() => {
      // se leen para reaccionar a cualquier cambio de audiencia
      const list = this.audience();
      if (list.length === 0) {
        this.reach.set(null);
        return;
      }
      this.reachLoading.set(true);
      this.promoSvc
        .previewTargets({
          segments: list
            .filter((a) => a.kind === 'segment')
            .map((a) => ({ segmentId: a.id, mode: a.mode })),
          customers: list
            .filter((a) => a.kind === 'customer')
            .map((a) => ({ customerId: a.id, mode: a.mode })),
        })
        .subscribe({
          next: (r) => {
            this.reach.set(r);
            this.reachLoading.set(false);
          },
          error: () => this.reachLoading.set(false),
        });
    });

    const editId = this.route.snapshot.paramMap.get('id');
    const duplicateFrom = this.route.snapshot.queryParamMap.get('duplicateFrom');
    const jumpToStep = this.route.snapshot.queryParamMap.get('step');
    if (editId) {
      this.editingId.set(Number(editId));
      this.loadInto(Number(editId), true, jumpToStep === '5');
    } else if (duplicateFrom) {
      this.loadInto(Number(duplicateFrom), false);
      this.code.set(slugCode('PROMO'));
    } else {
      // Autogenerado y fijo mientras no se edite una promoción existente —
      // no se recalcula con cada tecla del nombre (sección 8.2 del doc).
      this.code.set(slugCode('PROMO'));
    }
  }

  private toLookup(items: LookupItem[]): UiLookupItem[] {
    return items.map((i) => ({
      id: i.id!,
      code: i.code,
      name: i.name ?? '',
      extraInfo: i.extraInfo,
    }));
  }

  private combinedScopeSearch(q: string): Observable<UiLookupItem[]> {
    return forkJoin([
      this.lookupSvc.products(q, { limit: 6 }).pipe(catchError(() => of([]))),
      this.lookupSvc.families(q, { limit: 6 }).pipe(catchError(() => of([]))),
      this.lookupSvc.brands(q, { limit: 6 }).pipe(catchError(() => of([]))),
    ]).pipe(
      map(([products, families, brands]) => [
        ...products.map((i) => this.tag(i, 'PRODUCT')),
        ...families.map((i) => this.tag(i, 'FAMILY')),
        ...brands.map((i) => this.tag(i, 'BRAND')),
      ]),
    );
  }

  private combinedBrandFamilySearch(q: string): Observable<UiLookupItem[]> {
    return forkJoin([
      this.lookupSvc.brands(q, { limit: 8 }).pipe(catchError(() => of([]))),
      this.lookupSvc.families(q, { limit: 8 }).pipe(catchError(() => of([]))),
    ]).pipe(
      map(([brands, families]) => [
        ...brands.map((i) => this.tag(i, 'BRAND')),
        ...families.map((i) => this.tag(i, 'FAMILY')),
      ]),
    );
  }

  private combinedAudienceSearch(q: string): Observable<UiLookupItem[]> {
    return forkJoin([
      this.lookupSvc.segments(q, { limit: 8 }).pipe(catchError(() => of([]))),
      this.lookupSvc.customers(q, { limit: 8 }).pipe(catchError(() => of([]))),
    ]).pipe(
      map(([segments, customers]) => [
        ...segments.map((i) => this.tag(i, 'segment' as never, 'Segmento')),
        ...customers.map((i) => this.tag(i, 'customer' as never, 'Cliente')),
      ]),
    );
  }

  private tag(
    i: LookupItem,
    kind: 'PRODUCT' | 'FAMILY' | 'BRAND' | 'segment' | 'customer',
    label?: string,
  ): UiLookupItem {
    return {
      id: i.id!,
      code: i.code,
      name: i.name ?? '',
      extraInfo: label ?? this.scopeLabel(kind as 'PRODUCT' | 'FAMILY' | 'BRAND'),
      recent: i.recent,
    };
  }

  protected scopeLabel(scope: 'PRODUCT' | 'FAMILY' | 'BRAND'): string {
    return { PRODUCT: 'Producto', FAMILY: 'Familia', BRAND: 'Marca' }[scope];
  }

  protected addCondition(item: UiLookupItem) {
    const scope = (
      item.extraInfo === 'Marca' ? 'BRAND' : item.extraInfo === 'Familia' ? 'FAMILY' : 'PRODUCT'
    ) as 'PRODUCT' | 'FAMILY' | 'BRAND';
    if (this.conditions().some((c) => c.name === item.name && c.scope === scope)) return;
    const draft: ConditionDraft = { scope, name: item.name };
    if (scope === 'PRODUCT') {
      draft.productId = item.id;
      draft.code = item.code ?? undefined;
    }
    if (scope === 'FAMILY') draft.familyId = item.id;
    if (scope === 'BRAND') draft.brandId = item.id;
    this.conditions.update((list) => [...list, draft]);
  }

  protected removeCondition(c: ConditionDraft) {
    this.conditions.update((list) => list.filter((x) => x !== c));
  }

  /** "Obligatorio" por línea — doc 57, sección 5.2: nace con cantidad mínima 1. */
  protected setRequired(c: ConditionDraft, required: boolean) {
    c.required = required;
    c.minQuantity = required ? (c.minQuantity ?? 1) : undefined;
    this.conditions.update((list) => [...list]);
  }

  protected setMinQuantity(c: ConditionDraft, raw: string) {
    c.minQuantity = this.numberOr(1, raw);
    this.conditions.update((list) => [...list]);
  }

  protected requiredFieldError(c: ConditionDraft): string {
    if (!this.errorSteps().includes(1)) return '';
    if (c.required && (!c.minQuantity || c.minQuantity <= 0)) {
      return 'Indique la cantidad mínima, mayor a cero';
    }
    return '';
  }

  protected allConditionsRequired(): boolean {
    return this.conditions().length > 0 && this.conditions().every((c) => !!c.required);
  }

  protected setAmbito(item: UiLookupItem) {
    this.ambitoSelected.set(item);
  }

  protected addAudience(item: UiLookupItem) {
    const kind = item.extraInfo === 'Cliente' ? 'customer' : 'segment';
    if (this.audience().some((a) => a.id === item.id && a.kind === kind)) return;
    this.audience.update((list) => [
      ...list,
      { kind, id: item.id, name: item.name, mode: 'INCLUDE' },
    ]);
  }

  protected removeAudience(a: AudienceDraft) {
    this.audience.update((list) => list.filter((x) => x !== a));
  }

  protected toggleAudienceMode(a: AudienceDraft) {
    a.mode = a.mode === 'INCLUDE' ? 'EXCLUDE' : 'INCLUDE';
    this.audience.update((list) => [...list]);
  }

  protected currentTier(): TierDraft | null {
    return this.tiers()[this.selectedTier()] ?? null;
  }

  /** "Qué cuenta" en forma de condiciones genéricas, para las frases de texto. */
  protected effectiveConditionsForText(): {
    scope: 'PRODUCT' | 'FAMILY' | 'BRAND';
    productCode?: string;
    productName?: string;
    familyName?: string;
    brandName?: string;
  }[] {
    if (!this.requiresPurchase()) return [];
    if (this.mode() === 'ambito' && this.ambitoSelected()) {
      const sel = this.ambitoSelected()!;
      return sel.extraInfo === 'Familia'
        ? [{ scope: 'FAMILY', familyName: sel.name }]
        : [{ scope: 'BRAND', brandName: sel.name }];
    }
    return this.conditions().map((c) => ({
      scope: c.scope,
      productCode: c.code,
      productName: c.name,
      familyName: c.scope === 'FAMILY' ? c.name : undefined,
      brandName: c.scope === 'BRAND' ? c.name : undefined,
    }));
  }

  protected whatCountsPhrase(): string {
    return whatCountsText(
      this.effectiveConditionsForText(),
      this.requiresPurchase() ? 'TIERED' : 'CUSTOMER_LIST',
    );
  }

  protected measureModePhrase(): string {
    return measureModeText(
      this.measureType() || 'QUANTITY',
      this.effectiveConditionsForText(),
      'TIERED',
    );
  }

  /**
   * Cambiar cómo se cuenta con tramos ya cargados borra sus mínimos — doc
   * 47, sección 6.2 — porque un mismo número significa algo distinto en
   * soles que en unidades.
   */
  protected selectMeasureType(value: 'QUANTITY' | 'AMOUNT') {
    if (this.measureType() === value) return;
    const hasThresholds = this.tiers().some((t) => t.threshold != null);
    if (!hasThresholds) {
      this.measureType.set(value);
      return;
    }
    this.dialog
      .confirm({
        title: 'Cambiar cómo se cuenta',
        message:
          'Los tramos se miden distinto: se borrarán los mínimos de los tramos. Los premios se conservan. ¿Continuar?',
        confirmLabel: 'Continuar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.measureType.set(value);
        this.tiers.update((list) =>
          list.map((t) => ({ ...t, threshold: null, thresholdMismatch: false })),
        );
      });
  }

  protected repeatsError(): string {
    if (this.errorSteps().includes(2) && this.repeats() && !this.maxRepeatsPerOrder()) {
      return 'Obligatorio cuando la promoción se repite.';
    }
    return '';
  }

  protected hasIncludeTarget(): boolean {
    return this.audience().some((a) => a.mode === 'INCLUDE');
  }

  protected setAudienceMaxQuantity(a: AudienceDraft, raw: string) {
    a.maxQuantity = raw ? this.numberOr(0, raw) : undefined;
    this.audience.update((list) => [...list]);
  }

  protected openCreateSegmentFromFile() {
    this.dialog
      .open<ImportMembersDialog, unknown, ImportMembersDialogResult>(ImportMembersDialog, {
        width: '560px',
      })
      .afterClosed()
      .subscribe((res) => {
        if (res?.segment) {
          this.audience.update((list) => [
            ...list,
            {
              kind: 'segment' as const,
              id: res.segment!.segmentId,
              name: res.segment!.name,
              mode: 'INCLUDE' as const,
            },
          ]);
        }
      });
  }

  protected get tierThresholdModel() {
    const t = this.currentTier();
    return t?.threshold != null ? String(t.threshold) : '';
  }
  protected set tierThresholdModel(v: string) {
    const t = this.currentTier();
    if (!t) return;
    t.threshold = v === '' ? null : this.numberOr(t.threshold ?? 0, v);
    t.thresholdMismatch = false;
    this.resortTiers();
  }

  /** "S/ 190.00" · "10" — valor corto para la escalera de tramos y el panel lateral. */
  protected tierThresholdShort(t: TierDraft): string {
    if (t.threshold == null) return '—';
    return this.measureType() === 'AMOUNT' ? formatSoles(t.threshold) : quantityText(t.threshold);
  }

  protected allGroup(t: TierDraft): BenefitGroupDraft | undefined {
    return t.benefitGroups.find((g) => g.selectionMode === 'ALL');
  }

  protected chooseGroups(t: TierDraft): BenefitGroupDraft[] {
    return t.benefitGroups.filter((g) => g.selectionMode === 'CHOOSE');
  }

  private nextGroupNumber(t: TierDraft): number {
    return Math.max(0, ...t.benefitGroups.map((g) => g.benefitGroup)) + 1;
  }

  /** "+ Agregar premio" — doc 47, sección 6.3: agrega al grupo "Recibe todo", creándolo si hace falta. */
  protected addPremio(t: TierDraft) {
    let group = this.allGroup(t);
    if (!group) {
      group = {
        key: groupKeySeq++,
        benefitGroup: this.nextGroupNumber(t),
        selectionMode: 'ALL',
        chooseCount: 1,
        benefits: [],
      };
      t.benefitGroups = [group, ...t.benefitGroups];
    }
    group.benefits.push(emptyBenefit());
    this.tiers.update((list) => [...list]);
  }

  /** "+ Agregar premio a elegir" — crea un grupo nuevo con dos opciones vacías. */
  protected addPremioAElegir(t: TierDraft) {
    const group: BenefitGroupDraft = {
      key: groupKeySeq++,
      benefitGroup: this.nextGroupNumber(t),
      selectionMode: 'CHOOSE',
      chooseCount: 1,
      benefits: [emptyBenefit(), emptyBenefit()],
    };
    t.benefitGroups = [...t.benefitGroups, group];
    this.tiers.update((list) => [...list]);
  }

  /** "+ Agregar opción" dentro de un grupo "Elige" ya existente. */
  protected addChoiceOption(g: BenefitGroupDraft) {
    g.benefits.push(emptyBenefit());
    this.tiers.update((list) => [...list]);
  }

  protected setChooseCount(g: BenefitGroupDraft, ev: Event) {
    const raw = Number((ev.target as HTMLInputElement).value);
    g.chooseCount = Math.min(
      Math.max(1, Number.isFinite(raw) ? raw : 1),
      Math.max(1, g.benefits.length),
    );
    this.tiers.update((list) => [...list]);
  }

  protected removeBenefit(b: BenefitDraft) {
    // Un grupo sin premios desaparece — doc 47, sección 6.3.
    for (const t of this.tiers()) {
      for (const g of t.benefitGroups) {
        g.benefits = g.benefits.filter((x) => x !== b);
      }
      t.benefitGroups = t.benefitGroups.filter((g) => g.benefits.length > 0);
    }
    this.tiers.update((list) => [...list]);
  }

  protected benefitHelpText(b: BenefitDraft): string {
    if (b.benefitType === 'FREE_PRODUCT') {
      return 'Se agrega como bonificación. Si no hay stock, queda pendiente de stock.';
    }
    if (b.benefitType === 'DISCOUNT_PERCENT') {
      return this.requiresPurchase()
        ? 'Se descuenta de cada producto que cuenta, no del pedido completo.'
        : 'Se descuenta de todo el pedido.';
    }
    return this.requiresPurchase()
      ? 'Se reparte entre los productos que cuentan, según lo que vale cada uno.'
      : 'Se reparte entre todos los productos del pedido.';
  }

  protected benefitProductSelected(b: BenefitDraft): UiLookupItem | null {
    return b.productId ? { id: b.productId, code: b.productCode, name: b.productName ?? '' } : null;
  }
  protected setBenefitProduct(b: BenefitDraft, item: UiLookupItem) {
    b.productId = item.id;
    b.productCode = item.code ?? undefined;
    b.productName = item.name;
    this.tiers.update((list) => [...list]);
  }

  protected numberOr(fallback: number, raw: string): number {
    const n = Number(raw);
    return Number.isFinite(n) && raw !== '' ? n : fallback;
  }

  /** Reordena por umbral ascendente y renumera 1..n — doc 47, sección 8.2 regla 3. */
  private resortTiers() {
    const current = this.currentTier();
    const sorted = [...this.tiers()].sort(
      (a, b) => (a.threshold ?? Infinity) - (b.threshold ?? Infinity),
    );
    this.tiers.set(sorted.map((t, i) => ({ ...t, tier: i + 1 })));
    if (current) {
      const idx = this.tiers().findIndex((t) => t.key === current.key);
      if (idx >= 0) this.selectedTier.set(idx);
    }
  }

  protected addTier() {
    this.tiers.update((list) => [...list, emptyTier(list.length + 1)]);
    this.selectedTier.set(this.tiers().length - 1);
  }

  protected duplicateTier() {
    const t = this.currentTier();
    if (!t) return;
    const clone: TierDraft = {
      key: tierKeySeq++,
      tier: 0,
      threshold: null,
      benefitGroups: t.benefitGroups.map((g) => ({
        ...g,
        key: groupKeySeq++,
        benefits: g.benefits.map((b) => ({ ...b, key: benefitKeySeq++ })),
      })),
    };
    this.tiers.update((list) => [...list, clone]);
    this.selectedTier.set(this.tiers().length - 1);
  }

  /** Mensaje de validación del tramo (sección 6.3) — vacío si el tramo está bien armado. */
  protected tierValidationError(t: TierDraft, index: number): string {
    if (this.requiresPurchase()) {
      if (t.threshold == null) return 'Indica desde cuánto se gana este tramo.';
      if (t.threshold <= 0) return 'El mínimo debe ser mayor a cero.';
      const prev = this.tiers()[index - 1];
      if (prev && prev.threshold != null && t.threshold <= prev.threshold) {
        return `El tramo ${t.tier} debe pedir más que el tramo ${prev.tier} (${this.tierThresholdShort(prev)}).`;
      }
    }
    if (!t.benefitGroups.some((g) => g.benefits.length > 0)) {
      return 'Agrega al menos un premio a este tramo.';
    }
    for (const g of t.benefitGroups) {
      if (g.selectionMode === 'CHOOSE' && g.benefits.length < 2) {
        return 'Un premio a elegir necesita al menos dos opciones.';
      }
      if (g.selectionMode === 'CHOOSE' && g.chooseCount > g.benefits.length) {
        return 'No puede pedir elegir más premios de los que ofrece.';
      }
    }
    for (const g of t.benefitGroups) {
      for (const b of g.benefits) {
        if (!this.benefitComplete(b)) return this.incompleteBenefitMessage(b);
      }
    }
    if (this.repeats() && !this.maxRepeatsPerOrder()) return 'Indica el tope de veces por pedido.';
    return '';
  }

  private benefitComplete(b: BenefitDraft): boolean {
    if (b.benefitType === 'FREE_PRODUCT') {
      return (b.catalog ? !!b.productId : !!b.label) && !!b.quantity && b.quantity > 0;
    }
    if (b.benefitType === 'DISCOUNT_AMOUNT') return !!b.discountAmount && b.discountAmount > 0;
    return !!b.discountPercent && b.discountPercent > 0 && b.discountPercent <= 100;
  }

  private incompleteBenefitMessage(b: BenefitDraft): string {
    if (b.benefitType === 'FREE_PRODUCT') return 'Elige el producto y la cantidad.';
    if (b.benefitType === 'DISCOUNT_AMOUNT') return 'Indica el monto del descuento.';
    return 'Indica el porcentaje (de 0.01 a 100).';
  }

  protected tierBenefitSummary(t: TierDraft): string {
    const all = t.benefitGroups.filter((g) => g.selectionMode === 'ALL').flatMap((g) => g.benefits);
    const choose = t.benefitGroups
      .filter((g) => g.selectionMode === 'CHOOSE')
      .flatMap((g) => g.benefits);
    const parts: string[] = [];
    if (choose.length) parts.push(`Elige 1 de ${choose.length}`);
    if (all.length) parts.push(this.benefitLabel(all[0]));
    return parts.join(' + ') || 'Sin premios todavía';
  }

  /** Único lugar que arma este texto (sección 10): nunca concatena un valor que puede ser `undefined`. */
  protected benefitLabel(b: BenefitDraft): string {
    return benefitText({
      benefitType: b.benefitType,
      quantity: b.quantity,
      productCode: b.catalog ? b.productCode : undefined,
      productName: b.catalog ? b.productName : undefined,
      label: !b.catalog ? b.label : undefined,
      discountAmount: b.discountAmount,
      discountPercent: b.discountPercent,
    });
  }

  /** Frase del tramo en vivo, al pie de su editor — doc 47, sección 5.4 y 6.3; doc 57, sección 6.4. */
  protected tierPhrase(t: TierDraft): string {
    return tierPhraseText({
      promoType: this.requiresPurchase() ? 'TIERED' : 'CUSTOMER_LIST',
      measureType: this.measureType() || 'QUANTITY',
      fromQuantity: this.measureType() === 'QUANTITY' ? t.threshold : null,
      fromAmount: this.measureType() === 'AMOUNT' ? t.threshold : null,
      conditions: this.effectiveConditionsForText(),
      benefits: t.benefitGroups.flatMap((g) => g.benefits),
      requiredConditions: this.requiredConditionsForText(),
    });
  }

  /** Condiciones obligatorias con su mínimo, para las frases de 6.4 — solo aplica al surtido. */
  protected requiredConditionsForText(): {
    minQuantity: number;
    condition: {
      scope: 'PRODUCT' | 'FAMILY' | 'BRAND';
      productCode?: string;
      productName?: string;
      familyName?: string;
      brandName?: string;
    };
  }[] {
    if (this.mode() !== 'surtido') return [];
    return this.conditions()
      .filter((c) => c.required && c.minQuantity)
      .map((c) => ({
        minQuantity: c.minQuantity!,
        condition: {
          scope: c.scope,
          productCode: c.code,
          productName: c.name,
          familyName: c.scope === 'FAMILY' ? c.name : undefined,
          brandName: c.scope === 'BRAND' ? c.name : undefined,
        },
      }));
  }

  protected requiredConditionsCount(): number {
    return this.conditions().filter((c) => c.required).length;
  }

  protected isHighestTier(t: TierDraft): boolean {
    return t.tier === this.tiers().length;
  }

  /** Banner "Así funciona" del paso 5 — doc 47, sección 6.4; doc 57, sección 7: + "Los tramos se suman." */
  protected firstTierPhrase(): string {
    const t1 = this.tiers()[0];
    if (!t1) return '';
    const base = this.tierPhrase(t1);
    return this.combineTiers() ? `${base} Los tramos se suman.` : base;
  }

  protected extraTiersCount(): number {
    return Math.max(0, this.tiers().length - 1);
  }

  protected vigenciaSummary(): string {
    if (!this.startDate() && !this.endDate()) return 'Sin fecha de inicio';
    return `${dateText(this.startDate())} – ${dateText(this.endDate())}`;
  }

  protected selectedChannelName(): string {
    return this.channelOptions().find((o) => o.value === this.salesChannelId())?.label ?? '';
  }

  // — Resumen estructurado del paso 5 (sección 8.5): mismas reglas de texto
  // que el detalle (domain/promo-texts.ts), armadas con el estado local.
  protected priorityLabel(): string {
    return priorityText(Number(this.priority()));
  }

  protected repeatsSummary(): string {
    return repeatsText(
      this.repeats(),
      this.maxRepeatsPerOrder() ? this.numberOr(1, this.maxRepeatsPerOrder()) : null,
    );
  }

  protected maxApplicationsSummary(): string {
    return applicationsPerCustomerText(
      this.maxApplicationsPerCustomer() ? Number(this.maxApplicationsPerCustomer()) : null,
    );
  }

  // — Adaptadores del borrador local a las formas ConditionView/TierView/
  // SegmentTargetView/CustomerTargetView: el paso 5 reusa las mismas piezas
  // compartidas que el detalle (doc 45, sección 1), no vuelve a dibujar las
  // tablas a mano.
  protected conditionsAsViews = computed((): ConditionView[] => {
    if (this.mode() === 'ambito' && this.ambitoSelected()) {
      const sel = this.ambitoSelected()!;
      const isFamily = sel.extraInfo === 'Familia';
      return [
        {
          lineNumber: 1,
          scope: isFamily ? 'FAMILY' : 'BRAND',
          scopeName: isFamily ? 'Familia' : 'Marca',
          familyId: isFamily ? sel.id : undefined,
          familyName: isFamily ? sel.name : undefined,
          brandId: !isFamily ? sel.id : undefined,
          brandName: !isFamily ? sel.name : undefined,
          required: false,
          minQuantity: null,
          requiredText: null,
        },
      ];
    }
    return this.conditions().map((c, i) => ({
      lineNumber: i + 1,
      scope: c.scope,
      scopeName: this.scopeLabel(c.scope),
      productId: c.productId,
      productName: c.scope === 'PRODUCT' ? c.name : undefined,
      productCode: c.code,
      familyId: c.familyId,
      familyName: c.scope === 'FAMILY' ? c.name : undefined,
      brandId: c.brandId,
      brandName: c.scope === 'BRAND' ? c.name : undefined,
      required: !!c.required,
      minQuantity: c.required ? (c.minQuantity ?? null) : null,
      requiredText: c.required && c.minQuantity ? requiredConditionText(c.minQuantity) : null,
    }));
  });

  protected tiersAsViews = computed((): TierView[] =>
    this.tiers().map((t) => ({
      tier: t.tier,
      fromQuantity:
        this.requiresPurchase() && this.measureType() === 'QUANTITY'
          ? (t.threshold ?? undefined)
          : undefined,
      fromAmount:
        this.requiresPurchase() && this.measureType() === 'AMOUNT'
          ? (t.threshold ?? undefined)
          : undefined,
      benefitGroups: t.benefitGroups
        .filter((g) => g.benefits.length > 0)
        .map((g) => ({
          benefitGroup: g.benefitGroup,
          selectionMode: g.selectionMode,
          chooseCount: g.chooseCount,
          benefits: g.benefits.map((b, i) => ({
            benefitLine: i + 1,
            benefitType: b.benefitType,
            benefitTypeName: this.benefitTypeOptions.find((o) => o.value === b.benefitType)?.label,
            productId: b.productId,
            productName: b.catalog ? b.productName : undefined,
            productCode: b.catalog ? b.productCode : undefined,
            quantity: b.quantity,
            discountAmount: b.discountAmount,
            discountPercent: b.discountPercent,
            label: !b.catalog ? b.label : undefined,
          })),
        })),
    })),
  );

  protected segmentsAsViews = computed((): SegmentTargetView[] =>
    this.audience()
      .filter((a) => a.kind === 'segment')
      .map((a) => ({ segmentId: a.id, segmentName: a.name, mode: a.mode })),
  );

  protected customersAsViews = computed((): CustomerTargetView[] =>
    this.audience()
      .filter((a) => a.kind === 'customer')
      .map((a) => ({
        customerId: a.id,
        customerName: a.name,
        mode: a.mode,
        maxQuantity: a.maxQuantity,
      })),
  );

  protected datosGeneralesRows(): PromoConfigRow[] {
    return [
      { label: 'Código', value: this.code() },
      {
        label: 'Tipo',
        value: this.requiresPurchase() ? 'Por compra (tramos)' : 'Por lista de clientes',
      },
      ...(this.requiresPurchase()
        ? [
            {
              label: 'Se cuenta por',
              value: this.measureType() === 'AMOUNT' ? 'Importe (S/)' : 'Unidades',
            },
          ]
        : []),
      { label: 'Canal', value: this.selectedChannelName() || 'Todos los vendedores' },
      { label: 'Vigencia', value: this.vigenciaSummary() },
      { label: 'Prioridad', value: this.priorityLabel() },
      { label: 'Destacada en la app', value: this.featured() ? 'Sí' : 'No' },
      { label: 'Se combina con otras', value: this.stackable() ? 'Sí' : 'No' },
      { label: 'Se repite por múltiplos', value: this.repeatsSummary() },
      ...(this.requiresPurchase()
        ? [{ label: 'Sumar tramos', value: this.combineTiers() ? 'Sí' : 'No' }]
        : []),
      { label: 'Veces por cliente', value: this.maxApplicationsSummary() },
    ];
  }

  /** Doc 47, sección 6.4: el pie refleja el estado real del guardado, no un texto fijo. */
  protected stepHint(): string {
    if (this.step() === 4) {
      if (this.savingDraft()) return 'Guardando…';
      if (this.saveError()) return `No se pudo guardar: ${this.saveError()}`;
      return 'Todo guardado · lista para activar';
    }
    return [
      'Guarda los datos generales de la campaña.',
      'Define qué compra cuenta para esta promoción.',
      'Arma los tramos y sus premios.',
      'Elige a quién llega la promoción.',
    ][this.step()];
  }

  protected fieldError(field: string): string {
    if (this.step() !== 0) return '';
    if (field === 'name' && this.errorSteps().includes(0) && !this.name().trim()) {
      return 'Escribe un nombre para la promoción.';
    }
    return '';
  }

  protected dateRangeError(): string {
    if (this.startDate() && this.endDate() && this.endDate() < this.startDate()) {
      return 'No puede ser anterior a "Desde".';
    }
    return '';
  }

  /** Tramo alcanzado con una compra de `quantity`: el más alto cuyo umbral no la supera. */
  private reachedTier(quantity: number): TierDraft | null {
    const eligible = this.tiers()
      .filter((t) => t.threshold != null && t.threshold <= quantity)
      .sort((a, b) => (b.threshold ?? 0) - (a.threshold ?? 0));
    return eligible[0] ?? null;
  }

  /** "Si compra [N] → gana X premios" — fórmula de la sección 5.2, sin llamar al backend. */
  protected simRepeatResult(): string {
    const qty = this.numberOr(0, this.simRepeatQuantity());
    const tier = this.reachedTier(qty);
    const tope = this.numberOr(1, this.maxRepeatsPerOrder());
    if (!tier || tier.threshold == null || qty < tier.threshold) {
      return 'No alcanza ningún tramo todavía.';
    }
    const veces = Math.min(Math.floor(qty / tier.threshold), tope);
    return `Gana ${veces} ${veces === 1 ? 'vez' : 'veces'} el premio del tramo ${tier.tier}.`;
  }

  protected repeatsHelpText(): string {
    const tope = this.numberOr(3, this.maxRepeatsPerOrder());
    if (this.combineTiers()) {
      return `Se cuentan todas las veces de todos los tramos juntos. Nunca más de ${tope} veces por pedido.`;
    }
    const t1 = this.tiers()[0];
    const umbral = t1?.threshold ?? 10;
    const unidad = this.measureType() === 'AMOUNT' ? 'soles' : 'unidades';
    const base = `Cada vez que el pedido junta otras ${umbral} ${unidad}, se entrega el premio otra vez: ${umbral * 2} → 2, ${umbral * 3} → 3. Nunca más de ${tope} veces por pedido.`;
    if (this.tiers().length > 1) {
      return `${base} Se repite solo el tramo más alto alcanzado; los tramos no se combinan.`;
    }
    return base;
  }

  // — Sumar tramos — doc 57, secciones 6.2 y 10.2 —

  protected combineTiersDisabledReason(): string {
    if (this.tiers().length < 2) return 'Agregue al menos dos tramos para sumarlos.';
    const hasPercent = this.tiers().some((t) =>
      t.benefitGroups.some((g) => g.benefits.some((b) => b.benefitType === 'DISCOUNT_PERCENT')),
    );
    if (hasPercent) return 'No se pueden sumar tramos con descuento en porcentaje.';
    const hasChoice = this.tiers().some((t) =>
      t.benefitGroups.some((g) => g.selectionMode === 'CHOOSE'),
    );
    if (hasChoice) return 'No se pueden sumar tramos con premios a elegir.';
    return '';
  }

  protected benefitTypeOptionsAvailable(): UiFieldOption[] {
    if (!this.combineTiers()) return this.benefitTypeOptions;
    return this.benefitTypeOptions.filter((o) => o.value !== 'DISCOUNT_PERCENT');
  }

  protected combineTiersHelpText(): string {
    return (
      this.combineTiersExampleText() ||
      'El tramo más alto se entrega todas las veces que entre y lo que sobra se cuenta con los tramos menores.'
    );
  }

  /** Ejemplo dinámico con los dos tramos más altos — doc 57, sección 10.2. */
  protected combineTiersExampleText(): string {
    const sorted = [...this.tiers()]
      .filter((t) => t.threshold != null)
      .sort((a, b) => (b.threshold ?? 0) - (a.threshold ?? 0));
    if (sorted.length < 2) return '';
    const [a, b] = sorted;
    const benefitOf = (t: TierDraft) =>
      t.benefitGroups.flatMap((g) => g.benefits).find((x) => x.benefitType === 'FREE_PRODUCT');
    const ba = benefitOf(a);
    const bb = benefitOf(b);
    if (!ba || !bb || a.threshold == null || b.threshold == null || !ba.quantity || !bb.quantity) {
      return '';
    }
    const amount = this.measureType() === 'AMOUNT';
    const totalText = amount
      ? formatSoles(a.threshold + b.threshold)
      : `${quantityText(a.threshold + b.threshold)} unidades`;
    const aText = amount ? formatSoles(a.threshold) : quantityText(a.threshold);
    const bText = amount ? formatSoles(b.threshold) : quantityText(b.threshold);
    const sameProduct =
      ba.catalog && bb.catalog
        ? ba.productId != null && ba.productId === bb.productId
        : !ba.catalog && !bb.catalog
          ? !!ba.label && ba.label === bb.label
          : false;
    if (sameProduct) {
      return `Ej.: ${totalText} → ${aText} da ${ba.quantity} y ${bText} da ${bb.quantity} = ${ba.quantity + bb.quantity}.`;
    }
    const nameOf = (x: BenefitDraft) =>
      x.catalog ? (x.productName ?? x.productCode ?? 'producto') : (x.label ?? 'producto');
    return `Ej.: ${totalText} → ${ba.quantity} × ${nameOf(ba)} + ${bb.quantity} × ${nameOf(bb)}.`;
  }

  /** Cantidad sugerida para "Simular pedido" (paso 5) — doc 57, sección 7: suma de los dos tramos más altos. */
  protected combineTiersSimSuggestion(): string {
    const sorted = [...this.tiers()]
      .filter((t) => t.threshold != null)
      .sort((a, b) => (b.threshold ?? 0) - (a.threshold ?? 0));
    if (sorted.length < 2) return '';
    const total = (sorted[0].threshold ?? 0) + (sorted[1].threshold ?? 0);
    return this.measureType() === 'AMOUNT' ? formatSoles(total) : quantityText(total);
  }

  private validateStep(n: number): boolean {
    if (n === 0) return !!this.name().trim() && !this.dateRangeError();
    if (n === 1) {
      if (!this.requiresPurchase()) return true;
      const hasCondition =
        this.mode() === 'ambito' ? !!this.ambitoSelected() : this.conditions().length > 0;
      const requiredLinesValid =
        this.mode() === 'surtido'
          ? this.conditions().every((c) => !c.required || (!!c.minQuantity && c.minQuantity > 0))
          : true;
      return hasCondition && !!this.measureType() && requiredLinesValid;
    }
    if (n === 2) {
      return this.tiers().every((t, i) => !this.tierValidationError(t, i));
    }
    if (n === 3) {
      if (!this.requiresPurchase()) return this.audience().some((a) => a.mode === 'INCLUDE');
      return true;
    }
    return true;
  }

  protected nextStep() {
    if (!this.validateStep(this.step())) {
      this.errorSteps.update((s) => Array.from(new Set([...s, this.step()])));
      if (this.step() === 2) {
        const badIndex = this.tiers().findIndex((t, i) => !!this.tierValidationError(t, i));
        if (badIndex >= 0) this.selectedTier.set(badIndex);
      }
      return;
    }
    this.errorSteps.update((s) => s.filter((x) => x !== this.step()));
    const leavingStep = this.step();
    const next = Math.min(4, leavingStep + 1);
    this.step.set(next);
    this.visited.update((v) => Array.from(new Set([...v, next])));

    // Sección 8.2: la promo ya queda guardada apagada al salir del paso de
    // tramos y premios; el paso de "a quiénes llega" guarda el targeting —
    // así en el resumen ya existe y se puede simular sin un guardado aparte.
    if (leavingStep === 2) {
      this.ensureSaved().subscribe({ error: () => {} });
    } else if (leavingStep === 3) {
      this.ensureSaved().subscribe({
        next: (id) => this.promoSvc.setTargets(id, this.buildTargetsCommand()).subscribe(),
        error: () => {},
      });
    }
  }

  protected prevStep() {
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected goToStep(index: number) {
    if (index === this.step() || this.visited().includes(index)) this.step.set(index);
  }

  /**
   * Doc 47, sección 8.2: solo la columna de `measureType` lleva valor (nunca
   * las dos, nunca 0); tramos, grupos y premios se renumeran 1..n al
   * enviar — `tiers()` ya está ordenado por umbral (ver `resortTiers`).
   */
  private buildTiersCommand() {
    const source = this.requiresPurchase() ? this.tiers() : this.tiers().slice(0, 1);
    return source
      .filter((t) => t.benefitGroups.some((g) => g.benefits.length > 0))
      .map((t, ti) => ({
        tier: ti + 1,
        fromQuantity:
          this.requiresPurchase() && this.measureType() === 'QUANTITY'
            ? (t.threshold ?? undefined)
            : undefined,
        fromAmount:
          this.requiresPurchase() && this.measureType() === 'AMOUNT'
            ? (t.threshold ?? undefined)
            : undefined,
        benefitGroups: t.benefitGroups
          .filter((g) => g.benefits.length > 0)
          .map((g, gi) => {
            // Un grupo «elige» con una sola opción no es una elección: se
            // manda como entrega fija (el backend valida choiceMeaningful).
            const mode =
              g.selectionMode === 'CHOOSE' && g.benefits.length < 2 ? 'ALL' : g.selectionMode;
            return {
              benefitGroup: gi + 1,
              selectionMode: mode,
              chooseCount: mode === 'CHOOSE' ? g.chooseCount || 1 : undefined,
              label: mode === 'CHOOSE' ? 'Premio a elegir' : undefined,
              benefits: g.benefits.map((b, i) => ({
                benefitLine: i + 1,
                benefitType: b.benefitType,
                productId: b.benefitType === 'FREE_PRODUCT' && b.catalog ? b.productId : undefined,
                quantity: b.benefitType === 'FREE_PRODUCT' ? b.quantity : undefined,
                discountAmount: b.benefitType === 'DISCOUNT_AMOUNT' ? b.discountAmount : undefined,
                discountPercent:
                  b.benefitType === 'DISCOUNT_PERCENT' ? b.discountPercent : undefined,
                label: b.benefitType === 'FREE_PRODUCT' && !b.catalog ? b.label : undefined,
              })),
            };
          }),
      }));
  }

  private buildConditionsCommand() {
    if (!this.requiresPurchase()) return [];
    if (this.mode() === 'ambito' && this.ambitoSelected()) {
      const sel = this.ambitoSelected()!;
      const isFamily = sel.extraInfo === 'Familia';
      return isFamily
        ? [{ scope: 'FAMILY' as const, familyId: sel.id }]
        : [{ scope: 'BRAND' as const, brandId: sel.id }];
    }
    return this.conditions().map((c) => ({
      scope: c.scope,
      productId: c.productId,
      familyId: c.familyId,
      brandId: c.brandId,
      required: !!c.required,
      minQuantity: c.required ? (c.minQuantity ?? 1) : undefined,
    }));
  }

  private buildCreateCommand(): CreatePromoCommand {
    return {
      code: this.code(),
      name: this.name(),
      description: this.description() || undefined,
      promoType: this.requiresPurchase() ? 'TIERED' : 'CUSTOMER_LIST',
      salesChannelId: this.salesChannelId() ? Number(this.salesChannelId()) : undefined,
      // El backend exige un valor válido aunque no se use (lista de clientes) — sección 6.2.
      measureType: this.measureType() || 'QUANTITY',
      repeats: this.requiresPurchase() ? this.repeats() : false,
      maxRepeatsPerOrder:
        this.requiresPurchase() && this.repeats()
          ? this.numberOr(1, this.maxRepeatsPerOrder())
          : undefined,
      maxApplicationsPerCustomer: this.maxApplicationsPerCustomer()
        ? this.numberOr(1, this.maxApplicationsPerCustomer())
        : undefined,
      priority: Number(this.priority()),
      stackable: this.stackable(),
      startDate: this.startDate() || undefined,
      endDate: this.endDate() || undefined,
      conditions: this.buildConditionsCommand(),
      tiers: this.buildTiersCommand(),
      featured: this.featured(),
      combineTiers: this.requiresPurchase() && this.combineTiers(),
    };
  }

  private buildUpdateCommand(): UpdatePromoCommand {
    return {
      name: this.name(),
      description: this.description() || undefined,
      salesChannelId: this.salesChannelId() ? Number(this.salesChannelId()) : undefined,
      measureType: this.measureType() || 'QUANTITY',
      repeats: this.requiresPurchase() ? this.repeats() : false,
      maxRepeatsPerOrder:
        this.requiresPurchase() && this.repeats()
          ? this.numberOr(1, this.maxRepeatsPerOrder())
          : undefined,
      maxApplicationsPerCustomer: this.maxApplicationsPerCustomer()
        ? this.numberOr(1, this.maxApplicationsPerCustomer())
        : undefined,
      priority: Number(this.priority()),
      stackable: this.stackable(),
      startDate: this.startDate() || undefined,
      endDate: this.endDate() || undefined,
      conditions: this.buildConditionsCommand(),
      tiers: this.buildTiersCommand(),
      combineTiers: this.requiresPurchase() && this.combineTiers(),
    };
  }

  private buildTargetsCommand() {
    return {
      segments: this.audience()
        .filter((a) => a.kind === 'segment')
        .map((a) => ({ segmentId: a.id, mode: a.mode })),
      customers: this.audience()
        .filter((a) => a.kind === 'customer')
        .map((a) => ({ customerId: a.id, mode: a.mode, maxQuantity: a.maxQuantity })),
    };
  }

  private loadInto(id: number, keepId: boolean, jumpToSummary = false) {
    this.promoSvc.detail(id).subscribe((p: PromoDetail) => {
      // Sección 7.1: con definitionEditable = false no se abre el asistente
      // en modo edición, sea cual sea la pantalla desde la que se llegó —
      // la edición básica es la única vía. Se protege aquí, una sola vez,
      // para no repetir el chequeo en cada lugar que enlaza a esta ruta.
      if (keepId && !p.definitionEditable) {
        this.router.navigate(['/promociones', id]);
        return;
      }
      if (keepId) this.code.set(p.code ?? '');
      this.name.set(keepId ? (p.name ?? '') : `${p.name ?? ''} (copia)`);
      this.description.set(p.description ?? '');
      this.salesChannelId.set(p.salesChannelId ? String(p.salesChannelId) : '');
      this.priority.set(p.priority ? String(p.priority) : '100');
      this.startDate.set(p.startDate ?? '');
      this.endDate.set(p.endDate ?? '');
      this.maxApplicationsPerCustomer.set(
        p.maxApplicationsPerCustomer != null ? String(p.maxApplicationsPerCustomer) : '',
      );
      this.stackable.set(!!p.stackable);
      if (keepId) this.featured.set(!!p.featured); // duplicar: la copia nace sin destacar (sección 8.4)
      this.requiresPurchase.set(p.promoType !== 'CUSTOMER_LIST');
      this.measureType.set((p.measureType as 'QUANTITY' | 'AMOUNT') || 'QUANTITY');
      this.repeats.set(!!p.repeats);
      this.maxRepeatsPerOrder.set(p.maxRepeatsPerOrder != null ? String(p.maxRepeatsPerOrder) : '');
      this.combineTiers.set(!!p.combineTiers);
      const brandCond = (p.conditions ?? []).find(
        (c) => c.scope === 'BRAND' || c.scope === 'FAMILY',
      );
      if (brandCond) {
        this.mode.set('ambito');
        this.ambitoSelected.set({
          id: (brandCond.brandId ?? brandCond.familyId)!,
          name: brandCond.brandName ?? brandCond.familyName ?? '',
          extraInfo: brandCond.scope === 'FAMILY' ? 'Familia' : 'Marca',
        });
      } else {
        this.mode.set('surtido');
        this.conditions.set(
          (p.conditions ?? []).map((c) => ({
            scope: (c.scope as 'PRODUCT' | 'FAMILY' | 'BRAND') ?? 'PRODUCT',
            productId: c.productId ?? undefined,
            familyId: c.familyId ?? undefined,
            brandId: c.brandId ?? undefined,
            name: c.productName ?? c.familyName ?? c.brandName ?? '',
            code: c.productCode ?? undefined,
            required: !!c.required,
            minQuantity: c.required ? (c.minQuantity ?? 1) : undefined,
          })),
        );
      }
      // Umbral: de la columna que corresponde a measureType. Si por datos
      // viejos viene en la otra columna, queda vacío con el aviso de la
      // sección 7.2 (nunca se guarda así: el backend lo rechaza).
      const measureAmount = this.measureType() === 'AMOUNT';
      const loadedTiers: TierDraft[] = (p.tiers ?? []).map((t) => {
        const matching = measureAmount ? t.fromAmount : t.fromQuantity;
        const other = measureAmount ? t.fromQuantity : t.fromAmount;
        return {
          key: tierKeySeq++,
          tier: t.tier ?? 1,
          threshold: matching ?? null,
          thresholdMismatch: matching == null && other != null,
          benefitGroups: (t.benefitGroups ?? []).map((g) => ({
            key: groupKeySeq++,
            benefitGroup: g.benefitGroup ?? 1,
            selectionMode: (g.selectionMode as 'ALL' | 'CHOOSE') ?? 'ALL',
            chooseCount: g.chooseCount ?? 1,
            benefits: (g.benefits ?? []).map((b) => ({
              key: benefitKeySeq++,
              benefitType: (b.benefitType as BenefitDraft['benefitType']) ?? 'FREE_PRODUCT',
              catalog: !!b.productId,
              productId: b.productId ?? undefined,
              productCode: b.productCode ?? undefined,
              productName: b.productName ?? undefined,
              quantity: b.quantity ?? undefined,
              discountAmount: b.discountAmount ?? undefined,
              discountPercent: b.discountPercent ?? undefined,
              label: b.label ?? undefined,
            })),
          })),
        };
      });
      this.tiers.set(loadedTiers.length ? loadedTiers : [emptyTier(1)]);
      this.resortTiers();
      if (keepId) {
        this.draftId.set(id);
        this.audience.set([
          ...(p.segments ?? []).map((s) => ({
            kind: 'segment' as const,
            id: s.segmentId!,
            name: s.segmentName ?? '',
            mode: (s.mode as 'INCLUDE' | 'EXCLUDE') ?? 'INCLUDE',
          })),
          ...(p.customers ?? []).map((c) => ({
            kind: 'customer' as const,
            id: c.customerId!,
            name: c.customerName ?? '',
            mode: (c.mode as 'INCLUDE' | 'EXCLUDE') ?? 'INCLUDE',
            maxQuantity: c.maxQuantity ?? undefined,
          })),
        ]);
        // "Volver al asistente" desde Simular pedido (sección 9.3) regresa
        // directo al paso 5, ya visitado, sin repetir los pasos anteriores.
        if (jumpToSummary) {
          this.step.set(4);
          this.visited.update((v) => Array.from(new Set([...v, 0, 1, 2, 3, 4])));
        }
      }
    });
  }

  /**
   * Crea la promo la primera vez; de ahí en más actualiza con el estado
   * actual del formulario (no se queda con el primer guardado — sección
   * 8.2: cada "Continuar" guarda lo último).
   */
  /**
   * Motivo de un error de guardado y a qué paso lleva — doc 47, secciones
   * 8.4, 17.2 y 17.3. El `detail` del backend se muestra tal cual cuando ya
   * está en lenguaje de negocio; si trae un nombre técnico, se traduce.
   */
  private saveErrorMessage(err: { status?: number; error?: { detail?: string } }): {
    message: string;
    step: number;
  } {
    const detail: string = err?.error?.detail ?? '';
    if (err?.status === 409) {
      if (
        /se mide en soles|se mide en unidades|está repetido|debe pedir más que el tramo|lleva un solo tramo/i.test(
          detail,
        )
      ) {
        return { message: detail, step: 2 };
      }
      if (/al menos un tramo con un grupo de beneficio no vacío/i.test(detail)) {
        return { message: 'Cada tramo necesita al menos un premio.', step: 2 };
      }
      const chooseOneOption = detail.match(/grupo \d+ del tramo (\d+) .*una sola opción/i);
      if (chooseOneOption) {
        return {
          message: `El premio a elegir del tramo ${chooseOneOption[1]} necesita al menos dos opciones.`,
          step: 2,
        };
      }
      const chooseTooMany = detail.match(/grupo \d+ del tramo (\d+) pide elegir más premios/i);
      if (chooseTooMany) {
        return {
          message: `En el tramo ${chooseTooMany[1]}, no puede pedir elegir más premios de los que ofrece.`,
          step: 2,
        };
      }
      if (/fecha de fin no puede ser anterior/i.test(detail)) return { message: detail, step: 0 };
      if (/ya se aplicó en pedidos/i.test(detail)) return { message: detail, step: 4 };
      if (/ya existe una promoci[oó]n con ese c[oó]digo/i.test(detail) || /code/i.test(detail)) {
        return { message: 'Ya existe una promoción con ese código.', step: 0 };
      }
      return { message: detail || 'No se pudo completar la operación. Intenta de nuevo.', step: 2 };
    }
    if (err?.status === 400) {
      if (/maxRepeatsPerOrder/i.test(detail) && /solo aplica cuando/i.test(detail)) {
        return { message: 'El tope por pedido solo se usa si la promoción se repite.', step: 2 };
      }
      if (/necesita un tope por pedido/i.test(detail)) {
        return { message: 'Indica el tope de veces por pedido.', step: 2 };
      }
      if (/CUSTOMER_LIST no se repite/i.test(detail)) {
        return { message: 'Una promoción por lista de clientes no se repite.', step: 2 };
      }
      if (/CUSTOMER_LIST no lleva condiciones/i.test(detail)) {
        return { message: 'Una promoción por lista de clientes no lleva productos.', step: 1 };
      }
      if (/TIERED necesita al menos una condición/i.test(detail)) {
        return { message: 'Elige qué productos cuentan.', step: 1 };
      }
      if (/fromQuantity o fromAmount/i.test(detail)) {
        return { message: 'Indica desde cuánto se gana este tramo.', step: 2 };
      }
      if (/selectionMode CHOOSE exige chooseCount/i.test(detail)) {
        return { message: 'Indica cuántos premios elige el cliente.', step: 2 };
      }
      if (/chooseCount no puede ser mayor/i.test(detail)) {
        return { message: 'No puede pedir elegir más premios de los que ofrece.', step: 2 };
      }
      if (/grupo CHOOSE necesita al menos dos opciones/i.test(detail)) {
        return { message: 'Un premio a elegir necesita al menos dos opciones.', step: 2 };
      }
      if (/FREE_PRODUCT exige quantity/i.test(detail)) {
        return { message: 'Elige el producto y la cantidad.', step: 2 };
      }
      if (/scope debe traer su referencia/i.test(detail)) {
        return { message: 'Elige el producto, la familia o la marca.', step: 1 };
      }
      if (/measureType debe ser/i.test(detail)) {
        return { message: 'Elige cómo se cuenta la compra.', step: 1 };
      }
    }
    if (err?.status === 404) return { message: 'La promoción ya no existe.', step: this.step() };
    return { message: 'No se pudo completar la operación. Intenta de nuevo.', step: this.step() };
  }

  private ensureSaved(): Observable<number> {
    this.savingDraft.set(true);
    this.saveError.set('');
    const id = this.draftId() ?? this.editingId();
    const obs = id
      ? this.promoSvc.update(id, this.buildUpdateCommand()).pipe(map((p) => p.promoId!))
      : this.promoSvc.create(this.buildCreateCommand()).pipe(map((p) => p.promoId!));
    return obs.pipe(
      map((savedId) => {
        this.draftId.set(savedId);
        this.savedAt.set(new Date());
        this.savingDraft.set(false);
        return savedId;
      }),
      catchError((err) => {
        this.savingDraft.set(false);
        const { message, step } = this.saveErrorMessage(err);
        this.saveError.set(message);
        this.errorSteps.update((s) => Array.from(new Set([...s, step])));
        if (step !== this.step()) this.step.set(step);
        if (step === 2) {
          const badIndex = this.tiers().findIndex((t, i) => !!this.tierValidationError(t, i));
          if (badIndex >= 0) this.selectedTier.set(badIndex);
        }
        throw err;
      }),
    );
  }

  /** Sección 8.2: al llegar al paso 5 la promo ya está guardada — no hace falta guardar de nuevo. */
  protected saveOff() {
    const id = this.draftId();
    if (id) {
      this.toast.success('Promoción guardada apagada');
      this.router.navigate(['/promociones', id]);
      return;
    }
    this.ensureSaved().subscribe({
      next: (savedId) => {
        this.toast.success('Promoción guardada apagada');
        this.router.navigate(['/promociones', savedId]);
      },
    });
  }

  protected activatePromo() {
    this.dialog
      .confirm({
        title: 'Activar promoción',
        message: 'La promoción empezará a aplicarse en los pedidos. ¿Activarla?',
        confirmLabel: 'Activar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.activating.set(true);
        this.ensureSaved().subscribe({
          next: (id) => {
            this.promoSvc.approve(id).subscribe({
              next: () => {
                this.activating.set(false);
                this.toast.success('Promoción activada');
                this.router.navigate(['/promociones', id]);
              },
              error: () => this.activating.set(false),
            });
          },
          error: () => this.activating.set(false),
        });
      });
  }

  /** "Simular pedido" (paso 5) — sección 8.2: ya existe guardada apagada, se puede probar sin activarla. */
  protected goSimulate() {
    const id = this.draftId();
    if (!id) return;
    this.router.navigate(['/promociones/simular'], { queryParams: { promoId: id, fromWizard: 1 } });
  }
}
