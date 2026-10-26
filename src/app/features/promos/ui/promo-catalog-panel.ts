import { Component, computed, input, output, signal } from '@angular/core';
import { UiField } from '../../../shared/ui/field/field';
import { UiBadge } from '../../../shared/ui/badge/badge';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import {
  MobilePromoCatalogView,
  MobilePromoProductView,
  MobilePromoView,
} from '../../../shared/models/promo-simulation.models';

interface ProductRow {
  familyName: string;
  brandName: string;
  code: string;
  name: string;
  firstOfFamily: boolean;
}

/**
 * Panel "Promos disponibles" de un cliente — doc 49, sección 9.3. Pieza
 * compartida entre el pedido de mostrador (abre en "Todas") y televentas
 * (abre en "★ Destacadas"): es puramente de presentación, no llama al
 * backend. El padre hace el `GET` (con el `featuredOnly` que corresponda) y
 * vuelve a pedirlo cuando el usuario cambia de pestaña (`featuredOnlyChange`).
 */
@Component({
  selector: 'app-promo-catalog-panel',
  imports: [UiField, UiBadge, UiEmpty],
  template: `
    <div class="pcp">
      <div class="pcp-toolbar">
        <div class="pcp-tabs" role="tablist">
          <button
            type="button"
            class="pcp-tab"
            [class.active]="!activeFeaturedOnly()"
            (click)="selectTab(false)"
          >
            Todas{{ catalog() ? ' (' + catalog()!.totalAvailable + ')' : '' }}
          </button>
          <button
            type="button"
            class="pcp-tab"
            [class.active]="activeFeaturedOnly()"
            (click)="selectTab(true)"
          >
            <span class="material-icons" aria-hidden="true">star</span>
            Destacadas{{ catalog() ? ' (' + catalog()!.featuredCount + ')' : '' }}
          </button>
        </div>
        <ui-field
          label="Buscar producto"
          icon="search"
          placeholder="Código o nombre del producto…"
          [(value)]="searchText"
          class="pcp-search"
        />
      </div>

      @if (loading()) {
        <div class="pcp-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las promociones"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="retry.emit()"
        />
      } @else if (!catalog() || visiblePromos().length === 0) {
        <ui-empty [title]="emptyTitle()" [body]="emptyBody()" />
      } @else {
        <div class="pcp-list">
          @for (p of visiblePromos(); track p.promoId) {
            <div class="pcp-card">
              <div class="pcp-card-head">
                <div class="pcp-card-name">
                  {{ p.name }}
                  @if (p.featured) {
                    <ui-badge tone="accent" class="pcp-featured-badge"
                      ><span class="material-icons" aria-hidden="true">star</span
                      >Destacada</ui-badge
                    >
                  }
                </div>
                <span class="pcp-card-valid">{{ p.validUntilText }}</span>
              </div>

              <div class="pcp-card-rule">{{ p.requirementText }}</div>
              <div class="pcp-card-reward">
                <span class="material-icons" aria-hidden="true">auto_awesome</span>
                {{ p.rewardText }}
                @if (p.requiresChoice) {
                  <ui-badge tone="neutral">Premio a elegir</ui-badge>
                }
              </div>

              @if (noticeText(p)) {
                <div class="pcp-card-notice">{{ noticeText(p) }}</div>
              }

              @if (p.tiers.length > 1) {
                <div class="pcp-tiers">
                  <div class="pcp-tiers-title">Tramos</div>
                  @for (t of p.tiers; track t.tier) {
                    <div class="pcp-tier-row">
                      <span>Tramo {{ t.tier }} · {{ t.thresholdText }}</span>
                      <span class="pcp-tier-arrow">→</span>
                      <span>{{ t.rewardText }}</span>
                    </div>
                    @for (g of t.groups; track g.benefitGroup) {
                      @if (g.selectionMode === 'CHOOSE') {
                        <div class="pcp-tier-options">
                          {{ g.modeText }}:
                          @for (b of g.benefits; track b.benefitLine) {
                            <span class="pcp-tier-option">{{ b.text }}</span>
                          }
                        </div>
                      }
                    }
                  }
                </div>
              }

              <div class="pcp-products">
                <div class="pcp-products-title">
                  Productos que cuentan · {{ productRows(p).length }}
                </div>
                <div class="pcp-products-grid">
                  @for (row of visibleProductRows(p); track row.code) {
                    <div class="pcp-product-row">
                      <span class="pcp-product-family">{{
                        row.firstOfFamily ? row.familyName : ''
                      }}</span>
                      <span class="pcp-product-code">{{ row.code }}</span>
                      <span class="pcp-product-name"
                        >{{ row.name }}
                        @if (hasMultipleBrands(p)) {
                          <span class="pcp-product-brand">· {{ row.brandName }}</span>
                        }
                      </span>
                    </div>
                  }
                </div>
                @if (productRows(p).length > 6) {
                  <button type="button" class="pcp-products-toggle" (click)="toggleExpand(p)">
                    {{ isExpanded(p) ? 'Ver menos' : 'Ver todos' }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .pcp {
        display: grid;
        gap: var(--sp-4);
      }
      .pcp-toolbar {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--sp-4);
        flex-wrap: wrap;
      }
      .pcp-tabs {
        display: flex;
        gap: var(--sp-2);
      }
      .pcp-tab {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 8px 14px;
        border: 2px solid var(--divider);
        background: var(--surface);
        color: var(--ink-muted);
        font-weight: 700;
        font-size: var(--fs-dense);
        cursor: pointer;
      }
      .pcp-tab .material-icons {
        font-size: 15px;
      }
      .pcp-tab.active {
        border-color: var(--accent);
        color: var(--accent-ink);
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }
      .pcp-search {
        min-width: 220px;
        flex: 1;
        max-width: 320px;
      }
      .pcp-skeleton {
        height: 180px;
        background: var(--faint);
      }
      .pcp-list {
        display: grid;
        gap: var(--sp-4);
        max-height: 520px;
        overflow-y: auto;
      }
      .pcp-card {
        border: 2px solid var(--divider);
        border-radius: var(--radius-card);
        padding: var(--sp-4);
        display: grid;
        gap: var(--sp-2);
      }
      .pcp-card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--sp-3);
        flex-wrap: wrap;
      }
      .pcp-card-name {
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        color: var(--ink);
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .pcp-featured-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .pcp-featured-badge .material-icons {
        font-size: 12px;
      }
      .pcp-card-valid {
        flex: none;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .pcp-card-rule {
        color: var(--ink);
      }
      .pcp-card-reward {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        color: var(--accent-ink);
        flex-wrap: wrap;
      }
      .pcp-card-reward .material-icons {
        font-size: 16px;
      }
      .pcp-card-notice {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .pcp-tiers {
        border-top: 1px solid var(--hairline);
        padding-top: var(--sp-2);
        display: grid;
        gap: 4px;
      }
      .pcp-tiers-title {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .pcp-tier-row {
        display: flex;
        gap: 6px;
        font-size: var(--fs-dense);
        color: var(--ink);
      }
      .pcp-tier-arrow {
        color: var(--ink-muted);
      }
      .pcp-tier-options {
        margin-left: var(--sp-3);
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .pcp-tier-option {
        margin-right: 8px;
      }
      .pcp-products {
        border-top: 1px solid var(--hairline);
        padding-top: var(--sp-2);
      }
      .pcp-products-title {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        margin-bottom: 4px;
      }
      .pcp-products-grid {
        display: grid;
        gap: 2px;
      }
      .pcp-product-row {
        display: grid;
        grid-template-columns: 90px auto 1fr;
        gap: var(--sp-3);
        font-size: var(--fs-dense);
      }
      .pcp-product-family {
        font-weight: 700;
        color: var(--ink);
      }
      .pcp-product-code {
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .pcp-product-name {
        color: var(--ink);
      }
      .pcp-product-brand {
        color: var(--ink-muted);
      }
      .pcp-products-toggle {
        margin-top: 6px;
        background: none;
        border: none;
        padding: 0;
        color: var(--accent-ink);
        font-weight: 700;
        font-size: var(--fs-dense);
        cursor: pointer;
      }

      @media (max-width: 600px) {
        .pcp-product-row {
          grid-template-columns: 1fr;
          gap: 2px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--hairline);
        }
      }
    `,
  ],
})
export class PromoCatalogPanel {
  catalog = input<MobilePromoCatalogView | null>(null);
  loading = input(false);
  error = input(false);

