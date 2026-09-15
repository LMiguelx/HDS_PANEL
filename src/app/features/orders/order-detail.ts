import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { AuthService } from '../../core/auth/auth';
import { OrderAdminService } from './order-admin';
import { OrderDetail, ReturnedLineView } from '../../shared/models/order.models';
import { orderStatusName, deliveryStatusName } from './order-format';
import { dateTimeText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

/** Detalle de un pedido con sus líneas (GET /orders/{id}). */
@Component({
  selector: 'app-order-detail',
  imports: [RouterLink, UiStatus, UiEmpty],
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
            <ui-status [label]="statusName(o.statusCode)" />
            <h1>Pedido #{{ o.orderId }}</h1>
            <p class="od-meta">
              @if (canViewCustomer()) {
                <a [routerLink]="['/clientes', o.customerId]" class="od-customer-link">{{
                  o.customerName
                }}</a>
              } @else {
                {{ o.customerName }}
              }
              · {{ dateTimeText(o.orderDate) }}
            </p>
          </div>
        </div>

        @if (o.note) {
          <div class="od-note">{{ o.note }}</div>
        }

        <div class="od-grid">
          <div class="od-field">
            <span class="od-label">Vendedor</span>
            <span class="od-value">Usuario #{{ o.salespersonId }}</span>
          </div>
          <div class="od-field">
            <span class="od-label">Condición de pago</span>
            <span class="od-value">#{{ o.paymentConditionId }}</span>
          </div>
          <div class="od-field">
            <span class="od-label">Total</span>
            <span class="od-value">{{ formatSoles(o.totalAmount) }}</span>
          </div>
          <div class="od-field">
            <span class="od-label">Descuento</span>
            <span class="od-value">{{ formatSoles(o.discountAmount) }}</span>
          </div>
          <div class="od-field">
            <span class="od-label">Neto a cobrar</span>
            <span class="od-value od-value-strong">{{ formatSoles(o.netAmount) }}</span>
          </div>
          @if (o.sentToBillingAt) {
            <div class="od-field">
              <span class="od-label">Enviado a facturación</span>
              <span class="od-value">{{ dateTimeText(o.sentToBillingAt) }}</span>
            </div>
          }
        </div>

        <h2 class="od-section-title">Líneas</h2>
        <table class="ui-table-grid od-table-desktop">
          <thead>
            <tr>
              <th>#</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio unit.</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (item of o.items; track item.lineNumber) {
              <tr>
                <td class="od-muted">{{ item.lineNumber }}</td>
                <td>{{ item.productName }}</td>
                <td class="od-muted">{{ item.quantity }}</td>
                <td class="od-muted">{{ formatSoles(item.unitPrice) }}</td>
                <td class="od-muted">{{ formatSoles(item.subtotal) }}</td>
                <td>
                  @if (item.bonus) {
                    <span class="od-badge">Bonificado</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="od-cards-mobile">
          @for (item of o.items; track item.lineNumber) {
            <div class="od-card-mobile">
              <div class="od-card-mobile-head">
                <span class="od-card-mobile-name">{{ item.productName }}</span>
                @if (item.bonus) {
                  <span class="od-badge">Bonificado</span>
                }
              </div>
              <div class="od-muted">
                {{ item.quantity }} × {{ formatSoles(item.unitPrice) }} =
                {{ formatSoles(item.subtotal) }}
              </div>
            </div>
          }
        </div>

        <h2 class="od-section-title">Reparto</h2>
        @if (!o.deliveryStatus) {
          <ui-empty
            title="Sin información de reparto"
            body="Este pedido todavía no tiene planilla asociada."
          />
        } @else {
          <div class="od-delivery">
            <ui-status [label]="deliveryName(o.deliveryStatus.statusCode)" />
            @if (o.deliveryStatus.returnedLines.length === 0) {
              <p class="od-muted od-delivery-note">Sin líneas devueltas.</p>
            } @else {
              <div class="od-returns">
                @for (line of o.deliveryStatus.returnedLines; track line.productId) {
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
      .od-note {
        margin-top: 14px;
        border-left: 3px solid var(--accent);
        padding: 10px 14px;
        font-size: 13px;
        color: var(--ink-muted);
        background: var(--faint);
      }
      .od-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 20px;
        margin-top: 20px;
      }
      .od-field {
        display: grid;
        gap: 4px;
      }
      .od-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .od-value {
        font-size: 15px;
        color: var(--ink);
      }
      .od-value-strong {
        font-weight: 800;
      }
      .od-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 32px 0 14px;
        color: var(--ink);
        border-bottom: var(--border-rule);
        padding-bottom: 8px;
      }
      .od-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .od-badge {
        font-size: 11px;
        font-weight: 800;
        color: var(--st-vigente);
      }
      .od-cards-mobile {
        display: none;
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
        background: var(--bg);
        padding: 8px 10px;
        font-size: 13px;
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
  private auth = inject(AuthService);

  orderId = input('', { alias: 'orderId' });

  protected statusName = orderStatusName;
  protected deliveryName = deliveryStatusName;
  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;

  protected order = signal<OrderDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  protected canViewCustomer = computed(() => this.auth.hasAny('customer.view'));

  private loadEffect = effect(() => {
    if (this.orderId()) this.load();
  });

  load() {
    const id = Number(this.orderId());
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this.orderSvc.detail(id).subscribe({
      next: (detail) => {
        this.order.set(detail);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected productName(line: ReturnedLineView): string {
    return (
      this.order()?.items.find((i) => i.productId === line.productId)?.productName ??
      `Producto #${line.productId}`
    );
  }
}
