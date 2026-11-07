import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Subject, debounceTime } from 'rxjs';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { SegmentAdminService } from './segment-admin';
import { MemberView, SegmentView } from './segment.models';
import { ImportMembersDialog, ImportMembersDialogResult } from './ui/import-members-dialog';
import { LookupService, toUiLookup } from '../promos/lookup';
import { dateTimeText } from '../assignments/assignment-format';

/**
 * Miembros de un segmento (11.3). No hay GET /api/segments/{id}: la
 * cabecera (nombre, memberCount, estado) sale de la lista completa
 * (GET /api/segments?includeArchived=true), filtrada por id.
 */
@Component({
  selector: 'app-segment-members',
  imports: [UiButton, UiField, UiTypeahead, UiTable, UiStatus, UiEmpty],
  template: `
    <section class="sgm-page">
      @if (segment(); as s) {
        <div class="sgm-head">
          <div>
            <h1>{{ s.name }}</h1>
            <p class="sgm-sub">{{ s.code }} · {{ memberCountText(s.memberCount) }} clientes</p>
          </div>
          <ui-status [label]="s.active ? 'Activo' : 'Archivado'" />
        </div>

        @if (!s.active) {
          <div class="sgm-archived-banner">
            Segmento archivado: reactívalo para modificar sus miembros.
          </div>
        }

        <div class="sgm-toolbar">
          <ui-field label="Buscar" placeholder="Nombre, código o documento" [(value)]="query" />
          @if (s.active) {
            <ui-typeahead
              label="Agregar cliente"
              [clearOnPick]="true"
              [search]="customerSearch"
              (picked)="addMember($event)"
            />
            <button uiButton variant="secondary" (click)="openImport()">Importar archivo</button>
          }
        </div>

        @if (addError()) {
          <div class="sgm-error">{{ addError() }}</div>
        }

        <ui-table
          [loading]="loading()"
          [error]="error()"
          errorMessage="No pudimos cargar los miembros."
          [empty]="!loading() && !error() && members().length === 0"
          (retry)="load()"
        >
          <div empty>
            <ui-empty title="Sin miembros" body="Agrega clientes a mano o importa un archivo." />
          </div>

          <table class="ui-table-grid sgm-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Agregado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (m of members(); track m.customerId) {
                <tr>
                  <td class="sgm-muted">{{ m.code }}</td>
                  <td>
                    {{ m.businessName }}
                    @if (!m.customerActive) {
                      <ui-status label="Dado de baja" />
                    }
                  </td>
                  <td class="sgm-muted">{{ m.documentNumber || '—' }}</td>
                  <td class="sgm-muted">{{ dateTimeText(m.addedAt) }}</td>
                  <td class="sgm-row-action">
                    @if (s.active) {
                      <button uiButton variant="ghost" size="sm" (click)="removeMember(m)">
                        Quitar
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </ui-table>

        @if (!loading() && !error() && members().length > 0) {
          <div class="sgm-pager">
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() === 0"
              (click)="prevPage()"
            >
              Anterior
            </button>
            <span class="sgm-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      }
    </section>
  `,
  styles: [
    `
      .sgm-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .sgm-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .sgm-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .sgm-archived-banner {
        margin-top: 16px;
        padding: 12px 16px;
        border: 1px solid var(--hairline);
        background: var(--faint);
        font-size: 13px;
        color: var(--ink-muted);
      }
      .sgm-toolbar {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        margin: 24px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
        flex-wrap: wrap;
      }
      .sgm-toolbar ui-field,
      .sgm-toolbar ui-typeahead {
        width: 280px;
      }
      .sgm-error {
        margin-top: 12px;
        color: var(--accent-ink);
        font-size: 13px;
      }
      .sgm-table {
        width: 100%;
      }
      .sgm-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .sgm-row-action {
        text-align: right;
      }
      .sgm-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .sgm-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      @media (max-width: 767px) {
        .sgm-page {
          padding: var(--sp-4);
        }
        .sgm-toolbar ui-field,
        .sgm-toolbar ui-typeahead {
          width: 100%;
        }
      }
    `,
  ],
})
export class SegmentMembersPage {
  private segmentSvc = inject(SegmentAdminService);
  private lookupSvc = inject(LookupService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  id = input('');

  protected dateTimeText = dateTimeText;
  protected customerSearch = (q: string) =>
    this.lookupSvc.customers(q).pipe(map((items) => toUiLookup(items)));

  protected segment = signal<SegmentView | null>(null);
  protected members = signal<MemberView[]>([]);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected query = signal('');
  protected loading = signal(true);
  protected error = signal(false);
  protected addError = signal('');

  private query$ = new Subject<string>();

  private loadHeaderEffect = effect(() => {
    if (this.id()) this.loadSegment();
  });

  constructor() {
    this.query$.pipe(debounceTime(250)).subscribe(() => {
      this.page.set(0);
      this.loadMembers();
    });
  }

  private queryChangeEffect = effect(() => {
    const q = this.query();
    untracked(() => this.query$.next(q));
  });

  private loadSegment() {
    this.segmentSvc.list(true).subscribe((list) => {
      const found = list.find((s) => s.segmentId === Number(this.id()));
      this.segment.set(found ?? null);
      this.loadMembers();
    });
  }

  load() {
    this.loadMembers();
  }

  private loadMembers() {
    const segmentId = Number(this.id());
    if (!segmentId) return;
    this.loading.set(true);
    this.error.set(false);
    this.segmentSvc.members(segmentId, this.query(), this.page(), 50).subscribe({
      next: (result) => {
        this.members.set(result.content ?? []);
        this.totalPages.set(result.totalPages ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected memberCountText(n: number): string {
    return n.toLocaleString('es-PE');
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.loadMembers();
  }
  protected nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.loadMembers();
  }

  protected addMember(item: UiLookupItem) {
    const segmentId = this.segment()?.segmentId;
    if (!segmentId) return;
    this.addError.set('');
    this.segmentSvc.addMember(segmentId, item.id).subscribe({
      next: () => {
        this.toast.success('Cliente agregado.');
        this.loadSegment();
      },
      error: (err) => {
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.addError.set(detalle || 'No pudimos agregar el cliente.');
      },
    });
  }

  protected removeMember(m: MemberView) {
    const segmentId = this.segment()?.segmentId;
    if (!segmentId) return;
    this.dialog
      .confirm({
        title: 'Quitar cliente',
        message: `¿Quitar a ${m.businessName} del segmento?`,
        confirmLabel: 'Quitar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.segmentSvc.removeMember(segmentId, m.customerId).subscribe(() => {
          this.toast.success('Cliente quitado.');
          this.loadSegment();
        });
      });
  }

  protected openImport() {
    const segmentId = this.segment()?.segmentId;
    if (!segmentId) return;
    this.dialog
      .open<ImportMembersDialog, { segmentId: number }, ImportMembersDialogResult>(
        ImportMembersDialog,
        { data: { segmentId }, width: '560px' },
      )
      .afterClosed()
      .subscribe((res) => {
        if (res) {
          this.toast.success('Segmento actualizado.');
          this.loadSegment();
        }
      });
  }
}
