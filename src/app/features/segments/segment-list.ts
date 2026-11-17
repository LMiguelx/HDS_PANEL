import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { SegmentAdminService } from './segment-admin';
import { SegmentView } from './segment.models';
import { NewSegmentDialog } from './ui/new-segment-dialog';
import { ImportMembersDialog, ImportMembersDialogResult } from './ui/import-members-dialog';
import { dateText } from '../assignments/assignment-format';

/**
 * Segmentos — listado (10.3). Listado chico: búsqueda y orden se hacen en
 * el navegador sobre lo que trae GET /api/segments?includeArchived=.
 */
@Component({
  selector: 'app-segment-list',
  imports: [RouterLink, UiButton, UiField, UiToggle, UiTable, UiStatus, UiEmpty],
  template: `
    <section class="seg-page">
      <div class="seg-head">
        <div>
          <h1>Segmentos</h1>
          <p class="seg-sub">{{ countText() }}</p>
        </div>
        <div class="seg-head-actions">
          <button uiButton variant="secondary" (click)="openImportNew()">
            Nuevo segmento desde archivo
          </button>
          <button uiButton variant="primary" (click)="openNew()">Nuevo segmento</button>
        </div>
      </div>

      <div class="seg-filters">
        <ui-field label="Buscar por nombre" [(value)]="query" />
        <ui-toggle label="Ver archivados" [(checked)]="includeArchived" />
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar los segmentos."
        [empty]="!loading() && !error() && filtered().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty
            title="Sin segmentos"
            body="Crea el primero para reutilizarlo en promociones."
          />
        </div>

        <table class="ui-table-grid seg-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Clientes</th>
              <th>Creado</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of filtered(); track s.segmentId) {
              <tr>
                <td>
                  <a [routerLink]="['/segmentos', s.segmentId]" class="seg-name-link">{{
                    s.name
                  }}</a>
                  <div class="seg-code">{{ s.code }}</div>
                </td>
                <td class="seg-cell-strong">{{ memberCountText(s.memberCount) }}</td>
                <td class="seg-muted">{{ dateText(s.createdAt) }}</td>
                <td><ui-status [label]="s.active ? 'Activo' : 'Archivado'" /></td>
                <td class="seg-row-actions">
                  <button
                    uiButton
                    variant="ghost"
                    size="sm"
                    [routerLink]="['/segmentos', s.segmentId]"
                  >
                    Ver miembros
                  </button>
                  @if (s.active) {
                    <button uiButton variant="ghost" size="sm" (click)="archive(s)">
                      Archivar
                    </button>
                  } @else {
                    <button uiButton variant="ghost" size="sm" (click)="activate(s)">
                      Reactivar
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </ui-table>
    </section>
  `,
  styles: [
    `
      .seg-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .seg-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .seg-head-actions {
        display: flex;
        gap: 10px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .seg-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .seg-filters {
        display: flex;
        align-items: flex-end;
        gap: 24px;
        margin: 24px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .seg-filters ui-field {
        width: 280px;
      }
      .seg-table {
        width: 100%;
      }
      .seg-name-link {
        font-weight: 800;
        text-decoration: none;
        color: var(--ink);
      }
      .seg-name-link:hover {
        color: var(--accent);
      }
      .seg-code {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .seg-cell-strong {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .seg-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .seg-row-actions {
        text-align: right;
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }

      @media (max-width: 767px) {
        .seg-page {
          padding: var(--sp-4);
        }
        .seg-filters {
          flex-direction: column;
          align-items: stretch;
        }
        .seg-filters ui-field {
          width: 100%;
        }
      }
    `,
  ],
})
export class SegmentListPage {
  private segmentSvc = inject(SegmentAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected dateText = dateText;

  protected segments = signal<SegmentView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected query = signal('');
  protected includeArchived = signal(false);

  protected filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = q
      ? this.segments().filter((s) => s.name.toLowerCase().includes(q))
      : this.segments();
    return [...list].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  });

  private includeArchivedEffect = effect(() => {
    this.includeArchived();
    untracked(() => this.load());
  });

  protected countText(): string {
    const n = this.segments().length;
    return n === 1 ? '1 segmento' : `${n} segmentos`;
  }

  protected memberCountText(n: number): string {
    return n.toLocaleString('es-PE');
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.segmentSvc.list(this.includeArchived()).subscribe({
      next: (list) => {
        this.segments.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected openNew() {
    this.dialog
      .open<NewSegmentDialog, unknown, SegmentView>(NewSegmentDialog, { width: '420px' })
      .afterClosed()
      .subscribe((segment) => {
        if (segment) this.router.navigate(['/segmentos', segment.segmentId]);
      });
  }

  protected openImportNew() {
    this.dialog
      .open<ImportMembersDialog, unknown, ImportMembersDialogResult>(ImportMembersDialog, {
        width: '560px',
      })
      .afterClosed()
      .subscribe((res) => {
        if (res?.segment) this.router.navigate(['/segmentos', res.segment.segmentId]);
      });
  }

  protected archive(s: SegmentView) {
    this.dialog
      .confirm({
        title: 'Archivar segmento',
        message:
          'Dejará de aparecer para promociones nuevas. Las promociones que ya lo usan no cambian. No podrás modificar sus miembros hasta reactivarlo.',
        confirmLabel: 'Archivar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.segmentSvc.archive(s.segmentId).subscribe(() => {
          this.toast.success('Segmento archivado.');
          this.load();
        });
      });
  }

  protected activate(s: SegmentView) {
    this.segmentSvc.activate(s.segmentId).subscribe(() => {
      this.toast.success('Segmento reactivado.');
      this.load();
    });
  }
}
