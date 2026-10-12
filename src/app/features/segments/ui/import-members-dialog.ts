import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { SegmentAdminService } from '../segment-admin';
import { ImportMembersResult, ImportMode, SegmentView } from '../segment.models';

export interface ImportMembersDialogData {
  /** Si viene, importa a ESE segmento existente y muestra el selector de modo
   *  (caso "Importar archivo" desde Miembros). Si no viene, el modal primero
   *  pide Código y Nombre, crea el segmento (POST /api/segments) y usa
   *  siempre modo ADD (casos "Nuevo segmento desde archivo" / paso 4). */
  segmentId?: number;
}

export interface ImportMembersDialogResult {
  segment: SegmentView | null; // el creado, si el modal lo creó; null si ya existía
  result: ImportMembersResult;
}

const MODE_OPTIONS: UiFieldOption[] = [
  { value: 'ADD', label: 'Agregar al segmento' },
  { value: 'REPLACE', label: 'Reemplazar el segmento' },
];

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function downloadTemplate() {
  const csv = 'codigo\nC00873\nC00912\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-segmento.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Modal de importación de miembros por archivo CSV — sección 12.6 del doc.
 * Mismo componente en tres lugares: Segmentos → "Nuevo segmento desde
 * archivo", asistente paso 4 → "Crear segmento desde archivo" (sin
 * `data.segmentId`, siempre modo ADD) y Miembros → "Importar archivo" (con
 * `data.segmentId`, selector de modo visible). Siempre dos llamadas con el
 * mismo archivo: dryRun=true para revisar, dryRun=false para confirmar.
 */