  /** El padre vuelve a pedir el endpoint con este valor y actualiza `catalog`. */
  featuredOnlyChange = output<boolean>();
  retry = output<void>();

  protected searchText = signal('');
  private expanded = signal<Set<number>>(new Set());

  /** Si el padre todavía no respondió, refleja la pestaña pedida la última vez. */
  private requestedFeaturedOnly = signal(false);

  protected activeFeaturedOnly = computed(
    () => this.catalog()?.featuredOnly ?? this.requestedFeaturedOnly(),
  );

  private productsById = computed(() => {
    const map = new Map<number, MobilePromoProductView>();
    for (const prod of this.catalog()?.products ?? []) map.set(prod.productId, prod);
    return map;
  });

  protected visiblePromos = computed(() => {
    const promos = this.catalog()?.promos ?? [];
    const q = this.searchText().trim().toLowerCase();
    if (!q) return promos;
    const products = this.productsById();
    return promos.filter((p) =>
      p.productIds.some((id) => {
        const prod = products.get(id);
        if (!prod) return false;
        return prod.code.toLowerCase().includes(q) || prod.name.toLowerCase().includes(q);
      }),
    );
  });

  protected emptyTitle(): string {
    return this.activeFeaturedOnly() ? 'Sin promociones destacadas' : 'Sin promociones';
  }

