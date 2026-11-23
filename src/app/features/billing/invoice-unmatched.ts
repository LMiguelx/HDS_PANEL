import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { InvoiceModuleTabs } from './ui/module-tabs';
import { MatchDialog } from './ui/match-dialog';
import { MismatchDialog } from './ui/mismatch-dialog';
import { InvoiceAdminService } from './invoice-admin';
import { InvoiceSummary } from '../../shared/models/invoice.models';
import { dateText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

/** Bandeja de facturas sin conciliar (GET /invoices/unmatched). */
@Component({
  selector: 'app-invoice-unmatched',
  imports: [RouterLink, UiButton, UiTable, UiEmpty, InvoiceModuleTabs],
  template: `
    <app-invoice-module-tabs />
    <section class="iu-page">
      <div class="iu-head">
        <h1>Facturas sin conciliar</h1>
        <p class="iu-sub">{{ countText() }}</p>
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar las facturas."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty
            variant="al-dia"
            eyebrow="Al día"
            title="Sin facturas pendientes de conciliar"
            body="Todas las facturas ya tienen un pedido asociado."
          />
        </div>

        <table class="ui-table-grid iu-table-desktop">
          <thead>
            <tr>
              <th>Comprobante</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (i of rows(); track i.invoiceId) {
              <tr>
                <td class="iu-cell-strong">
                  {{ i.documentTypeAbbr }} {{ i.series }}-{{ i.number }}
                </td>
                <td class="iu-muted">{{ dateText(i.issueDate) }}</td>
                <td>{{ i.customerName }}</td>
                <td class="iu-muted">{{ formatSoles(i.grandTotal) }}</td>
                <td class="iu-row-actions">
                  <button
                    uiButton
                    variant="ghost"
                    size="sm"
                    [routerLink]="['/factura', i.invoiceId]"
                  >
                    Ver
                  </button>
                  <button uiButton variant="secondary" size="sm" (click)="openMatch(i)">
                    Conciliar
                  </button>
                  <button uiButton variant="ghost" size="sm" (click)="openMismatch(i)">
                    Diferencia
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="iu-cards-mobile">
          @for (i of rows(); track i.invoiceId) {
            <div class="iu-card-mobile">
              <div class="iu-card-mobile-name">
                {{ i.documentTypeAbbr }} {{ i.series }}-{{ i.number }}
              </div>
              <div class="iu-muted">{{ i.customerName }} · {{ formatSoles(i.grandTotal) }}</div>
              <div class="iu-muted">{{ dateText(i.issueDate) }}</div>
              <div class="iu-card-mobile-actions">
                <button uiButton variant="ghost" size="sm" [routerLink]="['/factura', i.invoiceId]">
                  Ver
                </button>
                <button uiButton variant="secondary" size="sm" (click)="openMatch(i)">
                  Conciliar
                </button>
                <button uiButton variant="ghost" size="sm" (click)="openMismatch(i)">
                  Diferencia
                </button>
              </div>
            </div>
          }
        </div>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="iu-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="iu-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() + 1 >= totalPages()"
            (click)="nextPage()"
          >
            Siguiente
          </button>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .iu-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .iu-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .iu-cell-strong {
        font-weight: 800;
      }
      .iu-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .iu-row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }
      .iu-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .iu-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .iu-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .iu-page {
          padding: var(--sp-4);
        }
        .iu-table-desktop {
          display: none;
        }
        .iu-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .iu-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .iu-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .iu-card-mobile-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 6px;
        }
      }
    `,
  ],
})
export class InvoiceUnmatchedPage {
  private invoiceSvc = inject(InvoiceAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected dateText = dateText;
  protected formatSoles = formatSoles;

  protected rows = signal<InvoiceSummary[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected size = signal(20);
  protected loading = signal(true);
  protected error = signal(false);

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 factura sin conciliar' : `${n} facturas sin conciliar`;
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.load();
  }
  protected nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.invoiceSvc.unmatched({ page: this.page(), size: this.size() }).subscribe({
      next: (result) => {
        this.rows.set(result.content ?? []);
        this.totalElements.set(result.totalElements ?? 0);
        this.totalPages.set(result.totalPages ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected openMatch(i: InvoiceSummary) {
    this.dialog
      .open(MatchDialog, { data: { invoiceId: i.invoiceId }, width: '440px' })
      .afterClosed()
      .subscribe((matched) => {
        if (matched) {
          this.toast.success(`Factura ${i.invoiceId} conciliada.`);
          this.load();
        }
      });
  }

  protected openMismatch(i: InvoiceSummary) {
    this.dialog
      .open(MismatchDialog, { data: { invoiceId: i.invoiceId }, width: '440px' })
      .afterClosed()
      .subscribe((marked) => {
        if (marked) {
          this.toast.success(`Factura ${i.invoiceId} marcada con diferencias.`);
          this.load();
        }
      });
  }
}
