import { Component, computed, inject, signal } from '@angular/core';
import { format } from 'date-fns';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { durationText as durationLabel } from '../../assignments/assignment-format';
import { OrderIntakeAdminService } from '../../../core/order-intake/order-intake-admin';
import { ClosureView } from '../../../shared/models/order-intake.models';

export type ScheduleClosureDialogData =
  { mode: 'schedule' } | { mode: 'change-end'; closure: ClosureView };

const MAX_DURATION_MS = 72 * 60 * 60_000;

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
 */
@Component({
  selector: 'app-schedule-closure-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="scd">
      <h2 class="scd-title">
        {{ isSchedule ? 'Programar cierre de la toma de pedidos' : 'Cambiar fin del cierre' }}
      </h2>

      @if (isSchedule) {
        <div class="scd-start-row">
          <span class="scd-start-label">Inicio</span>
          <label class="scd-radio">
            <input
              type="radio"
              name="startMode"
              [checked]="startMode() === 'now'"
              (change)="startMode.set('now')"
            />
            Ahora
          </label>
          <label class="scd-radio">
            <input
              type="radio"
              name="startMode"
              [checked]="startMode() === 'scheduled'"
              (change)="startMode.set('scheduled')"
            />
            Programar
          </label>
          @if (startMode() === 'scheduled') {
            <ui-field label="Fecha" type="date" [(value)]="startDate" />
            <ui-field label="Hora" type="time" [(value)]="startTime" />
          }
        </div>
      }

      <div class="scd-end-row">
        <ui-field label="Fin *" type="date" [(value)]="endDate" />
        <ui-field label="Hora" type="time" [(value)]="endTime" />
        <div class="scd-shortcuts">
          <button type="button" class="scd-shortcut" (click)="shortcutTomorrow6am()">
            Mañana 06:00
          </button>
          <button type="button" class="scd-shortcut" (click)="shortcutPlusHours(2)">+2 h</button>
          <button type="button" class="scd-shortcut" (click)="shortcutPlusHours(4)">+4 h</button>
        </div>
      </div>

      <p class="scd-duration" [class.scd-duration-danger]="!durationValid()">
        {{ durationText() }}
      </p>

      @if (isSchedule) {
        <ui-field label="Motivo (opcional)" [(value)]="reason" hint="Máximo 200 caracteres." />
        <p class="scd-info">
          <span class="material-icons" aria-hidden="true">info</span>
          Vendedores y televentas no podrán crear, editar ni anular pedidos hasta el fin.
          Supervisión sigue operando. La toma de pedidos se reabre sola a la hora de fin.
        </p>
      }

      @if (errorMsg()) {
        <p class="scd-error">{{ errorMsg() }}</p>
      }

      <div class="scd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button
          uiButton
          variant="primary"
          [disabled]="!durationValid()"
          [loading]="saving()"
          (click)="submit()"
        >
          {{ isSchedule ? 'Programar cierre' : 'Guardar' }}
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
      .scd {
        display: grid;
        gap: 16px;
        width: 100%;
      }
      .scd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .scd-start-row {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      .scd-start-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .scd-radio {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        color: var(--ink);
        cursor: pointer;
      }
      .scd-end-row {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        flex-wrap: wrap;
      }
      .scd-end-row ui-field {
        min-width: 140px;
      }
      .scd-shortcuts {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .scd-shortcut {
        appearance: none;
        border: 1px solid var(--divider);
        background: transparent;
        color: var(--ink);
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 700;
        padding: 6px 10px;
        border-radius: var(--radius-control);
        cursor: pointer;
        white-space: nowrap;
      }
      .scd-shortcut:hover {
        border-color: var(--accent);
      }
      .scd-duration {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--ink);
      }
      .scd-duration-danger {
        color: var(--status-danger);
      }
      .scd-info {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin: 0;
        padding: 10px 14px;
        background: var(--faint);
        border: 1px solid var(--hairline);
        font-size: 12px;
        color: var(--ink-muted);
      }
      .scd-info .material-icons {
        font-size: 16px;
        flex: none;
      }
      .scd-error {
        margin: 0;
        color: var(--status-danger);
        font-size: 13px;
      }
      .scd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
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

  protected startMode = signal<'now' | 'scheduled'>('now');
  protected startDate = signal(isoDateStr(new Date()));
  protected startTime = signal(isoTimeStr(new Date()));

  protected endDate = signal(this.closure ? isoDateStr(new Date(this.closure.endsAt)) : '');
  protected endTime = signal(this.closure ? isoTimeStr(new Date(this.closure.endsAt)) : '');
  protected reason = signal('');

  protected saving = signal(false);
  protected errorMsg = signal('');

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

  protected durationValid = computed(() => {
    const ms = this.durationMs();
    return ms != null && ms > 0 && ms <= MAX_DURATION_MS;
  });

  protected durationText = computed(() => {
    const ms = this.durationMs();
    if (ms == null) return this.closure ? '' : 'Elige el fin del cierre.';
    if (ms <= 0) return 'El fin debe ser posterior al inicio.';
    if (ms > MAX_DURATION_MS) return 'Un cierre dura como máximo 72 horas.';
    const mins = Math.round(ms / 60_000);
    if (this.closure) {
      return `El cierre quedará de ${this.startTimeLabel()} a ${format(this.effectiveEnd()!, 'dd/MM HH:mm')} (${durationLabel(mins)})`;
    }
    return `Durará ${durationLabel(mins)}`;
  });

  private startTimeLabel(): string {
    const s = this.effectiveStart();
    return s ? format(s, 'dd/MM HH:mm') : '';
  }

  protected shortcutPlusHours(hours: number) {
    const start = this.effectiveStart() ?? new Date();
    const d = new Date(start.getTime() + hours * 3600_000);
    this.endDate.set(isoDateStr(d));
    this.endTime.set(isoTimeStr(d));
  }

  protected shortcutTomorrow6am() {
    const start = this.effectiveStart() ?? new Date();
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 6, 0, 0);
    this.endDate.set(isoDateStr(d));
    this.endTime.set(isoTimeStr(d));
  }

  protected submit() {
    if (!this.durationValid()) return;
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
