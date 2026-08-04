import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { ToastService } from '../../core/ui/toast';
import { PromoService } from './promo';
import { ProductPickerDialog } from './product-picker-dialog';
import { CatalogService } from '../sales/catalog';
import { SegmentService } from '../segments/segment';
import { CustomerService } from '../customers/customer';
import { Brand, Family, Product, SalesChannel } from '../../shared/models/catalog.models';
import { Segment } from '../../shared/models/segment.models';
import { CustomerSummary } from '../../shared/models/customer.models';
import { CreatePromoCommand, PromoTargets } from '../../shared/models/promo.models';
import { PROMO_TYPE_LABELS } from '../../shared/ui/promo';

let SEQ = 0;
const uid = () => ++SEQ;

interface CondDraft {
  uid: number;
  scope: string;
  productId?: number;
  productName?: string;
  familyId?: number;
  brandId?: number;
  minQuantity?: number;
  minAmount?: number;
}
interface BenefDraft {
  uid: number;
  benefitType: string;
  productId?: number;
  productName?: string;
  quantity?: number;
  discountAmount?: number;
  discountPercent?: number;
  label?: string;
}
interface TierDraft {
  uid: number;
  tier: number;
  fromQuantity: number;
  fromAmount: number;
  benefits: BenefDraft[];
}
interface SegTarget {
  segmentId: number;
  name: string;
  mode: string;
}
interface CustTarget {
  customerId: number;
  name: string;
  mode: string;
  maxQuantity?: number;
}

