import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, filter, map, switchMap, tap } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiCard } from '../../shared/ui/card/card';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiStepper, UiStep } from '../../shared/ui/stepper/stepper';
import { UiOptionCard } from '../../shared/ui/option-card/option-card';
import { UiBadge } from '../../shared/ui/badge/badge';
import { UiTabs, UiTabItem } from '../../shared/ui/tabs/tabs';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { AuthService } from '../../core/auth/auth';
import { RouteStore } from './route-store';
import { CounterSessionStore } from './counter-session-store';
import { CounterOrderAdminService } from './counter-order-admin';
import { OrderAdminService } from './order-admin';
import { AllocationService } from '../sales/allocation';
import { OrderSimulationService } from '../promos/order-simulation';
import { CatalogLookupService } from '../catalog/catalog-lookup';
import { LookupService, toUiLookup } from '../promos/lookup';
import { PromoCatalogPanel } from '../promos/ui/promo-catalog-panel';
import { ToastService } from '../../core/ui/toast';
import {
  CounterCustomerContext,
  CounterSalespersonView,
  CreateCounterOrderCommand,
  SuggestedItem,
} from '../../shared/models/counter-order.models';
import {
  MobilePromoCatalogView,
  OrderSimulationView,
  SimulateOrderCommand,
} from '../../shared/models/promo-simulation.models';
import {
  AllocationEditCommand,
  OrderDetail,
  OrderItemEditCommand,
  UpdateOrderCommand,
} from '../../shared/models/order.models';
import { AllocationView } from '../../shared/models/allocation.models';
import { formatSoles } from '../../shared/pipes/money';
import { quantityText } from '../sales-reports/sales-report-format';
import { dateText, dateTimeText, timeText } from '../assignments/assignment-format';
import { originName } from './order-format';
import { isWholeQuantity, toWholeQuantity } from '../../shared/utils/quantity';

interface AllocationRow {
  allocationId: number;
  productName: string;
  promoName: string | null;
  periodEnd: string | null; // null + !expired = sin fecha de fin
  expired: boolean;
  available: number | null; // null en las vencidas
  originalQuantity: number; // lo que ya tenía el pedido — para el diff al guardar
  max: number;
  stockPending: boolean;
}

interface CartLine {
  productId: number;
  productName: string;
  quantity: number;
}

type AttributionTarget = 'salesperson' | 'counter' | 'other';
type FormTab = 'catalogo' | 'sugerido' | 'promociones';

const TABS: UiTabItem[] = [
  { value: 'catalogo', label: 'Catálogo' },
  { value: 'sugerido', label: 'Sugerido' },
  { value: 'promociones', label: 'Promociones' },
];

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Iniciales para el avatar de la ficha de cliente (máx. 2 letras). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Valor de un input numérico: NaN si quedó vacío (Number('') sería 0). */
function inputNumber(input: HTMLInputElement): number {
  return input.value.trim() === '' ? Number.NaN : Number(input.value);
}

/**
 * Pedido de mostrador — doc 30, secciones 2 y 7. Mismo formulario sirve
 * para registrar (sin orderId) y para editar un pedido OPEN existente
 * (con orderId, cliente/canal bloqueados) — sección 8.2.
 *
 * Pantalla base del sistema de diseño nuevo (ver DESIGN.md): stepper de
 * progreso, tarjetas con título + ayuda, buscador con ícono, OptionCard
 * para "Atribuir venta a" y resumen fijo de 360px. El stepper es solo
 * indicador — no oculta contenido, el formulario sigue siendo una sola
 * página con scroll.
 *
 * Edición: el pedido se carga desde el input `orderId` (que llega después
 * del constructor), con una sola petición vigente — ARCHITECTURE_PANEL,
 * sección 8.1. Editar no exige jornada abierta: la jornada solo hace
 * falta para registrar un pedido nuevo.
 */