@Component({
  selector: 'app-import-members-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="imd">
      <h2 class="imd-title">Importar clientes por archivo</h2>

      @switch (state()) {
        @case ('pick') {
          @if (!data?.segmentId) {
            <ui-field label="Código del segmento" [(value)]="code" hint="Máx. 30, único" />
            <ui-field label="Nombre del segmento" [(value)]="name" hint="Máx. 100" />
          }

          <div
            class="imd-dropzone"
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
              class="imd-file-input"
              (change)="onFileInputChange($event)"
            />
            @if (file()) {
              <span class="imd-file-name">{{ file()!.name }}</span>
            } @else {
              <span
                >Arrastra el archivo aquí o haz clic para elegirlo.<br />CSV con una columna: el
                código de cliente. Desde Excel: Guardar como → CSV UTF-8.</span
              >
            }
          </div>
          <button type="button" class="imd-template-link" (click)="downloadTemplate()">
            Descargar plantilla
          </button>

          @if (data?.segmentId) {
            <ui-field label="Modo" type="select" [(value)]="mode" [options]="modeOptions" />
          }

          @if (fileError()) {
            <div class="imd-error">{{ fileError() }}</div>
          }

          <div class="imd-actions">
            <button uiButton variant="secondary" (click)="ref.close()">Cancelar</button>
            <button
              uiButton
              variant="primary"
              [loading]="reviewing()"
              [disabled]="!canReview()"
              (click)="review()"
            >
              Revisar archivo
            </button>
          </div>
        }
        @case ('review') {
          @if (reviewResult(); as r) {
            <div class="imd-cards">
              <div class="imd-card">
                <span class="imd-card-value">{{ r.totalRows }}</span>
                <span class="imd-card-label">Filas leídas</span>
              </div>
              <div class="imd-card">
                <span class="imd-card-value">{{ r.matched }}</span>
                <span class="imd-card-label">Encontrados</span>
              </div>
              <div class="imd-card imd-card-highlight">
                <span class="imd-card-value">{{ r.toAdd }}</span>
                <span class="imd-card-label">Se agregarán</span>
              </div>
              <div class="imd-card">
                <span class="imd-card-value">{{ r.alreadyMembers }}</span>
                <span class="imd-card-label">Ya estaban</span>
              </div>
              @if (mode() === 'REPLACE') {
                <div class="imd-card imd-card-warn">
                  <span class="imd-card-value">{{ r.toRemove }}</span>
                  <span class="imd-card-label">Se quitarán</span>
                </div>
              }
              @if (r.notFound > 0) {
                <div class="imd-card imd-card-warn">
                  <span class="imd-card-value">{{ r.notFound }}</span>
                  <span class="imd-card-label">No encontrados</span>
                </div>
              }
              @if (r.inactive > 0) {
                <div class="imd-card imd-card-warn">
                  <span class="imd-card-value">{{ r.inactive }}</span>
                  <span class="imd-card-label">Dados de baja</span>
                </div>
              }
              @if (r.duplicatesInFile > 0) {
                <div class="imd-card">
                  <span class="imd-card-value">{{ r.duplicatesInFile }}</span>
                  <span class="imd-card-label">Repetidos en el archivo</span>
                </div>
              }
              @if (r.invalidRows > 0) {
                <div class="imd-card imd-card-warn">
                  <span class="imd-card-value">{{ r.invalidRows }}</span>
                  <span class="imd-card-label">Filas inválidas</span>
                </div>
              }
            </div>

            @if (r.notFound > 0) {
              <details class="imd-details">
                <summary>Mostrando hasta 50. Revisa estos códigos en el archivo.</summary>
                <div class="imd-sample">{{ r.notFoundSample.join(', ') }}</div>
                <button uiButton variant="ghost" size="sm" (click)="copy(r.notFoundSample)">
                  Copiar códigos
                </button>
              </details>
            }
            @if (r.invalidRows > 0) {
              <details class="imd-details">
                <summary>Estas filas no tienen un código válido (máximo 10 caracteres).</summary>
                <div class="imd-sample">{{ r.invalidSample.join(', ') }}</div>
                <button uiButton variant="ghost" size="sm" (click)="copy(r.invalidSample)">
                  Copiar códigos
                </button>
              </details>
            }

            @if (mode() === 'REPLACE' && r.toRemove > 0) {
              <div class="imd-warn-text">
                Se quitarán {{ r.toRemove }} clientes que hoy están en el segmento y no vienen en el
                archivo.
              </div>
            }

            @if (r.toAdd === 0 && r.toRemove === 0) {
              <div class="imd-warn-text">No hay cambios para aplicar.</div>
            }

            @if (confirmError()) {
              <div class="imd-error">{{ confirmError() }}</div>
            }

            <div class="imd-actions">
              <button uiButton variant="secondary" (click)="state.set('pick')">
                Cambiar archivo
              </button>
              @if (r.toAdd > 0 || r.toRemove > 0) {
                <button
                  uiButton
                  variant="primary"
                  [loading]="confirming()"
                  (click)="confirmImport()"
                >
                  Confirmar importación
                </button>
              }
            </div>
          }
        }
        @case ('done') {
          @if (finalResult(); as r) {
            <div class="imd-done">
              <p class="imd-done-text">
                Segmento actualizado: {{ r.toAdd }} cliente{{ r.toAdd === 1 ? '' : 's' }} agregado{{
                  r.toAdd === 1 ? '' : 's'
                }}
                @if (r.toRemove > 0) {
                  y {{ r.toRemove }} quitado{{ r.toRemove === 1 ? '' : 's' }}
                }
                .
              </p>
            </div>
            <div class="imd-actions">
              <button uiButton variant="primary" (click)="finish()">Listo</button>
            </div>
          }
        }
      }
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .imd {
        display: grid;
        gap: 16px;
      }
      .imd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .imd-dropzone {
        position: relative;
        border: 2px dashed var(--divider);
        padding: 28px 18px;
        text-align: center;
        font-size: 13px;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .imd-dropzone.drag {
        border-color: var(--accent);
        background: var(--faint);
      }
      .imd-file-input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
      .imd-file-name {
        font-weight: 800;
        color: var(--ink);
      }
      .imd-template-link {
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
      .imd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .imd-warn-text {
        color: var(--accent-ink);
        font-size: 13px;
        font-weight: 600;
      }
      .imd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .imd-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(120px, 100%), 1fr));
        gap: 10px;
      }
      .imd-card {
        border: 1px solid var(--hairline);
        padding: 10px 12px;
      }
      .imd-card-highlight {
        border: 2px solid var(--divider);
      }
      .imd-card-warn {
        border-color: var(--accent-ink);
      }
      .imd-card-value {
        display: block;
        font-size: 20px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .imd-card-label {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        color: var(--ink-muted);
      }
      .imd-details {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .imd-details summary {
        cursor: pointer;
        color: var(--ink);
      }
      .imd-sample {
        margin: 8px 0;
        font-family: monospace;
        font-size: 12px;
        word-break: break-word;
      }
      .imd-done-text {
        margin: 0;
        font-size: 15px;
      }
    `,
  ],
})
export class ImportMembersDialog {
  protected ref = inject(UiDialogRef<ImportMembersDialogResult>);
  protected data = inject<ImportMembersDialogData | null>(UI_DIALOG_DATA, { optional: true });
  private segmentSvc = inject(SegmentAdminService);

  protected modeOptions = MODE_OPTIONS;
  protected code = signal('');
  protected name = signal('');
  protected mode = signal<ImportMode>(this.data?.segmentId ? 'ADD' : 'ADD');
  protected file = signal<File | null>(null);
  protected dragging = signal(false);
  protected fileError = signal('');

  protected state = signal<'pick' | 'review' | 'done'>('pick');
  protected reviewing = signal(false);
  protected confirming = signal(false);
  protected confirmError = signal('');
  protected reviewResult = signal<ImportMembersResult | null>(null);
  protected finalResult = signal<ImportMembersResult | null>(null);

  private createdSegment: SegmentView | null = null;

  protected canReview(): boolean {
    if (!this.file() || this.fileError()) return false;
    if (!this.data?.segmentId) return !!this.code().trim() && !!this.name().trim();
    return true;
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

  protected copy(sample: string[]) {
    navigator.clipboard?.writeText(sample.join(', '));
  }

  protected review() {
    const file = this.file();
    if (!file) return;
    this.reviewing.set(true);
    this.confirmError.set('');

    const runImport = (segmentId: number) => {
      this.segmentSvc.importMembers(segmentId, file, this.mode(), true).subscribe({
        next: (result) => {
          this.reviewing.set(false);
          this.reviewResult.set(result);
          this.state.set('review');
        },
        error: (err) => {
          this.reviewing.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.fileError.set(detalle || 'No pudimos leer el archivo.');
        },
      });
    };

    if (this.data?.segmentId) {
      runImport(this.data.segmentId);
    } else {
      this.segmentSvc
        .create({ code: this.code().trim().toUpperCase(), name: this.name().trim() })
        .subscribe({
          next: (segment) => {
            this.createdSegment = segment;
            runImport(segment.segmentId);
          },
          error: (err) => {
            this.reviewing.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.fileError.set(detalle || 'No pudimos crear el segmento.');
          },
        });
    }
  }

  protected confirmImport() {
    const file = this.file();
    const segmentId = this.data?.segmentId ?? this.createdSegment?.segmentId;
    if (!file || !segmentId) return;
    this.confirming.set(true);
    this.confirmError.set('');
    this.segmentSvc.importMembers(segmentId, file, this.mode(), false).subscribe({
      next: (result) => {
        this.confirming.set(false);
        this.finalResult.set(result);
        this.state.set('done');
      },
      error: (err) => {
        this.confirming.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.confirmError.set(detalle || 'No pudimos aplicar la importación.');
      },
    });
  }

  protected finish() {
    const result = this.finalResult();
    if (!result) return;
    this.ref.close({ segment: this.createdSegment, result });
  }
}
