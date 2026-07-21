import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { MoneyPipe } from '../../shared/pipes/money';
import { statusLabel } from '../../shared/ui/status';
import { CustomerService } from './customer';
import { CustomerDetail, CustomerInvoiceSummary } from '../../shared/models/customer.models';

@Component({
  selector: 'app-customer-detail',
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
    MoneyPipe,
  ],
  template: `
    <div class="page">
      <app-page-header
        [title]="customer()?.businessName ?? 'Cliente'"
        [subtitle]="customer()?.documentNumber ?? ''"
      >
        <a mat-stroked-button routerLink="/clientes"> <mat-icon>arrow_back</mat-icon> Volver </a>
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (customer(); as c) {
        <div class="cols">
          <!-- Datos -->
          <mat-card class="card">
            <h2>Datos</h2>
            <dl>
              <dt>Razón social</dt>
              <dd>{{ c.businessName }}</dd>
              <dt>Documento</dt>
              <dd>{{ c.documentTypeName }} {{ c.documentNumber }}</dd>
              <dt>Dirección</dt>
              <dd>{{ c.address ?? '—' }}</dd>
              <dt>Tipo de cliente</dt>
              <dd>{{ c.customerTypeName ?? '—' }}</dd>
              <dt>Canal</dt>
              <dd>{{ c.salesChannelName ?? '—' }}</dd>
              <dt>Estado</dt>
              <dd>
                <span class="status-chip" [attr.data-status]="c.active ? 'DELIVERED' : 'CANCELLED'">
                  {{ c.active ? 'Activo' : 'Inactivo' }}
                </span>
              </dd>
            </dl>
          </mat-card>

          <!-- Métricas -->
          <mat-card class="card">
            <h2>Métricas de compra</h2>
            @if (c.metrics; as m) {
              <div class="metrics">
                <div class="metric">
                  <span class="muted">Última compra</span
                  ><strong>{{
                    m.lastPurchaseAt ? (m.lastPurchaseAt | date: 'dd/MM/yyyy') : '—'
                  }}</strong>
                </div>
                <div class="metric">
                  <span class="muted">Pedidos 30d</span><strong>{{ m.orders30 }}</strong>
                </div>
                <div class="metric">
                  <span class="muted">Monto 30d</span><strong>{{ m.amount30 | money }}</strong>
                </div>
                <div class="metric">
                  <span class="muted">Pedidos 90d</span><strong>{{ m.orders90 }}</strong>
                </div>
                <div class="metric">
                  <span class="muted">Monto 90d</span><strong>{{ m.amount90 | money }}</strong>
                </div>
                <div class="metric">
                  <span class="muted">Pedidos 365d</span><strong>{{ m.orders365 }}</strong>
                </div>
                <div class="metric">
                  <span class="muted">Monto 365d</span><strong>{{ m.amount365 | money }}</strong>
                </div>
                <div class="metric">
                  <span class="muted">Cada ~días</span
                  ><strong>{{ m.avgDaysBetweenOrders ?? '—' }}</strong>
                </div>
                <div class="metric">
                  <span class="muted">Familia favorita</span
                  ><strong>{{ m.favoriteFamily ?? '—' }}</strong>
                </div>
              </div>
            } @else {
              <p class="muted">Sin métricas todavía (las genera el job nocturno).</p>
            }
          </mat-card>
        </div>

        <!-- Facturas -->
        <mat-card class="card">
          <h2>Facturas</h2>
          <table mat-table [dataSource]="invoices()">
            <ng-container matColumnDef="invoiceId">
              <th mat-header-cell *matHeaderCellDef>Comprobante</th>
              <td mat-cell *matCellDef="let inv">{{ inv.invoiceId }}</td>
            </ng-container>
            <ng-container matColumnDef="issueDate">
              <th mat-header-cell *matHeaderCellDef>Fecha</th>
              <td mat-cell *matCellDef="let inv">{{ inv.issueDate | date: 'dd/MM/yyyy' }}</td>
            </ng-container>
            <ng-container matColumnDef="totalAmount">
              <th mat-header-cell *matHeaderCellDef style="text-align:end">Total</th>
              <td mat-cell *matCellDef="let inv" style="text-align:end" class="money">
                {{ inv.totalAmount | money }}
              </td>
            </ng-container>
            <ng-container matColumnDef="matchStatus">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let inv">
                <span class="status-chip" [attr.data-status]="inv.matchStatus">{{
                  label(inv.matchStatus)
                }}</span>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="invoiceCols"></tr>
            <tr mat-row *matRowDef="let row; columns: invoiceCols"></tr>
          </table>
          @if (invoices().length === 0) {
            <p class="muted">Sin facturas registradas.</p>
          }
        </mat-card>
      } @else {
        <p class="muted">No se encontró el cliente.</p>
      }
    </div>
  `,
  styles: [
    `
      .cols {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        margin-bottom: 16px;
      }
      .card {
        padding: 20px;
      }
      .card h2 {
        margin: 0 0 12px;
        font-size: 1.1rem;
      }
      dl {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 6px 12px;
        margin: 0;
      }
      dt {
        color: var(--mat-sys-on-surface-variant);
      }
      dd {
        margin: 0;
      }
      .metrics {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      }
      .metric {
        display: flex;
        flex-direction: column;
      }
      .metric strong {
        font-size: 1.05rem;
      }
      table {
        width: 100%;
      }
    `,
  ],
})
export class CustomerDetailPage {
  private customers = inject(CustomerService);

  /** Viene de la ruta :id (withComponentInputBinding). */
  readonly id = input.required<string>();

  readonly loading = signal(true);
  readonly customer = signal<CustomerDetail | null>(null);
  readonly invoices = signal<CustomerInvoiceSummary[]>([]);

  readonly invoiceCols = ['invoiceId', 'issueDate', 'totalAmount', 'matchStatus'];

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.load(id));
    });
  }

  label(code: string) {
    return statusLabel(code);
  }

  private load(id: number) {
    this.loading.set(true);
    this.customer.set(null);
    this.invoices.set([]);

    this.customers.detail(id).subscribe({
      next: (c) => {
        this.customer.set(c);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.customers.invoices(id).subscribe({
      next: (inv) => this.invoices.set(inv),
      error: () => this.invoices.set([]),
    });
  }
}
