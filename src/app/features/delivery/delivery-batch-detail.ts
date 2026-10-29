import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiCard } from '../../shared/ui/card/card';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { UiInfoTip } from '../../shared/ui/info-tip/info-tip';
import { ToastService } from '../../core/ui/toast';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { AuthService } from '../../core/auth/auth';
import { DeliveryAdminService } from './delivery-admin';
import { AssignTeamDialog } from './ui/assign-team-dialog';
import { ReturnsDialog } from './ui/returns-dialog';
import { BatchMap } from './ui/batch-map';
import { PromoInsightsDialog, PromoInsightsDialogData } from './ui/promo-insights-dialog';
import {
  BatchCustomerView,
  BatchDetail,
  BatchReturnInvoiceView,
  BatchReturnsReport,
  MemberTotals,
} from '../../shared/models/delivery.models';
import {
  AMOUNT_TO_COLLECT_TOOLTIP,
  CHARGE_AMOUNT_TOOLTIP,
  DISCOUNT_CHARGE_TOOLTIP,
  ITEM_STATUS_OPTIONS,
  batchStatusName,
  itemStatusName,
  roleInTeamName,
} from './delivery-format';
import { dateText, dateTimeText, timeText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

const RETURNS_AUTO_REFRESH_MS = 60_000;
const RETURN_INVOICE_STATUS_NAME: Record<string, string> = {
  PARTIAL: 'Entrega parcial',
  REJECTED: 'Rechazado por el cliente',
};

const ITEM_STATUS_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los estados' },
  ...ITEM_STATUS_OPTIONS.map((o) => ({ value: o.code, label: o.name })),
];

const UNATTENDED_FILTER_VALUE = '__none__';

