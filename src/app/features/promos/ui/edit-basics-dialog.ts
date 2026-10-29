import { Component, computed, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiCheckbox } from '../../../shared/ui/checkbox/checkbox';
import { UiToggle } from '../../../shared/ui/toggle/toggle';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { PromoService } from '../promo';
import { PromoDetail } from '../promo.types';
import { dateText, PRIORITY_OPTIONS } from '../promo-format';

/** `'duplicate'`: el usuario pulsó Duplicar — el detalle hace la navegación real. */
export type EditBasicsDialogResult = PromoDetail | 'duplicate';

/**
 * Edición básica — doc 44, sección 7.3: PATCH /promos/{id}/basics. Única
 * vía de edición cuando `definitionEditable = false` (ya se aplicó en
 * pedidos): nombre, fecha de fin y prioridad, nada más.
 */
@Component({
  selector: 'app-edit-basics-dialog',
  imports: [UiButton, UiField, UiCheckbox, UiToggle],
  template: `
    <div class="ebd">
      <h2 class="ebd-title">Editar promoción · {{ promo.code }}</h2>

      <div class="ebd-banner">
        <span class="material-icons" aria-hidden="true">info</span>
        <div>
          {{ promo.editBlockReason || 'Ya se aplicó en pedidos: solo puedes cambiar estos datos.' }}
          Para cambiar la regla, duplícala.
        </div>
        <button uiButton variant="secondary" size="sm" (click)="duplicate()">Duplicar</button>
      </div>

      <ui-field label="Nombre" [(value)]="name" [error]="nameError()" />

      <div class="ebd-vigencia">
        <div class="ebd-from">
          <span class="ebd-from-label">Desde</span>
          <span class="ebd-from-value">{{ startDateText }}</span>
          <span class="ebd-from-hint">no se puede cambiar</span>
        </div>
        <ui-field
          label="Hasta"
          type="date"
          [(value)]="endDate"
          [disabled]="noEndDate()"
          [error]="endDateError()"
        />
      </div>
      <ui-checkbox label="Sin fecha de fin" [(checked)]="noEndDate" />

      <ui-field label="Prioridad" type="select" [(value)]="priority" [options]="priorityOptions" />

      <ui-toggle
        label="Destacada en la app"
        [(checked)]="featured"
        hint="El vendedor la ve entre las primeras. No cambia cómo se aplica la promoción."
      />

      @if (error()) {
        <div class="ebd-error">{{ error() }}</div>
      }

      <div class="ebd-actions">
        <button uiButton variant="secondary" (click)="ref.close()">Cancelar</button>
        <button
          uiButton
          variant="primary"
          [loading]="saving()"
          [disabled]="!canSave()"
          (click)="submit()"
        >
          Guardar cambios
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
      .ebd {
        display: grid;
        gap: 16px;
      }
      .ebd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .ebd-banner {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        background: var(--faint);
        border: 1px solid var(--hairline);
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ebd-banner .material-icons {
        font-size: 18px;
        color: var(--ink-muted);
      }
      .ebd-banner button {
        flex: none;
      }
      .ebd-vigencia {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        align-items: end;
      }
      .ebd-from {
        display: grid;
        gap: 4px;
      }
      .ebd-from-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .ebd-from-value {
        min-height: var(--touch-min);
        display: flex;
        align-items: center;
        font-size: 14px;
        color: var(--ink);
      }
      .ebd-from-hint {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .ebd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .ebd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      @media (max-width: 500px) {
        .ebd-vigencia {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class EditBasicsDialog {
  protected ref = inject(UiDialogRef<EditBasicsDialogResult>);
  protected promo = inject<PromoDetail>(UI_DIALOG_DATA);
  private promoSvc = inject(PromoService);

  protected priorityOptions = PRIORITY_OPTIONS;
  protected startDateText = dateText(this.promo.startDate ?? undefined) || 'Sin fecha de inicio';

  protected name = signal(this.promo.name ?? '');
  protected endDate = signal(this.promo.endDate ?? '');
  protected noEndDate = signal(!this.promo.endDate);
  protected priority = signal(this.promo.priority ? String(this.promo.priority) : '100');
  protected featured = signal(this.promo.featured ?? false);
  protected saving = signal(false);
  protected error = signal('');

  protected nameError = computed(() => (this.name().trim() ? '' : 'Escribe un nombre.'));
  protected endDateError = computed(() => {
    if (this.noEndDate() || !this.endDate() || !this.promo.startDate) return '';
    return this.endDate() < this.promo.startDate ? 'No puede ser anterior a "Desde".' : '';
  });

  private hasChanges = computed(() => {
    const originalEndDate = this.promo.endDate ?? '';
    const newEndDate = this.noEndDate() ? '' : this.endDate();
    return (
      this.name().trim() !== (this.promo.name ?? '').trim() ||
      newEndDate !== originalEndDate ||
      Number(this.priority()) !== this.promo.priority ||
      this.featured() !== (this.promo.featured ?? false)
    );
  });

  protected canSave = computed(
    () => !this.saving() && !this.nameError() && !this.endDateError() && this.hasChanges(),
  );

  protected duplicate() {
    this.ref.close('duplicate');
  }

  protected submit() {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set('');
    this.promoSvc
      .updateBasics(this.promo.promoId!, {
        name: this.name().trim(),
        endDate: this.noEndDate() ? null : this.endDate() || null,
        priority: Number(this.priority()),
        featured: this.featured(),
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.ref.close(updated);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(detalle || 'No pudimos guardar los cambios.');
        },
      });
  }
}
