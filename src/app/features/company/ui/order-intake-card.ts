import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiCard } from '../../../shared/ui/card/card';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UiStatus } from '../../../shared/ui/status/status';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { IntakeStatusService } from '../../../core/order-intake/intake-status.service';
import { OrderIntakeAdminService } from '../../../core/order-intake/order-intake-admin';
import { ClosureView } from '../../../shared/models/order-intake.models';
import { dateTimeText, durationText } from '../../assignments/assignment-format';
import { ScheduleClosureDialog, ScheduleClosureDialogData } from './schedule-closure-dialog';

/**
 * Tarjeta "Toma de pedidos" — doc 65, sección 2.9. `order.intake.manage`.
 * Programar/cambiar/reabrir/anular el cierre en curso y el próximo
 * programado. El historial vive en su propia tarjeta (`ClosureHistoryCard`).
 */
@Component({
  selector: 'app-order-intake-card',
  imports: [UiButton, UiCard, UiEmpty, UiStatus],
  template: `
    <ui-card title="Toma de pedidos" class="sys-card oi-card">
      <p class="sys-help">
        Cierra la toma de pedidos entre dos horas. Vendedores y televentas no podrán crear, editar
        ni anular pedidos; Supervisión sigue operando.
      </p>

      @if (intake.loading() && !intake.status()) {
        <div class="sys-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (intake.error() && !intake.status()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el estado de la toma de pedidos"
          actionLabel="Reintentar"
          (action)="intake.refresh()"
        />
      } @else if (intake.status(); as s) {
        <div class="oi-top-row">
          <div class="oi-status-block">
            @if (s.current; as c) {
              <ui-status
                [label]="'Cerrada hasta ' + dateTimeText(c.endsAt) + ' (' + countdownText() + ')'"
                status="en ruta"
              />
              <p class="sys-meta">
                Desde {{ dateTimeText(c.startsAt) }} · por {{ c.createdByName }}
                @if (c.reason) {
                  · "{{ c.reason }}"
                }
              </p>
              <div class="sys-actions">
                <button uiButton variant="secondary" size="sm" (click)="openChangeEnd(c)">
                  Cambiar fin
                </button>
                <button uiButton variant="secondary" size="sm" (click)="reopenNow(c)">
                  Reabrir ahora
                </button>
              </div>
            } @else {
              <ui-status label="Abierta" status="entregado" />
              <p class="sys-meta">Vendedores y televentas pueden tomar pedidos.</p>
            }
          </div>

          <button uiButton variant="primary" (click)="openSchedule()">Programar cierre</button>
        </div>

        <div class="oi-scheduled">
          <span class="oi-scheduled-label">Cierres programados</span>
          @if (s.next; as n) {
            <div class="oi-next-row">
              <span
                >{{ dateTimeText(n.startsAt) }} → {{ dateTimeText(n.endsAt) }} ({{
                  n.statusName
                }})</span
              >
              <div class="sys-actions">
                <button uiButton variant="ghost" size="sm" (click)="openChangeEnd(n)">
                  Cambiar fin
                </button>
                <button uiButton variant="ghost" size="sm" (click)="cancelClosure(n)">
                  Anular
                </button>
              </div>
            </div>
          } @else {
            <div class="oi-empty-compact">
              <span class="material-icons" aria-hidden="true">event_busy</span>
              No hay cierres programados.
            </div>
          }
        </div>
      }
    </ui-card>
  `,
  styles: [
    `
      .oi-card {
        max-width: none;
      }
      .oi-top-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-4);
        flex-wrap: wrap;
      }
      .oi-status-block {
        display: grid;
        gap: 4px;
        min-width: 0;
      }
      .oi-scheduled {
        display: grid;
        gap: var(--sp-2);
        padding-top: var(--sp-3);
        border-top: 1px solid var(--hairline);
      }
      .oi-scheduled-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        font-weight: 800;
      }
      .oi-next-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-3);
        flex-wrap: wrap;
        font-size: var(--fs-dense);
        color: var(--ink);
      }
      .oi-empty-compact {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        min-height: var(--touch-min);
        padding: 0 var(--sp-3);
        border: 1px dashed var(--divider);
        border-radius: var(--radius-control, 0);
        color: var(--ink-muted);
        font-size: var(--fs-dense);
      }
      .oi-empty-compact .material-icons {
        font-size: 18px;
      }

      @media (max-width: 767px) {
        .oi-top-row {
          flex-direction: column;
          align-items: stretch;
        }
        .oi-top-row button[uiButton] {
          width: 100%;
        }
      }
    `,
  ],
})
export class OrderIntakeCard {
  protected intake = inject(IntakeStatusService);
  private intakeSvc = inject(OrderIntakeAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected dateTimeText = dateTimeText;

  private clockTick = signal(Date.now());
  private tickHandle = setInterval(() => this.clockTick.set(Date.now()), 30_000);
  private offsetMs = signal(0);

  protected countdownText = computed(() => {
    const s = this.intake.status();
    this.clockTick();
    if (!s?.current) return '';
    const remainingMs = new Date(s.current.endsAt).getTime() + this.offsetMs() - Date.now();
    if (remainingMs <= 0) return 'por reabrir';
    return `faltan ${durationText(Math.round(remainingMs / 60_000))}`;
  });

  constructor() {
    // El sondeo de 5 minutos y el temporizador de `serverTime` los maneja el
    // shell (persiste entre pantallas); esta tarjeta solo pide un refresh al
    // entrar — doc 65, sección 2.8.
    this.intake.refresh();
    // `offsetMs` se recalcula cada vez que llega un status nuevo, para la cuenta regresiva.
    effect(() => {
      const s = this.intake.status();
      if (s) untracked(() => this.offsetMs.set(Date.now() - new Date(s.serverTime).getTime()));
    });
    inject(DestroyRef).onDestroy(() => clearInterval(this.tickHandle));
  }

  protected openSchedule() {
    this.dialog
      .open<ScheduleClosureDialog, ScheduleClosureDialogData, ClosureView | false>(
        ScheduleClosureDialog,
        { data: { mode: 'schedule' }, width: 'var(--card-w-sm)' },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.toast.success(
          result.statusCode === 'ACTIVE' ? 'Toma de pedidos cerrada.' : 'Cierre programado.',
        );
        this.intake.refresh();
      });
  }

