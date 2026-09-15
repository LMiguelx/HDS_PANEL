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
import { ratingText } from './customer-format';
import { RatingDialog, RatingDialogData } from './ui/rating-dialog';
import { OrderAdminService } from '../orders/order-admin';
import { OrderSummary } from '../../shared/models/order.models';
import { orderStatusName, deliveryStatusName } from '../orders/order-format';
import { dateTimeText } from '../assignments/assignment-format';

/** Ficha completa del cliente — GET /api/customers/{id}. También se llega
 * acá desde el mapa de Asignaciones al clickear un punto. */
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
          <div>
            <ui-status
              [label]="c.isActive ? 'Activo' : 'Inactivo'"
              [status]="c.isActive ? 'vigente' : 'apagada'"
            />
            <h1>{{ c.businessName }}</h1>
            <p class="cd-meta">{{ c.code }} · {{ c.documentTypeName }} {{ c.documentNumber }}</p>
          </div>
          <div class="cd-actions">
            <span class="cd-rating">{{ ratingText(c.rating) }}</span>
            <button uiButton variant="secondary" (click)="rate(c)">Calificar</button>
          </div>
        </div>
        <hr class="cd-rule" />

        <div class="cd-grid">
          <div class="cd-field">
            <span class="cd-label">Tipo de cliente</span>
            <span class="cd-value">{{ c.customerTypeName || '—' }}</span>
          </div>
          <div class="cd-field">
            <span class="cd-label">Actividad</span>
            <span class="cd-value">{{ c.businessActivity || '—' }}</span>
          </div>
          <div class="cd-field">
            <span class="cd-label">Dirección</span>
            <span class="cd-value">{{ c.address || '—' }}</span>
          </div>
          <div class="cd-field">
            <span class="cd-label">Teléfono</span>
            <span class="cd-value">{{ c.phone || '—' }}</span>
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

        <h2 class="cd-section-title">Métricas de compra</h2>
        @if (!c.metrics) {
          <ui-empty title="Este cliente nunca compró" body="Todavía no hay pedidos registrados." />
        } @else {
          <div class="cd-metrics-grid">
            <div class="cd-metric">
              <span class="cd-metric-value">{{ c.metrics.ordersLast30d }}</span>
              <span class="cd-metric-label">Pedidos · 30 días</span>
            </div>
            <div class="cd-metric">
              <span class="cd-metric-value">{{ formatSoles(c.metrics.amountLast30d) }}</span>
              <span class="cd-metric-label">Monto · 30 días</span>
            </div>
            <div class="cd-metric">
              <span class="cd-metric-value">{{ c.metrics.ordersLast90d }}</span>
              <span class="cd-metric-label">Pedidos · 90 días</span>
            </div>
            <div class="cd-metric">
              <span class="cd-metric-value">{{ formatSoles(c.metrics.amountLast90d) }}</span>
              <span class="cd-metric-label">Monto · 90 días</span>
            </div>
            <div class="cd-metric">
              <span class="cd-metric-value">{{ c.metrics.ordersLast365d }}</span>
              <span class="cd-metric-label">Pedidos · 365 días</span>
            </div>
            <div class="cd-metric">
              <span class="cd-metric-value">{{ formatSoles(c.metrics.amountLast365d) }}</span>
              <span class="cd-metric-label">Monto · 365 días</span>
            </div>
            <div class="cd-metric">
              <span class="cd-metric-value">{{ c.metrics.lastPurchaseDate || '—' }}</span>
              <span class="cd-metric-label">Última compra</span>
            </div>
            <div class="cd-metric">
              <span class="cd-metric-value">{{
                c.metrics.avgDaysBetweenOrders != null
                  ? c.metrics.avgDaysBetweenOrders + ' días'
                  : '—'
              }}</span>
              <span class="cd-metric-label">Promedio entre pedidos</span>
            </div>
          </div>
        }

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
      .cd-rule {
        border: 0;
        border-top: var(--border-hair);
        margin: 20px 0;
      }
      .cd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
        gap: 20px;
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
        font-size: 15px;
        color: var(--ink);
      }
      .cd-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 32px 0 14px;
        color: var(--ink);
        border-bottom: var(--border-rule);
        padding-bottom: 8px;
      }
      .cd-metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
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
  protected dateTimeText = dateTimeText;
  protected orderStatusName = orderStatusName;
  protected deliveryStatusName = deliveryStatusName;

  protected customer = signal<CustomerDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  protected canViewOrders = computed(() => this.auth.hasAny('order.create'));
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
}
