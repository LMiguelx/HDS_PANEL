import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { CompanyAdminService } from '../company-admin';
import { CycleAnchorImpactPreview } from '../../../shared/models/assignment-cycle.models';
import { dateText } from '../../assignments/assignment-format';

/**
 * Cambiar fecha ancla del ciclo de asignaciones — doc 65, sección 3.4. Dos
 * pasos: elegir fecha (PUT `confirm:false` para la vista previa) y aplicar
 * (mismo PUT con `confirm:true`). Nunca cambia nada antes de "Aplicar
 * cambio".
 */
@Component({
  selector: 'app-cycle-anchor-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="cad">
      @if (step() === 'pick') {
        <h2 class="cad-title">Cambiar fecha ancla</h2>
        <ui-field
          label="Nueva fecha ancla"
          type="date"
          [(value)]="newDate"
          hint="Se recomienda un lunes. Cambiarla mueve la semana del ciclo para todas las asignaciones."
        />
        @if (errorMsg()) {
          <p class="cad-error">{{ errorMsg() }}</p>
        }
        <div class="cad-actions">
          <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
          <button
            uiButton
            variant="primary"
            [disabled]="!newDate()"
            [loading]="loading()"
            (click)="viewImpact()"
          >
            Ver impacto
          </button>
        </div>
      } @else if (preview(); as p) {
        <h2 class="cad-title">Vista previa del cambio</h2>
        <p class="cad-summary">
          Con la fecha {{ dateText(newDate()) }}, hoy pasaría de la semana
          {{ p.currentWeekToday }} a la semana {{ p.proposedWeekToday }}.
        </p>
        <p class="cad-summary">
          De {{ p.totalAssignmentsWithWeekFilter }} asignación{{
            p.totalAssignmentsWithWeekFilter === 1 ? '' : 'es'
          }}
          con semanas del ciclo:
        </p>
        <ul class="cad-impact-list">
          <li>{{ p.appearingToday }} empiezan a visitarse hoy</li>
          <li>{{ p.disappearingToday }} dejan de visitarse hoy</li>
        </ul>
        @if (errorMsg()) {
          <p class="cad-error">{{ errorMsg() }}</p>
        }
        <div class="cad-actions">
          <button uiButton variant="secondary" (click)="back()">Volver</button>
          <button uiButton variant="primary" [loading]="applying()" (click)="apply()">
            Aplicar cambio
          </button>
        </div>
      }
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .cad {
        display: grid;
        gap: 14px;
        width: 100%;
      }
      .cad-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .cad-summary {
        margin: 0;
        font-size: 14px;
        color: var(--ink);
      }
      .cad-impact-list {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 4px;
        font-size: 14px;
        font-weight: 700;
        color: var(--ink);
      }
      .cad-error {
        margin: 0;
        color: var(--status-danger);
        font-size: 13px;
      }
      .cad-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class CycleAnchorDialog {
  protected ref = inject(UiDialogRef<boolean>);
  private companySvc = inject(CompanyAdminService);

  protected dateText = dateText;

  protected step = signal<'pick' | 'preview'>('pick');
  protected newDate = signal('');
  protected preview = signal<CycleAnchorImpactPreview | null>(null);
  protected loading = signal(false);
  protected applying = signal(false);
  protected errorMsg = signal('');

  protected viewImpact() {
    if (!this.newDate()) return;
    this.loading.set(true);
    this.errorMsg.set('');
    this.companySvc.updateCycleAnchor({ date: this.newDate(), confirm: false }).subscribe({
      next: (p) => {
        this.loading.set(false);
        this.preview.set(p);
        this.step.set('preview');
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.detail ?? 'No pudimos calcular el impacto.');
      },
    });
  }

  protected back() {
    this.step.set('pick');
    this.errorMsg.set('');
  }

  protected apply() {
    this.applying.set(true);
    this.errorMsg.set('');
    this.companySvc.updateCycleAnchor({ date: this.newDate(), confirm: true }).subscribe({
      next: () => {
        this.applying.set(false);
        this.ref.close(true);
      },
      error: (err) => {
        this.applying.set(false);
        this.errorMsg.set(err?.error?.detail ?? 'No pudimos aplicar el cambio.');
      },
    });
  }
}
