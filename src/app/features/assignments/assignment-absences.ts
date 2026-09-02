import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { CoverageDialog } from './ui/coverage-dialog';
import { AssignmentAdminService } from './assignment-admin';
import { VendorOnRouteView } from '../../shared/models/assignment-admin.models';
import { timeText } from './assignment-format';

/**
 * Ausencias del día: vendedores sin ruta hoy (punto de partida del flujo de
 * cobertura) junto a los activos hoy, para poder comparar de un vistazo.
 */
@Component({
  selector: 'app-assignment-absences',
  imports: [UiButton, UiEmpty, AssignmentModuleTabs],
  template: `
    <app-assignment-module-tabs />
    <section class="abs-page">
      <div class="abs-head">
        <h1>Ausencias de hoy</h1>
        <p class="abs-sub">Vendedores que no iniciaron ruta hoy, junto a los que sí.</p>
      </div>

      @if (loading()) {
        <div class="abs-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las ausencias"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else {
        <div class="abs-grid">
          <div class="abs-col">
            <h2>Sin ruta hoy ({{ withoutRoute().length }})</h2>
            @if (withoutRoute().length === 0) {
              <ui-empty
                variant="al-dia"
                eyebrow="Al día"
                title="Todos los vendedores iniciaron ruta hoy"
                body="No hay ausencias que cubrir en este momento."
              />
            } @else {
              <div class="abs-list">
                @for (v of withoutRoute(); track v.userId) {
                  <div class="abs-row">
                    <span class="abs-row-name">{{ v.userName }}</span>
                    <div class="abs-row-actions">
                      <button uiButton variant="ghost" size="sm" (click)="viewOnMap(v)">
                        Ver en mapa
                      </button>
                      <button uiButton variant="secondary" size="sm" (click)="cover(v)">
                        Cubrir cartera
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <div class="abs-col">
            <h2>Activos hoy ({{ active().length }})</h2>
            @if (active().length === 0) {
              <ui-empty
                title="Nadie ha iniciado ruta todavía"
                body="En cuanto un vendedor inicie ruta aparecerá aquí."
              />
            } @else {
              <div class="abs-list">
                @for (v of active(); track v.userId) {
                  <div class="abs-row">
                    <span class="abs-row-name">{{ v.userName }}</span>
                    <div class="abs-row-meta">
                      <span class="abs-time">{{ timeText(v.startTime) }}</span>
                      @if (v.startLatitude == null || v.startLongitude == null) {
                        <span class="abs-badge">Sin GPS</span>
                      }
                      <button uiButton variant="ghost" size="sm" (click)="viewOnMap(v)">
                        Ver en mapa
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .abs-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .abs-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .abs-skeleton {
        height: 220px;
        background: var(--faint);
        margin-top: 20px;
      }
      .abs-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-top: 24px;
      }
      .abs-col h2 {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0 0 12px;
        color: var(--ink);
        border-bottom: var(--border-rule);
        padding-bottom: 8px;
      }
      .abs-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .abs-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: var(--bg);
        padding: 12px 14px;
        flex-wrap: wrap;
      }
      .abs-row-name {
        font-weight: 800;
        color: var(--ink);
      }
      .abs-row-actions,
      .abs-row-meta {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .abs-time {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .abs-badge {
        font-size: 11px;
        font-weight: 800;
        color: var(--st-pendiente);
        white-space: nowrap;
      }

      @media (max-width: 900px) {
        .abs-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .abs-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class AssignmentAbsencesPage {
  private assignmentSvc = inject(AssignmentAdminService);
  private dialog = inject(UiDialogService);
  private router = inject(Router);

  protected timeText = timeText;

  protected withoutRoute = signal<VendorOnRouteView[]>([]);
  protected active = signal<VendorOnRouteView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    forkJoin({
      withoutRoute: this.assignmentSvc.vendorsWithoutRouteToday(),
      active: this.assignmentSvc.activeVendorsToday(),
    }).subscribe({
      next: ({ withoutRoute, active }) => {
        this.withoutRoute.set(withoutRoute);
        this.active.set(active);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected viewOnMap(vendor: VendorOnRouteView) {
    this.router.navigate(['/asignaciones/mapa'], { queryParams: { userIds: vendor.userId } });
  }

  protected cover(vendor: VendorOnRouteView) {
    this.dialog.open(CoverageDialog, {
      data: { absentUserId: vendor.userId, absentUserName: vendor.userName },
      width: '520px',
    });
  }
}
