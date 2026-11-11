import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { SegmentAdminService } from '../segment-admin';
import { SegmentView } from '../segment.models';

/** "Nuevo segmento" — POST /api/segments. Nace activo y vacío. */
@Component({
  selector: 'app-new-segment-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="nsd">
      <h2 class="nsd-title">Nuevo segmento</h2>
      <ui-field label="Código" [(value)]="code" hint="Máx. 30 caracteres, único" />
      <ui-field label="Nombre" [(value)]="name" hint="Máx. 100 caracteres" />

      @if (error()) {
        <div class="nsd-error">{{ error() }}</div>
      }

      <div class="nsd-actions">
        <button uiButton variant="secondary" (click)="ref.close()">Cancelar</button>
        <button
          uiButton
          variant="primary"
          [loading]="saving()"
          [disabled]="!code().trim() || !name().trim()"
          (click)="submit()"
        >
          Crear segmento
        </button>
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .nsd {
        display: grid;
        gap: 16px;
      }
      .nsd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .nsd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .nsd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class NewSegmentDialog {
  protected ref = inject(UiDialogRef<SegmentView>);
  private data = inject<{ prefillCode?: string } | null>(UI_DIALOG_DATA, { optional: true });
  private segmentSvc = inject(SegmentAdminService);

  protected code = signal(this.data?.prefillCode ?? '');
  protected name = signal('');
  protected saving = signal(false);
  protected error = signal('');

  protected submit() {
    this.saving.set(true);
    this.error.set('');
    this.segmentSvc
      .create({ code: this.code().trim().toUpperCase(), name: this.name().trim() })
      .subscribe({
        next: (segment) => {
          this.saving.set(false);
          this.ref.close(segment);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(detalle || 'No pudimos crear el segmento.');
        },
      });
  }
}
