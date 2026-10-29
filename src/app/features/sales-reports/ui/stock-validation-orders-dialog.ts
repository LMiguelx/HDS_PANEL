import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../../shared/ui/button/button';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { SalesReportAdminService } from '../sales-report-admin';
import {
  StockValidationOrderRow,
  StockValidationProductDetail,
} from '../../../shared/models/sales-report.models';
import { quantityText } from '../sales-report-format';
import { dateTimeText, timeText } from '../../assignments/assignment-format';
import { originName } from '../../orders/order-format';
import { advanceNotBackedText, panelHeadlineText } from '../stock-validation-format';

export interface StockValidationOrdersDialogData {
  productId: number;
  warehouseId: number;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Panel "Pedidos de un producto" — doc 56, sección 7. Solo consulta y
 * abrir para editar; supervisión decide qué pedido reducir, el panel no
 * sugiere nada. Cierra con `true` cuando se fue a editar un pedido, para
 * que la pantalla de origen recargue al volver.
 */
@Component({
  selector: 'app-stock-validation-orders-dialog',
  imports: [UiButton, UiEmpty],
  template: `
    <div class="svo">
      @if (loading()) {
        <div class="svo-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (forbidden()) {
        <ui-empty title="No tiene permisos para ver esta pantalla." />
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar los pedidos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (notFound()) {
        <ui-empty title="Este producto ya no tiene pedidos por facturar." />
      } @else if (detail(); as d) {
        <div class="svo-head">
          <div>
            <h2 class="svo-title">{{ d.product.productName }}</h2>
            <p class="svo-subtitle">{{ d.product.productCode }}</p>
          </div>
          <button type="button" class="svo-close" aria-label="Cerrar" (click)="ref.close()">
            ✕
          </button>
        </div>

        <p class="svo-meta">
          Stock ERP {{ d.product.erpStock != null ? quantityText(d.product.erpStock) : '—' }}
          @if (d.product.erpStockAt) {
            ({{ dateTimeText(d.product.erpStockAt) }})
          }
          · Por facturar {{ quantityText(d.product.toBillQuantity) }} · Bonif. pendiente
          {{ quantityText(d.product.pendingQuantity) }}
        </p>

        <p
          class="svo-headline"
          [class.svo-headline-shortfall]="d.product.status === 'SHORTFALL'"
          [class.svo-headline-ok]="d.product.status === 'OK'"
        >
          {{ headline() }}
        </p>
        @if (d.product.advanceNotBacked) {
          <p class="svo-advance">{{ advanceText() }}</p>
        }

        @if (d.orders.length === 0) {
          <ui-empty title="Sin pedidos" body="No hay pedidos por facturar con este producto." />
        } @else {
          <div class="svo-table-wrap">
            <table class="ui-table-grid svo-table">
              <thead>
                <tr>
                  <th>N.°</th>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Origen</th>
                  <th>Venta</th>
                  <th>Bonif.</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (o of d.orders; track o.orderId) {
                  <tr [class.svo-row-dim]="!o.editable">
                    <td class="svo-cell-strong">{{ o.orderId }}</td>
                    <td class="svo-muted">
                      {{ isToday(o.orderDate) ? timeText(o.orderDate) : 'ayer' }}
                    </td>
                    <td>{{ o.customerName }}</td>
                    <td class="svo-muted">{{ o.salespersonName }}</td>
                    <td class="svo-muted">{{ originName(o.originCode) }}</td>
                    <td class="svo-num">{{ quantityText(o.saleQuantity) }}</td>
                    <td class="svo-num">
                      @if (o.bonusQuantity > 0) {
                        {{ quantityText(o.bonusQuantity) }}
                        @if (o.pendingQuantity > 0) {
                          <span title="Pendiente de stock">⏳</span>
                        }
                      } @else {
                        —
                      }
                    </td>
                    <td class="svo-muted">{{ orderStatusText(o) }}</td>
                    <td>
                      @if (o.editable) {
                        <button uiButton variant="secondary" size="sm" (click)="editOrder(o)">
                          Editar
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .svo {
        display: grid;
        gap: 10px;
      }
      .svo-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .svo-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .svo-title {
        font-size: 18px;
        margin: 0;
        color: var(--ink);
      }
      .svo-subtitle {
        margin: 2px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .svo-close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--ink-muted);
        font-size: 16px;
        padding: 2px;
      }
      .svo-meta {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .svo-headline {
        margin: 2px 0 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--ink);
      }
      .svo-headline-shortfall {
        color: var(--st-mismatch);
      }
      .svo-headline-ok {
        color: var(--success);
      }
      .svo-advance {
        margin: 0;
        font-size: 12px;
        color: var(--st-in-route);
      }
      .svo-table-wrap {
        max-height: 55vh;
        overflow: auto;
        margin-top: 6px;
      }
      .svo-table {
        width: 100%;
      }
      .svo-row-dim {
        opacity: 0.55;
      }
      .svo-cell-strong {
        font-weight: 800;
      }
      .svo-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .svo-num {
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
    `,
  ],
})
export class StockValidationOrdersDialog {
  protected data = inject<StockValidationOrdersDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private reportSvc = inject(SalesReportAdminService);
  private router = inject(Router);

  protected quantityText = quantityText;
  protected dateTimeText = dateTimeText;
  protected timeText = timeText;
  protected originName = originName;
  protected isToday = isToday;

  protected detail = signal<StockValidationProductDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected forbidden = signal(false);
  protected notFound = signal(false);

  protected headline = computed(() => {
    const d = this.detail();
    return d ? panelHeadlineText(d.product) : '';
  });
  protected advanceText = computed(() => {
    const d = this.detail();
    return d ? advanceNotBackedText(d.product) : '';
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.forbidden.set(false);
    this.notFound.set(false);
    this.reportSvc.stockValidationOrders(this.data.productId, this.data.warehouseId).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 403) this.forbidden.set(true);
        else if (err?.status === 404) this.notFound.set(true);
        else this.error.set(true);
      },
    });
  }

  protected orderStatusText(o: StockValidationOrderRow): string {
    switch (o.statusCode) {
      case 'OPEN':
        return 'Abierto';
      case 'SENT_TO_BILLING':
        return 'Enviado';
      case 'COUNTER_DELIVERED':
        return 'Entregado en mostrador';
      default:
        return o.statusCode;
    }
  }

  protected editOrder(o: StockValidationOrderRow) {
    this.ref.close(true);
    this.router.navigate(['/pedidos/editar', o.orderId]);
  }
}
