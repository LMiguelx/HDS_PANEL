import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { map } from 'rxjs/operators';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { LookupService, toUiLookup } from '../../promos/lookup';
import { AssignmentAdminService } from '../assignment-admin';
import {
  CoverageCandidateView,
  CoverageSelection,
  ImportCoverageResult,
} from '../../../shared/models/assignment-admin.models';
import { ratingText } from '../../customers/customer-format';

export interface CoverageDialogData {
  absentUserId: number;
  absentUserName: string;
  /** Precargada al abrir desde el Mapa (sección 10.7); default = hoy. */
  defaultDate?: string;
}

type OptionKey = CoverageSelection | 'FILE';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadTemplate() {
  const csv = 'codigo\nC00873\nC00912\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-cobertura.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Cobertura puntual (`POST /api/admin/assignments/coverage`) — modal de 4
 * opciones (sección 12 del doc): Programados ese día (default), Toda la
 * cartera, Elegir a mano o Subir archivo. Ninguna opción cambia la
 * asignación real: pasa los clientes elegidos a quien cubre por un solo día.
 */
@Component({
  selector: 'app-coverage-dialog',
  imports: [UiButton, UiField, UiTypeahead],
  template: `
    <div class="cov">
      <h2 class="cov-title">Cobertura puntual</h2>
      <p class="cov-sub">
        Ausente: <strong>{{ data.absentUserName }}</strong>
      </p>

      <ui-typeahead
        label="Vendedor que cubre — busca por nombre"
        [clearOnPick]="false"
        [search]="userSearch"
        [selected]="covering()"
        (picked)="covering.set($event)"
      />

      <ui-field
        label="Fecha de cobertura"
        type="date"
        [(value)]="coverageDate"
        hint="Hoy o una fecha futura."
      />

      <ui-field
        label="Motivo (opcional)"
        type="textarea"
        [rows]="2"
        [(value)]="reason"
        hint="Máximo 255 caracteres."
      />

      @if (loadingCandidates()) {
        <div class="cov-skeleton" role="status" aria-label="Cargando cartera"></div>
      } @else {
        <div class="cov-options">
          <button
            type="button"
            class="cov-option-card"
            [class.selected]="option() === 'SCHEDULED'"
            (click)="option.set('SCHEDULED')"
          >
            <span class="cov-option-title">Programados ese día</span>
            <span class="cov-option-body"
              >{{ scheduledCandidates().length }} clientes que {{ data.absentUserName }} tenía en su
              ruta del {{ coverageDate() }}</span
            >
          </button>
          <button
            type="button"
            class="cov-option-card"
            [class.selected]="option() === 'ALL_PORTFOLIO'"
            (click)="option.set('ALL_PORTFOLIO')"
          >
            <span class="cov-option-title">Toda la cartera</span>
            <span class="cov-option-body"
              >Los {{ candidates().length }} clientes de {{ data.absentUserName }}</span
            >
          </button>
          <button
            type="button"
            class="cov-option-card"
            [class.selected]="option() === 'CUSTOMER_IDS'"
            (click)="option.set('CUSTOMER_IDS')"
          >
            <span class="cov-option-title">Elegir a mano</span>
            <span class="cov-option-body">Marca los clientes de la lista</span>
          </button>
          <button
            type="button"
            class="cov-option-card"
            [class.selected]="option() === 'FILE'"
            (click)="option.set('FILE')"
          >
            <span class="cov-option-title">Subir archivo</span>
            <span class="cov-option-body">CSV con los códigos de cliente</span>
          </button>
        </div>

        @switch (option()) {
          @case ('SCHEDULED') {
            @if (scheduledCandidates().length === 0) {
              <div class="cov-warn-text">
                {{ data.absentUserName }} no tiene clientes programados el {{ coverageDate() }}.
                Elige otra opción.
              </div>
            } @else {
              <div class="cov-customer-list cov-readonly">
                @for (c of scheduledCandidates(); track c.customerId) {
                  <div class="cov-customer-row">
                    <span class="cov-customer-body">
                      <span class="cov-customer-name">{{ c.businessName }}</span>
                      <span class="cov-customer-rating">{{ ratingText(c.rating) }}</span>
                    </span>
                    @if (c.existingCoveringUserId) {
                      <span class="cov-badge"
                        >ya cubierto por {{ c.existingCoveringUserName }}</span
                      >
                    }
                  </div>
                }
              </div>
            }
          }
          @case ('ALL_PORTFOLIO') {
            <p class="cov-warn-text">
              Se pasarán {{ candidates().length }} clientes a la app de
              {{ covering()?.name || 'quien cubre' }} por ese día.
            </p>
          }
          @case ('CUSTOMER_IDS') {
            <ui-field label="Buscar" placeholder="Nombre o código" [(value)]="manualQuery" />
            <div class="cov-manual-actions">
              <button uiButton variant="ghost" size="sm" (click)="markScheduled()">
                Marcar programados
              </button>
              <button uiButton variant="ghost" size="sm" (click)="markAll()">Marcar todos</button>
              <button uiButton variant="ghost" size="sm" (click)="markNone()">Ninguno</button>
              <span class="cov-manual-count"
                >{{ selected().size }} de {{ candidates().length }} seleccionados</span
              >
            </div>
            <div class="cov-customer-list">
              @for (c of filteredCandidates(); track c.customerId) {
                <label class="cov-customer-row cov-customer-row-clickable">
                  <input
                    type="checkbox"
                    [checked]="selected().has(c.customerId)"
                    (change)="toggle(c.customerId)"
                  />
                  <span class="cov-customer-body">
                    <span class="cov-customer-name">{{ c.businessName }}</span>
                    <span class="cov-customer-rating"
                      >{{ c.code }} · {{ ratingText(c.rating) }}</span
                    >
                  </span>
                  @if (c.scheduledOnDate) {
                    <span class="cov-chip">Programado</span>
                  }
                  @if (c.existingCoveringUserId) {
                    <span class="cov-badge">ya cubierto por {{ c.existingCoveringUserName }}</span>
                  }
                </label>
              }
            </div>
          }
          @case ('FILE') {
            @switch (fileState()) {
              @case ('pick') {
                <div
                  class="cov-dropzone"
                  [class.drag]="dragging()"
                  (dragover)="onDragOver($event)"
                  (dragleave)="dragging.set(false)"
                  (drop)="onDrop($event)"
                  (click)="fileInput.click()"
                >
                  <input
                    #fileInput
                    type="file"
                    accept=".csv,.txt"
                    class="cov-file-input"
                    (change)="onFileInputChange($event)"
                  />
                  @if (file()) {
                    <span class="cov-file-name">{{ file()!.name }}</span>
                  } @else {
                    <span
                      >Arrastra el archivo aquí o haz clic para elegirlo.<br />CSV con una columna:
                      el código de cliente.</span
                    >
                  }
                </div>
                <button type="button" class="cov-template-link" (click)="downloadTemplate()">
                  Descargar plantilla
                </button>
                @if (fileError()) {
                  <div class="cov-error">{{ fileError() }}</div>
                }
              }
              @case ('review') {
                @if (reviewResult(); as r) {
                  <div class="cov-cards">
                    <div class="cov-card">
                      <span class="cov-card-value">{{ r.totalRows }}</span>
                      <span class="cov-card-label">Filas leídas</span>
                    </div>
                    <div class="cov-card cov-card-highlight">
                      <span class="cov-card-value">{{ r.toCreate }}</span>
                      <span class="cov-card-label">Se cubrirán</span>
                    </div>
                    @if (r.toReassign > 0) {
                      <div class="cov-card cov-card-warn">
                        <span class="cov-card-value">{{ r.toReassign }}</span>
                        <span class="cov-card-label">Pasan a este vendedor</span>
                      </div>
                    }
                    <div class="cov-card">
                      <span class="cov-card-value">{{ r.alreadyCovered }}</span>
                      <span class="cov-card-label">Ya estaban cubiertos por él</span>
                    </div>
                    @if (r.notInPortfolio > 0) {
                      <div class="cov-card cov-card-warn">
                        <span class="cov-card-value">{{ r.notInPortfolio }}</span>
                        <span class="cov-card-label">De otra cartera</span>
                      </div>
                    }
                    @if (r.notFound > 0) {
                      <div class="cov-card cov-card-warn">
                        <span class="cov-card-value">{{ r.notFound }}</span>
                        <span class="cov-card-label">No encontrados</span>
                      </div>
                    }
                    @if (r.inactive > 0) {
                      <div class="cov-card cov-card-warn">
                        <span class="cov-card-value">{{ r.inactive }}</span>
                        <span class="cov-card-label">Dados de baja</span>
                      </div>
                    }
                    @if (r.invalidRows > 0) {
                      <div class="cov-card cov-card-warn">
                        <span class="cov-card-value">{{ r.invalidRows }}</span>
                        <span class="cov-card-label">Filas inválidas</span>
                      </div>
                    }
                  </div>
                  @if (r.toCreate + r.toReassign === 0) {
                    <div class="cov-warn-text">No hay cambios para aplicar.</div>
                  }
                }
              }
              @case ('done') {
                @if (finalResult(); as r) {
                  <p class="cov-done-text">
                    {{ r.toCreate }} cliente{{ r.toCreate === 1 ? '' : 's' }} cubierto{{
                      r.toCreate === 1 ? '' : 's'
                    }}
                    @if (r.toReassign > 0) {
                      y {{ r.toReassign }} reasignado{{ r.toReassign === 1 ? '' : 's' }}
                    }
                    por {{ covering()?.name }} el {{ coverageDate() }}.
                  </p>
                }
              }
            }
          }
        }
      }

      @if (reassignWarning() && option() !== 'FILE') {
        <div class="cov-warn-text">
          {{ reassignWarning() }} cliente{{ reassignWarning() === 1 ? '' : 's' }} ya estaban
          cubiertos por otro vendedor y pasarán a {{ covering()?.name || 'quien cubre' }}.
        </div>
      }

      @if (error()) {
        <div class="cov-error">{{ error() }}</div>
      }

      <div class="cov-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        @if (option() === 'FILE') {
          @switch (fileState()) {
            @case ('pick') {
              <button
                uiButton
                variant="primary"
                [loading]="reviewing()"
                [disabled]="!canReviewFile()"
                (click)="reviewFile()"
              >
                Revisar archivo
              </button>
            }
            @case ('review') {
              <button uiButton variant="secondary" (click)="fileState.set('pick')">
                Cambiar archivo
              </button>
              @if ((reviewResult()?.toCreate ?? 0) + (reviewResult()?.toReassign ?? 0) > 0) {
                <button uiButton variant="primary" [loading]="confirming()" (click)="confirmFile()">
                  Confirmar importación
                </button>
              }
            }
            @case ('done') {
              <button uiButton variant="primary" (click)="ref.close(true)">Listo</button>
            }
          }
        } @else {
          <button
            uiButton
            variant="primary"
            [loading]="saving()"
            [disabled]="!canSubmit()"
            (click)="submit()"
          >
            Cubrir {{ confirmCount() }} cliente{{ confirmCount() === 1 ? '' : 's' }}
          </button>
        }
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px; max-height:84vh; overflow-y:auto;',
  },
  styles: [
    `
      .cov {
        display: grid;
        gap: 16px;
        max-width: 560px;
      }
      .cov-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .cov-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .cov-skeleton {
        height: 90px;
        background: var(--faint);
      }
      .cov-options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .cov-option-card {
        text-align: left;
        border: 1px solid var(--divider);
        background: var(--bg);
        padding: 12px 14px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .cov-option-card.selected {
        border: 2px solid var(--accent);
      }
      .cov-option-title {
        font-weight: 800;
        font-size: 13px;
      }
      .cov-option-body {
        font-size: 12px;
        color: var(--ink-muted);
        line-height: 1.4;
      }
      .cov-manual-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }
      .cov-manual-count {
        margin-left: auto;
        font-size: 12px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .cov-customer-list {
        display: grid;
        gap: 2px;
        max-height: 240px;
        overflow-y: auto;
        border: 1px solid var(--hairline);
      }
      .cov-readonly .cov-customer-row {
        cursor: default;
      }
      .cov-customer-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        min-height: var(--touch-min);
        font-size: 13px;
      }
      .cov-customer-row-clickable {
        cursor: pointer;
      }
      .cov-customer-row-clickable:hover {
        background: var(--faint);
      }
      .cov-customer-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }
      .cov-customer-name {
        font-weight: 600;
        color: var(--ink);
      }
      .cov-customer-rating {
        font-size: 11px;
        color: var(--ink-muted);
      }
      .cov-chip {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        border: 1px solid var(--divider);
        padding: 1px 6px;
        white-space: nowrap;
      }
      .cov-badge {
        font-size: 11px;
        font-weight: 800;
        color: var(--st-pendiente);
        white-space: nowrap;
      }
      .cov-warn-text {
        font-size: 13px;
        color: var(--accent-ink);
        font-weight: 600;
      }
      .cov-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .cov-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .cov-dropzone {
        position: relative;
        border: 2px dashed var(--divider);
        padding: 28px 18px;
        text-align: center;
        font-size: 13px;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .cov-dropzone.drag {
        border-color: var(--accent);
        background: var(--faint);
      }
      .cov-file-input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
      .cov-file-name {
        font-weight: 800;
        color: var(--ink);
      }
      .cov-template-link {
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        color: var(--accent);
        font-size: 13px;
        font-weight: 600;
        text-decoration: underline;
        cursor: pointer;
        justify-self: start;
      }
      .cov-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(120px, 100%), 1fr));
        gap: 10px;
      }
      .cov-card {
        border: 1px solid var(--hairline);
        padding: 10px 12px;
      }
      .cov-card-highlight {
        border: 2px solid var(--divider);
      }
      .cov-card-warn {
        border-color: var(--accent-ink);
      }
      .cov-card-value {
        display: block;
        font-size: 20px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .cov-card-label {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        color: var(--ink-muted);
      }
      .cov-done-text {
        margin: 0;
        font-size: 15px;
      }
    `,
  ],
})
export class CoverageDialog {
  protected data = inject<CoverageDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private lookupSvc = inject(LookupService);
  private assignmentSvc = inject(AssignmentAdminService);

  protected ratingText = ratingText;

  protected covering = signal<UiLookupItem | null>(null);
  protected coverageDate = signal(this.data.defaultDate || todayIso());
  protected reason = signal('');
  protected option = signal<OptionKey>('SCHEDULED');

  protected candidates = signal<CoverageCandidateView[]>([]);
  protected loadingCandidates = signal(true);
  protected scheduledCandidates = computed(() =>
    this.candidates().filter((c) => c.scheduledOnDate),
  );

  protected manualQuery = signal('');
  protected selected = signal<Set<number>>(new Set());
  protected filteredCandidates = computed(() => {
    const q = this.manualQuery().trim().toLowerCase();
    if (!q) return this.candidates();
    return this.candidates().filter(
      (c) => c.businessName.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  });

  protected saving = signal(false);
  protected error = signal('');

  // Opción "Subir archivo"
  protected fileState = signal<'pick' | 'review' | 'done'>('pick');
  protected file = signal<File | null>(null);
  protected dragging = signal(false);
  protected fileError = signal('');
  protected reviewing = signal(false);
  protected confirming = signal(false);
  protected reviewResult = signal<ImportCoverageResult | null>(null);
  protected finalResult = signal<ImportCoverageResult | null>(null);

  protected userSearch = (q: string) =>
    this.lookupSvc
      .users(q, { role: 'VENDEDOR' })
      .pipe(map((items) => toUiLookup(items).filter((i) => i.id !== this.data.absentUserId)));

  protected reassignWarning = computed(() => {
    const ids =
      this.option() === 'SCHEDULED'
        ? this.scheduledCandidates().map((c) => c.customerId)
        : this.option() === 'ALL_PORTFOLIO'
          ? this.candidates().map((c) => c.customerId)
          : Array.from(this.selected());
    const set = new Set(ids);
    return this.candidates().filter((c) => set.has(c.customerId) && c.existingCoveringUserId)
      .length;
  });

  protected confirmCount = computed(() => {
    switch (this.option()) {
      case 'SCHEDULED':
        return this.scheduledCandidates().length;
      case 'ALL_PORTFOLIO':
        return this.candidates().length;
      case 'CUSTOMER_IDS':
        return this.selected().size;
      default:
        return 0;
    }
  });

  private loadCandidatesEffect = effect(() => {
    const date = this.coverageDate();
    untracked(() => this.loadCandidates(date));
  });

  private loadCandidates(date: string) {
    if (!date) return;
    this.loadingCandidates.set(true);
    this.assignmentSvc.coverageCandidates(this.data.absentUserId, date).subscribe({
      next: (rows) => {
        this.candidates.set(rows);
        this.selected.set(new Set());
        this.loadingCandidates.set(false);
      },
      error: () => this.loadingCandidates.set(false),
    });
  }

  protected toggle(customerId: number) {
    const next = new Set(this.selected());
    next.has(customerId) ? next.delete(customerId) : next.add(customerId);
    this.selected.set(next);
  }

  protected markScheduled() {
    this.selected.set(new Set(this.scheduledCandidates().map((c) => c.customerId)));
  }
  protected markAll() {
    this.selected.set(new Set(this.candidates().map((c) => c.customerId)));
  }
  protected markNone() {
    this.selected.set(new Set());
  }

  protected canSubmit(): boolean {
    if (!this.covering() || !this.coverageDate()) return false;
    if (this.option() === 'SCHEDULED') return this.scheduledCandidates().length > 0;
    if (this.option() === 'ALL_PORTFOLIO') return this.candidates().length > 0;
    if (this.option() === 'CUSTOMER_IDS') return this.selected().size > 0;
    return false;
  }

  protected submit() {
    const coveringUserId = this.covering()?.id;
    if (!coveringUserId || !this.coverageDate()) return;
    const selection = this.option() as CoverageSelection;
    const customerIds = selection === 'CUSTOMER_IDS' ? Array.from(this.selected()) : [];
    this.saving.set(true);
    this.error.set('');
    this.assignmentSvc
      .coverage({
        absentUserId: this.data.absentUserId,
        coveringUserId,
        coverageDate: this.coverageDate(),
        selection,
        customerIds,
        reason: this.reason() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.ref.close(true);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(
            detalle
              ? `No pudimos registrar la cobertura: ${detalle}`
              : 'No pudimos registrar la cobertura.',
          );
        },
      });
  }

  // ---- Subir archivo ----

  protected canReviewFile(): boolean {
    return !!this.file() && !this.fileError() && !!this.covering() && !!this.coverageDate();
  }

  protected onDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(true);
  }
  protected onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(false);
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.setFile(f);
  }
  protected onFileInputChange(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) this.setFile(f);
  }
  private setFile(f: File) {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
    if (ext !== '.csv' && ext !== '.txt') {
      this.fileError.set('El archivo debe ser .csv o .txt');
      this.file.set(null);
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      this.fileError.set('El archivo supera los 5 MB.');
      this.file.set(null);
      return;
    }
    this.fileError.set('');
    this.file.set(f);
  }

  protected downloadTemplate() {
    downloadTemplate();
  }

  private importParams() {
    return {
      absentUserId: this.data.absentUserId,
      coveringUserId: this.covering()!.id,
      coverageDate: this.coverageDate(),
      reason: this.reason() || undefined,
    };
  }

  protected reviewFile() {
    const file = this.file();
    if (!file) return;
    this.reviewing.set(true);
    this.assignmentSvc.importCoverage(this.importParams(), file, true).subscribe({
      next: (result) => {
        this.reviewing.set(false);
        this.reviewResult.set(result);
        this.fileState.set('review');
      },
      error: (err) => {
        this.reviewing.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.fileError.set(detalle || 'No pudimos leer el archivo.');
      },
    });
  }

  protected confirmFile() {
    const file = this.file();
    if (!file) return;
    this.confirming.set(true);
    this.assignmentSvc.importCoverage(this.importParams(), file, false).subscribe({
      next: (result) => {
        this.confirming.set(false);
        this.finalResult.set(result);
        this.fileState.set('done');
      },
      error: (err) => {
        this.confirming.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(detalle || 'No pudimos aplicar la importación.');
      },
    });
  }
}
