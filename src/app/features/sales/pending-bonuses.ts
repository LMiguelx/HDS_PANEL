import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { OrderService } from './order';
import { TenantService } from '../admin/tenant';
import { PendingBonusOrderView } from '../../shared/models/order.models';
import { BranchView } from '../../shared/models/tenant.models';

@Component({
  selector: 'app-pending-bonuses',
  imports: [
    RouterLink,
    DatePipe,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header
        title="Bonificaciones pendientes"
        subtitle="Pedidos abiertos con líneas de bonificación sin stock respaldado"
      >
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="branch">
          <mat-label>Sede</mat-label>
          <mat-select [value]="branchId()" (valueChange)="onBranch($event)">
            <mat-option [value]="null">Todas</mat-option>
            @for (b of branches(); track b.branchId) {
              <mat-option [value]="b.branchId">{{ b.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </app-page-header>

      <p class="muted small">
        Estas líneas no se resuelven solas: no hay reintento automático de reserva de stock. Un
        pedido con líneas aquí no se puede enviar a facturación hasta que se ajuste el inventario
        (Administración → Inventario) — el sistema no vuelve a intentarlo por su cuenta.
      </p>

      @if (loading()) {
        <p class="muted">Cargando…</p>
      } @else if (!orders().length) {
        <div class="empty">
          <mat-icon>check_circle</mat-icon>
          <p>No hay pedidos con bonificaciones pendientes.</p>
        </div>
      } @else {
        @for (o of orders(); track o.orderId) {
          <mat-card class="card order">
            <div class="head">
              <a routerLink="/pedidos/{{ o.orderId }}" class="oid">#{{ o.orderId }}</a>
              <span>{{ o.customerName }}</span>
              <span class="muted">{{ o.orderDate | date: 'dd/MM/yyyy' }}</span>
            </div>
            @for (l of o.pendingLines; track l.lineNumber) {
              <div class="line">
                <span>{{ l.productName }}</span>
                <span class="muted">× {{ l.quantity }}</span>
              </div>
            }
          </mat-card>
        }
      }
    </div>
  `,
  styles: [
    `
      .branch {
        min-width: 200px;
      }
      .small {
        font-size: 0.82rem;
        max-width: var(--card-w-lg);
      }
      .card {
        padding: var(--sp-5);
        margin-bottom: var(--sp-4);
        max-width: var(--card-w-lg);
      }
      .order .head {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 8px;
        font-weight: 600;
      }
      .oid {
        color: var(--mat-sys-primary);
      }
      .line {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 40px 0;
        color: var(--mat-sys-on-surface-variant);
      }
      .empty mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: var(--st-settled);
      }
    `,
  ],
})
export class PendingBonusesPage {
  private orderSvc = inject(OrderService);
  private tenant = inject(TenantService);

  readonly branchId = signal<number | null>(null);
  readonly branches = signal<BranchView[]>([]);
  readonly orders = signal<PendingBonusOrderView[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.tenant.branches().subscribe({ next: (b) => this.branches.set(b), error: () => {} });
    this.load();
  }

  onBranch(id: number | null) {
    this.branchId.set(id);
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.orderSvc.pendingBonuses(this.branchId() ?? undefined).subscribe({
      next: (o) => {
        this.orders.set(o);
        this.loading.set(false);
      },
      error: () => {
        this.orders.set([]);
        this.loading.set(false);
      },
    });
  }
}
