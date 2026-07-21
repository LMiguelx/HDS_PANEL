import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeaderComponent } from '../../shared/components/page-header';
import {
  ColumnDef,
  FetchFn,
  PaginatedTableComponent,
} from '../../shared/components/paginated-table';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { OrderService } from './order';
import { OrderSummary } from '../../shared/models/order.models';
import { CustomerService } from '../customers/customer';
import { CustomerSummary } from '../../shared/models/customer.models';
import { formatSoles } from '../../shared/pipes/money';
import { statusLabel } from '../../shared/ui/status';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-PE');
}

@Component({
  selector: 'app-orders-admin',
  imports: [
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    PageHeaderComponent,
    PaginatedTableComponent,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <app-page-header title="Pedidos" subtitle="Supervisión de todos los pedidos">
        <a
          *hasPermission="'order.create'"
          mat-flat-button
          color="tertiary"
          routerLink="/pedidos/nuevo"
        >
          <mat-icon>add</mat-icon>
          Nuevo pedido
        </a>
      </app-page-header>

      <div class="filters">
        <div class="statuses">
          @for (s of statuses; track s.code) {
            <button [class.active]="status() === s.code" (click)="status.set(s.code)">
              {{ s.label }}
            </button>
          }
        </div>

        @if (customerName()) {
          <span class="chip">
            Cliente: {{ customerName() }}
            <button (click)="clearCustomer()" aria-label="Quitar filtro">✕</button>
          </span>
        } @else {
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="cust">
            <mat-icon matPrefix>search</mat-icon>
            <mat-label>Filtrar por cliente</mat-label>
            <input
              matInput
              [value]="custQuery()"
              (input)="custQuery.set($any($event.target).value)"
              (keyup.enter)="searchCustomers()"
            />
          </mat-form-field>
        }
      </div>

      @if (custResults().length) {
        <mat-card class="reslist">
          @for (c of custResults(); track c.customerId) {
            <button class="row-item" (click)="pickCustomer(c)">
              <span>{{ c.businessName }}</span
              ><span class="muted">{{ c.documentNumber }}</span>
            </button>
          }
        </mat-card>
      }

      <app-paginated-table
        [columns]="columns"
        [fetch]="fetch"
        [reloadKey]="reloadKey()"
        [clickable]="true"
        emptyText="No hay pedidos."
        (rowClick)="open($event)"></app-paginated-table>
    </div>
  `,
  styles: [
    `
      .filters {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .statuses {
        display: flex;
        gap: 4px;
      }
      .statuses button {
        border: 1px solid var(--mat-sys-outline);
        background: transparent;
        cursor: pointer;
        padding: 6px 14px;
        border-radius: 999px;
        font: inherit;
        color: var(--mat-sys-on-surface-variant);
      }
      .statuses button.active {
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        border-color: var(--mat-sys-primary);
      }
      .cust {
        min-width: 240px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 6px 4px 12px;
        border-radius: 999px;
        background: var(--mat-sys-surface-container-high);
      }
      .chip button {
        border: 0;
        background: transparent;
        cursor: pointer;
        font: inherit;
      }
      .reslist {
        display: flex;
        flex-direction: column;
        padding: 4px;
        margin-bottom: 12px;
        max-width: 480px;
      }
      .row-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        text-align: left;
        width: 100%;
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        font: inherit;
      }
      .row-item:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }
    `,
  ],
})
export class OrdersAdminPage {
  private orders = inject(OrderService);
  private customers = inject(CustomerService);
  private router = inject(Router);

  readonly statuses = [
    { code: '', label: 'Todos' },
    { code: 'OPEN', label: 'Abiertos' },
    { code: 'SENT_TO_BILLING', label: 'Enviados' },
    { code: 'CANCELLED', label: 'Cancelados' },
  ];

  readonly status = signal('');
  readonly customerId = signal<number | null>(null);
  readonly customerName = signal<string | null>(null);

  readonly custQuery = signal('');
  readonly custResults = signal<CustomerSummary[]>([]);

  readonly reloadKey = computed(() => `${this.status()}|${this.customerId() ?? ''}`);

  readonly columns: ColumnDef<OrderSummary>[] = [
    { key: 'orderId', header: 'Pedido', cell: (o) => '#' + o.orderId },
    { key: 'customerName', header: 'Cliente', cell: (o) => o.customerName },
    { key: 'orderDate', header: 'Fecha', cell: (o) => fmtDate(o.orderDate) },
    { key: 'statusCode', header: 'Estado', cell: (o) => statusLabel(o.statusCode) },
    { key: 'totalAmount', header: 'Total', cell: (o) => formatSoles(o.totalAmount), align: 'end' },
  ];

  readonly fetch: FetchFn<OrderSummary> = (page, size) =>
    this.orders.all(page, size, this.status() || undefined, this.customerId() ?? undefined);

  searchCustomers() {
    const q = this.custQuery().trim();
    if (!q) return;
    this.customers.search(q, 0, 10).subscribe({
      next: (r) => this.custResults.set(r.content),
      error: () => this.custResults.set([]),
    });
  }
  pickCustomer(c: CustomerSummary) {
    this.customerId.set(c.customerId);
    this.customerName.set(c.businessName);
    this.custResults.set([]);
    this.custQuery.set('');
  }
  clearCustomer() {
    this.customerId.set(null);
    this.customerName.set(null);
  }

  open(o: OrderSummary) {
    this.router.navigate(['/pedidos', o.orderId]);
  }
}
