import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiCheckbox } from '../../shared/ui/checkbox/checkbox';
import { UiBadge } from '../../shared/ui/badge/badge';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { PromoService } from './promo';
import { PromoSummary } from './promo.types';

/** Insignia del premio — doc 51, sección 4.2. `AVAILABLE`/`null` no pintan nada. */
function rewardBadgeColorVar(rewardStatus: string | null): string {
  return rewardStatus === 'SOLD_OUT' ? '--status-danger' : '--st-no-purchase';
}

/**
 * Promociones → Promociones vigentes — doc 51, sección 11. La lista liviana
 * de `GET /promos/current` (`order.create` o `promo.create`), con el
 * estado del premio: en qué promociones ya no hay nada que ofrecer.
 */
@Component({
  selector: 'app-promo-current',
  imports: [UiCheckbox, UiBadge, UiEmpty],
  template: `
    <section class="pc-page">
      <div class="pc-head">
        <div>
          <h1>Promociones vigentes</h1>
          <p class="pc-sub">Las que hoy le llegan al cliente, con el estado de su premio.</p>
        </div>
        <ui-checkbox
          label="Ver todos los canales"
          [(checked)]="allChannels"
          (checkedChange)="load()"
        />
      </div>

      @if (loading()) {
        <div class="pc-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las promociones"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (promos().length === 0) {
        <ui-empty
          title="Sin promociones vigentes"
          body="No hay promociones activas para mostrar."
        />
      } @else {
        <table class="ui-table-grid pc-table">
          <thead>
            <tr>
              <th>Promoción</th>
              <th>Canal</th>
              <th>Beneficio</th>
              <th>Premio</th>
            </tr>
          </thead>
          <tbody>
            @for (p of promos(); track p.promoId) {
              <tr class="pc-row" (click)="openDetail(p)">
                <td>
                  <div class="pc-name-cell">
                    <span class="pc-name">{{ p.name }}</span>
                    @if (p.featured) {
                      <ui-badge tone="accent"
                        ><span class="material-icons" aria-hidden="true">star</span
                        >Destacada</ui-badge
                      >
                    }
                  </div>
                  <span class="pc-code">{{ p.code }}</span>
                </td>
                <td class="pc-muted">{{ p.salesChannelName || 'Todos' }}</td>
                <td class="pc-muted">{{ p.benefitSummary }}</td>
                <td>
                  @if (p.rewardStatusLabel) {
                    <span class="pc-reward-badge" [style.color]="'var(' + rewardColorVar(p) + ')'">
                      ■ {{ p.rewardStatusLabel }}
                    </span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: [
    `
      .pc-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .pc-head {
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
      .pc-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .pc-skeleton {
        height: 220px;
        background: var(--faint);
        margin-top: 20px;
      }
      .pc-table {
        width: 100%;
        margin-top: 20px;
      }
      .pc-row {
        cursor: pointer;
      }
      .pc-row:hover {
        background: var(--faint);
      }
      .pc-name-cell {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pc-name {
        font-weight: 700;
        color: var(--ink);
      }
      .pc-code {
        display: block;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .pc-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .pc-reward-badge {
        font-size: 12px;
        font-weight: 800;
      }

      @media (max-width: 767px) {
        .pc-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class PromoCurrentPage {
  private promoSvc = inject(PromoService);
  private router = inject(Router);

  protected rewardColorVar = (p: PromoSummary) => rewardBadgeColorVar(p.rewardStatus);

  protected allChannels = signal(false);
  protected promos = signal<PromoSummary[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.promoSvc.current({ allChannels: this.allChannels() }).subscribe({
      next: (list) => {
        this.promos.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected openDetail(p: PromoSummary) {
    this.router.navigate(['/promociones', p.promoId]);
  }
}
