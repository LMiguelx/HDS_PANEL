import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { MoneyPipe } from '../../shared/pipes/money';
import { ToastService } from '../../core/ui/toast';
import { PriceAdminService } from './price-admin';
import { CatalogService } from '../sales/catalog';
import { ProductPickerDialog } from '../promos/product-picker-dialog';
import { Product, PaymentCondition } from '../../shared/models/catalog.models';
import { UpsertPriceCommand } from '../../shared/models/price.models';

let SEQ = 0;
interface PriceDraft {
  uid: number;
  priceId?: number;
  paymentConditionId: number | null;
  paymentConditionName?: string | null;
  customerTypeId: number | null;
  customerTypeName?: string | null;
  minQuantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-prices',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    HasPermissionDirective,
    MoneyPipe,
  ],
  template: `
    <div class="page">
      <app-page-header title="Precios" subtitle="Escalones por volumen, por producto"></app-page-header>

      <mat-card class="card">
        <div class="pick">
          <button mat-stroked-button (click)="pickProduct()">
            <mat-icon>inventory_2</mat-icon>
            {{ productName() || 'Elegir producto' }}
          </button>
          @if (productId()) {
            <span class="muted">Producto #{{ productId() }}</span>
          }
        </div>
        <p class="muted small">
          La resolución toma la fila con el <strong>mayor "cant. mínima" que no supere</strong> la
          cantidad pedida. Ej.: 1+ a S/4.00, 12+ a S/3.50, 24+ a S/3.20.
        </p>
      </mat-card>

      @if (productId()) {
        <mat-card class="card">
          <h3>Escalones</h3>
          <div class="grid head">
            <span>Cond. pago</span><span>Tipo cliente</span><span>Cant. mín.</span
          ><span>Precio</span><span></span>
          </div>
          @for (r of rows(); track r.uid) {
            <div class="grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-select
                  [value]="r.paymentConditionId"
                  (valueChange)="update(r.uid, { paymentConditionId: $event })"
                >
                  @for (pc of paymentConditions(); track pc.paymentConditionId) {
                    <mat-option [value]="pc.paymentConditionId">{{ pc.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <input
                  matInput
                  type="number"
                  [value]="r.customerTypeId ?? ''"
                  [placeholder]="r.customerTypeName ?? 'id'"
                  (input)="update(r.uid, { customerTypeId: +$any($event.target).value || null })"
                />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <input
                  matInput
                  type="number"
                  [value]="r.minQuantity || ''"
                  (input)="update(r.uid, { minQuantity: +$any($event.target).value || 0 })"
                />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <input
                  matInput
                  type="number"
                  [value]="r.unitPrice || ''"
                  (input)="update(r.uid, { unitPrice: +$any($event.target).value || 0 })"
                />
              </mat-form-field>
              <div class="rowact">
                <button
                  *hasPermission="'price.edit'"
                  mat-icon-button
                  [disabled]="!rowValid(r)"
                  (click)="save(r)"
                  aria-label="Guardar"
                >
                  <mat-icon>save</mat-icon>
                </button>
                <button
                  *hasPermission="'price.edit'"
                  mat-icon-button
                  (click)="remove(r)"
                  aria-label="Borrar"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          } @empty {
            <p class="muted">Sin precios para este producto.</p>
          }

          <button *hasPermission="'price.edit'" mat-stroked-button class="add" (click)="addRow()">
            <mat-icon>add</mat-icon>
            Agregar escalón
          </button>
        </mat-card>

        <mat-card class="card">
          <h3>Simulador</h3>
          <div class="sim">
            <mat-form-field appearance="outline" subscriptSizing="dynamic"
            >
              <mat-label>Cond. pago</mat-label>
              <mat-select [value]="simPc()" (valueChange)="simPc.set($event)">
                @for (pc of paymentConditions(); track pc.paymentConditionId) {
                  <mat-option [value]="pc.paymentConditionId">{{ pc.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field
            >
            <mat-form-field appearance="outline" subscriptSizing="dynamic"
            >
              <mat-label>Tipo cliente (id)</mat-label>
              <input
                matInput
                type="number"
                [value]="simCt() ?? ''"
                (input)="simCt.set(+$any($event.target).value || null)"
              /></mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"
            >
              <mat-label>Cantidad</mat-label>
              <input
                matInput
                type="number"
                [value]="simQty() || ''"
                (input)="simQty.set(+$any($event.target).value || 0)"
              /></mat-form-field>
            <button
              mat-flat-button
              color="tertiary"
              [disabled]="!canSimulate()"
              (click)="simulate()"
            >
              Calcular
            </button>
          </div>
          @if (simResult() !== undefined) {
            @if (simResult() === null) {
              <p class="muted">No hay precio para esa combinación.</p>
            } @else {
              <p class="simout">
                Precio unitario: <strong class="money">{{ simResult()! | money }}</strong>
              </p>
            }
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
        max-width: 860px;
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .pick {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .small {
        font-size: 0.82rem;
        margin: 12px 0 0;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 130px 110px 110px 96px;
        gap: 10px;
        align-items: center;
        padding: 4px 0;
      }
      .grid.head {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.8rem;
        padding-bottom: 8px;
      }
      .rowact {
        display: flex;
      }
      .add {
        margin-top: 8px;
      }
      .sim {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      .simout {
        margin-top: 12px;
      }
    `,
  ],
})
export class PricesPage {
  private prices = inject(PriceAdminService);
  private catalog = inject(CatalogService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly productId = signal<number | null>(null);
  readonly productName = signal('');
  readonly rows = signal<PriceDraft[]>([]);
  readonly paymentConditions = signal<PaymentCondition[]>([]);

  // Simulador
  readonly simPc = signal<number | null>(null);
  readonly simCt = signal<number | null>(null);
  readonly simQty = signal(0);
  readonly simResult = signal<number | null | undefined>(undefined);

  readonly canSimulate = computed(
    () => !!this.productId() && !!this.simPc() && !!this.simCt() && this.simQty() > 0,
  );

  constructor() {
    this.catalog
      .paymentConditions()
      .subscribe({ next: (pc) => this.paymentConditions.set(pc), error: () => {} });
  }

  pickProduct() {
    this.dialog
      .open(ProductPickerDialog, { width: '460px' })
      .afterClosed()
      .subscribe((p?: Product) => {
        if (!p) return;
        this.productId.set(p.productId);
        this.productName.set(p.name);
        this.simResult.set(undefined);
        this.load();
      });
  }

  update(uid: number, patch: Partial<PriceDraft>) {
    this.rows.update((l) => l.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }
  addRow() {
    this.rows.update((l) => [
      ...l,
      { uid: ++SEQ, paymentConditionId: null, customerTypeId: null, minQuantity: 1, unitPrice: 0 },
    ]);
  }
  rowValid(r: PriceDraft) {
    return !!r.paymentConditionId && !!r.customerTypeId && r.minQuantity >= 1 && r.unitPrice > 0;
  }
  save(r: PriceDraft) {
    if (!this.rowValid(r)) return;
    const cmd: UpsertPriceCommand = {
      productId: this.productId()!,
      paymentConditionId: r.paymentConditionId!,
      customerTypeId: r.customerTypeId!,
      minQuantity: r.minQuantity,
      unitPrice: r.unitPrice,
    };
    this.prices.upsert(cmd).subscribe({
      next: () => {
        this.toast.success('Precio guardado');
        this.load();
      },
      error: () => {},
    });
  }
  remove(r: PriceDraft) {
    if (!r.priceId) {
      this.rows.update((l) => l.filter((x) => x.uid !== r.uid));
      return;
    }
    this.prices.remove(r.priceId).subscribe({
      next: () => {
        this.toast.success('Precio borrado');
        this.load();
      },
      error: () => {},
    });
  }

  simulate() {
    if (!this.canSimulate()) return;
    this.simResult.set(undefined);
    this.prices.resolve(this.productId()!, this.simPc()!, this.simCt()!, this.simQty()).subscribe({
      next: (r) => {
        const price = typeof r === 'number' ? r : (r?.unitPrice ?? null);
        this.simResult.set(price);
      },
      error: () => this.simResult.set(null),
    });
  }

  private load() {
    const id = this.productId();
    if (!id) return;
    this.prices.byProduct(id).subscribe({
      next: (rows) =>
        this.rows.set(
          rows.map((p) => ({
            uid: ++SEQ,
            priceId: p.priceId,
            paymentConditionId: p.paymentConditionId,
            paymentConditionName: p.paymentConditionName,
            customerTypeId: p.customerTypeId,
            customerTypeName: p.customerTypeName,
            minQuantity: p.minQuantity,
            unitPrice: p.unitPrice,
          })),
        ),
      error: () => this.rows.set([]),
    });
  }
}
