import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiCard } from '../../shared/ui/card/card';
import { UiBadge } from '../../shared/ui/badge/badge';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { AuthService } from '../../core/auth/auth';
import { ToastService } from '../../core/ui/toast';
import { OrderAdminService } from './order-admin';
import { PromoService } from '../promos/promo';
import { CatalogLookupService } from '../catalog/catalog-lookup';
import { BillingValidationAdminService } from '../billing/billing-validation-admin';
import { OrderDetail, OrderItemView, ReturnedLineView } from '../../shared/models/order.models';
import {
  BillingIssue,
  OrderBillingValidation,
} from '../../shared/models/billing-validation.models';
import { hasRecalcFix } from '../billing/billing-validation-format';
import { ApplicationView, ChoiceOptionView, PendingChoiceView } from '../promos/promo.types';
import {
  ORDER_LINE_TYPE_COLOR_VAR,
  deliveryStatusName,
  orderLineType,
  orderLineTypeName,
  orderStatusName,
} from './order-format';
import { dateTimeText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

/** Detalle de un pedido con sus líneas (GET /orders/{id}) y sus acciones (doc 30, sección 8). */
@Component({
  selector: 'app-order-detail',
  imports: [RouterLink, UiButton, UiStatus, UiEmpty, UiCard, UiBadge, HasPermissionDirective],
  template: `
    <section class="od-page">
      @if (loading()) {
        <div class="od-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el pedido"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (order(); as o) {
        <div class="od-head">
          <div>
            <div class="od-badges">
              <ui-status [label]="statusName(o.statusCode)" />
              @if (o.originCode === 'COUNTER') {
                <span class="od-origin-tag">Mostrador</span>
              }
            </div>
            <h1>Pedido #{{ o.orderId }}</h1>
            <p class="od-meta">
              @if (canViewCustomer()) {
                <a [routerLink]="['/clientes', o.customerId]" class="od-customer-link">{{
                  o.customerName
                }}</a>
              } @else {
                {{ o.customerName }}
              }
              · {{ dateTimeText(o.orderDate) }} · Vendedor: {{ o.salespersonName }}
              @if (o.createdByName !== o.salespersonName) {
                · Registró: {{ o.createdByName }}
              }
              @if (o.salesChannelName) {
                · Canal: {{ o.salesChannelName }}
              }
            </p>
          </div>
          <div class="od-actions">
            @if (canEdit(o)) {
              <button
                uiButton
                variant="secondary"
                *hasPermission="['order.edit', 'order.manage']"
                [routerLink]="['/pedidos/editar', o.orderId]"
              >
                Editar
              </button>
            }
            @if (canDeliver(o)) {
              <button
                uiButton
                variant="secondary"
                *hasPermission="'order.manage'"
                [disabled]="blockedForClosing()"
                [title]="blockedForClosing() ? 'Resuelve lo pendiente antes de entregar' : ''"
                [loading]="delivering()"
                (click)="deliverAtCounter(o)"
              >
                Entregar en mostrador
              </button>
            }
            @if (canSendToBilling(o)) {
              <button
                uiButton
                variant="secondary"
                *hasPermission="'order.send_to_billing'"
                [disabled]="blockedForClosing()"
                [title]="blockedForClosing() ? 'Resuelve lo pendiente antes de enviarlo' : ''"
                [loading]="sendingToBilling()"
                (click)="validateAndSend(o)"
              >
                Enviar a facturación
              </button>
            }
            @if (canCancel(o)) {
              <button
                uiButton
                variant="secondary"
                *hasPermission="'order.cancel'"
                [loading]="cancelling()"
                (click)="cancelOrder(o)"
              >
                Anular
              </button>
            }
          </div>
        </div>

        @if (o.note) {
          <div class="od-note">{{ o.note }}</div>
        }

        @if (o.statusCode === 'OPEN' && pendingChoices().length > 0) {
          <div class="od-alert od-alert-warn">
            <strong>Falta elegir un premio</strong> de una promoción antes de poder entregar o
            facturar este pedido.
            @for (item of pendingChoices(); track item.promoApplicationId) {
              <div class="od-choice-card">
                <div class="od-choice-label">
                  {{ item.promoName }} — {{ item.groupLabel || 'Elige tu premio' }}
                </div>
                <div class="od-choice-options">
                  @for (opt of item.options; track opt.optionId) {
                    <button
                      type="button"
                      uiButton
                      variant="secondary"
                      size="sm"
                      [disabled]="!optionAvailable(opt) || resolvingChoice()"
                      (click)="resolveChoice(item, opt)"
                    >
                      {{ opt.displayText || opt.label }}
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
        @if (o.statusCode === 'OPEN' && stockPendingLines().length > 0) {
          <div class="od-alert od-alert-warn">
            <strong
              >Este pedido tiene {{ stockPendingLines().length }} bonificación{{
                stockPendingLines().length === 1 ? '' : 'es'
              }}
              pendiente{{ stockPendingLines().length === 1 ? '' : 's' }} de stock:</strong
            >
            no se puede enviar a facturación ni entregar en mostrador hasta resolverlas.
            <div class="od-alert-actions">
              <button
                uiButton
                variant="secondary"
                size="sm"
                [loading]="recalculating()"
                (click)="recalculateAndRevalidate(o)"
              >
                Reintentar stock
              </button>
              <button
                uiButton
                variant="ghost"
                size="sm"
                routerLink="/pedidos/bonificaciones-pendientes"
              >
                Ver bonificaciones pendientes
              </button>
            </div>
          </div>
        }

        @if (billingValidation(); as bv) {
          <div class="od-alert od-alert-warn">
            <strong>El pedido no pasó la validación de facturación.</strong>
            <div class="od-checks-row">
              @for (c of bv.checks; track c.group) {
                <span class="od-check" [class.fail]="!c.passed">
                  {{ c.passed ? '✓' : '✗' }} {{ c.groupName }}
                </span>
              }
            </div>
            @for (issue of bv.issues; track $index) {
              <div class="od-issue-row">
                • {{ issue.lineNumber != null ? 'Línea ' + issue.lineNumber + ' · ' : '' }}
                {{ issue.message }}
              </div>
            }
            @if (billingHasRecalcFix(bv)) {
              <button
                uiButton
                variant="secondary"
                size="sm"
                class="od-recalc-btn"
                [loading]="recalculating()"
                (click)="recalculateAndRevalidate(o)"
              >
                Recalcular pedido
              </button>
            }
          </div>
        }

        <div class="od-grid">
          <div class="od-main">
            <ui-card>
              <h2 class="od-section-title">Líneas</h2>
              <table class="ui-table-grid od-table-desktop">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Producto</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Precio unit.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of sortedItems(); track item.lineNumber) {
                    <tr [class.od-row-pending]="item.stockPending">
                      <td class="od-muted">{{ item.lineNumber }}</td>
                      <td>{{ item.productName }}</td>
                      <td>
                        @if (lineType(item) === 'SALE') {
                          Venta
                        } @else {
                          <span class="od-type-tag" [style.color]="typeColorVar(item)">{{
                            lineTypeName(item)
                          }}</span>
                        }
                      </td>
                      <td class="od-muted">{{ item.quantity }}</td>
                      <td class="od-muted">{{ item.bonus ? '—' : formatSoles(item.unitPrice) }}</td>
                      <td class="od-muted">{{ item.bonus ? '—' : formatSoles(item.subtotal) }}</td>
                    </tr>
                    @if (item.stockPending) {
                      <tr class="od-pending-note-row">
                        <td colspan="6" class="od-pending-note">⚠ Pendiente de stock</td>
                      </tr>
                    }
                  }
                </tbody>
              </table>

              <div class="od-cards-mobile">
                @for (item of sortedItems(); track item.lineNumber) {
                  <div class="od-card-mobile">
                    <div class="od-card-mobile-head">
                      <span class="od-card-mobile-name">{{ item.productName }}</span>
                      @if (lineType(item) !== 'SALE') {
                        <span class="od-type-tag" [style.color]="typeColorVar(item)">{{
                          lineTypeName(item)
                        }}</span>
                      }
                    </div>
                    <div class="od-muted">
                      {{ item.quantity }}
                      @if (!item.bonus) {
                        × {{ formatSoles(item.unitPrice) }} = {{ formatSoles(item.subtotal) }}
                      }
                    </div>
                    @if (item.stockPending) {
                      <div class="od-pending-note">⚠ Pendiente de stock</div>
                    }
                  </div>
                }
              </div>
            </ui-card>

            @if (applications().length > 0) {
              <ui-card>
                <h2 class="od-section-title">Promociones aplicadas</h2>
                <div class="od-promo-list">
                  @for (a of applications(); track a.promoApplicationId) {
                    <div class="od-promo-row">
                      <span class="od-promo-name">{{ a.promoName }}</span>
                      <span class="od-muted">
                        @if (a.productName) {
                          {{ a.quantity }} × {{ a.productName }}
                        } @else if (a.discountAmount) {
                          {{ formatSoles(a.discountAmount) }} de descuento
                        }
                      </span>
                    </div>
                  }
                </div>
              </ui-card>
            }

            <ui-card>
              <h2 class="od-section-title">Reparto</h2>
              <!-- El backend siempre envía deliveryStatus; sin planilla llega con statusCode null. -->
              @if (!o.deliveryStatus?.statusCode) {
                <ui-empty
                  title="Sin información de reparto"
                  body="Este pedido todavía no tiene planilla asociada."
                />
              } @else {
                <div class="od-delivery">
                  <ui-status [label]="deliveryName(o.deliveryStatus!.statusCode)" />
                  @if (o.deliveryStatus!.returnedLines.length === 0) {
                    <p class="od-muted od-delivery-note">Sin líneas devueltas.</p>
                  } @else {
                    <div class="od-returns">
                      @for (line of o.deliveryStatus!.returnedLines; track line.productId) {
                        <div class="od-return-row">
                          <span>{{ productName(line) }}</span>
                          <span class="od-muted">
                            {{ line.quantity }} unid.
                            @if (line.bonus) {
                              · Bonificado
                            }
                          </span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </ui-card>
          </div>

          <div class="od-side">
            <ui-card title="Resumen" class="od-card-stack">
              <div class="od-summary-row">
                <span>Condición de pago</span
                ><span>{{ paymentConditionName(o.paymentConditionId) }}</span>
              </div>
              <div class="od-summary-row">
                <span>Total</span><span>{{ formatSoles(o.totalAmount) }}</span>
              </div>
              <div class="od-summary-row">
                <span>Descuento</span><span>{{ formatSoles(o.discountAmount) }}</span>
              </div>
              <div class="od-summary-row od-summary-strong">
                <span>Neto a cobrar</span><span>{{ formatSoles(o.netAmount) }}</span>
              </div>
              @if (o.sentToBillingAt) {
                <div class="od-summary-row">
                  <span>Enviado a facturación</span>
                  <span>
                    {{ dateTimeText(o.sentToBillingAt) }}
                    @if (o.erpUploaded) {
                      <ui-badge tone="success">Recibido</ui-badge>
                    } @else {
                      <ui-badge tone="warning">Pendiente</ui-badge>
                    }
                  </span>
                </div>
              }
            </ui-card>

            @if (bonusLines().length > 0) {
              <ui-card title="Bonificaciones" class="od-card-stack">
                <p class="od-muted">
                  {{ bonusLines().length }} línea{{ bonusLines().length === 1 ? '' : 's' }} ·
                  {{ bonusUnits() }} unidad{{ bonusUnits() === 1 ? '' : 'es' }}
                </p>
                @if (stockPendingLines().length > 0) {
                  <button
                    uiButton
                    variant="ghost"
                    size="sm"
                    class="od-bonus-pending-link"
                    routerLink="/pedidos/bonificaciones-pendientes"
                  >
                    {{ stockPendingLines().length }} pendiente{{
                      stockPendingLines().length === 1 ? '' : 's'
                    }}
                    de stock · ver
                  </button>
                }
              </ui-card>
            }
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .od-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .od-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .od-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .od-badges {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .od-origin-tag {
        display: inline-block;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--st-counter-delivered);
        border: 1px solid var(--st-counter-delivered);
        padding: 1px 6px;
        white-space: nowrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 6px 0 4px;
        color: var(--ink);
      }
      .od-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .od-customer-link {
        color: var(--accent);
        font-weight: 800;
        text-decoration: none;
      }
      .od-customer-link:hover {
        text-decoration: underline;
      }
      .od-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .od-note {
        margin-top: 14px;
        border-left: 3px solid var(--accent);
        padding: 10px 14px;
        font-size: 13px;
        color: var(--ink-muted);
        background: var(--faint);
      }
      .od-alert {
        margin-top: 16px;
        padding: 12px 16px;
        border: 1px solid var(--st-no-purchase);
        border-radius: var(--radius-control, 0);
        font-size: 13px;
        color: var(--ink);
      }
      .od-alert-warn {
        background: color-mix(in srgb, var(--st-no-purchase) 10%, transparent);
      }
      .od-alert-actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      .od-choice-card {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px dashed var(--hairline);
      }
      .od-choice-label {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 6px;
      }
      .od-choice-options {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .od-grid {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 20px;
        margin-top: 20px;
        align-items: start;
      }
      .od-main {
        display: grid;
        gap: 20px;
        min-width: 0;
      }
      .od-side {
        display: grid;
        gap: 20px;
        position: sticky;
        top: var(--sp-6);
      }
      .od-card-stack {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .od-summary-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        color: var(--ink-muted);
      }
      .od-summary-row:last-child {
        align-items: flex-start;
      }
      .od-summary-strong {
        padding-top: 8px;
        border-top: 1px solid var(--hairline);
        font-weight: 700;
        color: var(--ink);
        font-size: 16px;
      }
      .od-bonus-pending-link {
        color: var(--st-pendiente);
        justify-content: flex-start;
        padding: 0;
      }
      .od-section-title {
        font-size: 15px;
        font-weight: 700;
        margin: 0 0 14px;
        color: var(--ink);
      }
      .od-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .od-type-tag {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .od-row-pending {
        background: color-mix(in srgb, var(--st-no-purchase) 8%, transparent);
      }
      .od-pending-note-row td {
        padding: 0 0 10px;
        border: 0;
      }
      .od-pending-note {
        font-size: 12px;
        font-weight: 700;
        color: var(--st-no-purchase);
      }
      .od-cards-mobile {
        display: none;
      }
      .od-promo-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .od-promo-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        background: var(--surface);
        padding: 8px 10px;
        font-size: 13px;
      }
      .od-promo-name {
        font-weight: 600;
      }
      .od-delivery {
        display: grid;
        gap: 10px;
      }
      .od-delivery-note {
        margin: 0;
      }
      .od-returns {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .od-return-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        background: var(--surface);
        padding: 8px 10px;
        font-size: 13px;
      }
      .od-checks-row {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin: 10px 0;
        font-size: 13px;
      }
      .od-check {
        color: var(--st-vigente);
      }
      .od-check.fail {
        color: var(--status-danger);
        font-weight: 700;
      }
      .od-issue-row {
        font-size: 13px;
        padding: 2px 0;
      }
      .od-recalc-btn {
        margin-top: 10px;
      }

      @media (max-width: 900px) {
        .od-grid {
          grid-template-columns: 1fr;
        }
        .od-side {
          position: static;
        }
      }
      @media (max-width: 767px) {
        .od-page {
          padding: var(--sp-4);
        }
        .od-table-desktop {
          display: none;
        }
        .od-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .od-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .od-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .od-card-mobile-name {
          font-weight: 800;
        }
      }
    `,
  ],
})
export class OrderDetailPage {
  private orderSvc = inject(OrderAdminService);
  private promoSvc = inject(PromoService);
  private catalogSvc = inject(CatalogLookupService);
  private billingSvc = inject(BillingValidationAdminService);
  private auth = inject(AuthService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  orderId = input<string>('');

  protected statusName = orderStatusName;
  protected deliveryName = deliveryStatusName;
  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;
  protected lineType = orderLineType;
  protected lineTypeName = (item: OrderItemView) => orderLineTypeName(orderLineType(item));
  protected typeColorVar = (item: OrderItemView) => {
    const v = ORDER_LINE_TYPE_COLOR_VAR[orderLineType(item)];
    return v ? `var(${v})` : null;
  };

  protected order = signal<OrderDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  protected pendingChoices = signal<PendingChoiceView[]>([]);
  protected applications = signal<ApplicationView[]>([]);
  protected resolvingChoice = signal(false);
  protected delivering = signal(false);
  protected sendingToBilling = signal(false);
  protected cancelling = signal(false);
  protected recalculating = signal(false);
  protected billingValidation = signal<OrderBillingValidation | null>(null);

  private paymentConditionNames = signal<Map<number, string>>(new Map());

  protected canViewCustomer = computed(() => this.auth.hasAny('customer.view'));

  /** Ventas primero, luego bonificaciones; dentro de cada grupo, por lineNumber — doc 36, sección 5.4. */
  protected sortedItems = computed(() => {
    const items = this.order()?.items ?? [];
    return [...items].sort((a, b) => {
      if (a.bonus !== b.bonus) return a.bonus ? 1 : -1;
      return a.lineNumber - b.lineNumber;
    });
  });
  protected bonusLines = computed(() => this.order()?.items.filter((i) => i.bonus) ?? []);
  protected bonusUnits = computed(() => this.bonusLines().reduce((sum, i) => sum + i.quantity, 0));
  protected stockPendingLines = computed(() => this.bonusLines().filter((i) => i.stockPending));
  protected blockedForClosing = computed(
    () => this.pendingChoices().length > 0 || this.stockPendingLines().length > 0,
  );

  private loadEffect = effect(() => {
    if (this.orderId()) this.load();
  });

  constructor() {
    this.catalogSvc.paymentConditions().subscribe((list) => {
      this.paymentConditionNames.set(new Map(list.map((p) => [p.paymentConditionId, p.name])));
    });
  }

  protected paymentConditionName(id: number): string {
    return this.paymentConditionNames().get(id) ?? '—';
  }

  load() {
    const id = Number(this.orderId());
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this.orderSvc.detail(id).subscribe({
      next: (detail) => {
        this.order.set(detail);
        this.loading.set(false);
        this.billingValidation.set(null);
        this.loadPendingChoices(detail);
        this.promoSvc
          .applicationsByOrder(id)
          .pipe(catchError(() => of([])))
          .subscribe((list) => this.applications.set(list));
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private loadPendingChoices(detail: OrderDetail) {
    if (detail.statusCode !== 'OPEN') {
      this.pendingChoices.set([]);
      return;
    }
    forkJoin({
      choices: this.promoSvc.pendingChoices().pipe(catchError(() => of([]))),
    }).subscribe(({ choices }) => {
      this.pendingChoices.set(choices.filter((c) => c.orderId === detail.orderId));
    });
  }

  protected optionAvailable(opt: ChoiceOptionView): boolean {
    return opt.availableStock == null || opt.availableStock > 0;
  }

  protected resolveChoice(item: PendingChoiceView, opt: ChoiceOptionView) {
    if (!this.optionAvailable(opt) || !opt.optionId) return;
    this.resolvingChoice.set(true);
    this.promoSvc
      .resolveChoice(item.promoApplicationId!, { chosenOptionIds: [opt.optionId] })
      .subscribe({
        next: () => {
          this.resolvingChoice.set(false);
          this.toast.success('Premio elegido.');
          this.load();
        },
        error: (err) => {
          this.resolvingChoice.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.toast.error(detalle || 'No pudimos registrar la elección.');
        },
      });
  }

  protected productName(line: ReturnedLineView): string {
    return this.order()?.items.find((i) => i.productId === line.productId)?.productName ?? '—';
  }

  protected canEdit(o: OrderDetail): boolean {
    return o.statusCode === 'OPEN';
  }

  protected canDeliver(o: OrderDetail): boolean {
    return o.statusCode === 'OPEN' && o.originCode === 'COUNTER';
  }

  protected canSendToBilling(o: OrderDetail): boolean {
    return o.statusCode === 'OPEN';
  }

  protected canCancel(o: OrderDetail): boolean {
    return o.statusCode === 'OPEN';
  }

  protected deliverAtCounter(o: OrderDetail) {
    this.dialog
      .confirm({
        title: 'Entregar en mostrador',
        message:
          '¿Confirmas que el cliente se lleva el pedido ahora? No pasará a facturación ni a reparto desde el panel.',
        confirmLabel: 'Entregar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.delivering.set(true);
        this.orderSvc.deliverAtCounter(o.orderId).subscribe({
          next: () => {
            this.delivering.set(false);
            this.toast.success('Pedido entregado en mostrador.');
            this.load();
          },
          error: (err) => {
            this.delivering.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.toast.error(detalle || 'No pudimos entregar el pedido.');
          },
        });
      });
  }

  protected billingHasRecalcFix(bv: OrderBillingValidation): boolean {
    return hasRecalcFix(bv.issues.map((i: BillingIssue) => i.code));
  }

  /** Valida antes de enviar (doc 32, sección 10.3): si falla, muestra los motivos en vez de enviar. */
  protected validateAndSend(o: OrderDetail) {
    this.sendingToBilling.set(true);
    this.billingValidation.set(null);
    this.billingSvc.validate({ orderIds: [o.orderId] }).subscribe({
      next: (result) => {
        this.sendingToBilling.set(false);
        const validation = result.orders[0];
        if (!validation || !validation.valid) {
          if (validation) this.billingValidation.set(validation);
          return;
        }
        this.dialog
          .confirm({
            title: 'Enviar a facturación',
            message: `¿Enviar el pedido ${o.orderId} a facturación? Después no se podrá editar ni anular.`,
            confirmLabel: 'Enviar',
          })
          .subscribe((confirmed) => {
            if (!confirmed) return;
            this.sendingToBilling.set(true);
            this.orderSvc.sendToBilling(o.orderId).subscribe({
              next: () => {
                this.sendingToBilling.set(false);
                this.toast.success('Pedido enviado a facturación.');
                this.load();
              },
              error: (err) => {
                this.sendingToBilling.set(false);
                const detalle = err?.error?.detail ?? err?.error?.message;
                this.toast.error(detalle || 'No pudimos enviar el pedido a facturación.');
              },
            });
          });
      },
      error: (err) => {
        this.sendingToBilling.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.toast.error(detalle || 'No pudimos validar el pedido.');
      },
    });
  }

  protected recalculateAndRevalidate(o: OrderDetail) {
    this.dialog
      .confirm({
        title: 'Recalcular pedido',
        message: `Se actualizarán los precios y las promociones del pedido ${o.orderId}, y se reintentará el stock de sus bonificaciones. Su total puede cambiar. ¿Recalcular?`,
        confirmLabel: 'Recalcular',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.recalculating.set(true);
        const catalogItems = o.items
          .filter((i) => !i.bonus)
          .map((i) => ({ productId: i.productId, newQuantity: i.quantity }));
        this.orderSvc.updateItems(o.orderId, { catalogItems, predictedItems: [] }).subscribe({
          next: () => {
            this.recalculating.set(false);
            this.toast.success('Pedido recalculado.');
            this.load();
          },
          error: (err) => {
            this.recalculating.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.toast.error(detalle || 'No pudimos recalcular el pedido.');
          },
        });
      });
  }

  protected cancelOrder(o: OrderDetail) {
    this.dialog
      .confirm({
        title: 'Anular pedido',
        message: '¿Anular este pedido? Se devolverá el stock y se revertirán las promociones.',
        confirmLabel: 'Anular',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.cancelling.set(true);
        this.orderSvc.cancel(o.orderId).subscribe({
          next: () => {
            this.cancelling.set(false);
            this.toast.success('Pedido anulado.');
            this.load();
          },
          error: (err) => {
            this.cancelling.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.toast.error(detalle || 'No pudimos anular el pedido.');
          },
        });
      });
  }
}
