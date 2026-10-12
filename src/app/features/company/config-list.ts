import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { CompanyModuleTabs } from './ui/module-tabs';
import { ConfigFormDialog } from './ui/config-form-dialog';
import { CompanyAdminService } from './company-admin';
import { ConfigView } from '../../shared/models/tenant.models';

/** Parámetros de configuración — GET/PUT /api/tenant/configurations. `config.edit`. */
@Component({
  selector: 'app-config-list',
  imports: [UiButton, UiField, UiTable, UiEmpty, CompanyModuleTabs],
  template: `
    <app-company-module-tabs />
    <section class="cl-page">
      <div class="cl-head">
        <div>
          <h1>Configuración</h1>
          <p class="cl-sub">{{ countText() }}</p>
        </div>
        <button uiButton variant="primary" (click)="openCreate()">Nuevo parámetro</button>
      </div>

      <div class="cl-filters">
        <ui-field label="Grupo" [(value)]="group" placeholder="Filtra por grupo (opcional)" />
        <button uiButton variant="secondary" size="sm" (click)="load()">Filtrar</button>
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar la configuración."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty title="Sin parámetros" body="No encontramos parámetros con ese filtro." />
        </div>

        <table class="ui-table-grid cl-table-desktop">
          <thead>
            <tr>
              <th>Código</th>
              <th>Grupo</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (c of rows(); track c.configId) {
              <tr>
                <td class="cl-cell-strong">{{ c.code }}</td>
                <td class="cl-muted">{{ c.configGroup }}</td>
                <td class="cl-muted">{{ c.configType }}</td>
                <td>{{ c.value }}</td>
                <td class="cl-muted">{{ c.description || '—' }}</td>
                <td class="cl-row-action">
                  <button uiButton variant="ghost" size="sm" (click)="edit(c)">Editar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="cl-cards-mobile">
          @for (c of rows(); track c.configId) {
            <div class="cl-card-mobile">
              <div class="cl-card-mobile-head">
                <span class="cl-card-mobile-name">{{ c.code }}</span>
                <span class="cl-muted">{{ c.configType }}</span>
              </div>
              <div class="cl-muted">{{ c.configGroup }} · {{ c.value }}</div>
              <button uiButton variant="ghost" size="sm" (click)="edit(c)">Editar</button>
            </div>
          }
        </div>
      </ui-table>
    </section>
  `,
  styles: [
    `
      .cl-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .cl-head {
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
      .cl-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .cl-filters {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        margin: 20px 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .cl-filters ui-field {
        width: 260px;
      }
      .cl-cell-strong {
        font-weight: 800;
      }
      .cl-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .cl-row-action {
        text-align: right;
      }
      .cl-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .cl-page {
          padding: var(--sp-4);
        }
        .cl-filters {
          flex-direction: column;
          align-items: stretch;
        }
        .cl-filters ui-field {
          width: 100%;
        }
        .cl-table-desktop {
          display: none;
        }
        .cl-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .cl-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 6px;
        }
        .cl-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .cl-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class ConfigListPage {
  private companySvc = inject(CompanyAdminService);
  private dialog = inject(UiDialogService);

  protected group = signal('');
  protected rows = signal<ConfigView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.rows().length;
    return n === 1 ? '1 parámetro' : `${n} parámetros`;
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.companySvc.configurations(this.group().trim() || undefined).subscribe({
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
      .open<ConfigFormDialog, { config?: ConfigView }, ConfigView | false>(ConfigFormDialog, {
        data: {},
        width: '560px',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  protected edit(c: ConfigView) {
    this.dialog
      .open<ConfigFormDialog, { config?: ConfigView }, ConfigView | false>(ConfigFormDialog, {
        data: { config: c },
        width: '560px',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }
}
