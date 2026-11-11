import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiCard } from '../../../shared/ui/card/card';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UiMenu } from '../../../shared/ui/menu/menu';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { IntakeStatusService } from '../../../core/order-intake/intake-status.service';
import { OrderIntakeAdminService } from '../../../core/order-intake/order-intake-admin';
import { ClosureView } from '../../../shared/models/order-intake.models';
import { dateTimeText, durationText } from '../../assignments/assignment-format';
import { closureStatusTone, lastChangeText, shortDateTimeText } from './order-intake-format';
import { ScheduleClosureDialog, ScheduleClosureDialogData } from './schedule-closure-dialog';

function todayMinus(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Tarjeta "Toma de pedidos" — doc 65, sección 2.9. `order.intake.manage`.
 * Programar/cambiar/reabrir/anular cierres y el historial, con el estado
 * compartido `IntakeStatusService` (lo usa también la barra superior).
 */
@Component({
  selector: 'app-order-intake-card',
  imports: [UiButton, UiField, UiCard, UiEmpty, UiMenu],
  template: `
    <ui-card title="Toma de pedidos" class="sys-card oi-card">
      <p class="sys-help">
        Cierra la toma de pedidos entre dos horas. Vendedores y televentas no podrán crear, editar
        ni anular pedidos. Supervisión sigue operando. Se reabre sola a la hora de fin.
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
        @if (s.current; as c) {
          <div class="sys-status sys-status-on">
            <span class="sys-dot"></span>
            En curso — cerrada hasta {{ dateTimeText(c.endsAt) }} ({{ countdownText() }})
          </div>
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
          <div class="sys-status sys-status-off">
            <span class="sys-dot"></span>
            Abierta
          </div>
          @if (!s.next) {
            <p class="sys-note">No hay cierres programados</p>
          }
        }

        @if (s.next; as n) {
          <div class="oi-next-row">
            <span
              >Próximo: {{ dateTimeText(n.startsAt) }} → {{ dateTimeText(n.endsAt) }} ({{
                n.statusName
              }})</span
            >
            <div class="sys-actions">
              <button uiButton variant="ghost" size="sm" (click)="openChangeEnd(n)">
                Cambiar fin
              </button>
              <button uiButton variant="ghost" size="sm" (click)="cancelClosure(n)">Anular</button>
            </div>
          </div>
        }

        <div class="sys-actions oi-schedule-row">
          <button uiButton variant="primary" size="sm" (click)="openSchedule()">
            + Programar cierre
          </button>
        </div>
      }

      <hr class="oi-rule" />

      <div class="oi-history-head">
        <span class="oi-history-title">Historial</span>
        <ui-field label="Desde" type="date" [(value)]="historyFrom" (valueChange)="loadHistory()" />
      </div>

      @if (historyLoading()) {
        <div class="sys-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (historyError()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el historial"
          actionLabel="Reintentar"
          (action)="loadHistory()"
        />
      } @else if (history().length === 0) {
        <ui-empty title="No hay cierres en este periodo" />
      } @else {
        <table class="ui-table-grid oi-history-table">
          <thead>
            <tr>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Estado</th>
              <th>Motivo</th>
              <th>Creó</th>
              <th>Último cambio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (c of history(); track c.closureId) {
              <tr>
                <td>{{ shortDateTimeText(c.startsAt) }}</td>
                <td>{{ shortDateTimeText(c.endsAt) }}</td>
                <td>
                  <span
                    class="oi-status-badge"
                    [style.color]="'var(' + closureStatusTone(c.statusCode) + ')'"
                  >
                    ● {{ c.statusName }}
                  </span>
                </td>
                <td class="oi-reason-cell" [title]="c.reason || ''">{{ c.reason || '—' }}</td>
                <td class="oi-muted">{{ c.createdByName }}</td>
                <td class="oi-muted">{{ lastChangeText(c) }}</td>
                <td class="oi-menu-cell">
                  @if (c.changeable) {
                    <ui-menu label="Acciones">
                      <button type="button" (click)="openChangeEnd(c)">Cambiar fin</button>
                      @if (c.statusCode === 'ACTIVE') {
                        <button type="button" (click)="reopenNow(c)">Reabrir ahora</button>
                      } @else {
                        <button type="button" (click)="cancelClosure(c)">Anular</button>
                      }
                    </ui-menu>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </ui-card>
  `,
  styles: [
    `
      .oi-card {
        max-width: none;
      }
      .oi-next-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        font-size: var(--fs-dense);
        color: var(--ink);
        padding: var(--sp-2) 0;
      }
      .oi-schedule-row {
        justify-content: flex-end;
      }
      .oi-rule {
        border: 0;
        border-top: 1px solid var(--hairline);
        margin: var(--sp-2) 0;
      }
      .oi-history-head {
        display: flex;
        align-items: flex-end;
        justify-content: flex-start;
        gap: 16px;
        /* La tarjeta ocupa todo el ancho de la grilla (es la única que lo
           hace); sin este tope el filtro "Desde" quedaba empujado al borde
           derecho, lejísimos del título "Historial", con un hueco enorme
           en medio — doc feedback. */
        max-width: 420px;
      }
      .oi-history-title {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
        font-weight: 800;
      }
      .oi-history-head ui-field {
        width: 180px;
      }
      .oi-history-table {
        width: 100%;
        margin-top: var(--sp-2);
      }
      .oi-status-badge {
        font-weight: 700;
        font-size: var(--fs-dense);
        white-space: nowrap;
      }
      .oi-reason-cell {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .oi-muted {
        color: var(--ink-muted);
        font-size: var(--fs-dense);
      }
      .oi-menu-cell {
        text-align: right;
      }

      @media (max-width: 767px) {
        .oi-history-table {
          display: block;
          overflow-x: auto;
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
  protected shortDateTimeText = shortDateTimeText;
  protected closureStatusTone = closureStatusTone;
  protected lastChangeText = lastChangeText;

  protected history = signal<ClosureView[]>([]);
  protected historyFrom = signal(todayMinus(7));
  protected historyLoading = signal(true);
  protected historyError = signal(false);

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
    this.loadHistory();
    // `offsetMs` se recalcula cada vez que llega un status nuevo, para la cuenta regresiva.
    effect(() => {
      const s = this.intake.status();
      if (s) untracked(() => this.offsetMs.set(Date.now() - new Date(s.serverTime).getTime()));
    });
    inject(DestroyRef).onDestroy(() => clearInterval(this.tickHandle));
  }

  loadHistory() {
    this.historyLoading.set(true);
    this.historyError.set(false);
    this.intakeSvc.closures(this.historyFrom() || undefined).subscribe({
      next: (list) => {
        this.history.set(list);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyLoading.set(false);
        this.historyError.set(true);
      },
    });
  }

  protected openSchedule() {
    this.dialog
      .open<ScheduleClosureDialog, ScheduleClosureDialogData, ClosureView | false>(
        ScheduleClosureDialog,
        { data: { mode: 'schedule' }, width: '560px' },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.toast.success(
          result.statusCode === 'ACTIVE' ? 'Toma de pedidos cerrada.' : 'Cierre programado.',
        );
        this.intake.refresh();
        this.loadHistory();
      });
  }

  protected openChangeEnd(closure: ClosureView) {
    this.dialog
      .open<ScheduleClosureDialog, ScheduleClosureDialogData, ClosureView | false>(
        ScheduleClosureDialog,
        { data: { mode: 'change-end', closure }, width: '560px' },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.toast.success('Cierre actualizado.');
        this.intake.refresh();
        this.loadHistory();
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
            this.loadHistory();
          },
          error: (err) => {
            this.toast.error(err?.error?.detail ?? 'No pudimos reabrir la toma de pedidos.');
            this.intake.refresh();
            this.loadHistory();
          },
        });
      });
  }

  protected cancelClosure(closure: ClosureView) {
    this.dialog
      .confirm({
        title: `¿Anular el cierre del ${shortDateTimeText(closure.startsAt)} al ${shortDateTimeText(closure.endsAt)}?`,
        message: '',
        confirmLabel: 'Anular cierre',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.intakeSvc.endClosure(closure.closureId).subscribe({
          next: () => {
            this.toast.success('Cierre anulado.');
            this.intake.refresh();
            this.loadHistory();
          },
          error: (err) => {
            this.toast.error(err?.error?.detail ?? 'No pudimos anular el cierre.');
            this.loadHistory();
          },
        });
      });
  }
}
