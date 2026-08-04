import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { ToastService } from '../../core/ui/toast';
import { AllocationService } from '../sales/allocation';
import { ProductPickerDialog } from './product-picker-dialog';
import { AllocationView, CreateAllocationCommand } from '../../shared/models/allocation.models';
import { Product } from '../../shared/models/catalog.models';

@Component({
  selector: 'app-allocations-admin',
  imports: [
    DatePipe,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <app-page-header title="Dotaciones" subtitle="Producto asignado a un vendedor para regalar"></app-page-header>

      <mat-card class="card">
        <div class="row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>ID del vendedor</mat-label>
            <input
              matInput
              type="number"
              [value]="userId() ?? ''"
              (input)="userId.set(+$any($event.target).value || null)"
              (keyup.enter)="loadUser()"
            />
          </mat-form-field>
          <button mat-flat-button color="primary" [disabled]="!userId()" (click)="loadUser()">
            Ver dotaciones
          </button>
        </div>
        <p class="muted small">
          Temporal: se ingresa el ID. Falta el endpoint para listar/autocompletar vendedores.
        </p>
      </mat-card>

      @if (loaded(); as uid) {
        <mat-card class="card">
          <h3>Dotaciones del vendedor #{{ uid }}</h3>
          @if (allocations().length) {
            <div class="table">
              <div class="trow head">
                <span>Producto</span><span>Asignado</span><span>Usado</span><span>Saldo</span
              ><span>Período</span>
              </div>
              @for (a of allocations(); track a.allocationId) {
                <div class="trow">
                  <span>{{ a.productName }}</span>
                  <span class="num">{{ a.allocatedQuantity }}</span>
                  <span class="num">{{ a.usedQuantity }}</span>
                  <span class="num" [class.zero]="a.availableQuantity <= 0">{{
                      a.availableQuantity
                    }}</span>
                  <span class="muted"
                  >{{ a.periodStart | date: 'dd/MM/yy' }} –
                    {{ a.periodEnd ? (a.periodEnd | date: 'dd/MM/yy') : '∞' }}</span
                  >
                </div>
              }
            </div>
          } @else {
            <p class="muted">Este vendedor no tiene dotaciones.</p>
          }
        </mat-card>

        <mat-card class="card" *hasPermission="'promo.allocate'">
          <h3>Nueva dotación</h3>
          <div class="form">
            <button mat-stroked-button (click)="pickProduct()">
              <mat-icon>inventory_2</mat-icon>
              {{ productName() || 'Elegir producto' }}
            </button>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"
            >
              <mat-label>Cantidad</mat-label>
              <input
                matInput
                type="number"
                [value]="quantity() || ''"
                (input)="quantity.set(+$any($event.target).value || 0)"
              /></mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"
            >
              <mat-label>Desde</mat-label>
              <input
                matInput
                type="date"
                [value]="periodStart()"
                (input)="periodStart.set($any($event.target).value)"
              /></mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"
            >
              <mat-label>Hasta (opcional)</mat-label>
              <input
                matInput
                type="date"
                [value]="periodEnd()"
                (input)="periodEnd.set($any($event.target).value)"
              /></mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"
            >
              <mat-label>Promo ID (opcional)</mat-label>
              <input
                matInput
                type="number"
                [value]="promoId() ?? ''"
                (input)="promoId.set(+$any($event.target).value || null)"
              /></mat-form-field>
          </div>
          <button mat-flat-button color="tertiary" [disabled]="!canSave()" (click)="save()">
            <mat-icon>add</mat-icon>
            Asignar dotación
          </button>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .card {
        padding: var(--sp-5);
        margin-bottom: var(--sp-4);
        max-width: var(--card-w-md);
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .small {
        font-size: 0.8rem;
        margin: 8px 0 0;
      }
      .table {
        display: flex;
        flex-direction: column;
      }
      .trow {
        display: grid;
        grid-template-columns: 1fr 90px 90px 90px 160px;
        gap: 8px;
        padding: 6px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        align-items: center;
      }
      .trow.head {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.8rem;
        border-bottom: 2px solid var(--mat-sys-outline-variant);
      }
      .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .zero {
        color: var(--mat-sys-error);
      }
      .form {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
    `,
  ],
})
export class AllocationsAdminPage {
  private allocSvc = inject(AllocationService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly userId = signal<number | null>(null);
  readonly loaded = signal<number | null>(null);
  readonly allocations = signal<AllocationView[]>([]);

  // Formulario
  readonly productId = signal<number | null>(null);
  readonly productName = signal('');
  readonly quantity = signal(0);
  readonly periodStart = signal('');
  readonly periodEnd = signal('');
  readonly promoId = signal<number | null>(null);
  readonly saving = signal(false);

  loadUser() {
    const id = this.userId();
    if (!id) return;
    this.allocSvc.byUser(id).subscribe({
      next: (a) => {
        this.allocations.set(a);
        this.loaded.set(id);
      },
      error: () => {
        this.allocations.set([]);
        this.loaded.set(id);
      },
    });
  }

  pickProduct() {
    this.dialog
      .open(ProductPickerDialog, { width: '460px' })
      .afterClosed()
      .subscribe((p?: Product) => {
        if (p) {
          this.productId.set(p.productId);
          this.productName.set(p.name);
        }
      });
  }

  canSave() {
    return (
      !!this.loaded() &&
      !!this.productId() &&
      this.quantity() > 0 &&
      !!this.periodStart() &&
      !this.saving()
    );
  }

  save() {
    if (!this.canSave()) return;
    this.saving.set(true);
    const cmd: CreateAllocationCommand = {
      userId: this.loaded()!,
      productId: this.productId()!,
      quantity: this.quantity(),
      periodStart: this.periodStart(),
      periodEnd: this.periodEnd() || undefined,
      promoId: this.promoId() ?? undefined,
    };
    this.allocSvc.create(cmd).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Dotación asignada');
        this.productId.set(null);
        this.productName.set('');
        this.quantity.set(0);
        this.periodEnd.set('');
        this.promoId.set(null);
        this.loadUser();
      },
      error: () => this.saving.set(false),
    });
  }
}
