import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { PromoService } from './promo';
import { PromoDetail } from './promo.types';
import { vigenciaText } from './promo-format';

@Component({
  selector: 'app-promo-detail',
  imports: [UiButton, UiStatus, UiEmpty],
  template: `
    <section class="promo-detail-page">
      @if (loading()) {
        <div class="promo-detail-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar la promoción"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (promo(); as p) {
        <div class="promo-detail-head">
          <div>
            <ui-status [label]="p.active ? 'Vigente' : 'Apagada'" [status]="p.active ? 'vigente' : 'apagada'" />
            <h1>{{ p.name }}</h1>
            <p class="promo-detail-meta">{{ metaLine(p) }}</p>
          </div>
          <div class="promo-detail-actions">
            <button uiButton variant="secondary" (click)="duplicate()">Duplicar</button>
            @if (p.active) {
              <button uiButton variant="secondary" (click)="deactivate()">Desactivar</button>
            } @else {
              <button uiButton variant="secondary" (click)="activate()">Activar</button>
            }
          </div>
        </div>

        @if (p.description) {
          <div class="promo-detail-prose">{{ p.description }}</div>
        }
        <hr class="promo-detail-rule" />

        <div class="promo-tiers">
          @for (tier of p.tiers; track tier.tier) {
            <div class="promo-tier-cell">
              <div class="promo-tier-label">Tramo {{ tier.tier }}</div>
              <div class="promo-tier-threshold">{{ tier.thresholdText || tierFallback(tier) }}</div>
              <div class="promo-tier-groups">
                @for (group of tier.benefitGroups; track group.benefitGroup) {
                  <div class="promo-benefit-group">
                    <strong>{{ group.modeText || group.selectionMode }}</strong>
                    @for (b of group.benefits; track b.benefitLine) {
                      <div class="promo-benefit-line">{{ b.displayText || b.label }}</div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <div class="promo-detail-bottom">
          <div>
            <h4>Qué debe comprar</h4>
            @if (p.conditions?.length) {
              <div class="promo-detail-muted">
                @for (c of p.conditions; track c.lineNumber) {
                  <div>{{ c.displayText }}</div>
                }
              </div>
            } @else {
              <div class="promo-detail-muted">Cualquier compra que llegue al total mínimo del tramo.</div>
            }
          </div>
          <div>
            <h4>A quiénes llega</h4>
            <div class="promo-detail-muted">{{ audienceText(p) }}</div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .promo-detail-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .promo-detail-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .promo-detail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 6px 0 4px;
        color: var(--ink);
      }
      .promo-detail-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .promo-detail-actions {
        display: flex;
        gap: 8px;
      }
      .promo-detail-prose {
        border-left: 3px solid var(--accent);
        padding: 6px 0 6px 18px;
        font-size: 20px;
        line-height: 1.45;
        margin: 24px 0 4px;
        color: var(--ink);
      }
      .promo-detail-rule {
        border: 0;
        border-top: var(--border-hair);
        margin: 20px 0;
      }
      .promo-tiers {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 0;
        border: 1px solid var(--hairline);
        width: 100%;
      }
      .promo-tier-cell {
        padding: 18px;
        border-right: 1px solid var(--hairline);
      }
      .promo-tier-label {
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .promo-tier-threshold {
        font-size: 26px;
        font-weight: 800;
        margin: 2px 0 10px;
        color: var(--ink);
      }
      .promo-tier-groups {
        display: grid;
        gap: 10px;
        font-size: 14px;
      }
      .promo-benefit-group {
        padding: 10px 12px;
        background: var(--faint);
      }
      .promo-benefit-line {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .promo-detail-bottom {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
        margin-top: 28px;
      }
      .promo-detail-bottom h4 {
        font-size: 16px;
        margin: 0 0 6px;
        color: var(--ink);
      }
      .promo-detail-muted {
        font-size: 14px;
        color: var(--ink-muted);
        line-height: 1.5;
      }
    `,
  ],
})
export class PromoDetailPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private promoSvc = inject(PromoService);

  protected promo = signal<PromoDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  constructor() {
    this.load();
  }

  load() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set(false);
    this.promoSvc.detail(id).subscribe({
      next: (p) => {
        this.promo.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected metaLine(p: PromoDetail): string {
    const parts = [
      p.salesChannelName,
      vigenciaText(p.startDate, p.endDate),
      p.priority ? `prioridad ${this.priorityText(p.priority)}` : '',
      p.stackable ? 'se combina con otras' : 'no se combina',
    ].filter(Boolean);
    return parts.join(' · ');
  }

  private priorityText(priority: number): string {
    if (priority <= 1) return 'alta';
    if (priority <= 5) return 'media';
    return 'baja';
  }

  protected tierFallback(tier: { fromQuantity?: number; fromAmount?: number }): string {
    if (tier.fromQuantity) return `Desde ${tier.fromQuantity} unidades`;
    if (tier.fromAmount) return `Desde S/ ${tier.fromAmount}`;
    return '—';
  }

  protected audienceText(p: PromoDetail): string {
    const segments = p.segments ?? [];
    const customers = p.customers ?? [];
    if (segments.length === 0 && customers.length === 0) {
      return `Llega a todos los clientes del canal ${p.salesChannelName ?? ''}.`;
    }
    const totalCustomers = segments.reduce((acc, s) => acc + (s.customerCount ?? 0), 0);
    const parts: string[] = [];
    if (totalCustomers > 0) parts.push(`${totalCustomers} clientes`);
    const segmentNames = segments
      .filter((s) => s.mode === 'INCLUDE')
      .map((s) => s.segmentName)
      .filter(Boolean);
    const excludedSegments = segments
      .filter((s) => s.mode === 'EXCLUDE')
      .map((s) => s.segmentName)
      .filter(Boolean);
    const includedCustomers = customers
      .filter((c) => c.mode === 'INCLUDE')
      .map((c) => c.customerName)
      .filter(Boolean);
    const excludedCustomers = customers
      .filter((c) => c.mode === 'EXCLUDE')
      .map((c) => c.customerName)
      .filter(Boolean);
    if (segmentNames.length) parts.push(`segmento ${segmentNames.join(', ')}`);
    if (includedCustomers.length) parts.push(`cliente ${includedCustomers.join(', ')}`);
    const excluded = [...excludedSegments, ...excludedCustomers];
    let text = parts.join(': ');
    if (excluded.length) text += `, menos ${excluded.join(', ')}`;
    return text || 'Alcance limitado.';
  }

  protected duplicate() {
    const id = this.promo()?.promoId;
    this.router.navigate(['/promociones/nueva'], { queryParams: { duplicateFrom: id } });
  }

  protected activate() {
    const id = this.promo()?.promoId;
    if (!id) return;
    this.promoSvc.approve(id).subscribe(() => this.load());
  }

  protected deactivate() {
    const id = this.promo()?.promoId;
    if (!id) return;
    this.promoSvc.deactivate(id).subscribe(() => this.load());
  }
}
