import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { format } from 'date-fns';
import { UiCard } from '../../../shared/ui/card/card';
import { UiField } from '../../../shared/ui/field/field';
import { UiBadge } from '../../../shared/ui/badge/badge';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UiStatus } from '../../../shared/ui/status/status';
import { OrderIntakeAdminService } from '../../../core/order-intake/order-intake-admin';
import { ClosureView } from '../../../shared/models/order-intake.models';
import { dateText, timeText } from '../../assignments/assignment-format';
import { closureStatusKey, lastChangeText } from './order-intake-format';

/** Hoy en hora local (Lima) — nunca `toISOString()`, que en Lima (UTC-5) después de las 19:00 daría el día siguiente. */
function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

type HistoryView =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'empty' }
  | { kind: 'data'; rows: ClosureView[] };

/**
 * Tarjeta "Historial de cierres" — doc 65, sección 2.9. Antes vivía dentro
 * de "Toma de pedidos"; se separa para que cada tarjeta resuelva sus
 * propios 4 estados sin empujar el resto de la pantalla.
 */
@Component({
  selector: 'app-closure-history-card',
  imports: [UiCard, UiField, UiBadge, UiEmpty, UiStatus],
  template: `
    <ui-card title="Historial de cierres" class="sys-card chc-card">
      <p class="sys-help">
        Cierres de la toma de pedidos desde la fecha elegida. Por defecto, desde hoy.
      </p>

      <div class="chc-toolbar">
        <ui-field label="Desde" type="date" [(value)]="from" />
        @if (view(); as v) {
          @if (v.kind === 'data') {
            <ui-badge>{{ v.rows.length }} cierre{{ v.rows.length === 1 ? '' : 's' }}</ui-badge>
          }
        }
        @if (hasMoved()) {
          <button type="button" class="chc-today-link" (click)="backToToday()">Volver a hoy</button>
        }
      </div>

      @switch (view().kind) {
        @case ('loading') {
          <div class="sys-skeleton" role="status" aria-label="Cargando"></div>
        }
        @case ('error') {
          <ui-empty
            variant="error"
            title="No pudimos cargar el historial"
            actionLabel="Reintentar"
            (action)="reload()"
          />
        }
        @case ('empty') {
          <ui-empty
            title="No hay cierres en este periodo"
            actionLabel="Ver últimos 7 días"
            (action)="last7Days()"
          />
        }
        @case ('data') {
          @let rows = asData(view()).rows;
          <table class="ui-table-grid chc-table-desktop">
            <thead>
              <tr>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
                <th>Motivo</th>
                <th>Creado por</th>
              </tr>
            </thead>
            <tbody>
              @for (c of rows; track c.closureId) {
                <tr>
                  <td>
                    <div>{{ dateText(c.startsAt) }}</div>
                    <div class="chc-meta">{{ timeText(c.startsAt) }}</div>
                  </td>
                  <td>
                    <div>{{ dateText(c.endsAt) }}</div>
                    <div class="chc-meta">{{ timeText(c.endsAt) }}</div>
                  </td>
                  <td>
                    <ui-status [label]="c.statusName" [status]="closureStatusKey(c.statusCode)" />
                    <div class="chc-meta">{{ lastChangeText(c) }}</div>
                  </td>
                  <td class="chc-reason-cell" [title]="c.reason || ''">{{ c.reason || '—' }}</td>
                  <td class="chc-muted">{{ c.createdByName }}</td>
                </tr>
              }
            </tbody>
          </table>

          <div class="chc-cards-mobile">
            @for (c of rows; track c.closureId) {
              <div class="chc-card-mobile">
                <div class="chc-card-top">
                  <span class="chc-card-period"
                    >{{ dateText(c.startsAt) }} {{ timeText(c.startsAt) }} →
                    {{ dateText(c.endsAt) }} {{ timeText(c.endsAt) }}</span
                  >
                  <ui-status [label]="c.statusName" [status]="closureStatusKey(c.statusCode)" />
                </div>
                <div class="chc-meta">{{ c.reason || '—' }}</div>
                <div class="chc-meta">{{ c.createdByName }} · {{ lastChangeText(c) }}</div>
              </div>
            }
          </div>
        }
      }
    </ui-card>
  `,
  styles: [
    `
      .chc-card {
        max-width: none;
      }
      .chc-toolbar {
        display: flex;
        align-items: flex-end;
        gap: var(--sp-4);
        flex-wrap: wrap;
      }
      .chc-toolbar ui-field {
        width: 180px;
      }
      .chc-toolbar ui-badge {
        margin-bottom: 10px;
      }
      .chc-today-link {
        appearance: none;
        border: 0;
        background: none;
        padding: 0;
        display: inline-flex;
        align-items: center;
        min-height: var(--touch-min);
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: var(--fs-dense);
        font-weight: 700;
        color: var(--accent-ink);
      }
      .chc-today-link:hover {
        text-decoration: underline;
      }
      .chc-table-desktop {
        width: 100%;
      }
      .chc-meta {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .chc-reason-cell {
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .chc-muted {
        color: var(--ink-muted);
        font-size: var(--fs-dense);
      }
      .chc-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .chc-table-desktop {
          display: none;
        }
        .chc-cards-mobile {
          display: grid;
          gap: var(--sp-3);
        }
        .chc-card-mobile {
          display: grid;
          gap: 4px;
          padding: var(--sp-3);
          border: 1px solid var(--hairline);
          border-radius: var(--radius-control, 0);
        }
        .chc-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--sp-3);
          font-weight: 700;
          font-size: var(--fs-dense);
        }
        .chc-card-period {
          min-width: 0;
        }
      }
    `,
  ],
})
export class ClosureHistoryCard {
  private intakeSvc = inject(OrderIntakeAdminService);

  protected dateText = dateText;
  protected timeText = timeText;
  protected closureStatusKey = closureStatusKey;
  protected lastChangeText = lastChangeText;

  private readonly today = todayIso();
  protected from = signal(this.today);
  protected hasMoved = computed(() => this.from() !== this.today);

  private loading = signal(true);
  private error = signal(false);
  /** Solo para que "Reintentar" fuerce una nueva emisión con el mismo `from`. */
  private reloadTick = signal(0);

  private readonly params = computed(() => ({ from: this.from(), tick: this.reloadTick() }));

  private result$ = toObservable(this.params).pipe(
    tap(() => {
      this.loading.set(true);
      this.error.set(false);
    }),
    switchMap(({ from }) =>
      this.intakeSvc.closures(from).pipe(
        catchError(() => {
          this.error.set(true);
          return of(null);
        }),
      ),
    ),
    tap(() => this.loading.set(false)),
  );
  private rows = toSignal(this.result$, { initialValue: null });

  /** Un único computed con los 4 estados de la sección 9 del design system. */
  protected view = computed<HistoryView>(() => {
    if (this.loading()) return { kind: 'loading' };
    if (this.error()) return { kind: 'error' };
    const rows = this.rows();
    if (!rows || rows.length === 0) return { kind: 'empty' };
    return { kind: 'data', rows };
  });

  /** El `@switch` del template solo discrimina por `kind`; esto recupera `rows` con el tipo correcto. */
  protected asData(v: HistoryView): Extract<HistoryView, { kind: 'data' }> {
    return v as Extract<HistoryView, { kind: 'data' }>;
  }

  protected reload() {
    this.reloadTick.update((n) => n + 1);
  }

  protected backToToday() {
    this.from.set(this.today);
  }

  protected last7Days() {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    this.from.set(format(d, 'yyyy-MM-dd'));
  }
}
