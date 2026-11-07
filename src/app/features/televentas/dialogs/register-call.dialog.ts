import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { TelesalesApi } from '../data-access/televentas.api';
import { NO_PURCHASE_VISIT_STATUS_ID } from '../domain/televentas.format';
import { VisitView } from '../domain/televentas.models';

export interface RegisterCallDialogData {
  customerId: number;
  customerName: string;
  assignmentId: number;
}

/**
 * Registrar una llamada sin pedido — doc 42, sección 8. El resultado es
 * siempre "No compró": Cerrado no aplica a una llamada y Atendido lo
 * registra el backend solo al crear un pedido (sección 8.1).
 */
@Component({
  selector: 'app-register-call-dialog',
  imports: [UiButton, UiField, UiModal],
  template: `
    <ui-modal title="Registrar llamada" [subtitle]="data.customerName" (close)="ref.close(false)">
      <div class="rc-body">
        <div class="rc-result">
          <span class="rc-result-label">Resultado</span>
          <span class="rc-result-value">● No compró</span>
        </div>

        @if (loadingReasons()) {
          <p class="rc-muted">Cargando motivos…</p>
        } @else {
          <ui-field
            label="Motivo"
            type="select"
            [(value)]="visitReasonId"
            [options]="reasonOptions()"
            [error]="reasonError()"
          />
        }

        @if (error()) {
          <div class="rc-error">{{ error() }}</div>
        }
      </div>

      <ng-container modalFooter>
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button
          uiButton
          variant="primary"
          [loading]="saving()"
          [disabled]="loadingReasons()"
          (click)="submit()"
        >
          Registrar
        </button>
      </ng-container>
    </ui-modal>
  `,
  styles: [
    `
      .rc-body {
        display: grid;
        gap: var(--sp-4);
      }
      .rc-result {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--sp-3) var(--sp-4);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-control);
        background: var(--surface-sunk);
      }
      .rc-result-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .rc-result-value {
        font-weight: 700;
        color: var(--st-no-purchase);
      }
      .rc-muted {
        margin: 0;
        color: var(--ink-muted);
        font-size: var(--fs-dense);
      }
      .rc-error {
        color: var(--status-danger);
        font-size: var(--fs-dense);
      }
    `,
  ],
})
export class RegisterCallDialog {
  protected data = inject<RegisterCallDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<VisitView | false>);
  private api = inject(TelesalesApi);

  protected loadingReasons = signal(true);
  protected reasonOptions = signal<UiFieldOption[]>([]);
  protected visitReasonId = signal('');
  protected saving = signal(false);
  protected submitted = signal(false);
  protected error = signal('');

  constructor() {
    this.api.visitReasons(NO_PURCHASE_VISIT_STATUS_ID).subscribe({
      next: (list) => {
        this.reasonOptions.set([
          { value: '', label: 'Selecciona' },
          ...list.map((r) => ({ value: String(r.visitReasonId), label: r.name })),
        ]);
        this.loadingReasons.set(false);
      },
      error: () => this.loadingReasons.set(false),
    });
  }

  protected reasonError(): string {
    return this.submitted() && !this.visitReasonId() ? 'Elige un motivo' : '';
  }

  protected submit() {
    this.submitted.set(true);
    if (!this.visitReasonId()) return;

    this.saving.set(true);
    this.error.set('');
    this.api
      .registerVisit({
        assignmentId: this.data.assignmentId,
        visitStatusId: NO_PURCHASE_VISIT_STATUS_ID,
        visitReasonId: Number(this.visitReasonId()),
        remote: true,
      })
      .subscribe({
        next: (visit) => {
          this.saving.set(false);
          this.ref.close(visit);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(detalle || 'No pudimos registrar la llamada.');
        },
      });
  }
}
