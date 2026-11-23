import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { PickingAdminService } from './picking-admin';
import { PickingSummary } from '../../shared/models/picking.models';
import { BATCH_STATUS_COLOR_VAR, batchStatusName } from './delivery-format';
import { reviewedText } from './picking-format';
import { dateText } from '../assignments/assignment-format';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Listado de picking (doc 89, sección 4) — control de carga por planilla,
 * una por una. Es un endpoint liviano (no trae las líneas de producto): la
 * declaración vive en el detalle.
 */
@Component({
  selector: 'app-picking-list',
  imports: [UiButton, UiField, UiToggle, UiTable, UiStatus, UiEmpty],
  template: `
    <section class="pkl-page">
      <div class="pkl-head">
        <div>
          <h1>Picking</h1>
          <p class="pkl-sub">Control de carga por planilla</p>
        </div>
        <button uiButton variant="ghost" (click)="load()" [loading]="loading()">
          ↻ Actualizar
        </button>
      </div>

      <div class="pkl-toolbar">
        <div class="pkl-date-nav">
          <button
            uiButton
            variant="ghost"
            size="sm"
            (click)="shiftDate(-1)"
            aria-label="Día anterior"
          >
            ◀
          </button>
          <ui-field label="Fecha" type="date" [(value)]="date" />
          <button
            uiButton
            variant="ghost"
            size="sm"
            (click)="shiftDate(1)"
            aria-label="Día siguiente"
          >
            ▶
          </button>
        </div>
        <ui-toggle label="Solo pendientes" [(checked)]="onlyPending" class="pkl-toggle" />
      </div>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="pkl-cards">
          <div class="pkl-card">
            <span class="pkl-card-value">{{ rows().length }}</span>
            <span class="pkl-card-label">Planillas</span>
          </div>
          <div class="pkl-card">
            <span class="pkl-card-value">{{ closedCount() }}</span>
            <span class="pkl-card-label">Picking cerrado</span>
          </div>
          <div class="pkl-card">
            <span class="pkl-card-value">{{ pendingCloseCount() }}</span>
            <span class="pkl-card-label">Pendientes de cerrar</span>
          </div>
          <div class="pkl-card" [class.pkl-card-danger]="withShortfallCount() > 0">
            <span class="pkl-card-value">{{ withShortfallCount() }}</span>
            <span class="pkl-card-label">Con faltantes</span>
          </div>
        </div>
      }

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar las planillas."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          @if (onlyPending()) {
            <ui-empty
              variant="al-dia"
              eyebrow="Al día"
              [title]="
                'Todas las planillas del ' + dateText(date()) + ' tienen el picking cerrado ✔'
              "
            />
          } @else {
            <ui-empty [title]="'No hay planillas para el ' + dateText(date())" />
          }
        </div>

        <table class="ui-table-grid pkl-table-desktop">
          <thead>
            <tr>
              <th>Planilla</th>
              <th>Equipo</th>
              <th>Estado planilla</th>
              <th>Progreso</th>
              <th>Picking</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (b of rows(); track b.batchId) {
              <tr class="pkl-row" (click)="open(b)">
                <td class="pkl-cell-strong">{{ b.series }}-{{ b.number }}</td>
                <td class="pkl-muted">
                  @if (b.vehiclePlate) {
                    {{ b.vehiclePlate }} · {{ b.driverName }}
                  } @else {
                    Sin equipo
                  }
                </td>
                <td><ui-status [label]="batchStatusName(b.statusCode)" /></td>
                <td class="pkl-progress-cell">
                  <div class="pkl-progress-bar">
                    @if (totalOf(b) > 0) {
                      <span
                        class="pkl-progress-seg"
                        style="background: var(--success)"
                        [style.width.%]="(b.pickingCounts.complete / totalOf(b)) * 100"
                      ></span>
                      <span
                        class="pkl-progress-seg"
                        style="background: var(--status-warn)"
                        [style.width.%]="(b.pickingCounts.shortLoaded / totalOf(b)) * 100"
                      ></span>
                      <span
                        class="pkl-progress-seg"
                        style="background: var(--status-danger)"
                        [style.width.%]="(b.pickingCounts.notLoaded / totalOf(b)) * 100"
                      ></span>
                    }
                  </div>
                  <span class="pkl-progress-text">{{ reviewedText(b.pickingCounts) }}</span>
                </td>
                <td>
                  @if (b.pickingConfirmedAt) {
                    <span class="pkl-chip pkl-chip-closed">🔒 Cerrado</span>
                  } @else {
                    <span class="pkl-chip pkl-chip-pending">Pendiente</span>
                  }
                </td>
                <td class="pkl-row-action">
                  <button
                    uiButton
                    variant="ghost"
                    size="sm"
                    (click)="open(b); $event.stopPropagation()"
                  >
                    @if (canStore() && !b.pickingConfirmedAt) {
                      Revisar carga
                    } @else {
                      Ver
                    }
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="pkl-cards-mobile">
          @for (b of rows(); track b.batchId) {
            <a class="pkl-card-mobile" (click)="open(b)">
              <div class="pkl-card-mobile-head">
                <span class="pkl-card-mobile-name">{{ b.series }}-{{ b.number }}</span>
                <ui-status [label]="batchStatusName(b.statusCode)" />
              </div>
              <div class="pkl-muted">
                {{ b.vehiclePlate ? b.vehiclePlate + ' · ' + b.driverName : 'Sin equipo' }}
              </div>
              <div class="pkl-muted">{{ reviewedText(b.pickingCounts) }}</div>
              @if (b.pickingConfirmedAt) {
                <span class="pkl-chip pkl-chip-closed">🔒 Cerrado</span>
              } @else {
                <span class="pkl-chip pkl-chip-pending">Pendiente</span>
              }
            </a>
          }
        </div>
      </ui-table>
    </section>
  `,
  styles: [
    `
      .pkl-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .pkl-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .pkl-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .pkl-toolbar {
        display: flex;
        align-items: flex-end;
        gap: 20px;
        flex-wrap: wrap;
        margin: 20px 0;
      }
      .pkl-date-nav {
        display: flex;
        align-items: flex-end;
        gap: 6px;
      }
      .pkl-date-nav ui-field {
        width: 180px;
      }
      .pkl-toggle {
        min-width: 220px;
      }
      .pkl-cards {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 20px;
      }
      .pkl-card {
        border: 1px solid var(--hairline);
        background: var(--bg);
        padding: 12px 14px;
        display: grid;
        gap: 4px;
      }
      .pkl-card-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        font-variant-numeric: var(--tnum);
        color: var(--ink);
      }
      .pkl-card-danger .pkl-card-value {
        color: var(--status-danger);
      }
      .pkl-card-label {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .pkl-cell-strong {
        font-weight: 800;
      }
      .pkl-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .pkl-row {
        cursor: pointer;
      }
      .pkl-row:hover {
        background: var(--faint);
      }
      .pkl-row-action {
        text-align: right;
      }
      .pkl-progress-cell {
        min-width: 160px;
      }
      .pkl-progress-bar {
        display: flex;
        height: 8px;
        background: var(--faint);
        overflow: hidden;
        margin-bottom: 4px;
      }
      .pkl-progress-seg {
        display: block;
        height: 100%;
      }
      .pkl-progress-text {
        font-size: 11px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .pkl-chip {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        white-space: nowrap;
      }
      .pkl-chip-closed {
        color: var(--success);
      }
      .pkl-chip-pending {
        color: var(--ink-muted);
      }
      .pkl-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .pkl-page {
          padding: var(--sp-4);
        }
        .pkl-table-desktop {
          display: none;
        }
        .pkl-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .pkl-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          cursor: pointer;
        }
        .pkl-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 4px;
        }
        .pkl-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .pkl-cards {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `,
  ],
})
export class PickingListPage {
  private pickingSvc = inject(PickingAdminService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected dateText = dateText;
  protected batchStatusName = batchStatusName;
  protected reviewedText = reviewedText;
  protected batchStatusColorVar = BATCH_STATUS_COLOR_VAR;

  protected canStore = computed(() => this.auth.hasAny('picking.store'));

  protected date = signal(this.route.snapshot.queryParamMap.get('date') || todayIso());
  protected onlyPending = signal(this.route.snapshot.queryParamMap.get('onlyPending') === 'true');

  protected rows = signal<PickingSummary[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  protected closedCount = computed(() => this.rows().filter((b) => b.pickingConfirmedAt).length);
  protected pendingCloseCount = computed(
    () => this.rows().filter((b) => !b.pickingConfirmedAt).length,
  );
  protected withShortfallCount = computed(
    () =>
      this.rows().filter((b) => b.pickingCounts.shortLoaded + b.pickingCounts.notLoaded > 0).length,
  );

  protected totalOf(b: PickingSummary): number {
    const c = b.pickingCounts;
    return c.complete + c.shortLoaded + c.notLoaded + c.pending;
  }

  private syncQueryParamsEffect = effect(() => {
    const date = this.date();
    const onlyPending = this.onlyPending();
    untracked(() => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { date, onlyPending: onlyPending || null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      this.load();
    });
  });

  protected shiftDate(delta: number) {
    this.date.set(addDaysIso(this.date(), delta));
  }

  protected open(b: PickingSummary) {
    this.router.navigate(['/reparto/picking', b.batchId]);
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.pickingSvc
      .list({ date: this.date(), onlyPending: this.onlyPending() || undefined, size: 100 })
      .subscribe({
        next: (result) => {
          this.rows.set(result.content ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }
}
