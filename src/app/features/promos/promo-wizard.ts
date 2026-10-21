import { Component, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { UiWizardSteps, UiWizardStep } from './ui/wizard-steps/wizard-steps';
import { PromoService } from './promo';
import { LookupService } from './lookup';
import { CreatePromoCommand, LookupItem, PromoDetail, UpdatePromoCommand } from './promo.types';
import {
  applicationsPerCustomerText,
  dateText,
  PRIORITY_OPTIONS,
  priorityText,
  repeatsText,
} from './promo-format';
import {
  benefitProductName,
  benefitQuantityText,
  benefitText,
  groupModeText,
  thresholdText,
} from './domain/promo-texts';
import { ToastService } from '../../core/ui/toast';
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
  benefitGroup: number;
  selectionMode: 'ALL' | 'CHOOSE';
  chooseCount: number;
  benefits: BenefitDraft[];
}

interface TierDraft {
  key: number;
  tier: number;
  fromQuantity: number;
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

/**
 * Un tramo nace siempre con sus dos grupos («elige 1 de N» y «se entrega
 * siempre»), aunque estén vacíos: así la plantilla los lee sin tener que
 * crearlos, y los grupos sin premios se descartan al armar el comando.
 */
function emptyTier(tierNumber: number): TierDraft {
  return {
    key: tierKeySeq++,
    tier: tierNumber,
    fromQuantity: 10,
    benefitGroups: [
      { benefitGroup: 1, selectionMode: 'CHOOSE', chooseCount: 1, benefits: [] },
      { benefitGroup: 2, selectionMode: 'ALL', chooseCount: 1, benefits: [] },
    ],
  };
}

/** Garantiza que un tramo traído del backend tenga los dos grupos. */
function withBothGroups(groups: BenefitGroupDraft[]): BenefitGroupDraft[] {
  const result = [...groups];
  if (!result.some((g) => g.selectionMode === 'CHOOSE')) {
    result.push({
      benefitGroup: result.length + 1,
      selectionMode: 'CHOOSE',
      chooseCount: 1,
      benefits: [],
    });
  }
  if (!result.some((g) => g.selectionMode === 'ALL')) {
    result.push({
      benefitGroup: result.length + 1,
      selectionMode: 'ALL',
      chooseCount: 1,
      benefits: [],
    });
  }
  return result;
}

@Component({
  selector: 'app-promo-wizard',
  imports: [
    NgTemplateOutlet,
    UiButton,
    UiField,
    UiToggle,
    UiTypeahead,
    UiWizardSteps,
    HasPermissionDirective,
  ],
  template: `
    <section class="wizard-page">
      <div class="wizard-head">
        <div>
          <div class="wizard-eyebrow">
            {{ editingId() ? 'Editar promoción' : 'Nueva promoción' }}
          </div>
          <h1>{{ name() || 'Sin nombre todavía' }}</h1>
        </div>
        <div class="wizard-head-actions">
          @if (savedAt()) {
            <span class="wizard-saved">Guardado</span>
          }
        </div>
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
              </div>
            </div>
          }
          @case (1) {
            <div>
              <h2>¿La promoción exige una compra?</h2>
              <p class="wizard-lede">El tipo no se puede cambiar después de crear la promoción.</p>

              <div class="wizard-mode-cards">
                <button
                  type="button"
                  class="wizard-mode-card"
                  [class.selected]="requiresPurchase()"
                  [disabled]="!!editingId()"
                  (click)="requiresPurchase.set(true)"
                >
                  <span class="wizard-mode-eyebrow">Sí</span>
                  <span class="wizard-mode-title">Por compra</span>
                  <span class="wizard-mode-body"
                    >Se gana comprando: tiene condiciones (qué comprar) y tramos con umbral.</span
                  >
                </button>
                <button
                  type="button"
                  class="wizard-mode-card"
                  [class.selected]="!requiresPurchase()"
                  [disabled]="!!editingId()"
                  (click)="requiresPurchase.set(false)"
                >
                  <span class="wizard-mode-eyebrow">No</span>
                  <span class="wizard-mode-title">Por lista de clientes</span>
                  <span class="wizard-mode-body"
                    >Se otorga por estar en la lista, sin condición de compra ni umbral. En el paso
                    4 hay que incluir al menos un segmento o cliente.</span
                  >
                </button>
              </div>

              @if (!requiresPurchase()) {
                <div class="wizard-toggle-card">
                  <p class="wizard-toggle-text">
                    Esta promoción no exige compra: se entrega a todos los clientes que se incluyan
                    en el paso 4 ("A quiénes llega").
                  </p>
                </div>
              } @else {
                <p class="wizard-lede">
                  Elige cómo se cuenta la compra. Puedes cambiarlo sin perder lo que agregaste.
                </p>

                <div class="wizard-mode-cards">
                  <button
                    type="button"
                    class="wizard-mode-card"
                    [class.selected]="mode() === 'ambito'"
                    (click)="mode.set('ambito')"
                  >
                    <span class="wizard-mode-eyebrow">Opción A</span>
                    <span class="wizard-mode-title">Todo de una marca o familia</span>
                    <span class="wizard-mode-body"
                      >«50 unidades de la marca Gaseosas Andinas». Cuenta cualquier producto de la
                      marca, incluso los que entren al catálogo mañana.</span
                    >
                  </button>
                  <button
                    type="button"
                    class="wizard-mode-card"
                    [class.selected]="mode() === 'surtido'"
                    (click)="mode.set('surtido')"
                  >
                    <span class="wizard-mode-eyebrow">Opción B · la más usada</span>
                    <span class="wizard-mode-title">Una lista de productos que se suman</span>
                    <span class="wizard-mode-body"
                      >«10 unidades entre Inca Kola, Coca Cola y Sprite». El cliente los combina
                      como quiera.</span
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
                              <div class="wizard-condition-actions">
                                <span class="wizard-condition-hint">cuenta cualquier cantidad</span>
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
                        <div class="wizard-total-block">
                          <span class="wizard-total-eq">=</span>
                          <ui-field label="Total mínimo" type="number" [(value)]="tier1Quantity" />
                          <span class="wizard-total-text"
                            >unidades <strong>en total</strong>, repartidas como el cliente
                            quiera.</span
                          >
                        </div>
                      </div>
                    </div>
                    <div class="wizard-side-card">
                      <div class="wizard-side-eyebrow">Cómo se calcula</div>
                      <p class="wizard-side-text">
                        El pedido suma las unidades de {{ conditions().length || 'los' }}
                        {{
                          conditions().length === 1 ? 'producto agregado' : 'productos agregados'
                        }}, en cualquier combinación. Cuando la suma llega a
                        {{ tier1Quantity() || '—' }}, el cliente califica.
                      </p>
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
                      <div class="wizard-ambito-total">
                        <ui-field label="Cantidad mínima" type="number" [(value)]="tier1Quantity" />
                        <span class="wizard-total-text"
                          >unidades de <strong>cualquier producto</strong> de
                          {{ ambitoSelected()?.name || 'la marca o familia elegida' }}.</span
                        >
                      </div>
                      @if (ambitoSelected()) {
                        <div class="wizard-ambito-hint">
                          Los productos que se den de alta más adelante entran solos, sin tocar la
                          campaña.
                        </div>
                      }
                    </div>
                    <div class="wizard-side-card">
                      <div class="wizard-side-eyebrow">Productos que cuentan hoy</div>
                      @if (ambitoProductCount() === null) {
                        <p class="wizard-side-text wizard-side-muted">
                          Elige una marca o familia para ver cuántos.
                        </p>
                      } @else {
                        <p class="wizard-side-text">
                          <strong>{{ ambitoProductCount() }}</strong> productos hoy.
                        </p>
                      }
                    </div>
                  </div>
                }
              }
            </div>
          }
          @case (2) {
            <div>
              <h2>Tramos y premios</h2>
              @if (requiresPurchase()) {
                <p class="wizard-lede">
                  Mientras más compra, mejor premio.
                  <strong>Se otorga solo el tramo más alto que alcance</strong> — los tramos no se
                  suman.
                </p>

                <div class="wizard-2col">
                  <ui-field
                    label="Se mide en"
                    type="select"
                    [(value)]="measureTypeValue"
                    [options]="measureTypeOptions"
                  />
                </div>

                <div class="wizard-toggle-card">
                  <ui-toggle label="Se repite por múltiplos" [(checked)]="repeats" />
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
              } @else {
                <p class="wizard-lede">
                  Esta promoción se otorga por estar en la lista: solo define los premios.
                </p>
              }

              @if (requiresPurchase()) {
                <div class="wizard-tier-ladder">
                  @for (t of tiers(); track t.key; let i = $index) {
                    <button
                      type="button"
                      class="wizard-tier-step"
                      [class.selected]="i === selectedTier()"
                      (click)="selectedTier.set(i)"
                    >
                      <span class="wizard-tier-step-eyebrow">Tramo {{ t.tier }}</span>
                      <span class="wizard-tier-step-value">{{ t.fromQuantity }}</span>
                      <span class="wizard-tier-step-hint">{{ tierBenefitSummary(t) }}</span>
                    </button>
                  }
                  <div class="wizard-ladder-note">
                    Un pedido que alcance el tramo más alto disponible gana ese, no todos.
                  </div>
                </div>
              }

              @if (currentTier(); as t) {
                <div class="wizard-tier-editor">
                  @if (requiresPurchase()) {
                    <div class="wizard-tier-editor-head">
                      <div class="wizard-tier-editor-from">
                        <ui-field
                          label="Desde (unidades)"
                          type="number"
                          [(value)]="tierFromQuantityModel"
                        />
                        <span class="wizard-total-text"
                          >unidades compradas · el cliente recibe:</span
                        >
                      </div>
                      <button uiButton variant="secondary" (click)="duplicateTier()">
                        Duplicar tramo
                      </button>
                    </div>
                  }

                  <div class="wizard-2col">
                    <div class="wizard-group-card">
                      <div class="wizard-group-head">
                        <span>El cliente elige 1 de 2</span>
                        <span class="wizard-group-hint">se decide al entregar</span>
                      </div>
                      <div class="wizard-group-body">
                        @for (b of chooseGroup(t).benefits; track b.key) {
                          <div class="wizard-benefit-row">
                            <ng-container
                              *ngTemplateOutlet="benefitEditor; context: { $implicit: b }"
                            />
                          </div>
                        }
                        <button uiButton variant="ghost" (click)="addBenefit(t, 'CHOOSE')">
                          + Agregar opción
                        </button>
                      </div>
                    </div>
                    <div class="wizard-group-card">
                      <div class="wizard-group-head">
                        <span>Se entrega siempre</span>
                        <span class="wizard-group-hint">todo lo de este grupo</span>
                      </div>
                      <div class="wizard-group-body">
                        @for (b of allGroup(t).benefits; track b.key) {
                          <div class="wizard-benefit-row">
                            <ng-container
                              *ngTemplateOutlet="benefitEditor; context: { $implicit: b }"
                            />
                          </div>
                        }
                        <button uiButton variant="ghost" (click)="addBenefit(t, 'ALL')">
                          + Agregar premio
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="wizard-tier-phrase">{{ tierPhrase(t) }}</div>
                </div>
              }

              @if (requiresPurchase()) {
                <button uiButton variant="secondary" class="wizard-add-tier" (click)="addTier()">
                  + Agregar otro tramo
                </button>
              }
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
            <div class="wizard-summary-single">
              <h2>Resumen</h2>
              <div class="wizard-prose">{{ summaryPhrase() }}</div>
              <hr class="wizard-hr" />

              <h3 class="wizard-summary-subtitle">Datos</h3>
              <div class="wizard-summary-facts">
                <div>
                  <span>Código</span><span>{{ code() }}</span>
                </div>
                <div>
                  <span>Tipo</span
                  ><span>{{ requiresPurchase() ? 'Por compra' : 'Por lista de clientes' }}</span>
                </div>
                <div>
                  <span>Canal</span><span>{{ selectedChannelName() || 'Todos los canales' }}</span>
                </div>
                <div>
                  <span>Vigencia</span><span>{{ vigenciaSummary() }}</span>
                </div>
                <div>
                  <span>Prioridad</span><span>{{ priorityLabel() }}</span>
                </div>
                <div>
                  <span>Se combina</span><span>{{ stackable() ? 'Sí' : 'No' }}</span>
                </div>
                <div>
                  <span>Se repite</span><span>{{ repeatsSummary() }}</span>
                </div>
                <div>
                  <span>Veces por cliente</span><span>{{ maxApplicationsSummary() }}</span>
                </div>
              </div>

              <h3 class="wizard-summary-subtitle">Qué debe comprar</h3>
              @if (!requiresPurchase()) {
                <p class="wizard-side-text wizard-side-muted">
                  No exige compra: se otorga por estar en la lista.
                </p>
              } @else if (mode() === 'ambito' && ambitoSelected()) {
                <p class="wizard-side-text">
                  {{ ambitoSelected()!.extraInfo === 'Familia' ? 'Familia' : 'Marca' }}
                  {{ ambitoSelected()!.name }}
                </p>
              } @else if (conditions().length === 0) {
                <p class="wizard-side-text wizard-side-muted">
                  Agrega al menos un producto en el paso "Qué debe comprar".
                </p>
              } @else {
                <table class="ui-table-grid wizard-summary-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Código</th>
                      <th>Nombre</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of conditions(); track c.name + c.scope) {
                      <tr>
                        <td class="wizard-side-muted">{{ scopeLabel(c.scope) }}</td>
                        <td class="wizard-side-muted">{{ c.code || '—' }}</td>
                        <td>{{ c.name }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }

              <h3 class="wizard-summary-subtitle">Tramos y premios</h3>
              <div class="wizard-summary-tiers">
                @for (t of tiers(); track t.key) {
                  <div class="wizard-summary-tier">
                    <div class="wizard-summary-tier-head">
                      {{ requiresPurchase() ? 'Tramo ' + t.tier + ' · ' : ''
                      }}{{ tierThresholdSummary(t) }}
                    </div>
                    @for (g of t.benefitGroups; track g.benefitGroup) {
                      @if (g.benefits.length > 0) {
                        <div class="wizard-summary-group-head">{{ groupModeSummary(g) }}</div>
                        <table class="ui-table-grid wizard-summary-table">
                          <thead>
                            <tr>
                              <th>Código</th>
                              <th>Premio</th>
                              <th class="wizard-col-right">Cantidad</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (b of g.benefits; track b.key) {
                              <tr>
                                <td class="wizard-side-muted">
                                  {{ b.catalog ? b.productCode || '—' : '—' }}
                                </td>
                                <td>{{ benefitNameSummary(b) }}</td>
                                <td class="wizard-col-right">{{ benefitQuantitySummary(b) }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      }
                    }
                  </div>
                }
              </div>

              <h3 class="wizard-summary-subtitle">A quiénes llega</h3>
              <p class="wizard-side-text">{{ audienceSummary() }}</p>
              @if (audience().length > 0) {
                <table class="ui-table-grid wizard-summary-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Nombre</th>
                      <th>Modo</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (a of audience(); track a.kind + a.id) {
                      <tr>
                        <td class="wizard-side-muted">
                          {{ a.kind === 'segment' ? 'Segmento' : 'Cliente' }}
                        </td>
                        <td>{{ a.name }}</td>
                        <td>{{ a.mode === 'INCLUDE' ? 'Incluido' : 'Excluido' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }

              @if (saveError()) {
                <div class="wizard-save-error">{{ saveError() }}</div>
              }
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
            <button
              uiButton
              variant="secondary"
              *hasPermission="'order.manage'"
              (click)="goSimulate()"
            >
              Simular pedido
            </button>
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
          [options]="benefitTypeOptions"
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
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      h1 {
        font-size: 28px;
        margin: 2px 0 0;
        color: var(--ink);
      }
      .wizard-head-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .wizard-saved {
        font-size: 12px;
        color: var(--ink-muted);
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
      .wizard-condition-hint {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .wizard-total-block {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 14px;
        padding: 14px 16px;
        border: 2px solid var(--accent);
      }
      .wizard-total-eq {
        font-size: 32px;
        font-weight: 800;
        line-height: 1;
      }
      .wizard-total-text {
        font-size: 15px;
      }
      .wizard-ambito-total {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-top: 22px;
        padding: 18px;
        border: 2px solid var(--accent);
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
      .wizard-ladder-note {
        flex: 1;
        padding: 16px;
        font-size: 13px;
        color: var(--ink-muted);
        display: flex;
        align-items: center;
      }
      .wizard-tier-editor {
        border: 2px solid var(--divider);
        padding: 22px;
      }
      .wizard-tier-editor-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
      }
      .wizard-tier-editor-from {
        display: flex;
        align-items: flex-end;
        gap: 14px;
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
      .wizard-group-body {
        padding: 14px 16px;
        display: grid;
        gap: 10px;
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
      .wizard-tier-phrase {
        margin-top: 18px;
        padding: 14px 16px;
        background: var(--faint);
        border-left: 3px solid var(--accent);
        font-size: 15px;
      }
      .wizard-add-tier {
        margin-top: 18px;
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
      .wizard-summary-single {
        max-width: 760px;
      }
      .wizard-prose {
        border-left: 3px solid var(--accent);
        padding: 4px 0 4px 18px;
        font-size: 20px;
        line-height: 1.45;
        color: var(--ink);
      }
      .wizard-summary-subtitle {
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-muted);
        margin: 26px 0 10px;
      }
      .wizard-summary-facts {
        display: grid;
        gap: 10px;
        font-size: 14px;
      }
      .wizard-summary-facts div {
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }
      .wizard-summary-facts span:first-child {
        color: var(--ink-muted);
      }
      .wizard-summary-table {
        width: 100%;
        margin-bottom: 4px;
      }
      .wizard-col-right {
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .wizard-summary-tiers {
        display: grid;
        gap: 14px;
      }
      .wizard-summary-tier {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
      }
      .wizard-summary-tier-head {
        font-size: 15px;
        font-weight: 800;
        color: var(--ink);
        margin-bottom: 8px;
      }
      .wizard-summary-group-head {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-muted);
        margin: 10px 0 4px;
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
        .wizard-audience-grid {
          grid-template-columns: 1fr;
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
        .wizard-ladder-note {
          flex: 1 0 100%;
          border-top: 1px solid var(--hairline);
        }
        .wizard-total-block,
        .wizard-ambito-total,
        .wizard-tier-editor-from {
          flex-wrap: wrap;
        }
        .wizard-summary-facts div {
          flex-direction: column;
          gap: 2px;
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
  protected channelOptions = signal<UiFieldOption[]>([]);

  // Paso 2
  protected requiresPurchase = signal(true); // No → CUSTOMER_LIST
  protected mode = signal<'surtido' | 'ambito'>('surtido');
  protected conditions = signal<ConditionDraft[]>([]);
  protected ambitoSelected = signal<UiLookupItem | null>(null);
  protected ambitoProductCount = signal<number | null>(null);
  protected tier1Quantity = signal('10');

  // Paso 3
  protected measureType = signal<'QUANTITY' | 'AMOUNT'>('QUANTITY');
  protected measureTypeOptions: UiFieldOption[] = [
    { value: 'QUANTITY', label: 'Unidades' },
    { value: 'AMOUNT', label: 'Soles' },
  ];
  protected repeats = signal(false);
  protected maxRepeatsPerOrder = signal('');
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
      this.channelOptions.set([
        { value: '', label: 'Todos los canales' },
        ...items.map((i) => ({ value: String(i.id), label: i.name ?? '' })),
      ]);
    });

    effect(() => {
      const brand = this.ambitoSelected();
      if (this.mode() === 'ambito' && brand && brand.name) {
        this.lookupSvc.products('', { brandId: brand.id, limit: 50 }).subscribe((items) => {
          this.ambitoProductCount.set(items.length);
        });
      } else {
        this.ambitoProductCount.set(null);
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

  protected get measureTypeValue() {
    return this.measureType();
  }
  protected set measureTypeValue(v: string) {
    this.measureType.set(v === 'AMOUNT' ? 'AMOUNT' : 'QUANTITY');
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

  protected get tierFromQuantityModel() {
    const t = this.currentTier();
    return String(t?.fromQuantity ?? '');
  }
  protected set tierFromQuantityModel(v: string) {
    const t = this.currentTier();
    if (!t) return;
    t.fromQuantity = this.numberOr(t.fromQuantity, v);
    this.tiers.update((list) => [...list]);
  }

  /** Lectura pura para la plantilla: el grupo siempre existe (ver emptyTier). */
  protected chooseGroup(t: TierDraft): BenefitGroupDraft {
    return t.benefitGroups.find((x) => x.selectionMode === 'CHOOSE')!;
  }

  protected allGroup(t: TierDraft): BenefitGroupDraft {
    return t.benefitGroups.find((x) => x.selectionMode === 'ALL')!;
  }

  protected addBenefit(t: TierDraft, mode: 'CHOOSE' | 'ALL') {
    const group = mode === 'CHOOSE' ? this.chooseGroup(t) : this.allGroup(t);
    group.benefits.push({
      key: benefitKeySeq++,
      benefitType: 'FREE_PRODUCT',
      catalog: true,
      quantity: 1,
    });
    group.chooseCount = Math.min(group.chooseCount, group.benefits.length || 1);
    this.tiers.update((list) => [...list]);
  }

  protected removeBenefit(b: BenefitDraft) {
    // Los grupos vacíos se conservan (son el andamiaje de las dos columnas);
    // buildTiersCommand() ya los descarta al enviar.
    for (const t of this.tiers()) {
      for (const g of t.benefitGroups) {
        g.benefits = g.benefits.filter((x) => x !== b);
      }
    }
    this.tiers.update((list) => [...list]);
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

  protected addTier() {
    const nextNum = Math.max(0, ...this.tiers().map((t) => t.tier)) + 1;
    this.tiers.update((list) => [...list, emptyTier(nextNum)]);
    this.selectedTier.set(this.tiers().length - 1);
  }

  protected duplicateTier() {
    const t = this.currentTier();
    if (!t) return;
    const nextNum = Math.max(0, ...this.tiers().map((x) => x.tier)) + 1;
    const clone: TierDraft = {
      key: tierKeySeq++,
      tier: nextNum,
      fromQuantity: t.fromQuantity,
      benefitGroups: t.benefitGroups.map((g) => ({
        ...g,
        benefits: g.benefits.map((b) => ({ ...b, key: benefitKeySeq++ })),
      })),
    };
    this.tiers.update((list) => [...list, clone]);
    this.selectedTier.set(this.tiers().length - 1);
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

  protected tierPhrase(t: TierDraft): string {
    const choose = t.benefitGroups.find((g) => g.selectionMode === 'CHOOSE');
    const all = t.benefitGroups.find((g) => g.selectionMode === 'ALL');
    const parts: string[] = [];
    if (choose?.benefits.length) {
      parts.push(`elige entre ${choose.benefits.map((b) => this.benefitLabel(b)).join(' y ')}`);
    }
    if (all?.benefits.length) {
      parts.push(`recibe ${all.benefits.map((b) => this.benefitLabel(b)).join(' y ')}`);
    }
    if (!parts.length) return 'Agrega al menos un premio para este tramo.';
    return `Con este tramo: ${parts.join(', y además ')}.`;
  }

  protected summaryPhrase(): string {
    const t1 = this.tiers()[0];
    if (!this.requiresPurchase()) {
      const benefitText = t1 ? this.tierPhraseInline(t1) : 'sin premios definidos';
      return `Por estar en la lista de clientes incluidos, el cliente ${benefitText}.`;
    }
    const scopeText =
      this.mode() === 'surtido'
        ? `${this.tier1Quantity()} unidades entre ${
            this.conditions()
              .map((c) => c.name)
              .join(', ') || 'los productos elegidos'
          }`
        : `${this.tier1Quantity()} unidades de ${this.ambitoSelected()?.name ?? 'la marca o familia elegida'}`;
    const benefitText = t1 ? this.tierPhraseInline(t1) : 'sin premios definidos';
    return `Comprando ${scopeText}, el cliente ${benefitText}.`;
  }

  private tierPhraseInline(t: TierDraft): string {
    const choose = t.benefitGroups.find((g) => g.selectionMode === 'CHOOSE');
    const all = t.benefitGroups.find((g) => g.selectionMode === 'ALL');
    const parts: string[] = [];
    if (choose?.benefits.length)
      parts.push(`elige entre ${choose.benefits.map((b) => this.benefitLabel(b)).join(' y ')}`);
    if (all?.benefits.length)
      parts.push(`recibe ${all.benefits.map((b) => this.benefitLabel(b)).join(' y ')}`);
    return parts.join(', y ') || 'no recibe premios todavía';
  }

  protected vigenciaSummary(): string {
    if (!this.startDate() && !this.endDate()) return 'Sin fecha de inicio';
    return `${dateText(this.startDate())} – ${dateText(this.endDate())}`;
  }

  protected selectedChannelName(): string {
    return this.channelOptions().find((o) => o.value === this.salesChannelId())?.label ?? '';
  }

  protected audienceSummary(): string {
    if (this.audience().length === 0) return 'Todos los clientes del canal';
    const n = this.reach()?.reachedCustomers;
    return n != null ? `${n} clientes` : `${this.audience().length} reglas de alcance`;
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

  protected tierThresholdSummary(t: TierDraft): string {
    return thresholdText({
      promoType: this.requiresPurchase() ? 'TIERED' : 'CUSTOMER_LIST',
      measureType: this.measureType(),
      fromQuantity: t.fromQuantity,
    });
  }

  protected groupModeSummary(g: BenefitGroupDraft): string {
    return groupModeText(g.selectionMode, g.chooseCount, g.benefits.length);
  }

  protected benefitNameSummary(b: BenefitDraft): string {
    return benefitProductName({
      benefitType: b.benefitType,
      productName: b.catalog ? b.productName : undefined,
      label: !b.catalog ? b.label : undefined,
    });
  }

  protected benefitQuantitySummary(b: BenefitDraft): string {
    return benefitQuantityText({
      benefitType: b.benefitType,
      quantity: b.quantity,
      discountAmount: b.discountAmount,
      discountPercent: b.discountPercent,
    });
  }

  protected stepHint(): string {
    return [
      'Guarda los datos generales de la campaña.',
      'Define qué compra cuenta para esta promoción.',
      'Arma los tramos y sus premios.',
      'Elige a quién llega la promoción.',
      'Revisa todo y actívala.',
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
      .filter((t) => t.fromQuantity <= quantity)
      .sort((a, b) => b.fromQuantity - a.fromQuantity);
    return eligible[0] ?? null;
  }

  /** "Si compra [N] → gana X premios" — fórmula de la sección 5.2, sin llamar al backend. */
  protected simRepeatResult(): string {
    const qty = this.numberOr(0, this.simRepeatQuantity());
    const tier = this.reachedTier(qty);
    const tope = this.numberOr(1, this.maxRepeatsPerOrder());
    if (!tier || qty < tier.fromQuantity) return 'No alcanza ningún tramo todavía.';
    const veces = Math.min(Math.floor(qty / tier.fromQuantity), tope);
    return `Gana ${veces} ${veces === 1 ? 'vez' : 'veces'} el premio del tramo ${tier.tier}.`;
  }

  protected repeatsHelpText(): string {
    const t1 = this.tiers()[0];
    const umbral = t1?.fromQuantity ?? 10;
    const tope = this.numberOr(3, this.maxRepeatsPerOrder());
    const base = `Cada vez que el pedido junta otras ${umbral} unidades, se entrega el premio otra vez: ${umbral * 2} → 2, ${umbral * 3} → 3. Nunca más de ${tope} veces por pedido.`;
    if (this.tiers().length > 1) {
      return `${base} Se repite solo el tramo más alto alcanzado; los tramos no se combinan.`;
    }
    return base;
  }

  private validateStep(n: number): boolean {
    if (n === 0) return !!this.name().trim() && !this.dateRangeError();
    if (n === 2) {
      const hasBenefit = this.tiers().some((t) =>
        t.benefitGroups.some((g) => g.benefits.length > 0),
      );
      if (!hasBenefit) return false;
      if (this.repeats() && !this.maxRepeatsPerOrder()) return false;
      return true;
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
      this.ensureSaved().subscribe();
    } else if (leavingStep === 3) {
      this.ensureSaved().subscribe((id) => {
        this.promoSvc.setTargets(id, this.buildTargetsCommand()).subscribe();
      });
    }
  }

  protected prevStep() {
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected goToStep(index: number) {
    if (index === this.step() || this.visited().includes(index)) this.step.set(index);
  }

  private buildTiersCommand() {
    const source = this.requiresPurchase() ? this.tiers() : this.tiers().slice(0, 1);
    return source
      .filter((t) => t.benefitGroups.some((g) => g.benefits.length > 0))
      .map((t) => ({
        tier: t.tier,
        // CUSTOMER_LIST: un único tramo sin umbral (sección 8.4 del doc).
        fromQuantity: this.requiresPurchase() ? t.fromQuantity : undefined,
        benefitGroups: t.benefitGroups
          .filter((g) => g.benefits.length > 0)
          .map((g) => {
            // Un grupo «elige» con una sola opción no es una elección: se
            // manda como entrega fija (el backend valida choiceMeaningful).
            const mode =
              g.selectionMode === 'CHOOSE' && g.benefits.length < 2 ? 'ALL' : g.selectionMode;
            return {
              benefitGroup: g.benefitGroup,
              selectionMode: mode,
              chooseCount: mode === 'CHOOSE' ? g.chooseCount || 1 : undefined,
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
    }));
  }

  private buildCreateCommand(): CreatePromoCommand {
    return {
      code: this.code(),
      name: this.name(),
      description: this.description() || undefined,
      promoType: this.requiresPurchase() ? 'TIERED' : 'CUSTOMER_LIST',
      salesChannelId: this.salesChannelId() ? Number(this.salesChannelId()) : undefined,
      measureType: this.measureType(),
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
    };
  }

  private buildUpdateCommand(): UpdatePromoCommand {
    return {
      name: this.name(),
      description: this.description() || undefined,
      salesChannelId: this.salesChannelId() ? Number(this.salesChannelId()) : undefined,
      measureType: this.measureType(),
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
      this.requiresPurchase.set(p.promoType !== 'CUSTOMER_LIST');
      this.measureType.set((p.measureType as 'QUANTITY' | 'AMOUNT') ?? 'QUANTITY');
      this.repeats.set(!!p.repeats);
      this.maxRepeatsPerOrder.set(p.maxRepeatsPerOrder != null ? String(p.maxRepeatsPerOrder) : '');
      const brandCond = (p.conditions ?? []).find(
        (c) => c.scope === 'BRAND' || c.scope === 'FAMILY',
      );
      if (brandCond) {
        this.mode.set('ambito');
        this.ambitoSelected.set({
          id: (brandCond.brandId ?? brandCond.familyId)!,
          name: brandCond.brandName ?? brandCond.familyName ?? '',
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
          })),
        );
      }
      const firstTier = (p.tiers ?? [])[0];
      this.tier1Quantity.set(String(firstTier?.fromQuantity ?? 10));
      this.tiers.set(
        (p.tiers ?? [emptyTier(1)]).map((t) => ({
          key: tierKeySeq++,
          tier: t.tier ?? 1,
          fromQuantity: t.fromQuantity ?? 10,
          benefitGroups: withBothGroups(
            (t.benefitGroups ?? []).map((g) => ({
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
          ),
        })),
      );
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
        this.saveError.set('No pudimos guardar la promoción. Revisa los datos e intenta de nuevo.');
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
