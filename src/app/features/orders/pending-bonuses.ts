import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiCard } from '../../shared/ui/card/card';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { OrderModuleTabs } from './ui/module-tabs';
import { OrderAdminService } from './order-admin';
import { PendingBonusOrderView } from '../../shared/models/order.models';
import { dateTimeText } from '../assignments/assignment-format';

/** Pedidos OPEN con bonificaciones sin stock respaldado (GET /orders/pending-bonuses). */
@Component({
  selector: 'app-pending-bonuses',
  imports: [RouterLink, UiButton, UiCard, UiEmpty, OrderModuleTabs],
  template: `
    <app-order-module-tabs />
    <section class="pb-page">
      <div class="pb-head">
        <h1>Bonificaciones pendientes</h1>
        <p class="pb-sub">{{ countText() }}</p>
      </div>

      @if (loading()) {
        <div class="pb-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las bonificaciones pendientes"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (orders().length === 0) {
        <ui-empty
          variant="al-dia"
          eyebrow="Al día"
          title="Sin bonificaciones pendientes"
          body="Todos los pedidos abiertos tienen sus bonificaciones respaldadas por stock."
        />
      } @else {
        <div class="pb-grid">
          @for (o of orders(); track o.orderId) {
            <ui-card variant="work">
              <div class="pb-card-head">
                <div>
                  <div class="pb-card-customer">{{ o.customerName }}</div>
                  <div class="pb-card-meta">
                    Pedido #{{ o.orderId }} · {{ dateTimeText(o.orderDate) }}
                  </div>
                </div>
                <button
                  uiButton
                  variant="ghost"
                  size="sm"
                  [routerLink]="['/pedidos/detalle', o.orderId]"
                >
                  Ver pedido
                </button>
              </div>
              <div class="pb-lines">
                @for (line of o.pendingLines; track line.lineNumber) {
                  <div class="pb-line-row">
                    <span>{{ line.productName }}</span>
                    <span class="pb-muted">{{ line.quantity }} unid.</span>
                  </div>
                }
              </div>
            </ui-card>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .pb-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .pb-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .pb-skeleton {
        height: 200px;
        background: var(--faint);
        margin-top: 20px;
      }
      .pb-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr));
        gap: 18px;
        margin-top: 20px;
      }
      .pb-card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .pb-card-customer {
        font-weight: 800;
        font-size: 16px;
        color: var(--ink);
      }
      .pb-card-meta {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .pb-lines {
        margin-top: 12px;
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .pb-line-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        background: var(--bg);
        padding: 8px 10px;
        font-size: 13px;
      }
      .pb-muted {
        color: var(--ink-muted);
      }

      @media (max-width: 767px) {
        .pb-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class PendingBonusesPage {
  private orderSvc = inject(OrderAdminService);

  protected dateTimeText = dateTimeText;

  protected orders = signal<PendingBonusOrderView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.orders().length;
    if (n === 0) return 'Sin pendientes.';
    return n === 1
      ? '1 pedido con bonificaciones pendientes'
      : `${n} pedidos con bonificaciones pendientes`;
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.orderSvc.pendingBonuses().subscribe({
      next: (list) => {
        this.orders.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
}
