import { Component, effect, inject, input, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { MatchDialog } from './ui/match-dialog';
import { MismatchDialog } from './ui/mismatch-dialog';
import { ReturnsSection } from '../delivery/ui/returns-section';
import { InvoiceAdminService } from './invoice-admin';
import { InvoiceDetail } from '../../shared/models/invoice.models';
import { matchStatusName } from './invoice-format';
import { dateText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

/** Detalle de la factura con sus líneas (GET /invoices/{id}). */
@Component({
  selector: 'app-invoice-detail',
  imports: [UiButton, UiStatus, UiEmpty, HasPermissionDirective, ReturnsSection],
  template: `
    <section class="id-page">
      @if (loading()) {
        <div class="id-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar la factura"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (invoice(); as inv) {
        <div class="id-head">
          <div>
            <ui-status [label]="matchStatusName(inv.matchStatusCode)" />
            <h1>{{ inv.documentTypeName }} {{ inv.series }}-{{ inv.number }}</h1>
            <p class="id-meta">{{ inv.customerName }} · {{ dateText(inv.issueDate) }}</p>
          </div>
          <div class="id-actions">
            <button uiButton variant="primary" (click)="openMatch(inv)">
              Conciliar con pedido
            </button>
            <button uiButton variant="secondary" (click)="openMismatch(inv)">
              Marcar diferencia
            </button>
            @if (inv.matchStatusCode !== 'UNMATCHED') {
              <button uiButton variant="ghost" [loading]="unmatching()" (click)="unmatch(inv)">
                Deshacer conciliación
              </button>
            }
          </div>
        </div>
        <hr class="id-rule" />

        <div class="id-grid">
          <div class="id-field">
            <span class="id-label">Fecha de vencimiento</span>
            <span class="id-value">{{ inv.dueDate ? dateText(inv.dueDate) : '—' }}</span>
          </div>
          <div class="id-field">
            <span class="id-label">Moneda</span>
            <span class="id-value">{{ inv.currencyCode }}</span>
          </div>
          <div class="id-field">
            <span class="id-label">Total</span>
            <span class="id-value">{{ formatSoles(inv.totalAmount) }}</span>
          </div>
          <div class="id-field">
            <span class="id-label">Percepción</span>
            <span class="id-value">{{ formatSoles(inv.perceptionAmount) }}</span>
          </div>
          <div class="id-field">
            <span class="id-label">Total general</span>
            <span class="id-value">{{ formatSoles(inv.grandTotal) }}</span>
          </div>
          <div class="id-field">
            <span class="id-label">Pedido conciliado</span>
            <span class="id-value">{{ inv.orderId ?? '—' }}</span>
          </div>
        </div>

        @if (inv.matchNotes) {
          <div class="id-notes">{{ inv.matchNotes }}</div>
        }

        <h2 class="id-section-title">Líneas</h2>
        <table class="ui-table-grid id-table-desktop">
          <thead>
            <tr>
              <th>#</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio unit.</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (item of inv.items; track item.lineNumber) {
              <tr>
                <td class="id-muted">{{ item.lineNumber }}</td>
                <td>{{ item.productName }}</td>
                <td class="id-muted">{{ item.quantity }}</td>
                <td class="id-muted">{{ formatSoles(item.unitPrice) }}</td>
                <td class="id-muted">{{ formatSoles(item.totalAmount) }}</td>
                <td>
                  @if (item.free) {
                    <span class="id-badge">Bonificado</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="id-cards-mobile">
          @for (item of inv.items; track item.lineNumber) {
            <div class="id-card-mobile">
              <div class="id-card-mobile-head">
                <span class="id-card-mobile-name">{{ item.productName }}</span>
                @if (item.free) {
                  <span class="id-badge">Bonificado</span>
                }
              </div>
              <div class="id-muted">
                {{ item.quantity }} × {{ formatSoles(item.unitPrice) }} =
                {{ formatSoles(item.totalAmount) }}
              </div>
            </div>
          }
        </div>

        <div *hasPermission="['delivery.return', 'delivery.settle', 'customer.view']">
          <h2 class="id-section-title">Devoluciones</h2>
          <app-returns-section [invoiceId]="inv.invoiceId" />
        </div>
      }
    </section>
  `,
  styles: [
    `
      .id-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .id-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .id-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 6px 0 4px;
        color: var(--ink);
      }
      .id-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .id-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .id-rule {
        border: 0;
        border-top: var(--border-hair);
        margin: 20px 0;
      }
      .id-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 20px;
      }
      .id-field {
        display: grid;
        gap: 4px;
      }
      .id-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .id-value {
        font-size: 15px;
        color: var(--ink);
      }
      .id-notes {
        margin-top: 20px;
        border-left: 3px solid var(--accent);
        padding: 10px 14px;
        font-size: 13px;
        color: var(--ink-muted);
        background: var(--faint);
      }
      .id-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 32px 0 14px;
        color: var(--ink);
        border-bottom: var(--border-rule);
        padding-bottom: 8px;
      }
      .id-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .id-badge {
        font-size: 11px;
        font-weight: 800;
        color: var(--st-vigente);
      }
      .id-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .id-page {
          padding: var(--sp-4);
        }
        .id-table-desktop {
          display: none;
        }
        .id-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .id-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .id-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .id-card-mobile-name {
          font-weight: 800;
        }
      }
    `,
  ],
})
export class InvoiceDetailPage {
  private invoiceSvc = inject(InvoiceAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  invoiceId = input('', { alias: 'invoiceId' });

  protected dateText = dateText;
  protected formatSoles = formatSoles;
  protected matchStatusName = matchStatusName;

  protected invoice = signal<InvoiceDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected unmatching = signal(false);

  private loadEffect = effect(() => {
    if (this.invoiceId()) this.load();
  });

  load() {
    const id = this.invoiceId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this.invoiceSvc.detail(id).subscribe({
      next: (detail) => {
        this.invoice.set(detail);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected openMatch(inv: InvoiceDetail) {
    this.dialog
      .open(MatchDialog, { data: { invoiceId: inv.invoiceId }, width: '440px' })
      .afterClosed()
      .subscribe((matched) => {
        if (matched) {
          this.toast.success('Factura conciliada.');
          this.load();
        }
      });
  }

  protected openMismatch(inv: InvoiceDetail) {
    this.dialog
      .open(MismatchDialog, { data: { invoiceId: inv.invoiceId }, width: '440px' })
      .afterClosed()
      .subscribe((marked) => {
        if (marked) {
          this.toast.success('Factura marcada con diferencias.');
          this.load();
        }
      });
  }

  protected unmatch(inv: InvoiceDetail) {
    this.dialog
      .confirm({
        title: 'Deshacer conciliación',
        message: `¿Volver la factura ${inv.invoiceId} a "Sin conciliar"?`,
        confirmLabel: 'Deshacer',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.unmatching.set(true);
        this.invoiceSvc.unmatch(inv.invoiceId).subscribe({
          next: () => {
            this.unmatching.set(false);
            this.toast.success('Conciliación deshecha.');
            this.load();
          },
          error: () => this.unmatching.set(false),
        });
      });
  }
}
