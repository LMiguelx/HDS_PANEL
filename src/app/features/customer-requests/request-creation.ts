import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { RequestModuleTabs } from './ui/module-tabs';
import { ApproveCreationDialog } from './ui/approve-creation-dialog';
import { CustomerRequestAdminService } from './customer-request-admin';
import { RequestView } from '../../shared/models/customer-request.models';
import { dateTimeText } from '../assignments/assignment-format';

/** Solicitudes de creación de cliente pendientes de aprobar. */
@Component({
  selector: 'app-request-creation',
  imports: [UiButton, UiTable, UiEmpty, RequestModuleTabs],
  template: `
    <app-request-module-tabs />
    <section class="rc-page">
      <div class="rc-head">
        <h1>Solicitudes de creación</h1>
        <p class="rc-sub">{{ countText() }}</p>
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar las solicitudes."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty
            variant="al-dia"
            eyebrow="Al día"
            title="Sin solicitudes de creación pendientes"
            body="Cuando un vendedor pida crear un cliente nuevo, aparece acá."
          />
        </div>

        <table class="ui-table-grid rc-table-desktop">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Motivo</th>
              <th>Solicitado por</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.requestId) {
              <tr>
                <td class="rc-cell-strong">{{ r.businessName }}</td>
                <td class="rc-muted">{{ r.reason || '—' }}</td>
                <td class="rc-muted">Usuario #{{ r.requestedBy }}</td>
                <td class="rc-muted">{{ dateTimeText(r.createdAt) }}</td>
                <td class="rc-row-actions">
                  <button uiButton variant="primary" size="sm" (click)="approve(r)">Aprobar</button>
                  <button uiButton variant="ghost" size="sm" (click)="reject(r)">Rechazar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="rc-cards-mobile">
          @for (r of rows(); track r.requestId) {
            <div class="rc-card-mobile">
              <div class="rc-card-mobile-name">{{ r.businessName }}</div>
              <div class="rc-muted">{{ r.reason || 'Sin motivo' }}</div>
              <div class="rc-muted">
                Usuario #{{ r.requestedBy }} · {{ dateTimeText(r.createdAt) }}
              </div>
              <div class="rc-card-mobile-actions">
                <button uiButton variant="primary" size="sm" (click)="approve(r)">Aprobar</button>
                <button uiButton variant="ghost" size="sm" (click)="reject(r)">Rechazar</button>
              </div>
            </div>
          }
        </div>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="rc-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="rc-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .rc-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .rc-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .rc-cell-strong {
        font-weight: 800;
      }
      .rc-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .rc-row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .rc-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .rc-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .rc-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .rc-page {
          padding: var(--sp-4);
        }
        .rc-table-desktop {
          display: none;
        }
        .rc-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .rc-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .rc-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .rc-card-mobile-actions {
          display: flex;
          gap: 8px;
          margin-top: 6px;
        }
      }
    `,
  ],
})
export class RequestCreationPage {
  private requestSvc = inject(CustomerRequestAdminService);
  private dialog = inject(UiDialogService);

  protected dateTimeText = dateTimeText;

  protected rows = signal<RequestView[]>([]);
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
    return n === 1 ? '1 solicitud pendiente' : `${n} solicitudes pendientes`;
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
    this.requestSvc.pendingCreation({ page: this.page(), size: this.size() }).subscribe({
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

  protected approve(r: RequestView) {
    this.dialog
      .open(ApproveCreationDialog, {
        data: { requestId: r.requestId, businessName: r.businessName },
        width: '480px',
      })
      .afterClosed()
      .subscribe((approved) => approved && this.load());
  }

  protected reject(r: RequestView) {
    this.dialog
      .confirm({
        title: 'Rechazar solicitud',
        message: `¿Rechazar la solicitud de creación de "${r.businessName}"?`,
        confirmLabel: 'Rechazar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.requestSvc.reject('creation', r.requestId).subscribe(() => this.load());
      });
  }
}
