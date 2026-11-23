import { Component, computed, inject, signal } from '@angular/core';
import { format } from 'date-fns';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UiOptionCard } from '../../../shared/ui/option-card/option-card';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { durationText as durationLabel } from '../../assignments/assignment-format';
import { OrderIntakeAdminService } from '../../../core/order-intake/order-intake-admin';
import { ClosureView } from '../../../shared/models/order-intake.models';

export type ScheduleClosureDialogData =
  { mode: 'schedule' } | { mode: 'change-end'; closure: ClosureView };

const MAX_REASON_LENGTH = 200;

type DurationState = 'incomplete' | 'invalid' | 'valid';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function isoDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isoTimeStr(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function combine(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Programar cierre / Cambiar fin — doc 65, sección 2.10. Un solo componente
 * para los dos diálogos: comparten el campo Fin, los atajos y el cálculo de
 * duración; "Programar cierre" agrega Inicio (Ahora/Programar) y Motivo.
 * El error de validación solo aparece al salir de un campo o al enviar,
 * nunca al abrir — mientras el fin está vacío se ve una pista neutra.
 */
@Component({
  selector: 'app-schedule-closure-dialog',
  imports: [UiButton, UiField, UiModal, UiOptionCard],
  template: `
    <ui-modal
      [title]="isSchedule ? 'Programar cierre' : 'Cambiar fin del cierre'"
      subtitle="Toma de pedidos"
      (close)="ref.close(false)"
    >
      <div class="scd">
        @if (isSchedule) {
          <div class="scd-section">
            <span class="scd-section-label">Inicio</span>
            <div class="scd-option-row">
              <ui-option-card [selected]="startMode() === 'now'" (pick)="startMode.set('now')">
                <strong>Ahora</strong>
                <div class="scd-option-sub">Empieza al confirmar.</div>
              </ui-option-card>
              <ui-option-card
                [selected]="startMode() === 'scheduled'"
                (pick)="startMode.set('scheduled')"
              >
                <strong>Programar</strong>
                <div class="scd-option-sub">Elige fecha y hora de inicio.</div>
              </ui-option-card>
            </div>
            @if (startMode() === 'scheduled') {
              <div class="scd-row">
                <ui-field label="Fecha" type="date" [(value)]="startDate" (blur)="markTouched()" />
                <ui-field label="Hora" type="time" [(value)]="startTime" (blur)="markTouched()" />
              </div>
            }
          </div>
        }

        <div class="scd-section">
          <span class="scd-section-label">Fin</span>
          <div class="scd-row">
            <ui-field label="Fecha" type="date" [(value)]="endDate" (blur)="markTouched()" />
            <ui-field label="Hora" type="time" [(value)]="endTime" (blur)="markTouched()" />
          </div>
          <div class="scd-shortcuts">
            <button type="button" class="scd-shortcut" (click)="shortcutTomorrow6am()">
              Mañana 06:00
            </button>
            <button type="button" class="scd-shortcut" (click)="shortcutPlusHours(2)">+2 h</button>
            <button type="button" class="scd-shortcut" (click)="shortcutPlusHours(4)">+4 h</button>
          </div>
        </div>

        @switch (durationState()) {
          @case ('incomplete') {
            <p class="scd-hint">Elige cuándo termina el cierre para continuar.</p>
          }
          @case ('invalid') {
            @if (touched()) {
              <p class="scd-error-text">{{ invalidReasonText() }}</p>
            }
          }
          @case ('valid') {
            <div class="scd-summary">
              <div class="scd-summary-item">
                <span class="scd-summary-label">Inicia</span>
                <span>{{ startLabel() }}</span>
              </div>
              <div class="scd-summary-item">
                <span class="scd-summary-label">Termina</span>
                <span>{{ endLabel() }}</span>
              </div>
              <div class="scd-summary-item">
                <span class="scd-summary-label">Duración</span>
                <span>{{ durationLabelText() }}</span>
              </div>
            </div>
          }
        }

        @if (isSchedule) {
          <ui-field
            label="Motivo (opcional)"
            type="textarea"
            [rows]="2"
            [value]="reason()"
            (valueChange)="onReasonChange($event)"
            [hint]="reason().length + ' / ' + maxReasonLength"
          />
          <p class="scd-info">
            <span class="material-icons" aria-hidden="true">info</span>
            Vendedores y televentas no podrán crear, editar ni anular pedidos hasta el fin.
            Supervisión sigue operando. La toma de pedidos se reabre sola a la hora de fin.
          </p>
        }

        @if (errorMsg()) {
          <p class="scd-api-error">{{ errorMsg() }}</p>
        }
      </div>

      <ng-container modalFooter>
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button
          uiButton
          variant="primary"
          [disabled]="durationState() !== 'valid'"
          [title]="durationState() !== 'valid' ? 'Elige cuándo termina el cierre' : ''"
          [loading]="saving()"
          (click)="submit()"
        >
          {{ isSchedule ? 'Programar cierre' : 'Guardar' }}
        </button>
      </ng-container>
    </ui-modal>
  `,
  styles: [
    `
      .scd {
        display: grid;
        gap: var(--sp-4);
      }
      .scd-section {
        display: grid;
        gap: var(--sp-2);
      }
      .scd-section-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        font-weight: 800;
      }
      .scd-option-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-3);
      }
      .scd-option-sub {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
        font-weight: 400;
      }
      .scd-row {
        display: flex;
        align-items: flex-end;
        gap: var(--sp-3);
        flex-wrap: wrap;
      }
      .scd-row ui-field {
        flex: 1;
        min-width: 140px;
      }
      .scd-shortcuts {
        display: flex;
        gap: var(--sp-2);
        flex-wrap: wrap;
      }
      .scd-shortcut {
        appearance: none;
        min-height: var(--touch-min);
        border: 1px solid var(--divider);
        background: transparent;
        color: var(--ink);
        font-family: var(--font-sans);
        font-size: var(--fs-dense);
        font-weight: 700;
        padding: 0 var(--sp-3);
        border-radius: var(--radius-control, 0);
        cursor: pointer;
        white-space: nowrap;
      }
      .scd-shortcut:hover {
        border-color: var(--accent);
      }
      .scd-hint {
        margin: 0;
        font-size: var(--fs-dense);
        color: var(--ink-muted);
      }
      .scd-error-text {
        margin: 0;
        font-size: var(--fs-dense);
        font-weight: 700;
        color: var(--status-danger);
      }
      .scd-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-4);
        background: var(--surface-sunk);
        border-radius: var(--radius-control, 0);
      }
      .scd-summary-item {
        display: grid;
        gap: 2px;
        font-size: var(--fs-dense);
        color: var(--ink);
      }
      .scd-summary-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        font-weight: 800;
      }
      .scd-info {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-2);
        margin: 0;
        padding: var(--sp-3) var(--sp-4);
        border-left: 3px solid var(--ink-muted);
        background: color-mix(in srgb, var(--ink-muted) 10%, transparent);
        border-radius: var(--radius-control, 0);
        font-size: var(--fs-dense);
        color: var(--ink-muted);
      }
      .scd-info .material-icons {
        font-size: 16px;
        flex: none;
      }
      .scd-api-error {
        margin: 0;
        color: var(--status-danger);
        font-size: var(--fs-dense);
      }

      @media (max-width: 767px) {
        .scd-option-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ScheduleClosureDialog {
  protected data = inject<ScheduleClosureDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<ClosureView | false>);
  private intakeSvc = inject(OrderIntakeAdminService);

  protected isSchedule = this.data.mode === 'schedule';
  private closure = this.data.mode === 'change-end' ? this.data.closure : null;
  protected maxReasonLength = MAX_REASON_LENGTH;

  protected startMode = signal<'now' | 'scheduled'>('now');
  protected startDate = signal(isoDateStr(new Date()));
  protected startTime = signal(isoTimeStr(new Date()));

  protected endDate = signal(this.closure ? isoDateStr(new Date(this.closure.endsAt)) : '');
  protected endTime = signal(this.closure ? isoTimeStr(new Date(this.closure.endsAt)) : '');
  protected reason = signal('');

  protected saving = signal(false);
  protected errorMsg = signal('');

  /** Solo se muestra el error de validación después de salir de un campo o intentar enviar. */
  protected touched = signal(!!this.closure);

  private effectiveStart = computed<Date | null>(() => {
    if (this.closure) return new Date(this.closure.startsAt);
    if (this.startMode() === 'now') return new Date();
    return combine(this.startDate(), this.startTime());
  });

  private effectiveEnd = computed<Date | null>(() => combine(this.endDate(), this.endTime()));

  private durationMs = computed(() => {
    const start = this.effectiveStart();
    const end = this.effectiveEnd();
    if (!start || !end) return null;
    return end.getTime() - start.getTime();
  });

  protected durationState = computed<DurationState>(() => {
    const ms = this.durationMs();
    if (ms == null) return 'incomplete';
    if (ms <= 0) return 'invalid';
    return 'valid';
  });

  protected invalidReasonText = computed(() =>
    this.durationState() === 'invalid' ? 'El fin debe ser posterior al inicio.' : '',
  );

  protected startLabel = computed(() => {
    const s = this.effectiveStart();
    return s ? format(s, 'dd/MM HH:mm') : '';
  });
  protected endLabel = computed(() => {
    const e = this.effectiveEnd();
    return e ? format(e, 'dd/MM HH:mm') : '';
  });
  protected durationLabelText = computed(() => {
    const ms = this.durationMs();
    return ms != null ? durationLabel(Math.round(ms / 60_000)) : '';
  });

  protected markTouched() {
    this.touched.set(true);
  }

  protected onReasonChange(v: string) {
    this.reason.set(v.slice(0, MAX_REASON_LENGTH));
  }

  protected shortcutPlusHours(hours: number) {
    const start = this.effectiveStart() ?? new Date();
    const d = new Date(start.getTime() + hours * 3600_000);
    this.endDate.set(isoDateStr(d));
    this.endTime.set(isoTimeStr(d));
    this.markTouched();
  }

  protected shortcutTomorrow6am() {
    const start = this.effectiveStart() ?? new Date();
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 6, 0, 0);
    this.endDate.set(isoDateStr(d));
    this.endTime.set(isoTimeStr(d));
    this.markTouched();
  }

  protected submit() {
    this.markTouched();
    if (this.durationState() !== 'valid') return;
    const end = this.effectiveEnd();
    if (!end) return;
    const endsAt = `${isoDateStr(end)}T${isoTimeStr(end)}:00`;
    this.saving.set(true);
    this.errorMsg.set('');

    if (this.closure) {
      this.intakeSvc.changeClosureEnd(this.closure.closureId, { endsAt }).subscribe({
        next: (c) => {
          this.saving.set(false);
          this.ref.close(c);
        },
        error: (err) => this.onError(err),
      });
      return;
    }

    const start = this.effectiveStart();
    const startsAt =
      this.startMode() === 'now' || !start ? null : `${isoDateStr(start)}T${isoTimeStr(start)}:00`;
    this.intakeSvc
      .scheduleClosure({ startsAt, endsAt, reason: this.reason().trim() || null })
      .subscribe({
        next: (c) => {
          this.saving.set(false);
          this.ref.close(c);
        },
        error: (err) => this.onError(err),
      });
  }

  private onError(err: { error?: { detail?: string } }) {
    this.saving.set(false);
    this.errorMsg.set(err?.error?.detail ?? 'No pudimos guardar el cierre.');
  }
}
