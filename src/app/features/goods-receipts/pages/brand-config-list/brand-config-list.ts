import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiField } from '../../../../shared/ui/field/field';
import { UiCheckbox } from '../../../../shared/ui/checkbox/checkbox';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { GoodsReceiptsApi } from '../../data-access/goods-receipts.api';
import { BrandReceiptConfigRow } from '../../domain/goods-receipt.models';
import { unitTypeLabel } from '../../domain/goods-receipt.format';
import { dateTimeText } from '../../../assignments/assignment-format';

/**
 * Configuración por marca — doc 58, sección 8.1. `goods_receipt.config` o
 * `.view`. Las tarjetas y los filtros son locales: la lista completa ya
 * llega en una sola llamada (sin paginar, sin parámetros).
 */
@Component({
  selector: 'app-brand-config-list',
  imports: [UiButton, UiField, UiCheckbox, UiEmpty],
  template: `
    <section class="bcl-page">
      <div class="bcl-head">
        <h1>Recepción de mercadería · Configuración por marca</h1>
        <p class="bcl-sub">
          Cada marca necesita su perfil para que almacén pueda leer sus documentos por foto.
        </p>
      </div>

      @if (loading()) {
        <div class="bcl-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las marcas"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else {
        <div class="bcl-cards">
          <button
            type="button"
            class="bcl-card"
            [class.bcl-card-active]="onlyUnconfigured() === false && cardFilter() === 'configured'"
            (click)="toggleCard('configured')"
          >
            <span class="bcl-card-label">Configuradas</span>
            <span class="bcl-card-value">{{ configuredCount() }}</span>
          </button>
          <button
            type="button"
            class="bcl-card bcl-card-gray"
            [class.bcl-card-active]="cardFilter() === 'unconfigured'"
            (click)="toggleCard('unconfigured')"
          >
            <span class="bcl-card-label">Sin configurar</span>
            <span class="bcl-card-value">{{ unconfiguredCount() }}</span>
          </button>
        </div>

        <div class="bcl-filters">
          <ui-field
            label="Buscar marca"
            icon="search"
            placeholder="Nombre o código"
            [(value)]="searchQuery"
          />
          <ui-checkbox label="Solo sin configurar" [(checked)]="onlyUnconfigured" />
        </div>

        @if (filteredRows().length === 0) {
          <ui-empty title="No hay marcas con estos filtros." />
        } @else {
          <table class="ui-table-grid bcl-table">
            <thead>
              <tr>
                <th>Marca</th>
                <th>RUC</th>
                <th>Viene en</th>
                <th>Precios</th>
                <th>Códigos</th>
                <th>Productos</th>
                <th>Equivalencias</th>
                <th>Actualizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (r of filteredRows(); track r.brandId) {
                <tr class="bcl-row" (click)="openBrand(r)">
                  <td>
                    <strong>{{ r.brandName }}</strong>
                    <span class="bcl-muted"> {{ r.brandCode }}</span>
                  </td>
                  @if (r.configured) {
                    <td class="bcl-muted">{{ r.ruc }}</td>
                    <td>{{ unitTypeLabel(r.unitType) }}</td>
                    <td>{{ r.pricesIncludeTax ? 'Con IGV' : 'Sin IGV' }}</td>
                    <td>{{ r.usesProductCodes ? 'Sí' : 'No' }}</td>
                    <td class="bcl-num">{{ r.activeProducts }}</td>
                    <td class="bcl-num">{{ r.activeEquivalences }}</td>
                    <td class="bcl-muted">{{ r.updatedByName }} · {{ shortDate(r.updatedAt) }}</td>
                    <td class="bcl-chevron">›</td>
                  } @else {
                    <td colspan="2"><span class="bcl-unconfigured">■ Sin configurar</span></td>
                    <td></td>
                    <td></td>
                    <td class="bcl-num">{{ r.activeProducts }}</td>
                    <td class="bcl-num bcl-muted">—</td>
                    <td class="bcl-muted">—</td>
                    <td>
                      <button uiButton variant="secondary" size="sm" (click)="openBrand(r, $event)">
                        Configurar
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        }
      }
    </section>
  `,
  styles: [
    `
      .bcl-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .bcl-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 13px;
        max-width: 620px;
      }
      .bcl-skeleton {
        height: 240px;
        background: var(--faint);
        margin-top: 20px;
      }
      .bcl-cards {
        display: flex;
        gap: 12px;
        margin: 20px 0;
      }
      .bcl-card {
        appearance: none;
        cursor: pointer;
        font-family: var(--font-sans);
        text-align: left;
        border: 1px solid var(--hairline);
        background: var(--bg);
        padding: 14px 22px;
        display: grid;
        gap: 4px;
        min-width: 140px;
      }
      .bcl-card:hover {
        border-color: var(--accent);
      }
      .bcl-card-active {
        border-color: var(--accent);
        box-shadow: inset 0 0 0 1px var(--accent);
      }
      .bcl-card-label {
        font-size: 12px;
        font-weight: 700;
        color: var(--ink-muted);
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
      }
      .bcl-card-value {
        font-size: 28px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .bcl-card-gray .bcl-card-value {
        color: var(--ink-muted);
      }
      .bcl-filters {
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
        padding-bottom: 16px;
        margin-bottom: 16px;
        border-bottom: var(--border-hair);
      }
      .bcl-filters ui-field {
        flex: 1;
        max-width: 320px;
      }
      .bcl-table {
        width: 100%;
      }
      .bcl-row {
        cursor: pointer;
      }
      .bcl-row:hover {
        background: var(--faint);
      }
      .bcl-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .bcl-num {
        font-variant-numeric: var(--tnum);
        text-align: right;
      }
      .bcl-unconfigured {
        font-size: 11px;
        font-weight: 800;
        color: var(--st-closed);
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
      }
      .bcl-chevron {
        color: var(--ink-muted);
        text-align: right;
        font-size: 18px;
      }

      @media (max-width: 767px) {
        .bcl-page {
          padding: var(--sp-4);
        }
        .bcl-table {
          display: block;
          overflow-x: auto;
        }
      }
    `,
  ],
})
export class BrandConfigListPage {
  private api = inject(GoodsReceiptsApi);
  private router = inject(Router);

