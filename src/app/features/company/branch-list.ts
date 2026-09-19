import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { CompanyModuleTabs } from './ui/module-tabs';
import { BranchFormDialog } from './ui/branch-form-dialog';
import { CompanyAdminService } from './company-admin';
import { BranchView } from '../../shared/models/tenant.models';

/**
 * Sedes — GET /api/tenant/branches. Solo hay endpoint de cierre
 * (deactivate), no de reapertura: una sede cerrada no se puede reactivar
 * desde este panel.
 */
@Component({
  selector: 'app-branch-list',
  imports: [UiButton, UiTable, UiEmpty, CompanyModuleTabs],
  template: `
    <app-company-module-tabs />
    <section class="bl-page">
      <div class="bl-head">
        <div>
          <h1>Sedes</h1>
          <p class="bl-sub">{{ countText() }}</p>
        </div>
        <button uiButton variant="primary" (click)="openCreate()">Nueva sede</button>
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar las sedes."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty title="Sin sedes" body="Todavía no hay sedes registradas." />
        </div>

        <table class="ui-table-grid bl-table-desktop">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Dirección</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (b of rows(); track b.branchId) {
              <tr>
                <td class="bl-muted">{{ b.code }}</td>
                <td class="bl-cell-strong">{{ b.name }}</td>
                <td class="bl-muted">{{ b.address || '—' }}</td>
                <td class="bl-muted">{{ b.active ? 'Activa' : 'Cerrada' }}</td>
                <td class="bl-row-action">
                  @if (b.active) {
                    <button uiButton variant="ghost" size="sm" (click)="close(b)">Cerrar sede</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="bl-cards-mobile">
          @for (b of rows(); track b.branchId) {
            <div class="bl-card-mobile">
              <div class="bl-card-mobile-head">
                <span class="bl-card-mobile-name">{{ b.name }}</span>
                <span class="bl-muted">{{ b.active ? 'Activa' : 'Cerrada' }}</span>
              </div>
              <div class="bl-muted">{{ b.code }} · {{ b.address || 'Sin dirección' }}</div>
              @if (b.active) {
                <button uiButton variant="ghost" size="sm" (click)="close(b)">Cerrar sede</button>
              }
            </div>
          }
        </div>
      </ui-table>
    </section>
  `,
  styles: [
    `
      .bl-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .bl-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
        margin-top: 20px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .bl-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .bl-cell-strong {
        font-weight: 800;
      }
      .bl-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .bl-row-action {
        text-align: right;
      }
      .bl-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .bl-page {
          padding: var(--sp-4);
        }
        .bl-table-desktop {
          display: none;
        }
        .bl-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .bl-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 6px;
        }
        .bl-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .bl-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class BranchListPage {
  private companySvc = inject(CompanyAdminService);
  private dialog = inject(UiDialogService);

  protected rows = signal<BranchView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.rows().length;
    return n === 1 ? '1 sede' : `${n} sedes`;
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.companySvc.branches().subscribe({
      next: (list) => {
        this.rows.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected openCreate() {
    this.dialog
      .open<BranchFormDialog, unknown, BranchView | false>(BranchFormDialog, { width: '560px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  protected close(b: BranchView) {
    this.dialog
      .confirm({
        title: 'Cerrar sede',
        message: `¿Cerrar "${b.name}"? No hay forma de reabrirla desde este panel.`,
        confirmLabel: 'Cerrar sede',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.companySvc.deactivateBranch(b.branchId).subscribe(() => this.load());
      });
  }
}