/** Detalle de una planilla: comprobantes + mapa de entregas. */
@Component({
  selector: 'app-delivery-batch-detail',
  imports: [
    RouterLink,
    UiButton,
    UiField,
    UiStatus,
    UiEmpty,
    UiCard,
    BatchMap,
    UiInfoTip,
    HasPermissionDirective,
  ],
  template: `
    <section class="dbd-page">
      @if (loading()) {
        <div class="dbd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar la planilla"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (batch(); as b) {
        <div class="dbd-head">
          <div>
            <ui-status [label]="statusName(b.statusCode)" />
            <h1>Planilla {{ b.series }}-{{ b.number }}</h1>
            <p class="dbd-meta">
              {{ dateText(b.batchDate) }} ·
              {{ b.vehiclePlate ? b.vehiclePlate + ' · ' + b.driverName : 'Sin equipo asignado' }}
            </p>
          </div>
          <div class="dbd-actions">
            @if (b.statusCode === 'OPEN') {
              <button
                uiButton
                variant="secondary"
                *hasPermission="'delivery.manage'"
                (click)="openAssignTeam(b)"
              >
                Asignar equipo
              </button>
            }
            <button
              uiButton
              variant="primary"
              *hasPermission="'delivery.settle'"
              [disabled]="!canSettle(b)"
              [loading]="settling()"
              (click)="settle(b)"
            >
              Liquidar
            </button>
          </div>
        </div>

        @if (b.statusCode !== 'OPEN') {
          <p class="dbd-hint">
            El equipo solo se puede asignar o reasignar mientras la planilla está Abierta.
          </p>
        }
        @if (b.statusCode !== 'SETTLED' && pendingCount() > 0) {
          <p class="dbd-hint">
            Faltan {{ pendingCount() }} comprobante{{ pendingCount() === 1 ? '' : 's' }} en
            Pendiente para poder liquidar.
          </p>
          @if (!canSettlePermission() && b.statusCode === 'IN_ROUTE') {
            <p class="dbd-hint">La liquida el conductor desde la app.</p>
          }
        }

        <div class="dbd-metrics">
          <div class="dbd-metric">
            <span class="dbd-metric-value">{{ formatSoles(b.totalAmount) }}</span>
            <span class="dbd-metric-label">Total</span>
          </div>
          <div class="dbd-metric">
            <span class="dbd-metric-value">{{ formatSoles(b.returnedAmount) }}</span>
            <span class="dbd-metric-label">Devuelto</span>
          </div>
          <div
            class="dbd-metric"
            [class.dbd-metric-click]="b.chargeAmount > 0"
            [class.dbd-metric-alert]="b.chargeAmount > 0"
            (click)="b.chargeAmount > 0 && openChargeAmountReturns()"
          >
            <span class="dbd-metric-value">{{ formatSoles(b.chargeAmount) }}</span>
            <span class="dbd-metric-label"
              >Descuento perdido <span [uiInfoTip]="chargeAmountTooltip"></span
            ></span>
            @if (b.chargeAmount > 0) {
              <span class="dbd-metric-sub"
                >{{ chargedItemCount(b) }} comprobante{{
                  chargedItemCount(b) === 1 ? '' : 's'
                }}</span
              >
            }
          </div>
          <div class="dbd-metric dbd-metric-primary">
            <span class="dbd-metric-value">{{ formatSoles(b.amountToCollect) }}</span>
            <span class="dbd-metric-label"
              >A cobrar <span [uiInfoTip]="amountToCollectTooltip"></span
            ></span>
            <span class="dbd-metric-sub">Neto {{ formatSoles(b.netAmount) }}</span>
          </div>
          <div class="dbd-metric">
            <span class="dbd-metric-value">{{ b.totalWeight }} kg</span>
            <span class="dbd-metric-label">Peso</span>
          </div>
          <div class="dbd-metric">
            <span class="dbd-metric-value">{{ pct(b) }}%</span>
            <span class="dbd-metric-label">Resueltos</span>
          </div>
          @if (b.settledAt) {
            <div class="dbd-metric">
              <span class="dbd-metric-value">{{ dateTimeText(b.settledAt) }}</span>
              <span class="dbd-metric-label">Liquidada el</span>
            </div>
          }
        </div>

        @if (b.returnedAmount > 0) {
          <p class="dbd-hint dbd-hint-alert">
            {{ b.returnedProductCount }} producto{{
              b.returnedProductCount === 1 ? '' : 's'
            }}
            devuelto{{ b.returnedProductCount === 1 ? '' : 's' }}, {{ b.returnedQuantity }} unidad{{
              b.returnedQuantity === 1 ? '' : 'es'
            }}.
          </p>
        }

        <div class="dbd-tabs">
          <button
            type="button"
            class="dbd-tab"
            [class.on]="view() === 'items'"
            (click)="view.set('items')"
          >
            Comprobantes
          </button>
          <button
            type="button"
            class="dbd-tab"
            [class.on]="view() === 'team'"
            (click)="view.set('team')"
          >
            Equipo
          </button>
          <button
            type="button"
            class="dbd-tab"
            [class.on]="view() === 'map'"
            (click)="view.set('map')"
          >
            Mapa
          </button>
          <button
            type="button"
            class="dbd-tab"
            *hasPermission="'delivery.manage'"
            [class.on]="view() === 'returns'"
            (click)="view.set('returns')"
          >
            Devoluciones
          </button>
          @if (view() === 'returns') {
            <button
              type="button"
              class="dbd-tab-refresh"
              [disabled]="loadingReturns()"
              (click)="refreshReturns()"
              aria-label="Actualizar"
              title="Actualizar"
            >
              ↻
            </button>
          }
        </div>

        @if (view() === 'items') {
          <div class="dbd-filters">
            <ui-field
              label="Estado"
              type="select"
              [(value)]="itemStatusFilter"
              [options]="itemStatusOptions"
            />
            <ui-field
              label="Atendido por"
              type="select"
              [(value)]="attendedByFilter"
              [options]="attendedByOptions()"
            />
            <button
              type="button"
              class="dbd-chip"
              [class.on]="onlyChargeAmountItems()"
              (click)="onlyChargeAmountItems.set(!onlyChargeAmountItems())"
            >
              Con descuento perdido
            </button>
          </div>

          <table class="ui-table-grid dbd-table-desktop">
            <thead>
              <tr>
                <th>#</th>
                <th>Comprobante</th>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Desc. perdido <span [uiInfoTip]="chargeAmountTooltip"></span></th>
                <th>A cobrar <span [uiInfoTip]="amountToCollectTooltip"></span></th>
                <th>Atendido por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.lineNumber) {
                <tr>
                  <td class="dbd-muted">{{ item.lineNumber }}</td>
                  <td class="dbd-cell-strong">
                    @if (canViewInvoice()) {
                      <a [routerLink]="['/factura', item.invoiceId]" class="dbd-invoice-link">{{
                        item.invoiceId
                      }}</a>
                    } @else {
                      {{ item.invoiceId }}
                    }
                  </td>
                  <td>{{ item.customerName }}</td>
                  <td class="dbd-muted">
                    @if (item.returnedAmount > 0) {
                      <span class="dbd-item-struck">{{ formatSoles(item.amount) }}</span>
                      {{ formatSoles(item.netAmount) }}
                    } @else {
                      {{ formatSoles(item.amount) }}
                    }
                  </td>
                  <td><ui-status [label]="itemStatusText(item.statusCode)" /></td>
                  <td>
                    @if (item.chargeAmount > 0 && canViewInvoice()) {
                      <button
                        type="button"
                        class="dbd-charge-link"
                        (click)="openPromoInsights(item)"
                      >
                        ⚠ {{ formatSoles(item.chargeAmount) }}
                      </button>
                    } @else if (item.chargeAmount > 0) {
                      <span class="dbd-charge">⚠ {{ formatSoles(item.chargeAmount) }}</span>
                    } @else {
                      <span class="dbd-muted">—</span>
                    }
                  </td>
                  <td class="dbd-cell-strong">{{ formatSoles(item.amountToCollect) }}</td>
                  <td class="dbd-muted">
                    @if (item.registeredByName) {
                      {{ item.registeredByName }}
                      <div class="dbd-attended-time">{{ timeText(item.registeredAt) }}</div>
                    } @else {
                      —
                    }
                  </td>
                  <td class="dbd-row-action">
                    <button
                      uiButton
                      variant="ghost"
                      size="sm"
                      *hasPermission="['delivery.return', 'delivery.settle', 'customer.view']"
                      (click)="viewReturns(item)"
                    >
                      Devoluciones
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="dbd-cards-mobile">
            @for (item of filteredItems(); track item.lineNumber) {
              <div class="dbd-card-mobile">
                <div class="dbd-card-mobile-head">
                  @if (canViewInvoice()) {
                    <a [routerLink]="['/factura', item.invoiceId]" class="dbd-invoice-link">{{
                      item.invoiceId
                    }}</a>
                  } @else {
                    <span class="dbd-card-mobile-name">{{ item.invoiceId }}</span>
                  }
                  <ui-status [label]="itemStatusText(item.statusCode)" />
                </div>
                <div class="dbd-muted">
                  {{ item.customerName }} ·
                  @if (item.returnedAmount > 0) {
                    <span class="dbd-item-struck">{{ formatSoles(item.amount) }}</span>
                    {{ formatSoles(item.netAmount) }}
                  } @else {
                    {{ formatSoles(item.amount) }}
                  }
                </div>
                @if (item.chargeAmount > 0) {
                  <div class="dbd-charge">Desc. perdido {{ formatSoles(item.chargeAmount) }}</div>
                }
                <div class="dbd-cell-strong">A cobrar {{ formatSoles(item.amountToCollect) }}</div>
                <div class="dbd-muted">
                  Atendido por:
                  @if (item.registeredByName) {
                    {{ item.registeredByName }} · {{ timeText(item.registeredAt) }}
                  } @else {
                    —
                  }
                </div>
                <div class="dbd-card-mobile-actions">
                  <button
                    uiButton
                    variant="ghost"
                    size="sm"
                    class="dbd-card-mobile-action"
                    *hasPermission="['delivery.return', 'delivery.settle', 'customer.view']"
                    (click)="viewReturns(item)"
                  >
                    Devoluciones
                  </button>
                  @if (item.chargeAmount > 0 && canViewInvoice()) {
                    <button
                      uiButton
                      variant="ghost"
                      size="sm"
                      class="dbd-card-mobile-action"
                      (click)="openPromoInsights(item)"
                    >
                      Promociones
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        } @else if (view() === 'team') {
          @if (!b.deliveryTeamId && b.memberTotals.length === 0) {
            <ui-empty
              title="Esta planilla aún no tiene equipo asignado"
              body="Asigna un conductor y sus ayudantes para repartir los comprobantes."
              [actionLabel]="canAssignTeam() ? 'Asignar equipo' : ''"
              (action)="openAssignTeam(b)"
            />
          } @else {
            <table class="ui-table-grid dbd-table-desktop">
              <thead>
                <tr>
                  <th>Integrante</th>
                  <th>Rol</th>
                  <th>Comprob.</th>
                  <th>Monto</th>
                  <th>Devuelto</th>
                  <th>Neto</th>
                  <th>Desc. perdido <span [uiInfoTip]="chargeAmountTooltip"></span></th>
                  <th>A rendir <span [uiInfoTip]="amountToCollectTooltip"></span></th>
                </tr>
              </thead>
              <tbody>
                @for (m of b.memberTotals; track m.userId) {
                  <tr class="dbd-team-row" (click)="openMember(m)">
                    <td class="dbd-cell-strong">{{ m.fullName }}</td>
                    <td [class.dbd-muted]="!m.roleInTeam">{{ roleInTeamName(m.roleInTeam) }}</td>
                    <td class="dbd-muted">{{ m.invoices }}</td>
                    <td class="dbd-muted">{{ formatSoles(m.amount) }}</td>
                    <td class="dbd-muted">{{ formatSoles(m.returnedAmount) }}</td>
                    <td class="dbd-muted">{{ formatSoles(m.netAmount) }}</td>
                    <td [class.dbd-charge]="m.chargeAmount > 0" [class.dbd-muted]="!m.chargeAmount">
                      {{ m.chargeAmount > 0 ? formatSoles(m.chargeAmount) : '—' }}
                    </td>
                    <td class="dbd-cell-strong">{{ formatSoles(m.amountToCollect) }}</td>
                  </tr>
                }
                @if (b.pendingAmount > 0) {
                  <tr class="dbd-team-row dbd-team-row-dim" (click)="openUnattended()">
                    <td class="dbd-cell-strong" colspan="2">Sin atender</td>
                    <td class="dbd-muted">{{ unattendedCount() }}</td>
                    <td class="dbd-muted">{{ formatSoles(b.pendingAmount) }}</td>
                    <td class="dbd-muted">—</td>
                    <td class="dbd-muted">{{ formatSoles(b.pendingAmount) }}</td>
                    <td class="dbd-muted">—</td>
                    <td class="dbd-cell-strong">{{ formatSoles(b.pendingAmount) }}</td>
                  </tr>
                }
                <tr class="dbd-team-row-total">
                  <td class="dbd-cell-strong" colspan="2">Total</td>
                  <td class="dbd-cell-strong">{{ b.items.length }}</td>
                  <td class="dbd-cell-strong">{{ formatSoles(b.totalAmount) }}</td>
                  <td class="dbd-cell-strong">{{ formatSoles(b.returnedAmount) }}</td>
                  <td class="dbd-cell-strong">{{ formatSoles(b.netAmount) }}</td>
                  <td class="dbd-cell-strong">{{ formatSoles(b.chargeAmount) }}</td>
                  <td class="dbd-cell-strong">{{ formatSoles(b.amountToCollect) }}</td>
                </tr>
              </tbody>
            </table>

            <div class="dbd-cards-mobile">
              @for (m of b.memberTotals; track m.userId) {
                <div class="dbd-card-mobile dbd-card-mobile-click" (click)="openMember(m)">
                  <div class="dbd-card-mobile-head">
                    <span class="dbd-card-mobile-name">{{ m.fullName }}</span>
                    <span [class.dbd-muted]="!m.roleInTeam">{{
                      roleInTeamName(m.roleInTeam)
                    }}</span>
                  </div>
                  <div class="dbd-muted">
                    {{ m.invoices }} comprob. · {{ formatSoles(m.amount) }} · devuelto
                    {{ formatSoles(m.returnedAmount) }}
                  </div>
                  @if (m.chargeAmount > 0) {
                    <div class="dbd-charge">Desc. perdido {{ formatSoles(m.chargeAmount) }}</div>
                  }
                  <div class="dbd-cell-strong">A rendir: {{ formatSoles(m.amountToCollect) }}</div>
                </div>
              }
              @if (b.pendingAmount > 0) {
                <div
                  class="dbd-card-mobile dbd-card-mobile-click dbd-team-row-dim"
                  (click)="openUnattended()"
                >
                  <div class="dbd-card-mobile-head">
                    <span class="dbd-card-mobile-name">Sin atender</span>
                  </div>
                  <div class="dbd-cell-strong">Neto: {{ formatSoles(b.pendingAmount) }}</div>
                </div>
              }
              <div class="dbd-card-mobile">
                <div class="dbd-card-mobile-head">
                  <span class="dbd-card-mobile-name">Total</span>
                </div>
                <div class="dbd-cell-strong">{{ formatSoles(b.netAmount) }}</div>
              </div>
            </div>
          }
        } @else if (view() === 'map') {
          @if (loadingCustomers()) {
            <div class="dbd-skeleton" role="status" aria-label="Cargando mapa"></div>
          } @else {
            <app-batch-map [customers]="customers()" />
          }
        } @else {
          @if (loadingReturns()) {
            <div class="dbd-skeleton" role="status" aria-label="Cargando devoluciones"></div>
          } @else if (errorReturns()) {
            <ui-empty
              variant="error"
              title="No pudimos cargar las devoluciones"
              body="Intenta de nuevo en unos segundos."
              actionLabel="Reintentar"
              (action)="refreshReturns()"
            />
          } @else if (returnsReport(); as r) {
            @if (r.invoicesWithReturns === 0) {
              <ui-empty title="Esta planilla no tiene devoluciones" />
            } @else {
              @if (r.statusCode === 'SETTLED') {
                <p class="dbd-hint dbd-ret-banner-settled">
                  Planilla liquidada el {{ dateTimeText(r.settledAt) }}: lista definitiva.
                </p>
              } @else {
                <p class="dbd-hint dbd-hint-alert">
                  La planilla sigue en ruta: faltan {{ r.pendingInvoices }} comprobante{{
                    r.pendingInvoices === 1 ? '' : 's'
                  }}
                  por atender y esta lista puede crecer.
                </p>
              }

              <div class="dbd-metrics">
                <div class="dbd-metric">
                  <span class="dbd-metric-value">{{ formatSoles(r.returnedAmount) }}</span>
                  <span class="dbd-metric-label">Devuelto</span>
                </div>
                <div class="dbd-metric">
                  <span class="dbd-metric-value">{{ r.returnedQuantity }}</span>
                  <span class="dbd-metric-label">Unidades</span>
                </div>
                <div class="dbd-metric">
                  <span class="dbd-metric-value">{{ r.productCount }}</span>
                  <span class="dbd-metric-label">Productos</span>
                </div>
                <div class="dbd-metric">
                  <span class="dbd-metric-value"
                    >{{ r.invoicesWithReturns }} de {{ r.totalInvoices }}</span
                  >
                  <span class="dbd-metric-label">Comprobantes con devolución</span>
                </div>
                <div class="dbd-metric" [class.dbd-metric-alert]="r.chargeAmount > 0">
                  <span class="dbd-metric-value">{{ formatSoles(r.chargeAmount) }}</span>
                  <span class="dbd-metric-label"
                    >Descuento perdido <span [uiInfoTip]="chargeAmountTooltip"></span
                  ></span>
                </div>
                <div
                  class="dbd-metric"
                  [class.dbd-metric-click]="r.pendingInvoices > 0"
                  [class.dbd-metric-alert]="r.pendingInvoices > 0"
                  (click)="r.pendingInvoices > 0 && openUnattended()"
                >
                  <span class="dbd-metric-value">{{ r.pendingInvoices }}</span>
                  <span class="dbd-metric-label">Sin atender</span>
                </div>
              </div>

              <button
                type="button"
                class="dbd-chip"
                [class.on]="onlyChargeAmount()"
                (click)="onlyChargeAmount.set(!onlyChargeAmount())"
              >
                Con descuento perdido
              </button>

              <div class="dbd-ret-grid">
                <ui-card title="Qué vuelve al almacén">
                  <table class="ui-table-grid dbd-ret-table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th>Und.</th>
                        <th>Cantidad</th>
                        <th>Empaque</th>
                        <th>Monto</th>
                        <th>En</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of r.products; track p.productId) {
                        <tr [class.dbd-ret-row-highlight]="highlightedProductId() === p.productId">
                          <td class="dbd-muted">{{ p.productCode }}</td>
                          <td>
                            <button
                              type="button"
                              class="dbd-ret-product-link"
                              (click)="toggleProductHighlight(p.productId)"
                            >
                              {{ p.productName }}
                            </button>
                            @if (p.bonusQuantity > 0) {
                              <span class="dbd-ret-bonus-tag"
                                >Bonificación: {{ p.bonusQuantity }}</span
                              >
                            }
                          </td>
                          <td class="dbd-muted">{{ p.unitOfMeasure }}</td>
                          <td class="dbd-cell-strong">{{ p.returnedQuantity }}</td>
                          <td class="dbd-muted">{{ packageText(p) }}</td>
                          <td class="dbd-muted">{{ formatSoles(p.returnedAmount) }}</td>
                          <td class="dbd-muted">en {{ p.invoiceCount }} comprobantes</td>
                        </tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr class="dbd-team-row-total">
                        <td class="dbd-cell-strong" colspan="3">Total</td>
                        <td class="dbd-cell-strong">{{ r.returnedQuantity }}</td>
                        <td></td>
                        <td class="dbd-cell-strong">{{ formatSoles(r.returnedAmount) }}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                  <button uiButton variant="ghost" size="sm" (click)="printConsolidated()">
                    Imprimir
                  </button>
                </ui-card>

                <ui-card title="Comprobantes con devolución">
                  <div class="dbd-ret-invoices">
                    @for (inv of filteredInvoices(r); track inv.lineNumber) {
                      <div
                        class="dbd-ret-invoice"
                        [class.dbd-ret-row-highlight]="
                          invoiceHasProduct(inv, highlightedProductId())
                        "
                      >
                        <button
                          type="button"
                          class="dbd-ret-invoice-head"
                          (click)="toggleInvoiceExpand(inv.lineNumber)"
                        >
                          <span class="dbd-muted">{{ inv.lineNumber }}</span>
                          <span class="dbd-cell-strong">{{ inv.invoiceId }}</span>
                          <span class="dbd-ret-invoice-customer">{{ inv.customerName }}</span>
                          <ui-status
                            [label]="returnInvoiceStatusName(inv.statusCode)"
                            [status]="returnInvoiceStatusSlug(inv.statusCode)"
                          />
                          <span class="dbd-cell-strong">{{ formatSoles(inv.returnedAmount) }}</span>
                          <span class="dbd-ret-invoice-caret">{{
                            expandedInvoiceLine() === inv.lineNumber ? '▾' : '▸'
                          }}</span>
                        </button>
                        <div class="dbd-muted dbd-ret-invoice-meta">
                          @if (inv.registeredByName) {
                            {{ inv.registeredByName }} · {{ timeText(inv.registeredAt) }}
                          }
                          Monto {{ formatSoles(inv.amount) }} · Devuelto
                          {{ formatSoles(inv.returnedAmount) }}
                          @if (inv.chargeAmount > 0) {
                            ·
                            <span class="dbd-charge"
                              >⚠ Desc. perdido {{ formatSoles(inv.chargeAmount) }}</span
                            >
                          }
                          · <strong>A cobrar {{ formatSoles(inv.amountToCollect) }}</strong>
                        </div>
                        @if (expandedInvoiceLine() === inv.lineNumber) {
                          <div class="dbd-ret-subtitle">Devuelto</div>
                          <table class="ui-table-grid dbd-ret-lines">
                            <tbody>
                              @for (l of inv.lines; track l.productId) {
                                <tr>
                                  <td>
                                    {{ l.productName }}
                                    @if (l.bonus) {
                                      <span class="dbd-ret-bonus-tag">Bonificación recuperada</span>
                                    }
                                  </td>
                                  <td class="dbd-muted">{{ l.quantity }}</td>
                                  <td class="dbd-muted">{{ formatSoles(l.amount) }}</td>
                                  <td class="dbd-muted">{{ l.reasonName }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>

                          @if (inv.discounts.length > 0) {
                            <div class="dbd-ret-subtitle">
                              Descuento perdido <span [uiInfoTip]="discountChargeTooltip"></span>
                            </div>
                            <table class="ui-table-grid dbd-ret-lines">
                              <thead>
                                <tr>
                                  <th>Promoción</th>
                                  <th>Producto</th>
                                  <th>Del pedido</th>
                                  <th>Quedaba</th>
                                  <th>Ahora</th>
                                  <th>A cobrar</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (d of inv.discounts; track d.promoId + '-' + d.productId) {
                                  <tr>
                                    <td>{{ d.promoName }}</td>
                                    <td class="dbd-muted">
                                      {{ d.productCode }} {{ d.productName }}
                                    </td>
                                    <td class="dbd-muted">{{ formatSoles(d.orderDiscount) }}</td>
                                    <td class="dbd-muted">{{ formatSoles(d.keptDiscount) }}</td>
                                    <td class="dbd-muted">{{ formatSoles(d.currentDiscount) }}</td>
                                    <td class="dbd-cell-strong">
                                      {{ formatSoles(d.chargeAmount) }}
                                    </td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          }
                        }
                      </div>
                    }
                  </div>
                </ui-card>
              </div>
            }
          }
        }
      }
    </section>
  `,
  styles: [
    `
      .dbd-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .dbd-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .dbd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 6px 0 4px;
        color: var(--ink);
      }
      .dbd-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .dbd-actions {
        display: flex;
        gap: 10px;
      }
      .dbd-hint {
        margin: 14px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .dbd-hint-alert {
        color: var(--accent-ink);
        font-weight: 600;
      }
      .dbd-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
        gap: 16px;
        margin-top: 20px;
      }
      .dbd-metric {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
      }
      .dbd-metric-value {
        display: block;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .dbd-metric-label {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .dbd-metric-sub {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        color: var(--ink-muted);
      }
      .dbd-metric-primary {
        border-color: var(--accent);
      }
      .dbd-metric-primary .dbd-metric-value {
        color: var(--accent-ink);
        font-weight: 900;
      }
      .dbd-tabs {
        display: flex;
        gap: 0;
        margin-top: 28px;
        border-bottom: var(--border-rule);
      }
      .dbd-tab {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 14px;
        padding: 12px 18px;
        color: var(--ink-muted);
        border-bottom: 3px solid transparent;
      }
      .dbd-tab.on {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
      .dbd-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 16px 0;
      }
      .dbd-filters ui-field {
        width: 220px;
      }
      .dbd-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        padding: 9px 14px;
        border: 2px solid var(--divider);
        border-radius: var(--radius-pill);
        background: var(--surface);
        color: var(--ink-muted);
        cursor: pointer;
        align-self: flex-end;
      }
      .dbd-chip.on {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--bg);
      }
      .dbd-charge-link {
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        font-size: 13px;
        color: var(--st-pendiente);
      }
      .dbd-charge-link:hover {
        text-decoration: underline;
      }
      .dbd-charge {
        font-weight: 700;
        font-size: 13px;
        color: var(--st-pendiente);
      }
      .dbd-card-mobile-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .dbd-cell-strong {
        font-weight: 800;
      }
      .dbd-invoice-link {
        font-weight: 800;
        color: var(--accent);
        text-decoration: none;
      }
      .dbd-invoice-link:hover {
        text-decoration: underline;
      }
      .dbd-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .dbd-attended-time {
        font-size: 11px;
        color: var(--ink-muted);
      }
      .dbd-item-struck {
        text-decoration: line-through;
        text-decoration-color: var(--accent-ink);
        margin-right: 4px;
      }
      .dbd-row-action {
        text-align: right;
      }
      .dbd-team-row {
        cursor: pointer;
      }
      .dbd-team-row:hover {
        background: var(--faint);
      }
      .dbd-team-row-dim {
        opacity: 0.65;
      }
      .dbd-team-row-total td {
        font-weight: 800;
        border-top: var(--border-rule);
      }
      .dbd-card-mobile-click {
        cursor: pointer;
      }
      .dbd-card-mobile-click:hover {
        background: var(--faint);
      }
      .dbd-cards-mobile {
        display: none;
      }
      .dbd-tab-refresh {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        margin-left: auto;
        font-size: 18px;
        color: var(--ink-muted);
        padding: 12px 10px;
      }
      .dbd-tab-refresh:hover {
        color: var(--ink);
      }
      .dbd-tab-refresh:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .dbd-metric-click {
        cursor: pointer;
      }
      .dbd-metric-alert .dbd-metric-value {
        color: var(--accent-ink);
      }
      .dbd-ret-banner-settled {
        color: var(--success);
        font-weight: 600;
      }
      .dbd-ret-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-top: 20px;
        align-items: start;
      }
      .dbd-ret-table {
        margin-bottom: 14px;
      }
      .dbd-ret-product-link {
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font: inherit;
        font-weight: 800;
        color: var(--ink);
        text-align: left;
      }
      .dbd-ret-product-link:hover {
        color: var(--accent);
        text-decoration: underline;
      }
      .dbd-ret-bonus-tag {
        display: inline-block;
        margin-left: 6px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 700;
        color: #1d4ed8;
        background: rgba(37, 99, 235, 0.12);
      }
      .dbd-ret-row-highlight {
        background: var(--accent-wash);
      }
      .dbd-ret-invoices {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .dbd-ret-invoice {
        border: 1px solid var(--hairline);
        padding: 10px 12px;
      }
      .dbd-ret-invoice-head {
        appearance: none;
        background: none;
        border: 0;
        width: 100%;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0;
        font: inherit;
        color: var(--ink);
        text-align: left;
      }
      .dbd-ret-invoice-customer {
        flex: 1;
        color: var(--ink-muted);
        font-size: 13px;
      }
      .dbd-ret-invoice-caret {
        color: var(--ink-muted);
      }
      .dbd-ret-invoice-meta {
        margin-top: 6px;
      }
      .dbd-ret-lines {
        margin-top: 10px;
      }
      .dbd-ret-subtitle {
        margin-top: 12px;
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      @media (max-width: 767px) {
        .dbd-page {
          padding: var(--sp-4);
        }
        .dbd-ret-grid {
          grid-template-columns: 1fr;
        }
        .dbd-table-desktop {
          display: none;
        }
        .dbd-cards-mobile {
          display: grid;
          gap: 10px;
          margin-top: 12px;
        }
        .dbd-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .dbd-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .dbd-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .dbd-card-mobile-action {
          margin-top: 6px;
          width: fit-content;
        }
      }
    `,
  ],
})
export class DeliveryBatchDetailPage {
  private deliverySvc = inject(DeliveryAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  id = input('');

  protected canViewInvoice = computed(() => this.auth.hasAny('customer.view', 'invoice.reconcile'));
  protected canAssignTeam = computed(() => this.auth.hasAny('delivery.manage'));
  protected canSettlePermission = computed(() => this.auth.hasAny('delivery.settle'));

  protected dateText = dateText;
  protected dateTimeText = dateTimeText;
  protected timeText = timeText;
  protected formatSoles = formatSoles;
  protected statusName = batchStatusName;
  protected itemStatusText = itemStatusName;
  protected roleInTeamName = roleInTeamName;
  protected itemStatusOptions = ITEM_STATUS_FILTER_OPTIONS;
  protected chargeAmountTooltip = CHARGE_AMOUNT_TOOLTIP;
  protected amountToCollectTooltip = AMOUNT_TO_COLLECT_TOOLTIP;
  protected discountChargeTooltip = DISCOUNT_CHARGE_TOOLTIP;

  protected batch = signal<BatchDetail | null>(null);
  protected customers = signal<BatchCustomerView[]>([]);
  protected loading = signal(true);
  protected loadingCustomers = signal(true);
  protected error = signal(false);
  protected settling = signal(false);
  protected view = signal<'items' | 'team' | 'map' | 'returns'>('items');
  protected itemStatusFilter = signal('');
  /** '' = todos, UNATTENDED_FILTER_VALUE = sin atender, o el registeredByUserId como texto. */
  protected attendedByFilter = signal('');
  protected onlyChargeAmountItems = signal(false);

  protected returnsReport = signal<BatchReturnsReport | null>(null);
  protected loadingReturns = signal(false);
  protected errorReturns = signal(false);
  protected highlightedProductId = signal<number | null>(null);
  protected expandedInvoiceLine = signal<number | null>(null);
  protected returnInvoiceStatusName = (code: string) => RETURN_INVOICE_STATUS_NAME[code] ?? code;

  protected pendingCount = computed(
    () => this.batch()?.items.filter((i) => i.statusCode === 'PENDING').length ?? 0,
  );

  /** Comprobantes con descuento perdido — subtítulo de la tarjeta (sección 7.3). */
  protected chargedItemCount(b: BatchDetail): number {
    return b.items.filter((i) => i.chargeAmount > 0).length;
  }

  /** Filtro "Con descuento perdido" de la pestaña Devoluciones — secciones 7.3 y 11.3. */
  protected onlyChargeAmount = signal(false);

  protected openChargeAmountReturns() {
    this.onlyChargeAmount.set(true);
    this.view.set('returns');
  }

  /** Cantidad de comprobantes pendientes — lo mismo que `pendingCount`, con el nombre que usa la pestaña Equipo. */
  protected unattendedCount = this.pendingCount;

  /** Se resuelve en el panel sobre los items ya cargados — sección 10.2. */
  protected attendedByOptions = computed<UiFieldOption[]>(() => {
    const items = this.batch()?.items ?? [];
    const byId = new Map<number, string>();
    for (const i of items) {
      if (i.registeredByUserId != null && i.registeredByName) {
        byId.set(i.registeredByUserId, i.registeredByName);
      }
    }
    return [
      { value: '', label: 'Todos' },
      ...Array.from(byId, ([id, name]) => ({ value: String(id), label: name })),
      { value: UNATTENDED_FILTER_VALUE, label: 'Sin atender' },
    ];
  });

  protected filteredItems = computed(() => {
    const items = this.batch()?.items ?? [];
    const statusFilter = this.itemStatusFilter();
    const attendedFilter = this.attendedByFilter();
    const chargeOnly = this.onlyChargeAmountItems();
    return items.filter((i) => {
      if (statusFilter && i.statusCode !== statusFilter) return false;
      if (attendedFilter === UNATTENDED_FILTER_VALUE) return i.registeredByUserId == null;
      if (attendedFilter && String(i.registeredByUserId) !== attendedFilter) return false;
      if (chargeOnly && i.chargeAmount <= 0) return false;
      return true;
    });
  });

  /**
   * El backend a veces no manda itemsProgressPercentage (queda undefined);
   * en ese caso se calcula acá desde los comprobantes — los que ya no están
   * pendientes sobre el total.
   */
  protected pct(b: BatchDetail): number {
    if (Number.isFinite(b.itemsProgressPercentage)) return Math.round(b.itemsProgressPercentage);
    if (!b.items.length) return 0;
    const resolved = b.items.length - this.pendingCount();
    return Math.round((resolved / b.items.length) * 100);
  }

  // Bug real detrás de "el mapa no renderiza": los inputs ligados a la ruta
  // (withComponentInputBinding) todavía no tienen valor en el constructor —
  // Angular los setea después de instanciar el componente. Cargar ahí
  // siempre pedía id=0 y `load()` abortaba en silencio. Con `effect` se
  // dispara apenas el router setea el id real (y de nuevo si cambia).
  private loadEffect = effect(() => {
    if (this.id()) this.load();
  });

  /**
   * Devoluciones por planilla no se carga junto al resto: solo mientras la
   * pestaña está activa, y con refresco automático cada 60s salvo que la
   * planilla ya esté liquidada (sección 8.5 del doc 36).
   */
  private returnsViewEffect = effect((onCleanup) => {
    const active = this.view() === 'returns';
    const id = Number(this.id());
    if (!active || !id) return;
    this.loadReturns(id);
    const timer = setInterval(() => {
      if (this.returnsReport()?.statusCode === 'SETTLED') return;
      this.loadReturns(id, true);
    }, RETURNS_AUTO_REFRESH_MS);
    onCleanup(() => clearInterval(timer));
  });

  protected canSettle(b: BatchDetail): boolean {
    return b.statusCode !== 'SETTLED' && this.pendingCount() === 0;
  }

  load() {
    const id = Number(this.id());
    if (!id) return;
    this.loading.set(true);
    this.loadingCustomers.set(true);
    this.error.set(false);
    forkJoin({
      batch: this.deliverySvc.batchDetail(id),
      customers: this.deliverySvc.batchCustomers(id),
    }).subscribe({
      next: ({ batch, customers }) => {
        this.batch.set(batch);
        this.customers.set(customers);
        this.loading.set(false);
        this.loadingCustomers.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingCustomers.set(false);
        this.error.set(true);
      },
    });
  }

  protected openAssignTeam(b: BatchDetail) {
    this.dialog
      .open(AssignTeamDialog, { data: { batchId: b.batchId }, width: '420px' })
      .afterClosed()
      .subscribe((assigned) => {
        if (assigned) {
          this.toast.success('Equipo asignado.');
          this.load();
        }
      });
  }

  protected settle(b: BatchDetail) {
    this.dialog
      .confirm({
        title: 'Liquidar planilla',
        message: `¿Liquidar la planilla ${b.series}-${b.number}? Esta acción no se puede deshacer.`,
        confirmLabel: 'Liquidar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.settling.set(true);
        this.deliverySvc.settle(b.batchId).subscribe({
          next: () => {
            this.settling.set(false);
            this.toast.success('Planilla liquidada.');
            this.load();
          },
          error: () => this.settling.set(false),
        });
      });
  }

  protected viewReturns(item: { invoiceId: string; customerName: string }) {
    this.dialog.open(ReturnsDialog, {
      data: { invoiceId: item.invoiceId, customerName: item.customerName },
      width: '480px',
    });
  }

  /** Panel "Promociones" del comprobante — doc 53, sección 12. */
  protected openPromoInsights(item: { invoiceId: string; customerName: string }) {
    this.dialog.open<PromoInsightsDialog, PromoInsightsDialogData, void>(PromoInsightsDialog, {
      data: { invoiceId: item.invoiceId, customerName: item.customerName },
      width: '560px',
    });
  }

  /** Clic en un integrante de Equipo → Comprobantes filtrado por esa persona — sección 9.4. */
  protected openMember(m: MemberTotals) {
    this.itemStatusFilter.set('');
    this.attendedByFilter.set(String(m.userId));
    this.view.set('items');
  }

  /** Clic en "Sin atender" → Comprobantes filtrado por estado Pendiente — sección 9.4. */
  protected openUnattended() {
    this.attendedByFilter.set('');
    this.itemStatusFilter.set('PENDING');
    this.view.set('items');
  }

  /** `silent` evita parpadear el skeleton en el refresco automático de 60s. */
  protected loadReturns(id: number, silent = false) {
    if (!silent) {
      this.loadingReturns.set(true);
      this.errorReturns.set(false);
    }
    this.deliverySvc.batchReturns(id).subscribe({
      next: (report) => {
        this.returnsReport.set(report);
        this.loadingReturns.set(false);
        this.errorReturns.set(false);
      },
      error: () => {
        this.loadingReturns.set(false);
        if (!silent) this.errorReturns.set(true);
      },
    });
  }

  protected refreshReturns() {
    const id = Number(this.id());
    if (id) this.loadReturns(id);
  }

  protected returnInvoiceStatusSlug(code: string): string {
    return code === 'REJECTED' ? 'rechazado' : 'entrega parcial';
  }

  protected toggleProductHighlight(productId: number) {
    this.highlightedProductId.set(this.highlightedProductId() === productId ? null : productId);
  }

  protected toggleInvoiceExpand(lineNumber: number) {
    this.expandedInvoiceLine.set(this.expandedInvoiceLine() === lineNumber ? null : lineNumber);
  }

  /** Chip "Con descuento perdido" — doc 53, sección 11.3. */
  protected filteredInvoices(r: BatchReturnsReport): BatchReturnInvoiceView[] {
    return this.onlyChargeAmount() ? r.invoices.filter((i) => i.chargeAmount > 0) : r.invoices;
  }

  protected invoiceHasProduct(inv: BatchReturnInvoiceView, productId: number | null): boolean {
    if (productId == null) return false;
    return inv.lines.some((l) => l.productId === productId);
  }

  /** "1 paq. + 18 und." — con empaque desconocido, solo las unidades. */
  protected packageText(p: {
    fullPackages: number | null;
    looseUnits: number | null;
    returnedQuantity: number;
  }): string {
    if (p.fullPackages == null || p.looseUnits == null) return `${p.returnedQuantity} und.`;
    const parts: string[] = [];
    if (p.fullPackages > 0) parts.push(`${p.fullPackages} paq.`);
    if (p.looseUnits > 0 || parts.length === 0) parts.push(`${p.looseUnits} und.`);
    return parts.join(' + ');
  }

  /** La hoja con la que almacén recibe la mercadería — sección 8.5. */
  protected printConsolidated() {
    window.print();
  }
}
