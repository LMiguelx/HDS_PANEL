import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { MoneyPipe } from '../../shared/pipes/money';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { statusLabel } from '../../shared/ui/status';
import { ToastService } from '../../core/ui/toast';
import { OrderService } from './order';
import { OrderDetail } from '../../shared/models/order.models';

@Component({
  selector: 'app-order-detail',
  imports: [
    DatePipe,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeaderComponent,
    MoneyPipe,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <app-page-header
        [title]="'Pedido #' + (order()?.orderId ?? id())"
        [subtitle]="order()?.customerName ?? ''"
      >
        <a mat-stroked-button routerLink="/pedidos"><mat-icon>arrow_back</mat-icon> Volver</a>
        @if (order()?.statusCode === 'OPEN') {
          <button
            *hasPermission="'order.send_to_billing'"
            mat-flat-button
            color="tertiary"
            (click)="sendToBilling()"
          >
            <mat-icon>send</mat-icon> Enviar a facturación
          </button>
        }
        @if (order() && order()?.statusCode !== 'CANCELLED') {
          <button *hasPermission="'order.cancel'" mat-stroked-button (click)="cancelOrder()">
            <mat-icon>cancel</mat-icon> Cancelar
          </button>
        }
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (order(); as o) {
        <mat-card class="card">
          <div class="head">
            <div>
              <span class="muted">Estado</span><br />
              <span class="status-chip" [attr.data-status]="o.statusCode">{{
                label(o.statusCode)
              }}</span>
            </div>
            <div>
              <span class="muted">Fecha</span><br />{{ o.orderDate | date: 'dd/MM/yyyy HH:mm' }}
            </div>
            <div>
              <span class="muted">Total</span><br /><strong class="money">{{
                o.totalAmount | money
              }}</strong>
            </div>
            @if (o.promoDiscountTotal) {
              <div>
                <span class="muted">Descuento promos</span><br />{{ o.promoDiscountTotal | money }}
              </div>
            }
            @if (o.paymentConditionName) {
              <div><span class="muted">Condición</span><br />{{ o.paymentConditionName }}</div>
            }
          </div>
          @if (o.note) {
            <p class="note"><span class="muted">Nota:</span> {{ o.note }}</p>
          }
        </mat-card>

        <mat-card class="card">
          <h3>Líneas</h3>
          <table mat-table [dataSource]="o.items">
            <ng-container matColumnDef="productName">
              <th mat-header-cell *matHeaderCellDef>Producto</th>
              <td mat-cell *matCellDef="let it">{{ it.productName }}</td>
            </ng-container>
            <ng-container matColumnDef="quantity">
              <th mat-header-cell *matHeaderCellDef style="text-align:end">Cant.</th>
              <td mat-cell *matCellDef="let it" style="text-align:end">{{ it.quantity }}</td>
            </ng-container>
            <ng-container matColumnDef="unitPrice">
              <th mat-header-cell *matHeaderCellDef style="text-align:end">P. Unit</th>
              <td mat-cell *matCellDef="let it" style="text-align:end" class="money">
                {{ it.unitPrice | money }}
              </td>
            </ng-container>
            <ng-container matColumnDef="lineTotal">
              <th mat-header-cell *matHeaderCellDef style="text-align:end">Total</th>
              <td mat-cell *matCellDef="let it" style="text-align:end" class="money">
                {{ it.lineTotal | money }}
              </td>
            </ng-container>
            <ng-container matColumnDef="bonus">
              <th mat-header-cell *matHeaderCellDef>Tipo</th>
              <td mat-cell *matCellDef="let it">
                @if (it.bonus) {
                  <span class="status-chip" data-status="DELIVERED">Bonificado</span>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="itemCols"></tr>
            <tr mat-row *matRowDef="let row; columns: itemCols" [class.bonus-row]="row.bonus"></tr>
          </table>
        </mat-card>
      } @else {
        <p class="muted">No se encontró el pedido.</p>
      }
    </div>
  `,
  styles: [
    `
      .card {
        padding: 20px;
        margin-bottom: 16px;
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
      }
      .note {
        margin: 12px 0 0;
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      table {
        width: 100%;
      }
      .bonus-row td {
        background: color-mix(in srgb, var(--st-delivered) 10%, transparent);
      }
    `,
  ],
})
export class OrderDetailPage {
  private orders = inject(OrderService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly id = input.required<string>();

  readonly loading = signal(true);
  readonly order = signal<OrderDetail | null>(null);
  readonly itemCols = ['productName', 'quantity', 'unitPrice', 'lineTotal', 'bonus'];

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.load(id));
    });
  }

  label(code: string) {
    return statusLabel(code);
  }

  sendToBilling() {
    const o = this.order();
    if (!o) return;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Enviar a facturación',
          message: `Pedido #${o.orderId} pasará a SENT_TO_BILLING.`,
          confirmText: 'Enviar',
        },
        width: '380px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.orders.sendToBilling(o.orderId).subscribe(() => {
          this.toast.success('Enviado a facturación');
          this.load(o.orderId);
        });
      });
  }

  cancelOrder() {
    const o = this.order();
    if (!o) return;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Cancelar pedido',
          message: `Se cancelará el pedido #${o.orderId}.`,
          confirmText: 'Cancelar pedido',
          danger: true,
        },
        width: '380px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.orders.cancel(o.orderId).subscribe(() => {
          this.toast.success('Pedido cancelado');
          this.load(o.orderId);
        });
      });
  }

  private load(id: number) {
    this.loading.set(true);
    this.order.set(null);
    this.orders.detail(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
