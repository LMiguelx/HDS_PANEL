import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { RequestModuleTabs } from './ui/module-tabs';
import { CustomerRequestAdminService } from './customer-request-admin';
import { RequestView } from '../../shared/models/customer-request.models';
import { dateTimeText } from '../assignments/assignment-format';

/** Solicitudes de cierre/baja de cliente pendientes de aprobar. */
@Component({
  selector: 'app-request-closure',
  imports: [UiButton, UiTable, UiEmpty, RequestModuleTabs],
  template: `
    <app-request-module-tabs />
    <section class="rcl-page">
      <div class="rcl-head">
        <h1>Solicitudes de cierre</h1>
        <p class="rcl-sub">{{ countText() }}</p>
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
            title="Sin solicitudes de cierre pendientes"
            body="Cuando un vendedor pida dar de baja a un cliente, aparece acá."
          />
        </div>

        <table class="ui-table-grid rcl-table-desktop">
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
                <td class="rcl-cell-strong">{{ r.businessName }}</td>
                <td class="rcl-muted">{{ r.reason || '—' }}</td>
                <td class="rcl-muted">{{ r.requestedByName }}</td>
                <td class="rcl-muted">{{ dateTimeText(r.createdAt) }}</td>
                <td class="rcl-row-actions">
                  <button uiButton variant="primary" size="sm" (click)="approve(r)">Aprobar</button>
                  <button uiButton variant="ghost" size="sm" (click)="reject(r)">Rechazar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="rcl-cards-mobile">
          @for (r of rows(); track r.requestId) {
            <div class="rcl-card-mobile">
              <div class="rcl-card-mobile-name">{{ r.businessName }}</div>
              <div class="rcl-muted">{{ r.reason || 'Sin motivo' }}</div>
              <div class="rcl-muted">{{ r.requestedByName }} · {{ dateTimeText(r.createdAt) }}</div>
              <div class="rcl-card-mobile-actions">
                <button uiButton variant="primary" size="sm" (click)="approve(r)">Aprobar</button>
                <button uiButton variant="ghost" size="sm" (click)="reject(r)">Rechazar</button>
              </div>
            </div>
          }
        </div>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="rcl-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="rcl-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .rcl-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .rcl-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .rcl-cell-strong {
        font-weight: 800;
      }
      .rcl-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .rcl-row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .rcl-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .rcl-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .rcl-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .rcl-page {
          padding: var(--sp-4);
        }
        .rcl-table-desktop {
          display: none;
        }
        .rcl-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .rcl-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .rcl-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .rcl-card-mobile-actions {
          display: flex;
          gap: 8px;
          margin-top: 6px;
        }
      }
    `,
  ],
})
export class RequestClosurePage {
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
    this.requestSvc.pendingClosure({ page: this.page(), size: this.size() }).subscribe({
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
      .confirm({
        title: 'Aprobar cierre',
        message: `¿Aprobar el cierre de "${r.businessName}"? El cliente quedará desactivado.`,
        confirmLabel: 'Aprobar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.requestSvc.approveClosure(r.requestId).subscribe(() => this.load());
      });
  }

  protected reject(r: RequestView) {
    this.dialog
      .confirm({
        title: 'Rechazar solicitud',
        message: `¿Rechazar la solicitud de cierre de "${r.businessName}"?`,
        confirmLabel: 'Rechazar',
      })
      .subscribe((confirmed) => {
        if (confirmed) this.requestSvc.reject('closure', r.requestId).subscribe(() => this.load());
      });
  }
}
