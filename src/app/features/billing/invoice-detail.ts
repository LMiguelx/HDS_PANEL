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
import { InvoiceService } from './invoice';
import { MatchDialog } from './match-dialog';
import { InvoiceDetail, PromoApplicationView } from '../../shared/models/invoice.models';

@Component({
  selector: 'app-invoice-detail',
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
      <app-page-header [title]="'Factura ' + id()" [subtitle]="invoice()?.customerName ?? ''">
        <a mat-stroked-button routerLink="/facturas"><mat-icon>arrow_back</mat-icon> Volver</a>
        @if (invoice(); as inv) {
          @if (inv.matchStatus === 'UNMATCHED') {
            <button
              *hasPermission="'invoice.reconcile'"
              mat-flat-button
              color="tertiary"
              (click)="openMatch(inv)"
            >
              <mat-icon>link</mat-icon> Emparejar
            </button>
            <button *hasPermission="'invoice.reconcile'" mat-stroked-button (click)="mismatch()">
              <mat-icon>report_problem</mat-icon> Marcar diferencia
            </button>
          } @else {
            <button *hasPermission="'invoice.reconcile'" mat-stroked-button (click)="unmatch()">
              <mat-icon>link_off</mat-icon> Deshacer
            </button>
          }
        }
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (invoice(); as inv) {
        <mat-card class="card">
          <div class="head">
            <div>
              <span class="muted">Estado</span><br /><span
                class="status-chip"
                [attr.data-status]="inv.matchStatus"
                >{{ label(inv.matchStatus) }}</span
              >
            </div>
            <div>
              <span class="muted">Fecha</span><br />{{ inv.issueDate | date: 'dd/MM/yyyy' }}
            </div>
            <div>
              <span class="muted">Total</span><br /><strong class="money">{{
                inv.totalAmount | money
              }}</strong>
            </div>
            @if (inv.orderId) {
              <div>
                <span class="muted">Pedido</span><br /><a routerLink="/pedidos/{{ inv.orderId }}"
                  >#{{ inv.orderId }}</a
                >
              </div>
            }
          </div>
        </mat-card>

        <mat-card class="card">
          <h3>Ítems</h3>
          <table mat-table [dataSource]="inv.items">
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
            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols"></tr>
          </table>
        </mat-card>

        <!-- Cruce con bonificaciones del pedido -->
        @if (inv.orderId) {
          <mat-card class="card">
            <h3>Bonificaciones del pedido #{{ inv.orderId }}</h3>
            @if (applications() === null) {
              <mat-progress-bar mode="indeterminate" />
            } @else if (applications()!.length) {
              @for (a of applications()!; track $index) {
                <div class="li">
                  <span>{{ a.promoName ?? 'Promo #' + a.promoId }}</span>
                  <span class="muted">{{ appText(a) }}</span>
                </div>
              }
              <p class="muted small">
                Coteja que el ERP haya facturado (o descontado) estos bonos correctamente.
              </p>
            } @else {
              <p class="muted">El pedido no tuvo bonificaciones.</p>
            }
          </mat-card>
        }
      } @else {
        <p class="muted">No se encontró la factura.</p>
      }
    </div>
  `,
  styles: [
    `
      .card {
        padding: var(--sp-5);
        margin-bottom: var(--sp-4);
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      table {
        width: 100%;
      }
      .li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .small {
        font-size: 0.82rem;
      }
    `,
  ],
})
export class InvoiceDetailPage {
  private invoices = inject(InvoiceService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly id = input.required<string>();
  readonly loading = signal(true);
  readonly invoice = signal<InvoiceDetail | null>(null);
  readonly applications = signal<PromoApplicationView[] | null>(null);
  readonly cols = ['productName', 'quantity', 'unitPrice', 'lineTotal'];

  constructor() {
    effect(() => {
      const invoiceId = this.id();
      untracked(() => this.load(invoiceId));
    });
  }

  label(code: string) {
    return statusLabel(code);
  }

  appText(a: PromoApplicationView): string {
    switch (a.benefitType) {
      case 'FREE_PRODUCT':
        return `${a.productName ?? 'Producto #' + a.productId} × ${a.quantity ?? 1} gratis`;
      case 'DISCOUNT_AMOUNT':
        return `Descuento de S/ ${a.discountAmount}`;
      case 'DISCOUNT_PERCENT':
        return `Descuento de ${a.discountPercent}%`;
      default:
        return a.benefitType;
    }
  }

  openMatch(inv: InvoiceDetail) {
    this.dialog
      .open(MatchDialog, { width: '820px', data: inv })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.load(inv.invoiceId);
      });
  }

  mismatch() {
    const inv = this.invoice();
    if (!inv) return;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Marcar diferencia',
          message: `La factura ${inv.invoiceId} quedará como MISMATCH para revisión.`,
          confirmText: 'Marcar',
        },
        width: '400px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.invoices.mismatch(inv.invoiceId).subscribe({
          next: () => {
            this.toast.success('Marcada como diferencia');
            this.load(inv.invoiceId);
          },
          error: () => {},
        });
      });
  }

  unmatch() {
    const inv = this.invoice();
    if (!inv) return;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Deshacer conciliación',
          message: `La factura ${inv.invoiceId} volverá a UNMATCHED.`,
          confirmText: 'Deshacer',
          danger: true,
        },
        width: '400px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.invoices.unmatch(inv.invoiceId).subscribe({
          next: () => {
            this.toast.success('Conciliación deshecha');
            this.load(inv.invoiceId);
          },
          error: () => {},
        });
      });
  }

  private load(invoiceId: string) {
    this.loading.set(true);
    this.invoice.set(null);
    this.applications.set(null);
    this.invoices.detail(invoiceId).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.loading.set(false);
        if (inv.orderId) this.loadApplications(inv.orderId);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadApplications(orderId: number) {
    this.invoices.promoApplications(orderId).subscribe({
      next: (a) => this.applications.set(a),
      error: () => this.applications.set([]),
    });
  }
}