  protected emptyBody(): string {
    if (this.activeFeaturedOnly()) {
      return 'No hay promociones destacadas para este cliente. Revisa la pestaña Todas.';
    }
    return 'Este cliente no tiene promociones vigentes con el canal elegido.';
  }

  protected selectTab(featuredOnly: boolean) {
    this.requestedFeaturedOnly.set(featuredOnly);
    this.featuredOnlyChange.emit(featuredOnly);
  }

  protected noticeText(p: MobilePromoView): string {
    const parts: string[] = [];
    if (p.repeatText) parts.push(p.repeatText);
    if (p.usesText) parts.push(p.usesText);
    if (!p.stackable) parts.push('No se combina con otras promociones.');
    return parts.join(' · ');
  }

  protected productRows(p: MobilePromoView): ProductRow[] {
    const products = this.productsById();
    const byFamily = new Map<string, ProductRow[]>();
    for (const id of p.productIds) {
      const prod = products.get(id);
      if (!prod) continue;
      const rows = byFamily.get(prod.familyName) ?? [];
      rows.push({
        familyName: prod.familyName,
        brandName: prod.brandName,
        code: prod.code,
        name: prod.name,
        firstOfFamily: rows.length === 0,
      });
      byFamily.set(prod.familyName, rows);
    }
    return Array.from(byFamily.values()).flat();
  }

  protected hasMultipleBrands(p: MobilePromoView): boolean {
    const products = this.productsById();
    const brands = new Set(
      p.productIds.map((id) => products.get(id)?.brandName).filter((b): b is string => !!b),
    );
    return brands.size > 1;
  }

  protected isExpanded(p: MobilePromoView): boolean {
    return this.expanded().has(p.promoId);
  }

  protected toggleExpand(p: MobilePromoView) {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(p.promoId)) next.delete(p.promoId);
      else next.add(p.promoId);
      return next;
    });
  }

  protected visibleProductRows(p: MobilePromoView): ProductRow[] {
    const rows = this.productRows(p);
    return this.isExpanded(p) ? rows : rows.slice(0, 6);
  }
}
