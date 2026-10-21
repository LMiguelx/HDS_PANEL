import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiMenu } from '../../shared/ui/menu/menu';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { PromoService } from './promo';
import { PromoDetail } from './promo.types';
import {
  applicationsPerCustomerText,
  priorityText,
  promoStatusLabel,
  repeatsText,
  vigenciaFullText,
} from './promo-format';
import { dateTimeText } from '../assignments/assignment-format';
import {
  benefitProductName,
  benefitQuantityText,
  groupModeText,
  thresholdText,
} from './domain/promo-texts';
import { EditBasicsDialog, EditBasicsDialogResult } from './ui/edit-basics-dialog';
import { formatSoles } from '../../shared/pipes/money';
import { quantityText } from '../sales-reports/sales-report-format';

@Component({
  selector: 'app-promo-detail',
  imports: [RouterLink, UiButton, UiStatus, UiEmpty, UiMenu, HasPermissionDirective],
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
            <p class="promo-detail-eyebrow">PROMOCIONES · {{ p.code }}</p>
            <div class="promo-detail-title-row">
              <h1>{{ p.name }}</h1>
              <ui-status [label]="statusLabel(p)" />
            </div>
            <p class="promo-detail-meta">{{ metaLine(p) }}</p>
            @if (p.description) {
              <p class="promo-detail-prose">{{ p.description }}</p>
            }
          </div>
          <div class="promo-detail-actions">
            <button
              uiButton
              variant="secondary"
              *hasPermission="'order.manage'"
              [routerLink]="['/promociones/simular']"
              [queryParams]="{ promoId: p.promoId }"
            >
              Simular
            </button>
            <button
              uiButton
              variant="secondary"
              *hasPermission="'promo.create'"
              (click)="duplicate()"
            >
              Duplicar
            </button>
            <button uiButton variant="secondary" *hasPermission="'promo.create'" (click)="edit(p)">
              Editar
            </button>
            <ui-menu label="Más acciones">
              @if (!p.active) {
                <button type="button" *hasPermission="'promo.approve'" (click)="activate()">
                  Encender
                </button>
              } @else {
                <button type="button" *hasPermission="'promo.approve'" (click)="deactivate()">
                  Apagar
                </button>
              }
              @if (p.usage.orderCount === 0) {
                <button type="button" *hasPermission="'promo.create'" (click)="remove()">
                  Borrar
                </button>
              }
            </ui-menu>
          </div>
        </div>

        @if (deleteError()) {
          <div class="promo-detail-error">{{ deleteError() }}</div>
        }

        <div class="promo-detail-usage">
          <div class="promo-usage-cell">
            <span class="promo-usage-value">{{ p.usage.orderCount }}</span>
            <span class="promo-usage-label">Pedidos</span>
          </div>
          <div class="promo-usage-cell">
            <span class="promo-usage-value">{{ quantityText(p.usage.grantedUnits) }}</span>
            <span class="promo-usage-label">Unidades bonificadas</span>
          </div>
          <div class="promo-usage-cell">
            <span class="promo-usage-value">{{ formatSoles(p.usage.discountAmount) }}</span>
            <span class="promo-usage-label">Descuentos</span>
          </div>
          <div class="promo-usage-cell">
            <span class="promo-usage-value promo-usage-value-sm">{{
              p.usage.lastAppliedAt ? dateTimeText(p.usage.lastAppliedAt) : 'Todavía no se aplicó'
            }}</span>
            <span class="promo-usage-label">Última aplicación</span>
          </div>
        </div>

        @if (!p.definitionEditable) {
          <div class="promo-edit-banner">
            <span class="material-icons" aria-hidden="true">info</span>
            <div>{{ p.editBlockReason }}</div>
            <button
              uiButton
              variant="secondary"
              size="sm"
              *hasPermission="'promo.create'"
              (click)="duplicate()"
            >
              Duplicar
            </button>
          </div>
        }

        <hr class="promo-detail-rule" />

        <h2 class="promo-section-title">Configuración</h2>
        <div class="promo-detail-facts">
          <div>
            <span>Se combina</span><span>{{ p.stackable ? 'Sí' : 'No' }}</span>
          </div>
          <div>
            <span>Se repite</span><span>{{ repeatsText(p.repeats, p.maxRepeatsPerOrder) }}</span>
          </div>
          <div>
            <span>Veces por cliente</span>
            <span>{{ applicationsPerCustomerText(p.maxApplicationsPerCustomer) }}</span>
          </div>
        </div>

        <h2 class="promo-section-title">
          Qué debe comprar
          @if (showSumNote(p)) {
            <span class="promo-section-note">Las cantidades se suman entre sí</span>
          }
        </h2>
        @if (p.promoType === 'CUSTOMER_LIST') {
          <p class="promo-detail-muted">No exige compra: se otorga por estar en la lista.</p>
        } @else if (!p.conditions?.length) {
          <p class="promo-detail-muted">Cualquier compra que llegue al total mínimo del tramo.</p>
        } @else {
          <table class="ui-table-grid promo-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Código</th>
                <th>Nombre</th>
              </tr>
            </thead>
            <tbody>
              @for (c of p.conditions; track c.lineNumber) {
                <tr>
                  <td class="promo-detail-muted">{{ scopeName(c.scope) }}</td>
                  <td class="promo-detail-muted">{{ c.productCode || '—' }}</td>
                  <td>{{ c.productName || c.familyName || c.brandName }}</td>
                </tr>
              }
            </tbody>
          </table>
        }

        <h2 class="promo-section-title">Tramos y premios</h2>
        <div class="promo-tiers">
          @for (tier of p.tiers; track tier.tier) {
            <div class="promo-tier-block">
              <div class="promo-tier-head">
                <span class="promo-tier-label">Tramo {{ tier.tier }}</span>
                <span class="promo-tier-threshold">{{ tierThreshold(p, tier) }}</span>
              </div>
              @for (group of tier.benefitGroups; track group.benefitGroup) {
                <div class="promo-benefit-group">
                  <div class="promo-benefit-group-head">
                    {{ groupMode(group) }}
                    @if (group.label) {
                      · {{ group.label }}
                    }
                  </div>
                  <table class="ui-table-grid promo-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Código</th>
                        <th>Premio</th>
                        <th class="promo-col-right">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (b of group.benefits; track b.benefitLine) {
                        <tr>
                          <td class="promo-detail-muted">{{ b.benefitTypeName }}</td>
                          <td class="promo-detail-muted">{{ b.productCode || '—' }}</td>
                          <td>{{ benefitProductName(b) }}</td>
                          <td class="promo-col-right">{{ benefitQuantityText(b) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }
        </div>

        <h2 class="promo-section-title">A quiénes llega</h2>
        @if (!p.segments?.length && !p.customers?.length) {
          <p class="promo-detail-muted">
            Todos los clientes{{ p.salesChannelName ? ' del canal ' + p.salesChannelName : '' }}.
          </p>
        } @else {
          @if (p.segments?.length) {
            <table class="ui-table-grid promo-table">
              <thead>
                <tr>
                  <th>Segmento</th>
                  <th class="promo-col-right">Clientes</th>
                  <th>Modo</th>
                </tr>
              </thead>
              <tbody>
                @for (s of p.segments; track s.segmentId) {
                  <tr>
                    <td>{{ s.segmentName }}</td>
                    <td class="promo-col-right promo-detail-muted">{{ s.customerCount ?? 0 }}</td>
                    <td><ui-status [label]="s.mode === 'INCLUDE' ? 'Incluido' : 'Excluido'" /></td>
                  </tr>
                }
              </tbody>
            </table>
          }
          @if (p.customers?.length) {
            <table class="ui-table-grid promo-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Modo</th>
                  <th class="promo-col-right">Tope</th>
                </tr>
              </thead>
              <tbody>
                @for (c of p.customers; track c.customerId) {
                  <tr>
                    <td class="promo-detail-muted">{{ c.customerCode }}</td>
                    <td>{{ c.customerName }}</td>
                    <td><ui-status [label]="c.mode === 'INCLUDE' ? 'Incluido' : 'Excluido'" /></td>
                    <td class="promo-col-right promo-detail-muted">
                      {{ c.maxQuantity != null ? quantityText(c.maxQuantity) : '—' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        }
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
      .promo-detail-eyebrow {
        margin: 0;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .promo-detail-title-row {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 4px 0 0;
        color: var(--ink);
      }
      .promo-detail-meta {
        margin: 4px 0 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .promo-detail-prose {
        border-left: 3px solid var(--accent);
        padding: 4px 0 4px 14px;
        margin: 14px 0 0;
        font-size: 15px;
        color: var(--ink);
        max-width: 640px;
      }
      .promo-detail-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .promo-detail-error {
        margin-top: 14px;
        color: var(--accent-ink);
        font-size: 13px;
      }
      .promo-detail-usage {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0;
        border: 1px solid var(--hairline);
        margin-top: 20px;
      }
      .promo-usage-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 16px 18px;
        border-right: 1px solid var(--hairline);
      }
      .promo-usage-cell:last-child {
        border-right: 0;
      }
      .promo-usage-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .promo-usage-value-sm {
        font-size: 18px;
        font-weight: 700;
      }
      .promo-usage-label {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .promo-edit-banner {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-top: 16px;
        padding: 12px 14px;
        background: var(--faint);
        border: 1px solid var(--hairline);
        font-size: 13px;
        color: var(--ink-muted);
      }
      .promo-edit-banner .material-icons {
        font-size: 18px;
        color: var(--ink-muted);
      }
      .promo-edit-banner button {
        flex: none;
        margin-left: auto;
      }
      .promo-detail-rule {
        border: 0;
        border-top: var(--border-hair);
        margin: 24px 0;
      }
      .promo-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 28px 0 12px;
        color: var(--ink);
        display: flex;
        align-items: baseline;
        gap: 10px;
      }
      .promo-section-note {
        font-size: 12px;
        font-weight: 400;
        color: var(--ink-muted);
      }
      .promo-detail-facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 14px;
        font-size: 14px;
      }
      .promo-detail-facts div {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .promo-detail-facts span:first-child {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .promo-table {
        width: 100%;
        margin-bottom: 4px;
      }
      .promo-col-right {
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .promo-detail-muted {
        color: var(--ink-muted);
        font-size: 14px;
      }
      .promo-tiers {
        display: grid;
        gap: 18px;
      }
      .promo-tier-block {
        border: 1px solid var(--hairline);
        padding: 16px 18px;
      }
      .promo-tier-head {
        display: flex;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 12px;
      }
      .promo-tier-label {
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .promo-tier-threshold {
        font-size: 20px;
        font-weight: 800;
        color: var(--ink);
      }
      .promo-benefit-group {
        margin-top: 12px;
      }
      .promo-benefit-group-head {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-muted);
        margin-bottom: 6px;
      }

      @media (max-width: 767px) {
        .promo-detail-page {
          padding: var(--sp-4);
        }
        .promo-detail-prose {
          font-size: 15px;
        }
      }
    `,
  ],
})
export class PromoDetailPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private promoSvc = inject(PromoService);
  private dialog = inject(UiDialogService);

  protected repeatsText = repeatsText;
  protected applicationsPerCustomerText = applicationsPerCustomerText;
  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;
  protected quantityText = quantityText;
  protected benefitProductName = benefitProductName;
  protected benefitQuantityText = benefitQuantityText;

  protected promo = signal<PromoDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected deleteError = signal('');

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

  protected statusLabel(p: PromoDetail): string {
    return promoStatusLabel(p);
  }

  protected metaLine(p: PromoDetail): string {
    const parts = [
      p.promoTypeName || p.promoType,
      p.salesChannelName ? `Canal ${p.salesChannelName}` : 'Todos los canales',
      vigenciaFullText(p.startDate, p.endDate),
      `Prioridad ${priorityText(p.priority)}`,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  protected showSumNote(p: PromoDetail): boolean {
    const conditions = p.conditions ?? [];
    return conditions.length > 1 || conditions.some((c) => c.scope !== 'PRODUCT');
  }

  protected scopeName(scope?: string | null): string {
    return { PRODUCT: 'Producto', FAMILY: 'Familia', BRAND: 'Marca' }[scope ?? ''] ?? scope ?? '—';
  }

  protected tierThreshold(
    p: PromoDetail,
    tier: { fromQuantity?: number; fromAmount?: number },
  ): string {
    return thresholdText({
      promoType: p.promoType,
      measureType: p.measureType,
      fromQuantity: tier.fromQuantity,
      fromAmount: tier.fromAmount,
    });
  }

  protected groupMode(group: {
    selectionMode?: string | null;
    chooseCount?: number | null;
    benefits?: unknown[];
  }): string {
    return groupModeText(group.selectionMode, group.chooseCount, group.benefits?.length ?? 0);
  }

  protected duplicate() {
    const id = this.promo()?.promoId;
    this.router.navigate(['/promociones/nueva'], { queryParams: { duplicateFrom: id } });
  }

  protected edit(p: PromoDetail) {
    if (p.definitionEditable) {
      this.router.navigate(['/promociones', p.promoId, 'editar']);
      return;
    }
    this.dialog
      .open<EditBasicsDialog, PromoDetail, EditBasicsDialogResult>(EditBasicsDialog, { data: p })
      .afterClosed()
      .subscribe((result) => {
        if (result === 'duplicate') {
          this.duplicate();
        } else if (result) {
          this.promo.set(result);
        }
      });
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

  protected remove() {
    const id = this.promo()?.promoId;
    if (!id) return;
    this.dialog
      .confirm({
        title: 'Borrar promoción',
        message: '¿Borrar esta promoción? Esta acción no se puede deshacer.',
        confirmLabel: 'Borrar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deleteError.set('');
        this.promoSvc.remove(id).subscribe({
          next: () => this.router.navigate(['/promociones']),
          error: (err) => {
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.deleteError.set(
              detalle || 'No pudimos borrar la promoción: ya se aplicó en algún pedido.',
            );
          },
        });
      });
  }
}