  protected unitTypeLabel = unitTypeLabel;

  protected loading = signal(true);
  protected error = signal(false);
  protected rows = signal<BrandReceiptConfigRow[]>([]);

  protected searchQuery = signal('');
  protected onlyUnconfigured = signal(false);
  protected cardFilter = signal<'configured' | 'unconfigured' | null>(null);

  protected configuredCount = computed(() => this.rows().filter((r) => r.configured).length);
  protected unconfiguredCount = computed(() => this.rows().filter((r) => !r.configured).length);

  protected filteredRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const onlyUnconf = this.onlyUnconfigured() || this.cardFilter() === 'unconfigured';
    return this.rows().filter((r) => {
      if (onlyUnconf && r.configured) return false;
      if (this.cardFilter() === 'configured' && !r.configured) return false;
      if (!q) return true;
      return r.brandName.toLowerCase().includes(q) || r.brandCode.toLowerCase().includes(q);
    });
  });

  constructor() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set(false);
    this.api.configBrands().subscribe({
      next: (list) => {
        this.rows.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected toggleCard(which: 'configured' | 'unconfigured') {
    this.cardFilter.set(this.cardFilter() === which ? null : which);
  }

  protected shortDate(iso: string | null): string {
    return iso ? dateTimeText(iso).replace(/^(\d{2}\/\d{2})\/\d{4}/, '$1') : '—';
  }

  protected openBrand(r: BrandReceiptConfigRow, event?: Event) {
    event?.stopPropagation();
    this.router.navigate(['/recepcion-mercaderia/configuracion', r.brandId]);
  }
}