@Component({
  selector: 'app-counter-order-form',
  imports: [
    UiButton,
    UiField,
    UiToggle,
    PromoCatalogPanel,
    UiTypeahead,
    UiCard,
    UiEmpty,
    UiStepper,
    UiOptionCard,
    UiBadge,
    UiTabs,
  ],
  template: `
    <section class="cof-page">
      <div class="cof-head">
        <div>
          <p class="cof-eyebrow">
            {{ editMode() ? 'Editar pedido' : 'Ventas · Pedido de mostrador' }}
          </p>
          <h1>{{ editMode() ? 'Pedido #' + orderId() : 'Nuevo pedido' }}</h1>
        </div>
        <button uiButton variant="secondary" (click)="cancel()">Cancelar</button>
      </div>

      @if (!editMode()) {
        <ui-stepper [steps]="stepState()" class="cof-stepper" />
      }

      @if (!editMode() && counterSession.noBranch()) {
        <ui-empty
          variant="error"
          title="Sin sede asignada"
          body="Tu usuario no tiene una sede asignada: no puedes registrar pedidos de mostrador."
        />
      } @else if (!editMode() && !jornadaOpen()) {
        <ui-empty
          title="Abre tu jornada"
          body="Necesitas abrir tu jornada de mostrador antes de registrar un pedido."
          actionLabel="Abrir jornada"
          (action)="routeStore.start()"
        />
      } @else if (editMode() && orderError()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el pedido"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="retryLoadOrder()"
        />
      } @else if (editMode() && !originalOrder()) {
        <div class="cof-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (editMode() && originalOrder()?.statusCode !== 'OPEN') {
        <ui-empty
          title="Este pedido ya no se puede editar"
          body="Solo los pedidos abiertos admiten cambios."
        />
      } @else {
        <div class="cof-grid">
          <div class="cof-left">
            <ui-card
              title="{{ editMode() ? 'Pedido' : 'Cliente' }}"
              subtitle="{{
                editMode()
                  ? 'Cliente, vendedor y canal no se cambian al editar.'
                  : 'Busca y selecciona a quién se le registra el pedido.'
              }}"
            >
              <div class="cof-stack">
                @if (editMode()) {
                  @if (originalOrder(); as o) {
                    <div class="cof-order-meta">
                      <div class="cof-field-readonly">
                        <span class="cof-label">Cliente</span>
                        <span class="cof-value">{{ o.customerName }}</span>
                      </div>
                      <div class="cof-field-readonly">
                        <span class="cof-label">Vendedor</span>
                        <span>{{ o.salespersonName }}</span>
                      </div>
                      <div class="cof-field-readonly">
                        <span class="cof-label">Fecha del pedido</span>
                        <span>{{ dateTimeText(o.orderDate) }}</span>
                      </div>
                      <div class="cof-field-readonly">
                        <span class="cof-label">Canal</span>
                        <span>{{ o.salesChannelName || '—' }}</span>
                      </div>
                      <div class="cof-field-readonly">
                        <span class="cof-label">Origen</span>
                        <span>{{ originName(o.originCode) }}</span>
                      </div>
                    </div>
                  }
                } @else if (!customer()) {
                  <ui-typeahead
                    label="Razón social o código"
                    icon="search"
                    placeholder="Busca por razón social o código"
                    [clearOnPick]="false"
                    [search]="searchCustomers"
                    [(selected)]="customer"
                    (picked)="onCustomerPicked($event)"
                  />
                } @else {
                  <div class="cof-customer-card">
                    <span class="cof-customer-avatar">{{ initials(customer()!.name) }}</span>
                    <div class="cof-customer-info">
                      <span class="cof-customer-name">{{ customer()!.name }}</span>
                      <span class="cof-customer-code"
                        >Código {{ customer()!.code || customer()!.id }}</span
                      >
                    </div>
                    <button uiButton variant="ghost" size="sm" (click)="changeCustomer()">
                      Cambiar
                    </button>
                  </div>
                }

                @if (contextLoading()) {
                  <span class="cof-muted">Cargando datos del cliente…</span>
                }

                @if (context(); as ctx) {
                  @if (!ctx.active) {
                    <div class="cof-alert">Este cliente está inactivo.</div>
                  }
                  @if (ctx.blockReason) {
                    <div class="cof-alert">{{ ctx.blockReason }}</div>
                  }
                  @if (ctx.todayOrder && !editMode()) {
                    <div class="cof-alert">
                      Ya tiene un pedido registrado hoy (#{{ ctx.todayOrder.orderId }}).
                    </div>
                  }

                  @if (!editMode()) {
                    <div class="cof-attribution">
                      <span class="cof-label">Venta para</span>
                      <div class="cof-attribution-options">
                        @if (ctx.salesAssignment; as a) {
                          <ui-option-card
                            [selected]="attributeTo() === 'salesperson'"
                            [disabled]="!a.salespersonActive"
                            (pick)="attributeTo.set('salesperson')"
                          >
                            <div class="cof-attr-name">
                              {{ a.salespersonName }}
                              <span class="cof-attr-code">{{ a.salespersonCode }}</span>
                            </div>
                            @if (!a.salespersonActive) {
                              <div class="cof-attr-sub cof-attr-warn">
                                Inactivo: no se le puede atribuir la venta
                              </div>
                            } @else {
                              <div class="cof-attr-sub">
                                {{ a.salesChannelName }}
                                <span class="cof-route" [class.cof-route-on]="a.onRoute">
                                  ●
                                  {{
                                    a.onRoute
                                      ? 'En ruta · ' + timeText(a.routeStartedAt)
                                      : 'Sin jornada abierta'
                                  }}
                                </span>
                              </div>
                            }
                          </ui-option-card>
                        }
                        <ui-option-card
                          [selected]="attributeTo() === 'counter'"
                          (pick)="attributeTo.set('counter')"
                        >
                          Mostrador (yo)
                        </ui-option-card>
                        <ui-option-card
                          [selected]="attributeTo() === 'other'"
                          (pick)="selectOtherSalesperson()"
                        >
                          Otro vendedor
                          @if (attributeTo() === 'other' && selectedOtherSalesperson(); as s) {
                            <div class="cof-attr-sub">
                              {{ s.salespersonName }} · {{ s.salesChannelName }}
                            </div>
                          }
                        </ui-option-card>
                      </div>

                      @if (attributeTo() === 'other') {
                        <div class="cof-other-picker">
                          <ui-field
                            label="Buscar vendedor"
                            placeholder="Nombre o código"
                            [(value)]="otherSalespersonQuery"
                          />
                          @if (otherSalespeopleLoading()) {
                            <span class="cof-muted">Cargando vendedores…</span>
                          } @else if (otherSalespeopleFiltered().length === 0) {
                            <span class="cof-muted">No hay otros vendedores activos.</span>
                          } @else {
                            <div class="cof-other-list">
                              @for (s of otherSalespeopleFiltered(); track s.salespersonId) {
                                <button
                                  type="button"
                                  class="cof-other-row"
                                  [class.selected]="
                                    selectedOtherSalesperson()?.salespersonId === s.salespersonId
                                  "
                                  (click)="selectedOtherSalesperson.set(s)"
                                >
                                  <span class="cof-attr-name"
                                    >{{ s.salespersonName }}
                                    <span class="cof-attr-code">{{ s.salespersonCode }}</span></span
                                  >
                                  <span class="cof-attr-sub">
                                    {{ s.salesChannelName }} ·
                                    <span class="cof-route" [class.cof-route-on]="s.onRoute">
                                      ●
                                      {{
                                        s.onRoute
                                          ? 'En ruta · ' + timeText(s.routeStartedAt)
                                          : 'Sin jornada abierta'
                                      }}
                                    </span>
                                  </span>
                                </button>
                              }
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }

                  @if (!editMode() && attributeTo() === 'counter') {
                    <ui-field
                      label="Canal de venta"
                      type="select"
                      [(value)]="salesChannelId"
                      [options]="channelOptions()"
                    />
                  }
                }
              </div>
            </ui-card>

            <ui-card
              title="Condiciones de venta"
              subtitle="{{
                editMode()
                  ? 'Define cómo se paga el pedido.'
                  : 'Define cómo se paga y si la entrega es inmediata.'
              }}"
            >
              <div class="cof-stack">
                <ui-field
                  label="Condición de pago"
                  type="select"
                  [(value)]="paymentConditionId"
                  [options]="paymentConditionOptions()"
                />

                @if (!editMode()) {
                  <div class="cof-mostrador-box" [class.cof-mostrador-on]="deliverNow()">
                    <div class="cof-mostrador-text">
                      <span class="cof-mostrador-title"
                        >El cliente se lo lleva ahora (mostrador)</span
                      >
                      <span class="cof-muted"
                        >Se registra como entregado en mostrador y no pasa a reparto.</span
                      >
                    </div>
                    <ui-toggle [(checked)]="deliverNow" />
                  </div>
                  <ui-field label="Nota (opcional)" type="textarea" [(value)]="note" />
                }
              </div>
            </ui-card>

            @if (canEditCart()) {
              <ui-card
                title="Agregar productos"
                subtitle="Busca en el catálogo, revisa lo sugerido o aplica una promoción."
              >
                <div class="cof-stack">
                  <ui-tabs [items]="tabs" [(value)]="activeTab" />

                  <div class="cof-tab-content">
                    @switch (activeTab()) {
                      @case ('catalogo') {
                        <ui-typeahead
                          label=""
                          icon="search"
                          placeholder="Busca por nombre o código"
                          [clearOnPick]="true"
                          [search]="searchProducts"
                          (picked)="addProduct($event)"
                        />
                      }
                      @case ('sugerido') {
                        @if (suggestedLoading()) {
                          <p class="cof-muted">Cargando sugeridos…</p>
                        } @else if (suggested().length === 0) {
                          <ui-empty
                            title="Sin sugeridos"
                            body="Este cliente todavía no tiene historial suficiente."
                          />
                        } @else {
                          <div class="cof-suggested-list cof-scroll-list">
                            @for (item of suggested(); track item.productId) {
                              <div class="cof-suggested-row">
                                <div>
                                  <div class="cof-suggested-name">{{ item.productName }}</div>
                                  <div class="cof-muted">
                                    Comprado {{ item.purchaseCount }}
                                    {{ item.purchaseCount === 1 ? 'vez' : 'veces' }}
                                  </div>
                                </div>
                                <button
                                  uiButton
                                  variant="secondary"
                                  size="sm"
                                  [disabled]="hasLine(item.productId)"
                                  (click)="addSuggested(item)"
                                >
                                  {{ hasLine(item.productId) ? 'Agregado' : 'Agregar' }}
                                </button>
                              </div>
                            }
                          </div>
                        }
                      }
                      @case ('promociones') {
                        <app-promo-catalog-panel
                          [catalog]="availablePromos()"
                          [loading]="availablePromosLoading()"
                          [error]="availablePromosError()"
                          (featuredOnlyChange)="onCatalogFeaturedOnlyChange($event)"
                          (retry)="retryAvailablePromos()"
                        />
                      }
                    }
                  </div>
                </div>
              </ui-card>

              <ui-card>
                <h3 class="cof-cart-title">
                  Carrito
                  @if (lines().length > 0) {
                    <ui-badge tone="accent">{{ lines().length }}</ui-badge>
                  }
                </h3>
                @if (lines().length === 0) {
                  <p class="cof-cart-empty cof-muted">Todavía no agregaste productos.</p>
                } @else {
                  <div class="cof-lines">
                    @for (line of lines(); track line.productId) {
                      <div class="cof-line-row">
                        <span class="cof-line-name">{{ line.productName }}</span>
                        <input
                          class="cof-line-qty"
                          type="number"
                          min="1"
                          step="1"
                          [value]="line.quantity"
                          (change)="updateQuantity(line, $event)"
                        />
                        <button uiButton variant="icon" title="Quitar" (click)="removeLine(line)">
                          ✕
                        </button>
                      </div>
                    }
                  </div>
                }

                @if (editMode() && promoLines().length > 0) {
                  <div class="cof-promo-readonly">
                    <span class="cof-label">Promociones de este pedido</span>
                    @for (p of promoLines(); track p.lineNumber) {
                      <div class="cof-promo-readonly-row">
                        <span>{{ p.quantity }} × {{ p.productName }}</span>
                        <span class="cof-muted">Se recalcula al guardar</span>
                      </div>
                    }
                  </div>
                }
              </ui-card>

              @if (showAllocationBlock()) {
                <ui-card
                  title="Dotación de {{ originalOrder()?.salespersonName }}"
                  subtitle="Es el cupo del vendedor, aunque edite supervisión."
                >
                  @if (allocationRows().length === 0) {
                    <p class="cof-muted">
                      Este vendedor no tiene dotaciones vigentes ni en este pedido.
                    </p>
                  } @else {
                    <table class="ui-table-grid cof-allocation-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Vigencia</th>
                          <th>Disponible</th>
                          <th>En el pedido</th>
                          <th>Máx.</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of allocationRows(); track row.allocationId) {
                          <tr>
                            <td>{{ row.productName }}</td>
                            <td>
                              @if (row.expired) {
                                <span class="cof-expired-tag">Vencida</span>
                              } @else if (row.periodEnd) {
                                {{ 'hasta ' + dateText(row.periodEnd) }}
                              } @else {
                                Sin fecha de fin
                              }
                            </td>
                            <td class="cof-muted">{{ row.available ?? '—' }}</td>
                            <td>
                              <input
                                class="cof-line-qty"
                                type="number"
                                min="0"
                                [max]="row.max"
                                step="1"
                                [value]="allocationQuantity(row)"
                                (change)="setAllocationQuantity(row, $event)"
                              />
                            </td>
                            <td class="cof-muted">{{ row.max }}</td>
                          </tr>
                          @if (row.expired) {
                            <tr class="cof-allocation-note-row">
                              <td colspan="5" class="cof-allocation-note">
                                Solo se puede bajar o quitar
                              </td>
                            </tr>
                          } @else if (row.stockPending) {
                            <tr class="cof-allocation-note-row">
                              <td colspan="5" class="cof-allocation-note cof-allocation-note-warn">
                                ⚠ Pendiente de stock: se reintenta al guardar
                              </td>
                            </tr>
                          }
                        }
                      </tbody>
                    </table>
                  }
                </ui-card>
              }
            }
          </div>

          @if (canEditCart()) {
            <div class="cof-right">
              <ui-card title="Resumen" class="cof-sim-card">
                @if (!editMode() && attributionSummaryText(); as attrText) {
                  <p class="cof-muted cof-attr-summary">
                    Venta para: <strong>{{ attrText }}</strong>
                  </p>
                }
                @if (editMode()) {
                  <div class="cof-change-summary">
                    <div class="cof-estimate">
                      <ui-badge tone="warning">Estimado</ui-badge>
                      <span class="cof-muted">El total final se confirma al guardar.</span>
                    </div>
                    <p class="cof-muted">
                      @if (saleChangeCount() === 0 && allocationChangeCount() === 0) {
                        Todavía no hay cambios.
                      } @else {
                        @if (saleChangeCount() > 0) {
                          {{ saleChangeCount() }} línea{{ saleChangeCount() === 1 ? '' : 's' }} de
                          venta cambia{{ saleChangeCount() === 1 ? '' : 'n' }}
                        }
                        @if (allocationChangeCount() > 0) {
                          @if (saleChangeCount() > 0) {
                            ·
                          }
                          {{ allocationChangeCount() }} dotación{{
                            allocationChangeCount() === 1 ? '' : 'es'
                          }}
                          cambia{{ allocationChangeCount() === 1 ? '' : 'n' }}
                        }
                      }
                    </p>
                    <p class="cof-muted">Las promociones se vuelven a calcular al guardar.</p>
                  </div>
                }
                @if (simulating()) {
                  <p class="cof-muted">Calculando…</p>
                } @else if (simResult(); as s) {
                  <div class="cof-sim-lines">
                    @for (sl of s.lines; track sl.productId) {
                      <div class="cof-sim-line-row">
                        <span>{{ sl.quantity }} × {{ sl.productName }}</span>
                        <span class="cof-muted">{{ formatSoles(sl.subtotal) }}</span>
                      </div>
                    }
                  </div>

                  @if (s.appliedPromos.length > 0) {
                    <h3 class="cof-sim-subtitle">Promociones aplicadas</h3>
                    @for (promo of s.appliedPromos; track promo.promoId) {
                      <div class="cof-sim-promo">
                        <div class="cof-sim-promo-name">{{ promo.promoName }}</div>
                        @for (g of promo.granted; track g.displayText) {
                          <div class="cof-muted">{{ g.displayText }}</div>
                        }
                        @for (c of promo.pendingChoices; track c.groupLabel) {
                          <div class="cof-muted">{{ c.groupLabel }} — se elige al entregar</div>
                        }
                      </div>
                    }
                  }

                  @if (s.nearPromos.length > 0) {
                    <h3 class="cof-sim-subtitle">Cerca de ganar</h3>
                    @for (np of s.nearPromos; track np.promoId) {
                      @if (np.soldOut) {
                        <div class="cof-near-soldout">
                          <strong>Promoción agotada</strong>
                          <p class="cof-muted">
                            El cliente cumple, pero el premio no tiene stock. Si se registra el
                            pedido, quedará pendiente en Bonificaciones sin stock.
                          </p>
                        </div>
                      } @else {
                        <div class="cof-near-promo">
                          <div class="cof-muted">{{ np.progressText }}</div>
                          <div class="cof-near-track">
                            <div class="cof-near-fill" [style.width.%]="np.percentComplete"></div>
                          </div>
                        </div>
                      }
                    }
                  }

                  <div class="cof-sim-totals">
                    <div class="cof-sim-total-row">
                      <span>Subtotal</span><span>{{ formatSoles(s.totalAmount) }}</span>
                    </div>
                    <div class="cof-sim-total-row">
                      <span>Descuentos</span><span>{{ formatSoles(s.discountAmount) }}</span>
                    </div>
                    <div class="cof-sim-total-row cof-sim-total-strong">
                      <span>Total</span><span>{{ formatSoles(s.netAmount) }}</span>
                    </div>
                  </div>
                } @else {
                  <p class="cof-muted">{{ summaryHelp() }}</p>
                  <div class="cof-sim-totals">
                    <div class="cof-sim-total-row">
                      <span>Subtotal</span><span>{{ formatSoles(0) }}</span>
                    </div>
                    <div class="cof-sim-total-row">
                      <span>Descuentos</span><span>{{ formatSoles(0) }}</span>
                    </div>
                    <div class="cof-sim-total-row cof-sim-total-strong">
                      <span>Total</span><span>{{ formatSoles(0) }}</span>
                    </div>
                  </div>
                }

                @if (!editMode()) {
                  <button
                    uiButton
                    variant="primary"
                    class="ui-btn-block"
                    [disabled]="!canSubmit()"
                    [loading]="submitting()"
                    (click)="submit()"
                  >
                    Registrar pedido
                  </button>
                  @if (!canSubmit() && submitDisabledReason()) {
                    <p class="cof-submit-hint">{{ submitDisabledReason() }}</p>
                  }
                } @else {
                  @if (lines().length === 0) {
                    <div class="cof-alert">
                      El pedido debe conservar al menos una línea de venta. Si el cliente ya no
                      lleva nada, anula el pedido desde su detalle.
                    </div>
                  }
                  <button
                    uiButton
                    variant="primary"
                    class="ui-btn-block"
                    [disabled]="!canSaveEdit()"
                    [loading]="submitting()"
                    (click)="submitEdit()"
                  >
                    Guardar cambios
                  </button>
                }
              </ui-card>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .cof-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .cof-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 20px;
      }
      .cof-eyebrow {
        margin: 0;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 2px 0 0;
        color: var(--ink);
      }
      .cof-stepper {
        display: block;
        margin-bottom: 24px;
      }
      .cof-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .cof-order-meta {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 14px 20px;
      }
      .cof-field-readonly {
        display: grid;
        gap: 4px;
        font-size: 14px;
        color: var(--ink);
      }
      .cof-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .cof-value {
        font-size: 16px;
        font-weight: 700;
        color: var(--ink);
      }
      .cof-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .cof-alert {
        padding: 10px 14px;
        border-radius: var(--radius-control, 0);
        border-left: 3px solid var(--st-no-purchase);
        background: color-mix(in srgb, var(--st-no-purchase) 10%, transparent);
        font-size: 13px;
      }
      .cof-customer-card {
        display: flex;
        align-items: center;
        gap: 12px;
        border: 1.5px solid var(--accent);
        background: var(--accent-wash);
        border-radius: var(--radius-control, 0);
        padding: 10px 14px;
      }
      .cof-customer-avatar {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--accent);
        color: var(--on-accent);
        font-weight: 700;
        font-size: 14px;
      }
      .cof-customer-info {
        display: grid;
        gap: 2px;
        min-width: 0;
        flex: 1;
      }
      .cof-customer-name {
        font-weight: 700;
        font-size: 14px;
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cof-customer-code {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .cof-attribution {
        display: grid;
        gap: 10px;
      }
      .cof-attribution-options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
        align-items: start;
      }
      .cof-attr-name {
        font-weight: 700;
      }
      .cof-attr-code {
        font-weight: 400;
        color: var(--ink-muted);
        font-size: 12px;
      }
      .cof-attr-sub {
        margin-top: 2px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .cof-attr-warn {
        color: var(--status-danger);
      }
      .cof-route {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: var(--ink-muted);
      }
      .cof-route-on {
        color: var(--status-ok);
        font-weight: 600;
      }
      .cof-other-picker {
        border: 1px solid var(--divider);
        padding: 12px;
        display: grid;
        gap: 10px;
      }
      .cof-other-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
        max-height: 220px;
        overflow-y: auto;
      }
      .cof-other-row {
        display: grid;
        gap: 2px;
        text-align: left;
        border: 0;
        background: var(--bg);
        padding: 10px 12px;
        cursor: pointer;
        font-family: var(--font-sans);
        color: var(--ink);
      }
      .cof-other-row:hover {
        background: var(--faint);
      }
      .cof-other-row.selected {
        background: var(--faint);
        box-shadow: inset 3px 0 0 var(--accent);
      }
      .cof-attr-summary {
        margin: 0 0 10px;
        padding-bottom: 10px;
        border-bottom: var(--border-hair);
      }
      .cof-left {
        display: grid;
        gap: var(--sp-6);
        align-content: start;
        min-width: 0;
        max-width: var(--card-w-lg);
      }
      .cof-mostrador-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-4);
        background: var(--surface-sunk);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-control);
        padding: var(--sp-4);
      }
      .cof-mostrador-box.cof-mostrador-on {
        border-color: var(--accent);
        background: var(--accent-wash);
      }
      .cof-mostrador-text {
        display: grid;
        gap: 2px;
      }
      .cof-mostrador-title {
        font-weight: 700;
        font-size: 14px;
        color: var(--ink);
      }
      /* ui-card no espacia su contenido solo. La separación va en un
         contenedor DENTRO de la tarjeta: una clase en el host <ui-card> no
         sirve, porque el contenido proyectado vive en el div interno de
         ui-card y el gap del host solo separaría ese único div. */
      .cof-stack {
        display: grid;
        gap: var(--sp-4);
        min-width: 0;
      }
      .cof-grid {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 24px;
        align-items: start;
      }
      .cof-cart-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 700;
        margin: 0 0 14px;
        color: var(--ink);
      }
      .cof-cart-empty {
        margin: 0;
        padding: var(--sp-2) 0;
      }
      .cof-tab-content {
        display: grid;
        gap: var(--sp-4);
      }
      .cof-scroll-list {
        max-height: 360px;
        overflow-y: auto;
      }
      .cof-suggested-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .cof-suggested-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: var(--surface);
        padding: 10px 12px;
      }
      .cof-suggested-name {
        font-weight: 600;
        font-size: 14px;
      }
      .cof-lines {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .cof-line-row {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--surface);
        padding: 10px 12px;
      }
      .cof-line-name {
        flex: 1;
        font-size: 14px;
      }
      .cof-line-qty {
        width: 80px;
        font-family: var(--font-sans);
        font-size: 14px;
        min-height: var(--touch-min);
        border: 1px solid var(--divider);
        border-radius: var(--radius-control, 0);
        padding: 0 8px;
        background: var(--surface-sunk);
        color: var(--ink);
      }
      .cof-promo-readonly {
        display: grid;
        gap: 6px;
        padding-top: 14px;
        margin-top: 14px;
        border-top: 1px solid var(--hairline);
      }
      .cof-promo-readonly-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
      }
      .cof-allocation-table {
        width: 100%;
      }
      .cof-allocation-note-row td {
        padding: 0 0 10px;
        border: 0;
      }
      .cof-allocation-note {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .cof-allocation-note-warn {
        color: var(--st-no-purchase);
        font-weight: 700;
      }
      .cof-expired-tag {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .cof-change-summary {
        padding-bottom: 14px;
        margin-bottom: 4px;
        border-bottom: 1px solid var(--hairline);
        display: grid;
        gap: 4px;
      }
      .cof-estimate {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      .cof-right {
        position: sticky;
        top: var(--sp-6);
      }
      .cof-sim-card {
        display: grid;
        gap: 14px;
      }
      .cof-sim-subtitle {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-muted);
        margin: 4px 0 0;
      }
      .cof-sim-lines {
        display: grid;
        gap: 6px;
      }
      .cof-sim-line-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
      }
      .cof-sim-promo {
        padding: 8px 0;
        border-top: 1px dashed var(--hairline);
      }
      .cof-sim-promo-name {
        font-weight: 700;
        font-size: 13px;
      }
      .cof-near-promo {
        display: grid;
        gap: 6px;
      }
      .cof-near-soldout {
        display: grid;
        gap: 4px;
        padding: 10px 12px;
        background: var(--faint);
        border-left: 3px solid var(--ink-muted);
      }
      .cof-near-soldout strong {
        font-size: 13px;
        color: var(--ink);
      }
      .cof-near-soldout p {
        margin: 0;
        font-size: 12px;
      }
      .cof-near-track {
        height: 8px;
        border-radius: var(--radius-pill);
        background: var(--faint);
        overflow: hidden;
      }
      .cof-near-fill {
        height: 100%;
        background: var(--accent);
      }
      .cof-sim-totals {
        border-top: 1px solid var(--hairline);
        padding-top: 12px;
        display: grid;
        gap: 6px;
      }
      .cof-sim-total-row {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        color: var(--ink-muted);
      }
      .cof-sim-total-strong {
        font-size: 20px;
        font-weight: 700;
        color: var(--ink);
        margin-top: 2px;
      }
      .cof-submit-hint {
        margin: var(--sp-2) 0 0;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
        text-align: center;
      }

      @media (max-width: 900px) {
        .cof-grid {
          grid-template-columns: 1fr;
        }
        .cof-right {
          position: static;
        }
        .cof-attribution-options {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 767px) {
        .cof-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class CounterOrderFormPage implements OnInit {
  private counterOrderSvc = inject(CounterOrderAdminService);
  private orderSvc = inject(OrderAdminService);
  private allocationSvc = inject(AllocationService);
  private simulationSvc = inject(OrderSimulationService);
  private catalogSvc = inject(CatalogLookupService);
  private lookupSvc = inject(LookupService);
  private auth = inject(AuthService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected routeStore = inject(RouteStore);
  protected counterSession = inject(CounterSessionStore);

  orderId = input('', { alias: 'orderId' });

  protected formatSoles = formatSoles;
  protected quantityText = quantityText;
  protected initials = initials;
  protected dateText = dateText;
  protected dateTimeText = dateTimeText;
  protected originName = originName;
  protected tabs = TABS;

  protected editMode = computed(() => !!this.orderId());
  protected jornadaOpen = computed(
    () => !!this.routeStore.route() && !this.routeStore.route()!.endTime,
  );

  // — Pedido a editar: cada id nuevo o cada "Reintentar" dispara UNA carga vigente.
  protected originalOrder = signal<OrderDetail | null>(null);
  protected orderError = signal(false);
  private orderRetry = signal(0);
  private orderRequest = computed(() => ({
    orderId: Number(this.orderId()) || 0,
    attempt: this.orderRetry(),
  }));

  protected customer = signal<UiLookupItem | null>(null);
  protected context = signal<CounterCustomerContext | null>(null);
  protected contextLoading = signal(false);
  protected attributeTo = signal<AttributionTarget>('counter');
  protected salesChannelId = signal('');
  protected channelOptions = signal<UiFieldOption[]>([{ value: '', label: 'Sin canal' }]);
  protected timeText = timeText;

  // — "Otro vendedor" (doc 44, sección 5) — lista corta (~25), se pide una
  // sola vez al elegir el cliente o al abrir esta opción, y se filtra en
  // el cliente por nombre o código.
  protected otherSalespeople = signal<CounterSalespersonView[]>([]);
  protected otherSalespeopleLoading = signal(false);
  private otherSalespeopleLoaded = false;
  protected otherSalespersonQuery = signal('');
  protected selectedOtherSalesperson = signal<CounterSalespersonView | null>(null);
  protected otherSalespeopleFiltered = computed(() => {
    const q = this.otherSalespersonQuery().trim().toLowerCase();
    const list = this.otherSalespeople();
    if (!q) return list;
    return list.filter(
      (s) => s.salespersonName.toLowerCase().includes(q) || s.salespersonCode.includes(q),
    );
  });
  protected paymentConditions = signal<UiFieldOption[]>([]);
  protected paymentConditionId = signal('');
  protected deliverNow = signal(false);
  protected note = signal('');

  protected lines = signal<CartLine[]>([]);
  protected activeTab = signal<FormTab>('catalogo');
  protected suggested = signal<SuggestedItem[]>([]);
  protected suggestedLoading = signal(false);
  protected availablePromos = signal<MobilePromoCatalogView | null>(null);
  protected availablePromosLoading = signal(false);
  protected availablePromosError = signal(false);
  private availablePromosFeaturedOnly = false;

  protected simResult = signal<OrderSimulationView | null>(null);
  protected simulating = signal(false);
  protected submitting = signal(false);

  // — Dotación del vendedor (doc 36, sección 6; doc 42, sección 9.4) — en
  // edición de pedidos de campo o de televentas, nunca de mostrador.
  protected vendorAllocations = signal<AllocationView[]>([]);
  protected allocationQuantities = signal<Map<number, number>>(new Map());

  /** El propio vendedor editando su pedido: usa su cupo por self-service (`/mobile/allocations/mine`). */
  protected isOwnOrder = computed(
    () => this.originalOrder()?.salespersonId === this.auth.currentUser()?.userId,
  );
  protected canManageAllocations = computed(
    () => this.auth.hasAny('order.manage', 'promo.allocate') || this.isOwnOrder(),
  );
  protected showAllocationBlock = computed(
    () =>
      this.editMode() &&
      this.originalOrder()?.originCode !== 'COUNTER' &&
      this.canManageAllocations(),
  );

  protected allocationRows = computed<AllocationRow[]>(() => {
    const order = this.originalOrder();
    if (!order) return [];
    const inOrder = new Map<
      number,
      { productName: string; quantity: number; stockPending: boolean }
    >();
    for (const item of order.items) {
      if (!item.bonus || item.allocationId == null) continue;
      const prev = inOrder.get(item.allocationId);
      inOrder.set(item.allocationId, {
        productName: item.productName,
        quantity: (prev?.quantity ?? 0) + item.quantity,
        stockPending: (prev?.stockPending ?? false) || item.stockPending,
      });
    }
    const rows: AllocationRow[] = [];
    const seen = new Set<number>();
    for (const a of this.vendorAllocations()) {
      const existing = inOrder.get(a.allocationId);
      seen.add(a.allocationId);
      rows.push({
        allocationId: a.allocationId,
        productName: a.productName,
        promoName: a.promoName,
        periodEnd: a.periodEnd,
        expired: false,
        available: a.availableQuantity,
        originalQuantity: existing?.quantity ?? 0,
        max: a.availableQuantity + (existing?.quantity ?? 0),
        stockPending: existing?.stockPending ?? false,
      });
    }
    for (const [allocationId, data] of inOrder) {
      if (seen.has(allocationId)) continue;
      rows.push({
        allocationId,
        productName: data.productName,
        promoName: null,
        periodEnd: null,
        expired: true,
        available: null,
        originalQuantity: data.quantity,
        max: data.quantity,
        stockPending: data.stockPending,
      });
    }
    return rows;
  });

  protected allocationChangeCount = computed(
    () =>
      this.allocationRows().filter(
        (r) =>
          (this.allocationQuantities().get(r.allocationId) ?? r.originalQuantity) !==
          r.originalQuantity,
      ).length,
  );
  protected saleChangeCount = computed(() => this.buildSaleItemChanges().length);

  /** Un pedido debe conservar al menos una línea de venta (doc 37, sección 7.6). */
  protected canSaveEdit = computed(() => !this.submitting() && this.lines().length > 0);

  private idempotencyKey = signal(newIdempotencyKey());
  private simTrigger$ = new Subject<void>();

  protected paymentConditionOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Selecciona' },
    ...this.paymentConditions(),
  ]);

  /** Progreso puramente visual (ver DESIGN.md) — no gatilla ni oculta nada. */
  protected stepState = computed<UiStep[]>(() => {
    const hasCustomer = !!this.customer();
    const hasProducts = this.lines().length > 0;
    const steps: UiStep[] = [
      { label: 'Cliente', state: hasCustomer ? 'complete' : 'current' },
      {
        label: 'Productos',
        state: hasProducts ? 'complete' : hasCustomer ? 'current' : 'upcoming',
      },
      { label: 'Revisar y registrar', state: hasProducts ? 'current' : 'upcoming' },
    ];
    return steps;
  });

  protected searchCustomers = (q: string) =>
    this.lookupSvc.customers(q).pipe(map((items) => toUiLookup(items)));

  protected searchProducts = (q: string) =>
    this.lookupSvc.products(q).pipe(map((items) => toUiLookup(items)));

  constructor() {
    // Las condiciones de pago se usan en los dos modos.
    this.catalogSvc.paymentConditions().subscribe((list) => {
      this.paymentConditions.set(
        list.map((p) => ({ value: String(p.paymentConditionId), label: p.name })),
      );
    });

    // `orderId` llega por la ruta DESPUÉS del constructor: se lee de forma
    // reactiva. switchMap deja una sola petición vigente (ARCHITECTURE_PANEL 8.1).
    toObservable(this.orderRequest)
      .pipe(
        filter((req) => req.orderId > 0),
        tap(() => {
          this.orderError.set(false);
          this.originalOrder.set(null);
        }),
        switchMap((req) =>
          this.orderSvc.detail(req.orderId).pipe(
            catchError(() => {
              this.orderError.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((detail) => {
        if (detail) this.applyOrder(detail);
      });

    this.simTrigger$
      .pipe(
        debounceTime(400),
        switchMap(() => {
          const cmd = this.buildSimulateCommand();
          if (!cmd) return of(null);
          this.simulating.set(true);
          return this.simulationSvc.simulateOrder(cmd).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.simulating.set(false);
        this.simResult.set(result);
      });

    effect(() => {
      this.lines();
      this.paymentConditionId();
      this.customer();
      this.attributeTo();
      this.salesChannelId();
      this.selectedOtherSalesperson();
      this.originalOrder();
      untracked(() => this.simTrigger$.next());
    });
  }

  /**
   * Aquí los inputs de la ruta ya tienen valor. La jornada, el almacén de
   * la sede y los canales solo los necesita Nuevo pedido (doc 30, sección 6):
   * editar no pide jornada abierta.
   */
  ngOnInit() {
    if (this.editMode()) return;
    this.routeStore.refresh();
    this.counterSession.ensureLoaded();
    this.lookupSvc.salesChannels().subscribe((list) => {
      this.channelOptions.set([
        { value: '', label: 'Sin canal' },
        ...list.map((i) => ({ value: String(i.id), label: i.name ?? '' })),
      ]);
    });
  }

  protected retryLoadOrder() {
    this.orderRetry.update((n) => n + 1);
  }

  /** Deja el formulario con el pedido recién cargado. */
  private applyOrder(detail: OrderDetail) {
    this.originalOrder.set(detail);
    this.paymentConditionId.set(String(detail.paymentConditionId));
    this.allocationQuantities.set(new Map());
    // Solo las líneas de venta son editables aquí — promoción y
    // dotación tienen su propio trato (doc 36, sección 6.3).
    this.lines.set(
      detail.items
        .filter((i) => !i.bonus)
        .map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
        })),
    );
    this.vendorAllocations.set([]);
    if (detail.originCode !== 'COUNTER' && this.canManageAllocations()) {
      const ownOrder = detail.salespersonId === this.auth.currentUser()?.userId;
      const allocations$ = ownOrder
        ? this.allocationSvc.mine()
        : this.allocationSvc.byUser(detail.salespersonId);
      allocations$.subscribe({
        next: (list) => this.vendorAllocations.set(list),
        error: () => this.vendorAllocations.set([]),
      });
    }
  }

  protected canEditCart(): boolean {
    if (this.editMode()) return this.originalOrder()?.statusCode === 'OPEN';
    return !!this.context()?.canCreateOrder;
  }

  protected canSubmit(): boolean {
    return (
      !this.submitting() &&
      !!this.customer() &&
      !!this.context()?.canCreateOrder &&
      !!this.paymentConditionId() &&
      this.lines().length > 0 &&
      (this.attributeTo() !== 'other' || !!this.selectedOtherSalesperson())
    );
  }

  /** Lo único que falta para poder calcular o registrar, en orden: cliente → condición de pago → productos. */
  protected summaryHelp = computed(() => {
    if (this.editMode()) return 'Agrega productos para ver el cálculo.';
    if (!this.customer()) return 'Elige un cliente';
    if (!this.paymentConditionId()) return 'Elige la condición de pago';
    if (this.lines().length === 0) return 'Agrega productos';
    return 'Agrega un cliente y productos para ver el cálculo.';
  });

  protected submitDisabledReason = computed(() => {
    if (!this.customer()) return 'Elige un cliente';
    if (!this.context()?.canCreateOrder) return 'Este cliente no puede recibir un pedido ahora.';
    if (this.attributeTo() === 'other' && !this.selectedOtherSalesperson()) {
      return 'Elige a qué vendedor va la venta';
    }
    if (!this.paymentConditionId()) return 'Elige la condición de pago';
    if (this.lines().length === 0) return 'Agrega productos';
    return '';
  });

  protected hasLine(productId: number): boolean {
    return this.lines().some((l) => l.productId === productId);
  }

  protected onCustomerPicked(item: UiLookupItem) {
    this.lines.set([]);
    this.simResult.set(null);
    this.note.set('');
    this.deliverNow.set(false);
    this.idempotencyKey.set(newIdempotencyKey());
    this.suggested.set([]);
    this.availablePromos.set(null);
    this.resetAttribution();
    this.loadContext(item.id);
  }

  protected changeCustomer() {
    this.customer.set(null);
    this.context.set(null);
    this.resetAttribution();
  }

  private resetAttribution() {
    this.otherSalespeople.set([]);
    this.otherSalespeopleLoaded = false;
    this.otherSalespersonQuery.set('');
    this.selectedOtherSalesperson.set(null);
  }

  private loadContext(customerId: number) {
    this.contextLoading.set(true);
    this.context.set(null);
    this.counterOrderSvc.customerContext(customerId).subscribe({
      next: (ctx) => {
        this.context.set(ctx);
        this.contextLoading.set(false);
        const assignment = ctx.salesAssignment;
        if (assignment?.salespersonActive) {
          this.attributeTo.set('salesperson');
          this.salesChannelId.set(
            assignment.salesChannelId ? String(assignment.salesChannelId) : '',
          );
        } else {
          // Sin asignación, o asignado pero inactivo (sección 5.1): mostrador
          // por defecto; si estaba inactivo, ya se pide la lista de "otro
          // vendedor" para que la opción quede lista de inmediato.
          this.attributeTo.set('counter');
          if (assignment) this.loadOtherSalespeople();
        }
        this.loadSuggested(customerId);
      },
      error: () => this.contextLoading.set(false),
    });
  }

  /** "Venta para: {nombre}" del resumen — sección 5.5. */
  protected attributionSummaryText(): string {
    if (this.attributeTo() === 'salesperson' && this.context()?.salesAssignment) {
      return this.context()!.salesAssignment!.salespersonName;
    }
    if (this.attributeTo() === 'other' && this.selectedOtherSalesperson()) {
      return this.selectedOtherSalesperson()!.salespersonName;
    }
    if (this.attributeTo() === 'counter') return 'Mostrador (yo)';
    return '';
  }

  /** Abre "Otro vendedor" y pide la lista la primera vez (sección 5.3). */
  protected selectOtherSalesperson() {
    this.attributeTo.set('other');
    this.loadOtherSalespeople();
  }

  private loadOtherSalespeople() {
    if (this.otherSalespeopleLoaded) return;
    this.otherSalespeopleLoaded = true;
    this.otherSalespeopleLoading.set(true);
    const excludeUserId = this.context()?.salesAssignment?.salespersonId;
    this.counterOrderSvc.salespeople(excludeUserId).subscribe({
      next: (list) => {
        this.otherSalespeople.set(list);
        this.otherSalespeopleLoading.set(false);
      },
      error: () => {
        this.otherSalespeopleLoading.set(false);
        this.otherSalespeopleLoaded = false;
      },
    });
  }

  private loadSuggested(customerId: number) {
    this.suggestedLoading.set(true);
    this.counterOrderSvc.suggested(customerId).subscribe({
      next: (list) => {
        this.suggested.set(list);
        this.suggestedLoading.set(false);
      },
      error: () => this.suggestedLoading.set(false),
    });
    this.loadAvailablePromos(customerId, false);
  }

  /** `featuredOnly` por defecto `false`: en mostrador se ven todas (doc 49, sección 9.1). */
  protected loadAvailablePromos(customerId: number, featuredOnly: boolean) {
    const salesChannelId = this.resolvedSalesChannelId();
    if (salesChannelId == null) return;
    this.availablePromosFeaturedOnly = featuredOnly;
    this.availablePromosLoading.set(true);
    this.availablePromosError.set(false);
    this.simulationSvc.available(customerId, salesChannelId, featuredOnly).subscribe({
      next: (catalog) => {
        this.availablePromos.set(catalog);
        this.availablePromosLoading.set(false);
      },
      error: () => {
        this.availablePromosError.set(true);
        this.availablePromosLoading.set(false);
      },
    });
  }

  protected onCatalogFeaturedOnlyChange(featuredOnly: boolean) {
    const customerId = this.customer()?.id;
    if (customerId != null) this.loadAvailablePromos(customerId, featuredOnly);
  }

  protected retryAvailablePromos() {
    const customerId = this.customer()?.id;
    if (customerId != null) this.loadAvailablePromos(customerId, this.availablePromosFeaturedOnly);
  }

  protected addProduct(item: UiLookupItem) {
    if (this.hasLine(item.id)) {
      this.lines.update((list) =>
        list.map((l) => (l.productId === item.id ? { ...l, quantity: l.quantity + 1 } : l)),
      );
      return;
    }
    this.lines.update((list) => [
      ...list,
      { productId: item.id, productName: item.name, quantity: 1 },
    ]);
  }

  protected addSuggested(item: SuggestedItem) {
    if (this.hasLine(item.productId)) return;
    // El promedio histórico puede venir con decimales: se vende en unidades enteras.
    const quantity = toWholeQuantity(item.avgQuantity, 1) ?? 1;
    this.lines.update((list) => [
      ...list,
      { productId: item.productId, productName: item.productName, quantity },
    ]);
  }

  /** Cantidad de venta: entero, mínimo 1. Para quitar el producto está el botón ✕. */
  protected updateQuantity(line: CartLine, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const raw = inputNumber(input);
    const value = toWholeQuantity(raw, 1);
    if (value == null) {
      input.value = String(line.quantity);
      return;
    }
    if (raw < 1) {
      this.toast.info('La cantidad mínima es 1. Para quitar el producto usa ✕.');
    } else if (!isWholeQuantity(raw)) {
      this.toast.info(`Las cantidades van en unidades enteras: se dejó ${value}.`);
    }
    input.value = String(value);
    this.lines.update((list) =>
      list.map((l) => (l.productId === line.productId ? { ...l, quantity: value } : l)),
    );
  }

  protected removeLine(line: CartLine) {
    this.lines.update((list) => list.filter((l) => l.productId !== line.productId));
  }

  private resolvedSalesChannelId(): number | null {
    if (this.editMode()) return this.originalOrder()?.salesChannelId ?? 0;
    if (this.attributeTo() === 'salesperson' && this.context()?.salesAssignment) {
      return this.context()!.salesAssignment!.salesChannelId ?? 0;
    }
    if (this.attributeTo() === 'other') {
      return this.selectedOtherSalesperson()?.salesChannelId ?? null;
    }
    return this.salesChannelId() ? Number(this.salesChannelId()) : 0;
  }

  private buildSimulateCommand(): SimulateOrderCommand | null {
    const customerId = this.editMode() ? this.originalOrder()?.customerId : this.customer()?.id;
    const paymentConditionId = Number(this.paymentConditionId());
    const lines = this.lines();
    if (!customerId || !paymentConditionId || lines.length === 0) return null;
    const salesChannelId = this.resolvedSalesChannelId();
    if (salesChannelId == null) return null;
    return {
      customerId,
      paymentConditionId,
      salesChannelId,
      lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    };
  }

  protected submit() {
    const customer = this.customer();
    const paymentConditionId = Number(this.paymentConditionId());
    if (!customer || !paymentConditionId || this.lines().length === 0) return;

    const cmd: CreateCounterOrderCommand = {
      customerId: customer.id,
      paymentConditionId,
      deliverNow: this.deliverNow(),
      idempotencyKey: this.idempotencyKey(),
      catalogItems: this.lines().map((l) => ({ productId: l.productId, quantity: l.quantity })),
      predictedItems: [],
    };
    if (this.attributeTo() === 'salesperson' && this.context()?.salesAssignment) {
      cmd.assignmentId = this.context()!.salesAssignment!.assignmentId;
    } else if (this.attributeTo() === 'other' && this.selectedOtherSalesperson()) {
      cmd.salespersonId = this.selectedOtherSalesperson()!.salespersonId;
    } else {
      cmd.salesChannelId = this.salesChannelId() ? Number(this.salesChannelId()) : 0;
    }
    if (this.note().trim()) cmd.note = this.note().trim();

    this.submitting.set(true);
    this.counterOrderSvc.create(cmd).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.toast.success(
          result.duplicate
            ? 'Este pedido ya se había registrado.'
            : result.pendingChoiceCount > 0
              ? `Pedido registrado. Ganó ${result.pendingChoiceCount} premio(s) a elegir.`
              : 'Pedido registrado.',
        );
        this.idempotencyKey.set(newIdempotencyKey());
        this.router.navigate(['/pedidos/detalle', result.orderId]);
      },
      error: (err) => {
        this.submitting.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.toast.error(detalle || 'No pudimos registrar el pedido.');
      },
    });
  }

  /** Solo las líneas de venta (bonus = false) del pedido original. */
  private buildSaleItemChanges(): OrderItemEditCommand[] {
    const order = this.originalOrder();
    if (!order) return [];
    const originalMap = new Map(
      order.items.filter((i) => !i.bonus).map((i) => [i.productId, i.quantity]),
    );
    const currentMap = new Map(this.lines().map((l) => [l.productId, l.quantity]));
    const items: OrderItemEditCommand[] = [];
    for (const [productId, qty] of currentMap) {
      if (originalMap.get(productId) !== qty) items.push({ productId, newQuantity: qty });
    }
    for (const productId of originalMap.keys()) {
      if (!currentMap.has(productId)) items.push({ productId, newQuantity: 0 });
    }
    return items;
  }

  private buildAllocationChanges(): AllocationEditCommand[] {
    return this.allocationRows()
      .filter(
        (r) =>
          (this.allocationQuantities().get(r.allocationId) ?? r.originalQuantity) !==
          r.originalQuantity,
      )
      .map((r) => ({
        allocationId: r.allocationId,
        newQuantity: this.allocationQuantities().get(r.allocationId) ?? r.originalQuantity,
      }));
  }

  /** Líneas de promoción del pedido — solo lectura, se recalculan al guardar (doc 36, sección 6.3). */
  protected promoLines = computed(
    () => this.originalOrder()?.items.filter((i) => i.bonus && i.allocationId == null) ?? [],
  );

  protected allocationQuantity(row: AllocationRow): number {
    return this.allocationQuantities().get(row.allocationId) ?? row.originalQuantity;
  }

  /** Cantidad final de dotación: entero entre 0 (quitar) y el máximo de la fila. */
  protected setAllocationQuantity(row: AllocationRow, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const raw = inputNumber(input);
    const value = toWholeQuantity(raw, 0, row.max) ?? this.allocationQuantity(row);
    if (Number.isFinite(raw) && !isWholeQuantity(raw)) {
      this.toast.info(`Las cantidades van en unidades enteras: se dejó ${value}.`);
    }
    input.value = String(value);
    this.allocationQuantities.update((current) => {
      const next = new Map(current);
      next.set(row.allocationId, value);
      return next;
    });
  }

  protected submitEdit() {
    const order = this.originalOrder();
    if (!order) return;
    if (this.lines().length === 0) {
      this.toast.error(
        'El pedido debe conservar al menos una línea de venta. Si el cliente ya no lleva nada, anúlalo.',
      );
      return;
    }
    const catalogItems = this.buildSaleItemChanges();
    const allocationItems = this.buildAllocationChanges();
    const paymentConditionChanged = Number(this.paymentConditionId()) !== order.paymentConditionId;

    if (catalogItems.length === 0 && allocationItems.length === 0 && !paymentConditionChanged) {
      this.toast.info('No hay cambios para guardar.');
      return;
    }

    const parts: string[] = [];
    if (catalogItems.length > 0) {
      parts.push(
        `${catalogItems.length} línea${catalogItems.length === 1 ? '' : 's'} de venta cambia${catalogItems.length === 1 ? '' : 'n'}`,
      );
    }
    if (allocationItems.length > 0) {
      parts.push(
        `${allocationItems.length} dotación${allocationItems.length === 1 ? '' : 'es'} cambia${allocationItems.length === 1 ? '' : 'n'}`,
      );
    }
    if (paymentConditionChanged) {
      parts.push('cambia la condición de pago');
    }
    const message = `${parts.join(' y ')}. Las promociones se vuelven a calcular al guardar. ¿Guardar cambios?`;

    this.dialog
      .confirm({ title: 'Guardar cambios', message, confirmLabel: 'Guardar cambios' })
      .subscribe((confirmed) => {
        if (confirmed) this.doSubmitEdit(order, catalogItems, allocationItems);
      });
  }

  private doSubmitEdit(
    order: OrderDetail,
    catalogItems: OrderItemEditCommand[],
    allocationItems: AllocationEditCommand[],
  ) {
    const cmd: UpdateOrderCommand = {
      paymentConditionId: Number(this.paymentConditionId()) || null,
      catalogItems,
      predictedItems: [],
      allocationItems: allocationItems.length > 0 ? allocationItems : undefined,
    };
    const editedAllocationIds = new Set(allocationItems.map((a) => a.allocationId));
    this.submitting.set(true);
    this.orderSvc.updateItems(order.orderId, cmd).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        const pendingNames = updated.items
          .filter(
            (i) =>
              i.allocationId != null && editedAllocationIds.has(i.allocationId) && i.stockPending,
          )
          .map((i) => i.productName);
        if (pendingNames.length > 0) {
          this.toast.error(`La dotación de ${pendingNames.join(', ')} quedó pendiente de stock.`);
        } else {
          this.toast.success('Pedido actualizado.');
        }
        this.router.navigate(['/pedidos/detalle', order.orderId]);
      },
      error: (err) => {
        this.submitting.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.toast.error(detalle || 'No pudimos actualizar el pedido.');
      },
    });
  }

  protected cancel() {
    // En edición vuelve al detalle aunque el pedido no haya cargado.
    if (this.editMode()) {
      this.router.navigate(['/pedidos/detalle', this.orderId()]);
    } else {
      this.router.navigate(['/pedidos']);
    }
  }
}
