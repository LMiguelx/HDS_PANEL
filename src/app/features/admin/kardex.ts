import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { ProductPickerDialog } from '../promos/product-picker-dialog';
import { InventoryService } from './inventory';
import { AdjustmentDialog } from './adjustment-dialog';
import { KardexResponse } from '../../shared/models/inventory.models';
import { Product } from '../../shared/models/catalog.models';

const MOVEMENT_LABELS: Record<string, string> = {
  SALE_PROMISE: 'Promesa de venta',
  INVOICE_SYNC: 'Sinc. factura',
  RETURN: 'Devolución',
  BONUS_OUT: 'Salida de bono',
  BONUS_SUBSTITUTION: 'Sustitución de bono',
  MANUAL_ADJUSTMENT: 'Ajuste manual',
  ERP_SYNC: 'Sinc. ERP',
};

@Component({
  selector: 'app-kardex',
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    PageHeaderComponent,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <app-page-header title="Inventario" subtitle="Kardex referencial por producto">
        @if (kardex()) {
          <button
            *hasPermission="'config.edit'"
            mat-flat-button
            color="tertiary"
            (click)="adjust()"
          >
            <mat-icon>tune</mat-icon> Ajuste manual
          </button>
        }
      </app-page-header>

      <mat-card class="card">
        <div class="pick">
          <button mat-stroked-button (click)="pickProduct()">
            <mat-icon>inventory_2</mat-icon> {{ productName() || 'Elegir producto' }}
          </button>
        </div>
        <p class="muted small">
          Stock <strong>referencial</strong> — el inventario oficial está en el ERP.
        </p>
      </mat-card>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (kardex(); as k) {
        <mat-card class="card stock">
          <div>
            <span class="muted">Stock referencial</span>
            <div class="big" [class.neg]="k.referenceStock < 0">{{ k.referenceStock }}</div>
          </div>
          <div class="pname">{{ k.productName }}</div>
        </mat-card>

        <mat-card class="card">
          <h3>Movimientos</h3>
          <div class="table">
            <div class="mrow head">
              <span>Fecha</span><span>Tipo</span><span>Cant.</span><span>Almacén</span
              ><span>Referencia</span><span>Nota</span>
            </div>
            @for (m of k.movements.content; track m.stockMovementId) {
              <div class="mrow">
                <span class="muted">{{ m.createdAt | date: 'dd/MM/yy HH:mm' }}</span>
                <span class="tag">{{ typeLabel(m.movementTypeCode) }}</span>
                <span class="num" [class.pos]="m.quantity > 0" [class.neg]="m.quantity < 0"
                  >{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}</span
                >
                <span class="muted">{{ m.warehouseName }}</span>
                <span class="muted small"
                  >{{ m.referenceTable }}{{ m.referenceId ? '#' + m.referenceId : '' }}</span
                >
                <span class="muted small">{{ m.note }}</span>
              </div>
            } @empty {
              <p class="muted">Sin movimientos.</p>
            }
          </div>

          @if (k.movements.totalPages > 1) {
            <div class="pager">
              <button mat-icon-button [disabled]="page() === 0" (click)="go(page() - 1)">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <span class="muted">Página {{ page() + 1 }} de {{ k.movements.totalPages }}</span>
              <button
                mat-icon-button
                [disabled]="page() + 1 >= k.movements.totalPages"
                (click)="go(page() + 1)"
              >
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          }
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .card {
        padding: 20px;
        margin-bottom: 16px;
        max-width: 920px;
      }
      .pick {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .small {
        font-size: 0.82rem;
      }
      .stock {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .big {
        font-size: 2.4rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .big.neg {
        color: var(--mat-sys-error);
      }
      .pname {
        color: var(--mat-sys-on-surface-variant);
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .table {
        display: flex;
        flex-direction: column;
      }
      .mrow {
        display: grid;
        grid-template-columns: 130px 150px 70px 1fr 1fr 1fr;
        gap: 8px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .mrow.head {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.8rem;
        border-bottom: 2px solid var(--mat-sys-outline-variant);
      }
      .tag {
        font-size: 0.74rem;
        background: var(--mat-sys-surface-container-high);
        padding: 2px 8px;
        border-radius: 999px;
        width: fit-content;
      }
      .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
      .num.pos {
        color: var(--st-delivered);
      }
      .num.neg {
        color: var(--mat-sys-error);
      }
      .pager {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 8px;
      }
    `,
  ],
})
export class KardexPage {
  private inventory = inject(InventoryService);
  private dialog = inject(MatDialog);

  readonly productId = signal<number | null>(null);
  readonly productName = signal('');
  readonly page = signal(0);
  readonly loading = signal(false);
  readonly kardex = signal<KardexResponse | null>(null);

  typeLabel(code: string) {
    return MOVEMENT_LABELS[code] ?? code;
  }

  pickProduct() {
    this.dialog
      .open(ProductPickerDialog, { width: '460px' })
      .afterClosed()
      .subscribe((p?: Product) => {
        if (!p) return;
        this.productId.set(p.productId);
        this.productName.set(p.name);
        this.page.set(0);
        this.load();
      });
  }

  go(page: number) {
    this.page.set(page);
    this.load();
  }

  adjust() {
    const id = this.productId();
    if (!id) return;
    this.dialog
      .open(AdjustmentDialog, {
        width: '460px',
        data: { productId: id, productName: this.productName() },
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.load();
      });
  }

  private load() {
    const id = this.productId();
    if (!id) return;
    this.loading.set(true);
    this.inventory.kardex(id, this.page(), 20).subscribe({
      next: (k) => {
        this.kardex.set(k);
        this.loading.set(false);
      },
      error: () => {
        this.kardex.set(null);
        this.loading.set(false);
      },
    });
  }
}
