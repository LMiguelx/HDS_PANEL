import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { UserFormDialog } from './ui/user-form-dialog';
import { UserAdminService } from './user-admin';
import { UserSummaryView } from '../../shared/models/user.models';

/** Listado paginado de usuarios — GET /api/users. `user.manage`. */
@Component({
  selector: 'app-user-list',
  imports: [RouterLink, UiButton, UiTable, UiEmpty],
  template: `
    <section class="ul-page">
      <div class="ul-head">
        <div>
          <h1>Usuarios</h1>
          <p class="ul-sub">{{ countText() }}</p>
        </div>
        <button uiButton variant="primary" (click)="openCreate()">Nuevo usuario</button>
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar los usuarios."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty title="Sin usuarios" body="Todavía no hay usuarios registrados." />
        </div>

        <table class="ui-table-grid ul-table-desktop">
          <thead>
            <tr>
              <th>Código</th>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Roles</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (u of rows(); track u.userId) {
              <tr>
                <td class="ul-muted">{{ u.code }}</td>
                <td class="ul-cell-strong">{{ u.username }}</td>
                <td>{{ u.fullName }}</td>
                <td class="ul-muted">{{ u.roleCodes.join(', ') || '—' }}</td>
                <td class="ul-muted">{{ u.active ? 'Activo' : 'Inactivo' }}</td>
                <td class="ul-row-action">
                  <button uiButton variant="ghost" size="sm" [routerLink]="['/usuarios', u.userId]">
                    Ver detalle
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="ul-cards-mobile">
          @for (u of rows(); track u.userId) {
            <a [routerLink]="['/usuarios', u.userId]" class="ul-card-mobile">
              <div class="ul-card-mobile-head">
                <span class="ul-card-mobile-name">{{ u.fullName }}</span>
                <span class="ul-muted">{{ u.active ? 'Activo' : 'Inactivo' }}</span>
              </div>
              <div class="ul-muted">{{ u.username }} · {{ u.code }}</div>
              @if (u.roleCodes.length > 0) {
                <div class="ul-muted">{{ u.roleCodes.join(', ') }}</div>
              }
            </a>
          }
        </div>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="ul-pager">
          <button uiButton variant="secondary" size="sm" [disabled]="page() === 0" (click)="prevPage()">
            Anterior
          </button>
          <span class="ul-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .ul-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .ul-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .ul-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .ul-cell-strong {
        font-weight: 800;
      }
      .ul-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .ul-row-action {
        text-align: right;
      }
      .ul-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .ul-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .ul-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .ul-page {
          padding: var(--sp-4);
        }
        .ul-table-desktop {
          display: none;
        }
        .ul-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .ul-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .ul-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .ul-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class UserListPage {
  private userSvc = inject(UserAdminService);
  private dialog = inject(UiDialogService);

  protected rows = signal<UserSummaryView[]>([]);
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
    return n === 1 ? '1 usuario' : `${n} usuarios`;
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
    this.userSvc.list(this.page(), this.size()).subscribe({
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

  protected openCreate() {
    this.dialog
      .open<UserFormDialog, unknown, { userId: number } | false>(UserFormDialog, { width: '680px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }
}
