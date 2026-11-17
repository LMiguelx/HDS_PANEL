import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../../shared/ui/button/button';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { HasPermissionDirective } from '../../../shared/directives/has-permission';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { SalesReportAdminService } from '../sales-report-admin';
import {
  OrderWithoutErpRow,
  OrdersWithoutErpReport,
} from '../../../shared/models/sales-report.models';
import { formatSoles } from '../../../shared/pipes/money';
import { orderStatusName } from '../../orders/order-format';
import { shortDateTimeText } from '../stock-validation-format';

export interface OrdersWithoutErpDialogData {
  warehouseId: number;
}

/**
 * "Pedidos sin respuesta del ERP" — doc 87, sección 4.3: aviso "Ver" de la
 * franja de Validación de stock. Solo consulta; cada fila abre el pedido.
 */
@Component({
  selector: 'app-orders-without-erp-dialog',
  imports: [UiButton, UiModal, UiEmpty, HasPermissionDirective],
  template: `
    <ui-modal
      title="Pedidos sin respuesta del ERP"
      [subtitle]="subtitle()"
      [wide]="true"
      (close)="ref.close()"
    >
      @if (loading()) {
        <div class="owe-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar los pedidos"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (report(); as r) {
        @if (r.orders.length === 0) {
          <ui-empty
            variant="al-dia"
            eyebrow="Al día"
            title="No hay pedidos sin respuesta del ERP en los últimos 31 días."
          />
        } @else {
          <p class="owe-count">{{ countText() }}</p>
          <div class="owe-table-wrap">
            <table class="ui-table-grid owe-table">
              <thead>
                <tr>
                  <th>N.°</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Monto</th>
                  <th *hasPermission="'order.view_all'"></th>
                </tr>
              </thead>
              <tbody>
                @for (o of r.orders; track o.orderId) {
                  <tr>
                    <td class="owe-cell-strong">{{ o.orderId }}</td>
                    <td class="owe-muted">{{ shortDateTimeText(o.orderDate) }}</td>
                    <td class="owe-muted">{{ orderStatusName(o.statusCode) }}</td>
                    <td>{{ o.customerName }}</td>
                    <td class="owe-muted">{{ o.salespersonName }}</td>
                    <td class="owe-num">{{ formatSoles(o.netAmount) }}</td>
                    <td *hasPermission="'order.view_all'">
                      <button uiButton variant="ghost" size="sm" (click)="openOrder(o)">Ver</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (r.total > r.limit) {
            <p class="owe-footnote">
              Mostrando {{ r.limit }} de {{ r.total }}. Revise en el listado de pedidos con fecha.
            </p>
          }
        }
      }
    </ui-modal>
  `,
  styles: [
    `
      .owe-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .owe-count {
        margin: 0 0 10px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .owe-table-wrap {
        max-height: 55vh;
        overflow: auto;
      }
      .owe-table {
        width: 100%;
      }
      .owe-cell-strong {
        font-weight: 800;
      }
      .owe-muted {
        color: var(--ink-muted);
        font-size: 13px;
        white-space: nowrap;
      }
      .owe-num {
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .owe-footnote {
        margin: 12px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
    `,
  ],
})
export class OrdersWithoutErpDialog {
  protected data = inject<OrdersWithoutErpDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<void>);
  private reportSvc = inject(SalesReportAdminService);
  private router = inject(Router);

  protected formatSoles = formatSoles;
  protected orderStatusName = orderStatusName;
  protected shortDateTimeText = shortDateTimeText;

  protected report = signal<OrdersWithoutErpReport | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  protected subtitle = computed(() => {
    const r = this.report();
    if (!r) return '';
    return `Enviados antes del ${shortDateTimeText(r.windowStart)} que el ERP no facturó. Ya no ocupan stock.`;
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.reportSvc.ordersWithoutErp(this.data.warehouseId).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected countText(): string {
    const r = this.report();
    if (!r || r.orders.length === 0) return '';
    const oldest = r.orders[r.orders.length - 1]?.orderDate;
    return oldest
      ? `${r.total} pedido${r.total === 1 ? '' : 's'} · desde el ${shortDateTimeText(oldest).slice(0, 5)}`
      : `${r.total} pedido${r.total === 1 ? '' : 's'}`;
  }

  protected openOrder(o: OrderWithoutErpRow) {
    this.ref.close();
    this.router.navigate(['/pedidos/detalle', o.orderId]);
  }
}
