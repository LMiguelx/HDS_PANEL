import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MoneyPipe } from '../../shared/pipes/money';
import { ToastService } from '../../core/ui/toast';
import { InvoiceService } from './invoice';
import { OrderService } from '../sales/order';
import { InvoiceDetail } from '../../shared/models/invoice.models';
import { OrderDetail, OrderSummary } from '../../shared/models/order.models';

@Component({
  selector: 'app-match-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule, MoneyPipe],
  template: `
    <h2 mat-dialog-title>Emparejar factura {{ data.invoiceId }}</h2>
    <mat-dialog-content>
      <div class="cols">
        <!-- Candidatos -->
        <div class="candidates">
          <h4>Pedidos candidatos <span class="muted">(SENT_TO_BILLING)</span></h4>
          @for (o of candidates(); track o.orderId) {
            <button
              class="cand"
              [class.sel]="selected()?.orderId === o.orderId"
              (click)="select(o)"
            >
              <span>#{{ o.orderId }}</span>
              <span class="money">{{ o.totalAmount | money }}</span>
            </button>
          } @empty {
            <p class="muted small">No hay pedidos candidatos para este cliente.</p>
          }
        </div>

        <!-- Comparación -->
        <div class="compare">
          @if (loadingSel()) {
            <mat-progress-bar mode="indeterminate" />
          } @else if (selected(); as o) {
            <div class="totals">
              <div>
                <span class="muted">Pedido #{{ o.orderId }}</span
                ><br /><strong class="money">{{ o.totalAmount | money }}</strong>
              </div>
              <div>
                <span class="muted">Factura</span><br /><strong class="money">{{
                  data.totalAmount | money
                }}</strong>
              </div>
              <div class="diff" [class.bad]="totalDiff() !== 0">
                <span class="muted">Diferencia</span><br />
                <strong class="money">{{ totalDiff() | money }}</strong>
              </div>
            </div>
            @if (totalDiff() !== 0) {
              <p class="warn">
                <mat-icon>report_problem</mat-icon> Los totales difieren: quedará como MISMATCH.
              </p>
            }
            <div class="side">
              <div>
                <h4>Ítems del pedido</h4>
                @for (it of o.items; track it.productId) {
                  <div class="li">
                    <span>{{ it.productName }}</span
                    ><span class="muted">× {{ it.quantity }} · {{ it.lineTotal | money }}</span>
                  </div>
                }
              </div>
              <div>
                <h4>Ítems de la factura</h4>
                @for (it of data.items; track it.lineNumber) {
                  <div class="li">
                    <span>{{ it.productName }}</span
                    ><span class="muted">× {{ it.quantity }} · {{ it.lineTotal | money }}</span>
                  </div>
                }
              </div>
            </div>
          } @else {
            <p class="muted">Elige un pedido de la izquierda para comparar.</p>
          }
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button
        mat-flat-button
        color="tertiary"
        [disabled]="!selected() || saving()"
        (click)="confirm()"
      >
        Emparejar
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      [mat-dialog-content] {
        min-width: min(760px, 90vw);
      }
      .cols {
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 16px;
      }
      .candidates {
        border-right: 1px solid var(--mat-sys-outline-variant);
        padding-right: 12px;
        max-height: 60vh;
        overflow: auto;
      }
      h4 {
        margin: 0 0 8px;
        font-size: 0.9rem;
      }
      .cand {
        display: flex;
        justify-content: space-between;
        width: 100%;
        border: 1px solid var(--mat-sys-outline-variant);
        background: transparent;
        border-radius: 8px;
        padding: 8px 10px;
        margin-bottom: 6px;
        cursor: pointer;
        font: inherit;
      }
      .cand.sel {
        border-color: var(--mat-sys-primary);
        background: color-mix(in srgb, var(--mat-sys-primary) 10%, transparent);
      }
      .totals {
        display: flex;
        gap: 24px;
        margin-bottom: 8px;
      }
      .diff.bad strong {
        color: var(--mat-sys-error);
      }
      .warn {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--mat-sys-error);
      }
      .warn mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .side {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-top: 8px;
      }
      .li {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .small {
        font-size: 0.82rem;
      }
    `,
  ],
})
export class MatchDialog {
  readonly data = inject<InvoiceDetail>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<MatchDialog>);
  private orders = inject(OrderService);
  private invoices = inject(InvoiceService);
  private toast = inject(ToastService);

  readonly candidates = signal<OrderSummary[]>([]);
  readonly selected = signal<OrderDetail | null>(null);
  readonly loadingSel = signal(false);
  readonly saving = signal(false);

  readonly totalDiff = computed(() => {
    const o = this.selected();
    return o ? Math.round((o.totalAmount - this.data.totalAmount) * 100) / 100 : 0;
  });

  constructor() {
    this.orders.all(0, 50, 'SENT_TO_BILLING', this.data.customerId).subscribe({
      next: (r) => this.candidates.set(r.content),
      error: () => this.candidates.set([]),
    });
  }

  select(o: OrderSummary) {
    this.loadingSel.set(true);
    this.selected.set(null);
    this.orders.detail(o.orderId).subscribe({
      next: (d) => {
        this.selected.set(d);
        this.loadingSel.set(false);
      },
      error: () => this.loadingSel.set(false),
    });
  }

  confirm() {
    const o = this.selected();
    if (!o) return;
    this.saving.set(true);
    this.invoices.match(this.data.invoiceId, { orderId: o.orderId }).subscribe({
      next: () => {
        this.toast.success(
          this.totalDiff() !== 0 ? 'Emparejada con diferencia (MISMATCH)' : 'Factura emparejada',
        );
        this.ref.close(true);
      },
      error: () => this.saving.set(false),
    });
  }
}