  protected openChangeEnd(closure: ClosureView) {
    this.dialog
      .open<ScheduleClosureDialog, ScheduleClosureDialogData, ClosureView | false>(
        ScheduleClosureDialog,
        { data: { mode: 'change-end', closure }, width: 'var(--card-w-sm)' },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.toast.success('Cierre actualizado.');
        this.intake.refresh();
      });
  }

  protected reopenNow(closure: ClosureView) {
    this.dialog
      .confirm({
        title: '¿Reabrir la toma de pedidos ahora?',
        message:
          'Los vendedores podrán volver a crear, editar y anular pedidos. El cierre quedará registrado como reabierto por usted.',
        confirmLabel: 'Reabrir ahora',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.intakeSvc.endClosure(closure.closureId).subscribe({
          next: () => {
            this.toast.success('Toma de pedidos reabierta.');
            this.intake.refresh();
          },
          error: (err) => {
            this.toast.error(err?.error?.detail ?? 'No pudimos reabrir la toma de pedidos.');
            this.intake.refresh();
          },
        });
      });
  }

  protected cancelClosure(closure: ClosureView) {
    this.dialog
      .confirm({
        title: `¿Anular el cierre programado?`,
        message: `Se anulará el cierre del ${dateTimeText(closure.startsAt)} al ${dateTimeText(closure.endsAt)}.`,
        confirmLabel: 'Anular cierre',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.intakeSvc.endClosure(closure.closureId).subscribe({
          next: () => {
            this.toast.success('Cierre anulado.');
            this.intake.refresh();
          },
          error: (err) => {
            this.toast.error(err?.error?.detail ?? 'No pudimos anular el cierre.');
          },
        });
      });
  }
}
