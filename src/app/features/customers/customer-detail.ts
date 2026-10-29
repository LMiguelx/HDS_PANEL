import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { AuthService } from '../../core/auth/auth';
import { formatSoles } from '../../shared/pipes/money';
import { CustomerService } from './customer';
import { CustomerDetail } from '../../shared/models/customer.models';
import { initials, ratingText } from './customer-format';
import { RatingDialog, RatingDialogData } from './ui/rating-dialog';
import { CreateAssignmentDialog } from '../assignments/ui/create-assignment-dialog';
import { ScheduleDialog } from '../assignments/ui/schedule-dialog';
import {
  dateText,
  dateTimeText,
  scheduleSummaryText,
  weekdaysText,
  weeksOfCycleText,
} from '../assignments/assignment-format';
import { OrderAdminService } from '../orders/order-admin';
import { OrderSummary } from '../../shared/models/order.models';
import { orderStatusName, deliveryStatusName } from '../orders/order-format';
import { ubigeoText } from '../../shared/utils/ubigeo';

/**
 * Ficha completa del cliente — GET /api/customers/{id}, ahora con la
 * tarjeta "Vendedor asignado" (doc 33). También se llega acá desde el mapa
 * de Asignaciones al clickear un punto.
 */
@Component({
  selector: 'app-customer-detail',
  imports: [RouterLink, UiButton, UiStatus, UiEmpty],
  template: `
    <section class="cd-page">
      @if (loading()) {
        <div class="cd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el cliente"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (customer(); as c) {
        <div class="cd-head">
          <div class="cd-head-main">
            <div class="cd-avatar">{{ initials(c.businessName) }}</div>
            <div>
              <div class="cd-badges">
                <ui-status
                  [label]="c.isActive ? 'Activo' : 'Inactivo'"
                  [status]="c.isActive ? 'vigente' : 'apagada'"
                />
                @if (c.customerTypeName) {
                  <span class="cd-type-tag">{{ c.customerTypeName }}</span>
                } @else {
                  <span class="cd-type-tag cd-type-tag-warn">Sin tipo</span>
                }
              </div>
              <h1>{{ c.businessName }}</h1>
              <p class="cd-meta">
                Cód. {{ c.code }}
                @if (c.documentNumber) {
                  · {{ c.documentTypeName }} {{ c.documentNumber }}
                }
                @if (c.address) {
                  · {{ c.address }}
                }
                · {{ ubigeoText(c.ubigeo) }}
              </p>
            </div>
          </div>
          <div class="cd-actions">
            <span class="cd-rating">{{ ratingText(c.rating) }}</span>
            <button uiButton variant="secondary" (click)="rate(c)">Calificar</button>
            <button
              uiButton
              variant="secondary"
              [disabled]="c.latitude == null || c.longitude == null"
              (click)="viewMap(c)"
            >
              Ver mapa
            </button>
          </div>
        </div>

        <div class="cd-body">
          <div class="cd-left">
            <h2 class="cd-section-title">Métricas de compra</h2>
            @if (!c.metrics) {
              <ui-empty
                title="Este cliente nunca compró"
                body="Todavía no hay pedidos registrados."
              />
            } @else {
              <div class="cd-metrics-grid">
                <div class="cd-metric">
                  <span class="cd-metric-value">{{ formatSoles(c.metrics.amountLast30d) }}</span>
                  <span class="cd-metric-label"
                    >{{ c.metrics.ordersLast30d }} pedidos · 30 días</span
                  >
                </div>
                <div class="cd-metric">
                  <span class="cd-metric-value">{{ formatSoles(c.metrics.amountLast90d) }}</span>
                  <span class="cd-metric-label"
                    >{{ c.metrics.ordersLast90d }} pedidos · 90 días</span
                  >
                </div>
                <div class="cd-metric">
                  <span class="cd-metric-value">{{ formatSoles(c.metrics.amountLast365d) }}</span>
                  <span class="cd-metric-label"
                    >{{ c.metrics.ordersLast365d }} pedidos · 365 días</span
                  >
                </div>
                <div class="cd-metric">
                  <span class="cd-metric-value">{{
                    c.metrics.lastPurchaseDate || 'Sin compras'
                  }}</span>
                  <span class="cd-metric-label">
                    Última compra
                    @if (c.metrics.avgDaysBetweenOrders != null) {
                      · cada {{ c.metrics.avgDaysBetweenOrders }} días
                    }
                  </span>
                </div>
              </div>
            }

            <div class="cd-contact-strip">
              <div class="cd-field">
                <span class="cd-label">Teléfono</span>
                <span class="cd-value">{{ c.phone || '—' }}</span>
              </div>
              <div class="cd-field">
                <span class="cd-label">Actividad</span>
                <span class="cd-value">{{ c.businessActivity || '—' }}</span>
              </div>
              <div class="cd-field">
                <span class="cd-label">Ubicación</span>
                <span class="cd-value">{{
                  c.latitude != null && c.longitude != null ? 'Con GPS' : 'Sin GPS'
                }}</span>
              </div>
              <div class="cd-field">
                <span class="cd-label">Crédito usado</span>
                <span class="cd-value">{{ formatSoles(c.creditUsed) }}</span>
              </div>
            </div>

            @if (canViewOrders()) {
              <h2 class="cd-section-title">Pedidos recientes</h2>
              @if (ordersLoading()) {
                <div class="cd-orders-skeleton" role="status" aria-label="Cargando"></div>
              } @else if (orders().length === 0) {
                <ui-empty
                  title="Sin pedidos"
                  body="Este cliente todavía no tiene pedidos registrados."
                />
              } @else {
                <div class="cd-orders-list">
                  @for (o of orders(); track o.orderId) {
                    <a [routerLink]="['/pedidos/detalle', o.orderId]" class="cd-order-row">
                      <div>
                        <span class="cd-order-date">{{ dateTimeText(o.orderDate) }}</span>
                        <ui-status [label]="orderStatusName(o.statusCode)" />
                        @if (o.deliveryStatusCode) {
                          <ui-status [label]="deliveryStatusName(o.deliveryStatusCode)" />
                        }
                      </div>
                      <span class="cd-order-amount">{{ formatSoles(o.netAmount) }}</span>
                    </a>
                  }
                </div>
              }
            }
          </div>

          <div class="cd-right">
            <div class="cd-vendor-card">
              <div class="cd-vendor-head">
                <span class="cd-vendor-title">Vendedor asignado</span>
                @if (canAssign() && c.salesAssignment) {
                  <button type="button" class="cd-vendor-link" (click)="changeVendor(c)">
                    Cambiar
                  </button>
                }
              </div>

              @if (c.salesAssignment; as sa) {
                <div class="cd-vendor-body">
                  <div class="cd-vendor-person">
                    <div class="cd-vendor-avatar">{{ initials(sa.salespersonName) }}</div>
                    <div>
                      <div class="cd-vendor-name">{{ sa.salespersonName }}</div>
                      <div class="cd-muted">
                        Cód. {{ sa.salespersonCode }} · desde {{ dateText(sa.effectiveFrom) }}
                      </div>
                    </div>
                  </div>
                  <hr class="cd-vendor-rule" />
                  @if (sa.weekdays.length && sa.weeksOfCycle.length) {
                    <div class="cd-schedule-row">
                      <span class="cd-label">Días</span>
                      <div class="cd-chips">
                        @for (day of weekdayChips; track day.value) {
                          <span class="cd-chip" [class.on]="sa.weekdays.includes(day.value)">{{
                            day.label
                          }}</span>
                        }
                      </div>
                    </div>
                    <div class="cd-schedule-row">
                      <span class="cd-label">Semanas</span>
                      <div class="cd-chips">
                        @for (week of cycleWeeks; track week) {
                          <span class="cd-chip" [class.on]="sa.weeksOfCycle.includes(week)"
                            >S{{ week }}</span
                          >
                        }
                      </div>
                    </div>
                    <p class="cd-schedule-summary">
                      {{ scheduleSummaryText(sa.weekdays, sa.weeksOfCycle) }}
                    </p>
                    @if (canAssign()) {
                      <button
                        type="button"
                        class="cd-vendor-link cd-vendor-link-block"
                        (click)="editSchedule(c)"
                      >
                        Editar horario
                      </button>
                    }
                  } @else {
                    <p class="cd-schedule-warn">
                      ▲ Horario incompleto: no aparece en el plan del vendedor
                    </p>
                    <p class="cd-muted">
                      {{ weekdaysText(sa.weekdays) }} · {{ weeksOfCycleText(sa.weeksOfCycle) }}
                    </p>
                    @if (canAssign()) {
                      <button uiButton variant="secondary" (click)="editSchedule(c)">
                        Completar horario
                      </button>
                    }
                  }
                </div>
              } @else {
                <p class="cd-muted">Este cliente no tiene vendedor asignado.</p>
                @if (canAssign()) {
                  <button uiButton variant="primary" (click)="changeVendor(c)">
                    Asignar vendedor
                  </button>
                }
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .cd-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .cd-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .cd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
        padding-bottom: 20px;
        border-bottom: var(--border-rule);
      }
      .cd-head-main {
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }
      .cd-avatar {
        flex: none;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--accent);
        color: var(--on-accent);
        font-weight: 800;
        font-size: 18px;
      }
      .cd-badges {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .cd-type-tag {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-muted);
        border: 1px solid var(--divider);
        padding: 1px 6px;
      }
      .cd-type-tag-warn {
        color: var(--st-pendiente);
        border-color: var(--st-pendiente);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 6px 0 4px;
        color: var(--ink);
      }
      .cd-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .cd-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .cd-rating {
        font-size: 14px;
        color: var(--ink);
      }
      .cd-body {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 28px;
        margin-top: 24px;
        align-items: start;
      }
      .cd-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 28px 0 14px;
        color: var(--ink);
        border-bottom: var(--border-rule);
        padding-bottom: 8px;
      }
      .cd-section-title:first-child {
        margin-top: 0;
      }
      .cd-metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 16px;
      }
      .cd-metric {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
      }
      .cd-metric-value {
        display: block;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .cd-metric-label {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .cd-contact-strip {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
        gap: 16px;
        margin-top: 20px;
        padding: 16px;
        border: 1px solid var(--hairline);
        background: var(--faint);
      }
      .cd-field {
        display: grid;
        gap: 4px;
      }
      .cd-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .cd-value {
        font-size: 14px;
        color: var(--ink);
      }
      .cd-orders-skeleton {
        height: 120px;
        background: var(--faint);
      }
      .cd-orders-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .cd-order-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: var(--bg);
        padding: 10px 14px;
        text-decoration: none;
        color: var(--ink);
      }
      .cd-order-row:hover {
        background: var(--faint);
      }
      .cd-order-row > div {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .cd-order-date {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .cd-order-amount {
        font-weight: 800;
        font-size: 14px;
      }
      .cd-muted {
        color: var(--ink-muted);
        font-size: 13px;
        margin: 0;
      }

      .cd-vendor-card {
        border: 2px solid var(--divider);
        padding: 18px;
      }
      .cd-vendor-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .cd-vendor-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        color: var(--ink);
      }
      .cd-vendor-link {
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        color: var(--accent-ink);
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 0;
      }
      .cd-vendor-link:hover {
        text-decoration: underline;
      }
      .cd-vendor-link-block {
        display: block;
        margin-top: 12px;
      }
      .cd-vendor-body {
        margin-top: 14px;
      }
      .cd-vendor-person {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .cd-vendor-avatar {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--faint);
        color: var(--ink);
        font-weight: 800;
        font-size: 14px;
      }
      .cd-vendor-name {
        font-weight: 800;
        font-size: 15px;
        color: var(--ink);
      }
      .cd-vendor-rule {
        border: 0;
        border-top: var(--border-hair);
        margin: 14px 0;
      }
      .cd-schedule-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      .cd-schedule-row .cd-label {
        width: 56px;
        flex: none;
      }
      .cd-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .cd-chip {
        font-size: 11px;
        font-weight: 800;
        padding: 3px 8px;
        border: 1px solid var(--divider);
        color: var(--ink-muted);
      }
      .cd-chip.on {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--on-accent);
      }
      .cd-schedule-summary {
        margin: 10px 0 0;
        font-size: 13px;
        color: var(--ink);
      }
      .cd-schedule-warn {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 700;
        color: var(--st-pendiente);
      }

      @media (max-width: 900px) {
        .cd-body {
          grid-template-columns: 1fr;
        }
        .cd-right {
          order: -1;
        }
      }

      @media (max-width: 767px) {
        .cd-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class CustomerDetailPage {
  private customerSvc = inject(CustomerService);
  private orderSvc = inject(OrderAdminService);
  private dialog = inject(UiDialogService);
  private auth = inject(AuthService);

  id = input('');

  protected formatSoles = formatSoles;
  protected ratingText = ratingText;
  protected initials = initials;
  protected ubigeoText = ubigeoText;
  protected dateText = dateText;
  protected dateTimeText = dateTimeText;
  protected weekdaysText = weekdaysText;
  protected weeksOfCycleText = weeksOfCycleText;
  protected scheduleSummaryText = scheduleSummaryText;
  protected orderStatusName = orderStatusName;
  protected deliveryStatusName = deliveryStatusName;

  protected weekdayChips = [
    { value: 1, label: 'L' },
    { value: 2, label: 'M' },
    { value: 3, label: 'M' },
    { value: 4, label: 'J' },
    { value: 5, label: 'V' },
    { value: 6, label: 'S' },
    { value: 7, label: 'D' },
  ];
  protected cycleWeeks = [1, 2, 3, 4];

  protected customer = signal<CustomerDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  protected canViewOrders = computed(() => this.auth.hasAny('order.create', 'order.view_all'));
  protected canAssign = computed(() => this.auth.hasAny('customer.assign'));
  protected orders = signal<OrderSummary[]>([]);
  protected ordersLoading = signal(true);

  private loadEffect = effect(() => {
    const id = this.id();
    if (id) this.load();
  });

  load() {
    const id = Number(this.id());
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this.customerSvc.detail(id).subscribe({
      next: (detail) => {
        this.customer.set(detail);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });

    if (this.canViewOrders()) {
      this.ordersLoading.set(true);
      this.orderSvc.byCustomer(id, { size: 10 }).subscribe({
        next: (result) => {
          this.orders.set(result.content ?? []);
          this.ordersLoading.set(false);
        },
        error: () => this.ordersLoading.set(false),
      });
    }
  }

  protected rate(c: CustomerDetail) {
    this.dialog
      .open<RatingDialog, RatingDialogData, CustomerDetail | false>(RatingDialog, {
        data: { customerId: c.customerId, businessName: c.businessName, currentRating: c.rating },
        width: '360px',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.customer.set(result);
      });
  }

  protected viewMap(c: CustomerDetail) {
    if (c.latitude == null || c.longitude == null) return;
    window.open(`https://www.google.com/maps?q=${c.latitude},${c.longitude}`, '_blank', 'noopener');
  }

  protected changeVendor(c: CustomerDetail) {
    this.dialog
      .open(CreateAssignmentDialog, {
        data: { fixedCustomer: { id: c.customerId, name: c.businessName, code: c.code } },
        width: '520px',
      })
      .afterClosed()
      .subscribe((saved) => saved && this.load());
  }

  protected editSchedule(c: CustomerDetail) {
    const sa = c.salesAssignment;
    if (!sa) return;
    this.dialog
      .open(ScheduleDialog, {
        data: {
          assignmentId: sa.assignmentId,
          customerName: c.businessName,
          vendorLabel: `${sa.salespersonCode} ${sa.salespersonName}`,
          weekdays: sa.weekdays,
          weeksOfCycle: sa.weeksOfCycle,
        },
        width: '480px',
      })
      .afterClosed()
      .subscribe((saved) => saved && this.load());
  }
}