@Component({
  selector: 'app-promo-wizard',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatTooltipModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Nueva promoción" subtitle="Nace apagada; se aprueba al final"></app-page-header>

      <!-- Stepper propio -->
      <div class="steps">
        @for (s of stepLabels; track $index) {
          <button
            class="step"
            [class.active]="step() === $index + 1"
            [class.done]="step() > $index + 1"
            (click)="goStep($index + 1)"
          >
            <span class="n">{{ $index + 1 }}</span> {{ s }}
          </button>
        }
      </div>

      @switch (step()) {
        <!-- 1. Datos generales -->
        @case (1) {
          <mat-card class="card">
            <h3 class="picker-h">¿Qué tipo de promoción es?</h3>
            <div class="type-grid">
              @for (t of promoTypes; track t.code) {
                <button
                  type="button"
                  class="type-card"
                  [class.selected]="promoType() === t.code"
                  (click)="onTypeChange(t.code)"
                >
                  <mat-icon>{{ t.icon }}</mat-icon>
                  <span class="t-label">{{ t.label }}</span>
                  <span class="t-desc">{{ t.desc }}</span>
                </button>
              }
            </div>

            <div class="grid2">
              <mat-form-field appearance="outline"
              >
                <mat-label>Nombre</mat-label>
                <input matInput [value]="name()" (input)="onNameInput($any($event.target).value)"
                /></mat-form-field>
              <mat-form-field appearance="outline"
              >
                <mat-label>Código</mat-label>
                <input
                  matInput
                  [value]="code()"
                  (input)="onCodeInput($any($event.target).value)"
                />
                <mat-hint>Se genera solo desde el nombre — edítalo si quieres otro.</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline"
              >
                <mat-label>Canal (vacío = todos)</mat-label>
                <mat-select
                  [value]="salesChannelId()"
                  (valueChange)="salesChannelId.set($event)"
                >
                  <mat-option [value]="null">Todos los canales</mat-option>
                  @for (c of salesChannels(); track c.salesChannelId) {
                    <mat-option [value]="c.salesChannelId">{{ c.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline"
              >
                <mat-label>Desde</mat-label>
                <input
                  matInput
                  type="date"
                  [value]="startDate()"
                  (input)="startDate.set($any($event.target).value)"
                /></mat-form-field>
              <mat-form-field appearance="outline"
              >
                <mat-label>Hasta</mat-label>
                <input
                  matInput
                  type="date"
                  [value]="endDate()"
                  (input)="endDate.set($any($event.target).value)"
                /></mat-form-field>
            </div>
            @if (typeNote(); as note) {
              <p class="hint">
                <mat-icon inline="">info</mat-icon>
                {{ note }}
              </p>
            }
            <mat-form-field appearance="outline" class="full"
            >
              <mat-label>Descripción</mat-label>
              <input
                matInput
                [value]="description()"
                (input)="description.set($any($event.target).value)"
              /></mat-form-field>
            @if (promoType() !== 'CUSTOMER_LIST') {
              <mat-checkbox [checked]="repeats()" (change)="repeats.set($any($event).checked)">
                Se repite por cada múltiplo (compra 36 con umbral 12 → 3× el beneficio)
              </mat-checkbox>
            } @else {
              <p class="hint">
                <mat-icon inline="">info</mat-icon>
                No aplica: una promo de lista de clientes siempre se otorga una vez por pedido
                calificado, sin multiplicar.
              </p>
            }
          </mat-card>
        }

        <!-- 2. Condiciones -->
        @case (2) {
          <mat-card class="card">
            <p class="muted">{{ conditionHint() }}</p>
            @if (allowedScopes().length) {
              <div class="addrow">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Agregar condición (scope)</mat-label>
                  <mat-select [value]="null" (valueChange)="addCondition($event)">
                    @for (s of allowedScopes(); track s.code) {
                      <mat-option [value]="s.code">{{ s.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
            }

            @for (c of conditions(); track c.uid) {
              <div class="cond">
                <span class="tag">{{ scopeLabel(c.scope) }}</span>
                @if (c.scope === 'PRODUCT' || c.scope === 'COMBO_ITEM') {
                  <button mat-stroked-button (click)="pickCondProduct(c)">
                    {{ c.productName ?? 'Elegir producto' }}
                  </button>
                }
                @if (c.scope === 'FAMILY') {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"
                  >
                    <mat-label>Familia</mat-label>
                    <mat-select
                      [value]="c.familyId ?? null"
                      (valueChange)="updateCond(c.uid, { familyId: $event })"
                    >
                      @for (f of families(); track f.familyId) {
                        <mat-option [value]="f.familyId">{{ f.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field
                  >
                }
                @if (c.scope === 'BRAND') {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"
                  >
                    <mat-label>Marca</mat-label>
                    <mat-select
                      [value]="c.brandId ?? null"
                      (valueChange)="updateCond(c.uid, { brandId: $event })"
                    >
                      @for (b of brands(); track b.brandId) {
                        <mat-option [value]="b.brandId">{{ b.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field
                  >
                }
                @if (c.scope === 'ORDER') {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"
                  >
                    <mat-label>Monto mínimo (S/)</mat-label>
                    <input
                      matInput
                      type="number"
                      [value]="c.minAmount ?? ''"
                      (input)="
                        updateCond(c.uid, { minAmount: +$any($event.target).value || undefined })
                      "
                    /></mat-form-field>
                } @else {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"
                  >
                    <mat-label>Cant. mínima</mat-label>
                    <input
                      matInput
                      type="number"
                      [value]="c.minQuantity ?? ''"
                      (input)="
                        updateCond(c.uid, { minQuantity: +$any($event.target).value || undefined })
                      "
                    /></mat-form-field>
                }
                <button mat-icon-button (click)="removeCond(c.uid)" aria-label="Quitar">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            } @empty {
              <p class="muted">Sin condiciones (para CUSTOMER_LIST está bien).</p>
            }
          </mat-card>
        }

        <!-- 3. Tramos y beneficios -->
        @case (3) {
          <mat-card class="card">
            @if (canAddTier()) {
              <button mat-stroked-button (click)="addTier()">
                <mat-icon>add</mat-icon>
                Agregar tramo
              </button>
            } @else {
              <p class="hint">
                <mat-icon inline="">info</mat-icon>
                {{ typeLabel(promoType()) }} solo usa el primer tramo — el motor ignora tramos
                adicionales para este tipo. Si necesitas otro nivel de beneficio, crea otra promo.
              </p>
            }
            @for (t of tiers(); track t.uid) {
              <div class="tier">
                <div class="trow">
                  <strong>Tramo {{ t.tier }}</strong>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"
                  >
                    <mat-label>Desde cant.</mat-label>
                    <input
                      matInput
                      type="number"
                      [value]="t.fromQuantity"
                      (input)="
                        updateTier(t.uid, { fromQuantity: +$any($event.target).value || 0 })
                      "
                    /></mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"
                  >
                    <mat-label>Desde monto</mat-label>
                    <input
                      matInput
                      type="number"
                      [value]="t.fromAmount"
                      (input)="updateTier(t.uid, { fromAmount: +$any($event.target).value || 0 })"
                    /></mat-form-field>
                  <button mat-icon-button (click)="removeTier(t.uid)" aria-label="Quitar tramo">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>

                <div class="benefits">
                  <div class="addrow">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic"
                    >
                      <mat-label>Agregar beneficio</mat-label>
                      <mat-select [value]="null" (valueChange)="addBenefit(t.uid, $event)">
                        @for (b of benefitTypes; track b.code) {
                          <mat-option [value]="b.code">{{ b.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field
                    >
                  </div>
                  @for (b of t.benefits; track b.uid) {
                    <div class="benefit">
                      <span class="tag">{{ benefitLabel(b.benefitType) }}</span>
                      @if (b.benefitType === 'FREE_PRODUCT') {
                        <button mat-stroked-button (click)="pickBenefitProduct(t.uid, b)">
                          {{ b.productName ?? 'Elegir producto' }}
                        </button>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic"
                        >
                          <mat-label>Cant.</mat-label>
                          <input
                            matInput
                            type="number"
                            [value]="b.quantity ?? 1"
                            (input)="
                              updateBenefit(t.uid, b.uid, {
                                quantity: +$any($event.target).value || 1,
                              })
                            "
                          /></mat-form-field>
                      }
                      @if (b.benefitType === 'DISCOUNT_AMOUNT') {
                        <mat-form-field appearance="outline" subscriptSizing="dynamic"
                        >
                          <mat-label>S/</mat-label>
                          <input
                            matInput
                            type="number"
                            [value]="b.discountAmount ?? ''"
                            (input)="
                              updateBenefit(t.uid, b.uid, {
                                discountAmount: +$any($event.target).value || undefined,
                              })
                            "
                          /></mat-form-field>
                      }
                      @if (b.benefitType === 'DISCOUNT_PERCENT') {
                        <mat-form-field appearance="outline" subscriptSizing="dynamic"
                        >
                          <mat-label>%</mat-label>
                          <input
                            matInput
                            type="number"
                            [value]="b.discountPercent ?? ''"
                            (input)="
                              updateBenefit(t.uid, b.uid, {
                                discountPercent: +$any($event.target).value || undefined,
                              })
                            "
                          /></mat-form-field>
                      }
                      <mat-form-field appearance="outline" subscriptSizing="dynamic"
                      >
                        <mat-label>Etiqueta (opcional)</mat-label>
                        <input
                          matInput
                          [value]="b.label ?? ''"
                          (input)="
                            updateBenefit(t.uid, b.uid, { label: $any($event.target).value })
                          "
                        /></mat-form-field>
                      <button
                        mat-icon-button
                        (click)="removeBenefit(t.uid, b.uid)"
                        aria-label="Quitar beneficio"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  } @empty {
                    <p class="muted small">
                      Agrega al menos un beneficio (puedes poner varios: producto gratis +
                      descuento).
                    </p>
                  }
                </div>
              </div>
            } @empty {
              <p class="muted">Agrega un tramo con sus beneficios.</p>
            }
          </mat-card>
        }

        <!-- 4. Targeting -->
        @case (4) {
          <mat-card class="card">
            @if (segmentRepeatsWarning()) {
              <p class="warn">
                <mat-icon inline="true">warning</mat-icon>
                Esta promo "no se repite", pero ese límite de una sola vez <strong>no se aplica
                a clientes que califican solo por segmento</strong> — es un límite conocido del
                backend (solo lo controla para clientes agregados individualmente abajo). Si
                necesitas que sea estrictamente una vez por cliente, agrégalos uno por uno en vez
                de por segmento.
              </p>
            }
            <h3>Segmentos</h3>
            <div class="addrow">
              <mat-form-field appearance="outline" subscriptSizing="dynamic"
              >
                <mat-label>Agregar segmento</mat-label>
                <mat-select [value]="null" (valueChange)="addSegment($event)">
                  @for (s of segments(); track s.segmentId) {
                    <mat-option [value]="s.segmentId">{{ s.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field
              >
            </div>
            @for (s of targetSegments(); track s.segmentId) {
              <div class="target">
                <span>{{ s.name }}</span>
                <div class="modes">
                  <button
                    [class.on]="s.mode === 'INCLUDE'"
                    (click)="setSegMode(s.segmentId, 'INCLUDE')"
                  >
                    Incluir
                  </button>
                  <button
                    [class.on]="s.mode === 'EXCLUDE'"
                    (click)="setSegMode(s.segmentId, 'EXCLUDE')"
                  >
                    Excluir
                  </button>
                </div>
                <button mat-icon-button (click)="removeSeg(s.segmentId)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }

            <h3>Clientes</h3>
            <div class="addrow">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
                <mat-icon matPrefix>search</mat-icon>
                <mat-label>Buscar cliente</mat-label>
                <input
                  matInput
                  [value]="custQuery()"
                  (input)="custQuery.set($any($event.target).value)"
                  (keyup.enter)="searchCustomers()"
                /></mat-form-field>
              <button mat-stroked-button (click)="searchCustomers()">Buscar</button>
            </div>
            @if (custResults().length) {
              <div class="results">
                @for (c of custResults(); track c.customerId) {
                  <button class="row-item" (click)="addCustomer(c)">
                    <span>{{ c.businessName }}</span
                    >
                    <mat-icon>add</mat-icon>
                  </button>
                }
              </div>
            }
            @for (c of targetCustomers(); track c.customerId) {
              <div class="target">
                <span>{{ c.name }}</span>
                <div class="modes">
                  <button
                    [class.on]="c.mode === 'INCLUDE'"
                    (click)="setCustMode(c.customerId, 'INCLUDE')"
                  >
                    Incluir
                  </button>
                  <button
                    [class.on]="c.mode === 'EXCLUDE'"
                    (click)="setCustMode(c.customerId, 'EXCLUDE')"
                  >
                    Excluir
                  </button>
                </div>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="maxq"
                >
                  <mat-label>Máx.</mat-label>
                  <input
                    matInput
                    type="number"
                    [value]="c.maxQuantity ?? ''"
                    (input)="setCustMax(c.customerId, +$any($event.target).value || undefined)"
                  /></mat-form-field>
                <button mat-icon-button (click)="removeCust(c.customerId)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
            <p class="muted small">
              Sin ningún INCLUDE → la promo aplica a todos (según canal y condiciones).
            </p>
          </mat-card>
        }

        <!-- 5. Revisar -->
        @case (5) {
          <mat-card class="card">
            <h3>Revisar</h3>
            <p>
              <strong>{{ name() }}</strong> ({{ code() }}) · {{ typeLabel(promoType()) }}
            </p>
            <p class="muted">
              Vigencia {{ startDate() }} – {{ endDate() }} ·
              {{ repeats() ? 'Se repite' : 'No se repite' }}
            </p>
            <p>
              Condiciones: {{ conditions().length }} · Tramos: {{ tiers().length }} · Segmentos:
              {{ targetSegments().length }} · Clientes: {{ targetCustomers().length }}
            </p>
            @if (!canCreate()) {
              <p class="err">Faltan datos: código, nombre, tipo y fechas son obligatorios.</p>
            }
          </mat-card>
        }
      }

      <div class="nav">
        <button mat-stroked-button [disabled]="step() === 1" (click)="prev()">Atrás</button>
        @if (step() < 5) {
          <button mat-flat-button color="primary" (click)="next()">Siguiente</button>
        } @else {
          <button
            mat-flat-button
            color="tertiary"
            [disabled]="!canCreate() || submitting()"
            (click)="create()"
          >
            <mat-icon>check</mat-icon>
            Crear promoción
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .steps {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .step {
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 8px 12px;
        font: inherit;
        color: var(--mat-sys-on-surface-variant);
        border-bottom: 2px solid transparent;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .step.active {
        color: var(--mat-sys-primary);
        border-bottom-color: var(--mat-sys-primary);
        font-weight: 600;
      }
      .step.done {
        color: var(--mat-sys-primary);
      }
      .step .n {
        display: inline-grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent);
        font-size: 0.78rem;
      }
      .card {
        padding: var(--sp-5);
        margin-bottom: var(--sp-4);
        max-width: var(--card-w-lg);
      }
      .picker-h {
        margin: 0 0 10px;
        font-size: 0.95rem;
      }
      .type-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 20px;
      }
      @media (max-width: 900px) {
        .type-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 560px) {
        .type-grid {
          grid-template-columns: 1fr;
        }
      }
      .type-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        text-align: left;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: var(--radius-md);
        padding: 14px;
        background: var(--mat-sys-surface-container-low);
        cursor: pointer;
        font: inherit;
        color: inherit;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      @media (prefers-reduced-motion: reduce) {
        .type-card {
          transition: none;
        }
      }
      .type-card:hover {
        border-color: var(--mat-sys-primary);
      }
      .type-card.selected {
        border-color: var(--mat-sys-primary);
        border-width: 2px;
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, var(--mat-sys-surface-container-low));
      }
      .type-card mat-icon {
        color: var(--mat-sys-primary);
      }
      .type-card .t-label {
        font-weight: 600;
        font-size: 0.9rem;
      }
      .type-card .t-desc {
        font-size: 0.78rem;
        color: var(--mat-sys-on-surface-variant);
      }
      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      @media (max-width: 640px) {
        .grid2 {
          grid-template-columns: 1fr;
        }
      }
      .full {
        width: 100%;
      }
      .addrow {
        margin: 8px 0;
      }
      .cond,
      .benefit {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .tag {
        font-size: 0.72rem;
        background: var(--mat-sys-surface-container-high);
        padding: 2px 8px;
        border-radius: 999px;
      }
      .tier {
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 10px;
        padding: 12px;
        margin: 12px 0;
      }
      .trow {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .benefits {
        margin-top: 8px;
        padding-left: 8px;
        border-left: 2px solid var(--mat-sys-outline-variant);
      }
      .target {
        display: flex;
        gap: 10px;
        align-items: center;
        padding: 6px 0;
      }
      .modes {
        display: flex;
        gap: 4px;
      }
      .modes button {
        border: 1px solid var(--mat-sys-outline);
        background: transparent;
        cursor: pointer;
        padding: 4px 10px;
        border-radius: 999px;
        font: inherit;
      }
      .modes button.on {
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        border-color: var(--mat-sys-primary);
      }
      .maxq {
        width: 90px;
      }
      .grow {
        flex: 1 1 auto;
      }
      .results {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
        margin: 8px 0;
      }
      .row-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 8px 12px;
        font: inherit;
      }
      .row-item:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }
      h3 {
        margin: 16px 0 8px;
        font-size: 1rem;
      }
      .small {
        font-size: 0.82rem;
      }
      .err {
        color: var(--mat-sys-error);
      }
      .hint {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.82rem;
        color: var(--mat-sys-on-surface-variant);
        margin: 4px 0 12px;
      }
      .warn {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 0.85rem;
        color: var(--mat-sys-on-error-container, var(--mat-sys-error));
        background: color-mix(in srgb, var(--mat-sys-error) 12%, transparent);
        border-radius: var(--radius-sm);
        padding: 10px 12px;
        margin-bottom: 12px;
      }
      .nav {
        display: flex;
        justify-content: space-between;
        max-width: 900px;
      }
    `,
  ],
})
export class PromoWizardPage {
  private promoSvc = inject(PromoService);
  private catalog = inject(CatalogService);
  private segmentsSvc = inject(SegmentService);
  private customers = inject(CustomerService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly stepLabels = ['General', 'Condiciones', 'Tramos', 'Targeting', 'Revisar'];
  readonly step = signal(1);

  readonly promoTypes = [
    {
      code: 'PRODUCT_QTY',
      label: PROMO_TYPE_LABELS['PRODUCT_QTY'],
      icon: 'inventory_2',
      desc: 'Compra X unidades de un producto y recibe el beneficio.',
    },
    {
      code: 'BRAND_FAMILY',
      label: PROMO_TYPE_LABELS['BRAND_FAMILY'],
      icon: 'category',
      desc: 'Aplica a toda una marca o familia desde cierta cantidad o monto.',
    },
    {
      code: 'TIERED',
      label: PROMO_TYPE_LABELS['TIERED'],
      icon: 'stacked_line_chart',
      desc: 'Varios escalones: a mayor compra, mejor beneficio.',
    },
    {
      code: 'ORDER_TOTAL',
      label: PROMO_TYPE_LABELS['ORDER_TOTAL'],
      icon: 'shopping_cart',
      desc: 'El pedido completo supera un monto mínimo.',
    },
    {
      code: 'COMBO',
      label: PROMO_TYPE_LABELS['COMBO'],
      icon: 'redeem',
      desc: 'Combina varios productos distintos en un mismo pedido.',
    },
    {
      code: 'CUSTOMER_LIST',
      label: PROMO_TYPE_LABELS['CUSTOMER_LIST'],
      icon: 'group',
      desc: 'Solo para clientes o segmentos elegidos, sin condiciones de compra.',
    },
  ];
  readonly scopes = [
    { code: 'PRODUCT', label: 'Producto' },
    { code: 'FAMILY', label: 'Familia' },
    { code: 'BRAND', label: 'Marca' },
    { code: 'ORDER', label: 'Pedido total' },
    { code: 'COMBO_ITEM', label: 'Ítem de combo' },
  ];
  readonly benefitTypes = [
    { code: 'FREE_PRODUCT', label: 'Producto gratis' },
    { code: 'DISCOUNT_AMOUNT', label: 'Descuento S/' },
    { code: 'DISCOUNT_PERCENT', label: 'Descuento %' },
  ];

  // Paso 1
  readonly code = signal('');
  readonly codeTouched = signal(false);
  readonly name = signal('');
  readonly description = signal('');
  readonly promoType = signal('PRODUCT_QTY');
  readonly salesChannelId = signal<number | null>(null);
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly repeats = signal(false);

  // Paso 2/3
  readonly conditions = signal<CondDraft[]>([]);
  readonly tiers = signal<TierDraft[]>([]);
  readonly families = signal<Family[]>([]);
  readonly brands = signal<Brand[]>([]);
  readonly salesChannels = signal<SalesChannel[]>([]);

  // Paso 4
  readonly segments = signal<Segment[]>([]);
  readonly targetSegments = signal<SegTarget[]>([]);
  readonly custQuery = signal('');
  readonly custResults = signal<CustomerSummary[]>([]);
  readonly targetCustomers = signal<CustTarget[]>([]);

  readonly submitting = signal(false);

  readonly conditionHint = computed(() => {
    switch (this.promoType()) {
      case 'PRODUCT_QTY':
        return 'Agrega una condición PRODUCTO con cantidad mínima.';
      case 'BRAND_FAMILY':
        return 'Agrega una condición de FAMILIA o MARCA (por cantidad o monto).';
      case 'ORDER_TOTAL':
        return 'Sin condiciones: el umbral se define con "Desde monto" en el tramo (paso siguiente).';
      case 'COMBO':
        return 'Agrega una condición ÍTEM DE COMBO por cada producto exigido.';
      case 'CUSTOMER_LIST':
        return 'Sin condiciones: solo la lista de clientes (paso Targeting).';
      case 'TIERED':
        return 'Define los umbrales en los tramos (paso siguiente).';
      default:
        return '';
    }
  });

  /** Scopes de condición que el motor realmente usa para cada tipo (evita 409 al enviar). */
  readonly allowedScopes = computed(() => {
    switch (this.promoType()) {
      case 'PRODUCT_QTY':
        return this.scopes.filter((s) => s.code === 'PRODUCT');
      case 'BRAND_FAMILY':
        return this.scopes.filter((s) => s.code === 'FAMILY' || s.code === 'BRAND');
      case 'TIERED':
        return this.scopes.filter((s) => ['PRODUCT', 'FAMILY', 'BRAND'].includes(s.code));
      case 'COMBO':
        return this.scopes.filter((s) => s.code === 'COMBO_ITEM');
      case 'ORDER_TOTAL':
      case 'CUSTOMER_LIST':
      default:
        return [];
    }
  });

  /** PRODUCT_QTY/BRAND_FAMILY/TIERED comparten el mismo motor — solo cambia la etiqueta. */
  readonly typeNote = computed(() => {
    if (['PRODUCT_QTY', 'BRAND_FAMILY', 'TIERED'].includes(this.promoType())) {
      return 'Nota: este tipo, "Por cantidad de producto", "Por marca/familia" y "Escalonada" funcionan exactamente igual por dentro — el nombre es solo para identificar la promo, no cambia el comportamiento.';
    }
    return null;
  });

  /** COMBO y CUSTOMER_LIST solo usan el tramo 1; el resto son código muerto en el motor. */
  readonly canAddTier = computed(() => {
    const single = this.promoType() === 'COMBO' || this.promoType() === 'CUSTOMER_LIST';
    return !single || this.tiers().length < 1;
  });

  /** Bug conocido de backend: repeats=false no limita a clientes que califican por segmento. */
  readonly segmentRepeatsWarning = computed(
    () => !this.repeats() && this.targetSegments().some((s) => s.mode === 'INCLUDE'),
  );

  constructor() {
    this.catalog.families().subscribe({ next: (f) => this.families.set(f), error: () => {} });
    this.catalog.brands().subscribe({ next: (b) => this.brands.set(b), error: () => {} });
    this.catalog
      .salesChannels()
      .subscribe({ next: (c) => this.salesChannels.set(c), error: () => {} });
    this.segmentsSvc.list().subscribe({ next: (s) => this.segments.set(s), error: () => {} });
  }

  typeLabel(code: string) {
    return PROMO_TYPE_LABELS[code] ?? code;
  }

  onNameInput(v: string) {
    this.name.set(v);
    if (!this.codeTouched()) this.code.set(this.slugify(v));
  }
  onCodeInput(v: string) {
    this.codeTouched.set(true);
    this.code.set(v.toUpperCase());
  }
  private slugify(v: string): string {
    return v
      .normalize('NFD')
      .replace(new RegExp('[̀-ͯ]', 'g'), '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40);
  }

  onTypeChange(code: string) {
    this.promoType.set(code);
    const single = code === 'COMBO' || code === 'CUSTOMER_LIST';
    if (single && this.tiers().length > 1) {
      this.tiers.update((l) => l.slice(0, 1));
      this.toast.info(
        `Se conservó solo el tramo 1: ${this.typeLabel(code)} no usa tramos adicionales.`,
      );
    }
  }
  scopeLabel(code: string) {
    return this.scopes.find((s) => s.code === code)?.label ?? code;
  }
  benefitLabel(code: string) {
    return this.benefitTypes.find((b) => b.code === code)?.label ?? code;
  }

  goStep(n: number) {
    this.step.set(n);
  }
  next() {
    this.step.update((s) => Math.min(5, s + 1));
  }
  prev() {
    this.step.update((s) => Math.max(1, s - 1));
  }

  // ── Condiciones ──
  addCondition(scope: string) {
    if (!scope) return;
    this.conditions.update((l) => [...l, { uid: uid(), scope }]);
  }
  updateCond(u: number, patch: Partial<CondDraft>) {
    this.conditions.update((l) => l.map((c) => (c.uid === u ? { ...c, ...patch } : c)));
  }
  removeCond(u: number) {
    this.conditions.update((l) => l.filter((c) => c.uid !== u));
  }
  pickCondProduct(c: CondDraft) {
    this.dialog
      .open(ProductPickerDialog, { width: '460px' })
      .afterClosed()
      .subscribe((p?: Product) => {
        if (p) this.updateCond(c.uid, { productId: p.productId, productName: p.name });
      });
  }

  // ── Tramos / beneficios ──
  addTier() {
    this.tiers.update((l) => [
      ...l,
      { uid: uid(), tier: l.length + 1, fromQuantity: 0, fromAmount: 0, benefits: [] },
    ]);
  }
  updateTier(u: number, patch: Partial<TierDraft>) {
    this.tiers.update((l) => l.map((t) => (t.uid === u ? { ...t, ...patch } : t)));
  }
  removeTier(u: number) {
    this.tiers.update((l) => l.filter((t) => t.uid !== u).map((t, i) => ({ ...t, tier: i + 1 })));
  }
  addBenefit(tierUid: number, type: string) {
    if (!type) return;
    this.tiers.update((l) =>
      l.map((t) =>
        t.uid === tierUid
          ? { ...t, benefits: [...t.benefits, { uid: uid(), benefitType: type, quantity: 1 }] }
          : t,
      ),
    );
  }
  updateBenefit(tierUid: number, bUid: number, patch: Partial<BenefDraft>) {
    this.tiers.update((l) =>
      l.map((t) =>
        t.uid === tierUid
          ? { ...t, benefits: t.benefits.map((b) => (b.uid === bUid ? { ...b, ...patch } : b)) }
          : t,
      ),
    );
  }
  removeBenefit(tierUid: number, bUid: number) {
    this.tiers.update((l) =>
      l.map((t) =>
        t.uid === tierUid ? { ...t, benefits: t.benefits.filter((b) => b.uid !== bUid) } : t,
      ),
    );
  }
  pickBenefitProduct(tierUid: number, b: BenefDraft) {
    this.dialog
      .open(ProductPickerDialog, { width: '460px' })
      .afterClosed()
      .subscribe((p?: Product) => {
        if (p) this.updateBenefit(tierUid, b.uid, { productId: p.productId, productName: p.name });
      });
  }

  // ── Targeting ──
  addSegment(segmentId: number) {
    if (!segmentId || this.targetSegments().some((s) => s.segmentId === segmentId)) return;
    const seg = this.segments().find((s) => s.segmentId === segmentId);
    this.targetSegments.update((l) => [
      ...l,
      { segmentId, name: seg?.name ?? '#' + segmentId, mode: 'INCLUDE' },
    ]);
  }
  setSegMode(id: number, mode: string) {
    this.targetSegments.update((l) => l.map((s) => (s.segmentId === id ? { ...s, mode } : s)));
  }
  removeSeg(id: number) {
    this.targetSegments.update((l) => l.filter((s) => s.segmentId !== id));
  }

  searchCustomers() {
    const q = this.custQuery().trim();
    if (!q) return;
    this.customers
      .search(q, 0, 10)
      .subscribe({
        next: (r) => this.custResults.set(r.content),
        error: () => this.custResults.set([]),
      });
  }
  addCustomer(c: CustomerSummary) {
    if (this.targetCustomers().some((x) => x.customerId === c.customerId)) return;
    this.targetCustomers.update((l) => [
      ...l,
      { customerId: c.customerId, name: c.businessName, mode: 'INCLUDE' },
    ]);
    this.custResults.set([]);
    this.custQuery.set('');
  }
  setCustMode(id: number, mode: string) {
    this.targetCustomers.update((l) => l.map((c) => (c.customerId === id ? { ...c, mode } : c)));
  }
  setCustMax(id: number, max?: number) {
    this.targetCustomers.update((l) =>
      l.map((c) => (c.customerId === id ? { ...c, maxQuantity: max } : c)),
    );
  }
  removeCust(id: number) {
    this.targetCustomers.update((l) => l.filter((c) => c.customerId !== id));
  }

  // ── Crear ──
  canCreate() {
    return (
      !!this.code().trim() &&
      !!this.name().trim() &&
      !!this.promoType() &&
      !!this.startDate() &&
      !!this.endDate()
    );
  }
  create() {
    if (!this.canCreate()) return;
    this.submitting.set(true);
    const cmd: CreatePromoCommand = {
      code: this.code().trim(),
      name: this.name().trim(),
      description: this.description() || undefined,
      promoType: this.promoType(),
      salesChannelId: this.salesChannelId(),
      repeats: this.repeats(),
      startDate: this.startDate(),
      endDate: this.endDate(),
      conditions: this.conditions().map((c) => ({
        scope: c.scope,
        productId: c.productId,
        familyId: c.familyId,
        brandId: c.brandId,
        minQuantity: c.minQuantity,
        minAmount: c.minAmount,
      })),
      tiers: this.tiers().map((t) => ({
        tier: t.tier,
        fromQuantity: t.fromQuantity,
        fromAmount: t.fromAmount,
        benefits: t.benefits.map((b) => ({
          benefitType: b.benefitType,
          productId: b.productId,
          quantity: b.quantity,
          discountAmount: b.discountAmount,
          discountPercent: b.discountPercent,
          label: b.label || undefined,
        })),
      })),
    };
    this.promoSvc.create(cmd).subscribe({
      next: (res) => {
        const id = res.promoId;
        const targets = this.buildTargets();
        if (targets.segments.length || targets.customers.length) {
          this.promoSvc
            .setTargets(id, targets)
            .subscribe({ next: () => this.done(id), error: () => this.done(id) });
        } else {
          this.done(id);
        }
      },
      error: () => this.submitting.set(false),
    });
  }

  private buildTargets(): PromoTargets {
    return {
      segments: this.targetSegments().map((s) => ({ segmentId: s.segmentId, mode: s.mode })),
      customers: this.targetCustomers().map((c) => ({
        customerId: c.customerId,
        mode: c.mode,
        maxQuantity: c.maxQuantity,
      })),
    };
  }
  private done(id: number) {
    this.toast.success('Promoción creada (apagada). Apruébala para encenderla.');
    void this.router.navigate(['/promos', id]);
  }
}
