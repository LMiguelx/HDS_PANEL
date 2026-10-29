import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiBadge } from '../../shared/ui/badge/badge';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiMenu } from '../../shared/ui/menu/menu';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { PromoModuleTabs } from './ui/module-tabs';
import { PromoService } from './promo';
import { PromoSummary } from './promo.types';
import { LookupService } from './lookup';
import { CatalogLookupService } from '../catalog/catalog-lookup';
import { vigenciaHintText, vigenciaPercent, vigenciaText } from './promo-format';

type SortKey = 'vigencia' | 'name' | 'recent';

const SORT_OPTIONS = [
  { value: 'vigencia', label: 'Vigencia más próxima' },
  { value: 'name', label: 'Nombre A-Z' },
  { value: 'recent', label: 'Más reciente primero' },
];

/** Orden en que aparecen los chips cuando hay filas con ese estado. */
const STATUS_CHIP_ORDER = ['Vigente', 'Borrador', 'Programada', 'Vencida', 'Apagada'];

@Component({
  selector: 'app-promo-list',
  imports: [
    RouterLink,
    UiButton,
    UiField,
    UiTable,
    UiStatus,
    UiBadge,
    UiEmpty,
    UiMenu,
    HasPermissionDirective,
    PromoModuleTabs,
  ],
  template: `
    <app-promo-module-tabs />
    <section class="promo-page">
      <div class="promo-page-head">
        <div>
          <h1>Promociones</h1>
          <p class="promo-page-sub">{{ summaryText() }}</p>
        </div>
        <button
          uiButton
          variant="primary"
          *hasPermission="'promo.create'"
          routerLink="/promociones/nueva"
        >
          Nueva promoción
        </button>
      </div>

      @if (overdueDraftsCount() > 0) {
        <div class="promo-alert">
          <span class="material-icons" aria-hidden="true">warning</span>
          <span>
            Hay {{ overdueDraftsCount() }} borrador{{ overdueDraftsCount() === 1 ? '' : 'es' }} cuya
            fecha de inicio ya pasó. Publícalo{{ overdueDraftsCount() === 1 ? '' : 's' }}
            o ajusta su vigencia.
          </span>
          <button
            type="button"
            uiButton
            variant="secondary"
            size="sm"
            (click)="statusChip.set('Borrador')"
          >
            Revisar borradores
          </button>
        </div>
      }

      <div class="promo-filters">
        <ui-field
          label="Buscar por nombre"
          placeholder="Escribe el nombre de la campaña"
          [(value)]="nameQuery"
        />
        <ui-field label="Marca" type="select" [(value)]="brandId" [options]="brandOptions()" />
        <ui-field label="Canal" type="select" [(value)]="channelId" [options]="channelOptions()" />
        <ui-field label="Ordenar por" type="select" [(value)]="sortKey" [options]="sortOptions" />
      </div>

      <div class="promo-chips-row">
        <div class="promo-chips">
          <button
            type="button"
            class="promo-chip"
            [class.on]="statusChip() === ''"
            (click)="statusChip.set('')"
          >
            Todas {{ loadedPromos().length }}
          </button>
          @for (chip of statusChips(); track chip.value) {
            <button
              type="button"
              class="promo-chip"
              [class.on]="statusChip() === chip.value"
              (click)="statusChip.set(chip.value)"
            >
              {{ chip.label }} {{ chip.count }}
            </button>
          }
        </div>
        @if (hasActiveFilters()) {
          <button type="button" class="promo-clear-link" (click)="clearFilters()">
            Limpiar filtros
          </button>
        }
      </div>

      <ui-table
        [columns]="columns"
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar las promociones."
        [empty]="!loading() && !error() && promos().length === 0"
        (retry)="load()"
      >
        <div empty>
          @if (hasActiveFilters()) {
            <ui-empty
              title="Tus filtros no encontraron nada"
              body="Prueba con otro nombre o quita algún filtro."
              actionLabel="Limpiar filtros"
              (action)="clearFilters()"
            />
          } @else {
            <ui-empty
              title="Todavía no hay promociones"
              body="Crea la primera campaña para empezar a premiar a tus clientes."
              actionLabel="Nueva promoción"
              (action)="goToWizard()"
            />
          }
        </div>

        <table class="ui-table-grid promo-table-desktop">
          <thead>
            <tr>
              <th>Promoción</th>
              <th>Qué debe comprar</th>
              <th>Qué gana</th>
              <th>Vigencia</th>
              <th>Canal</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (p of promos(); track p.promoId) {
              <tr>
                <td>
                  <a [routerLink]="['/promociones', p.promoId]" class="promo-name-link">{{
                    p.name
                  }}</a>
                  @if (p.featured) {
                    <ui-badge tone="accent" class="promo-featured-badge"
                      ><span class="material-icons" aria-hidden="true">star</span>
                      Destacada</ui-badge
                    >
                  }
                  <div class="promo-type-sub">{{ p.promoTypeName || p.promoType }}</div>
                </td>
                <td class="promo-cell-muted">{{ p.scopeSummary }}</td>
                <td>
                  <span class="promo-reward-badge">{{ p.benefitSummary }}</span>
                  @if (p.repeats) {
                    <span class="promo-badge-repeats">Se repite</span>
                  }
                </td>
                <td class="promo-vigencia-cell">
                  <div>{{ vigencia(p) }}</div>
                  @if (vigenciaHint(p)) {
                    <div class="promo-vigencia-hint" [class.promo-vigencia-hint-alert]="!p.active">
                      {{ vigenciaHint(p) }}
                    </div>
                  }
                  @if (p.active && vigenciaPct(p) != null) {
                    <div class="promo-vigencia-track">
                      <div class="promo-vigencia-fill" [style.width.%]="vigenciaPct(p)"></div>
                    </div>
                  }
                </td>
                <td>
                  <span class="promo-channel-pill">{{ p.salesChannelName }}</span>
                </td>
                <td><ui-status [label]="p.statusLabel || ''" /></td>
                <td class="promo-row-actions">
                  @if (p.statusLabel === 'Borrador' || p.statusLabel === 'Apagada') {
                    <button
                      type="button"
                      uiButton
                      variant="secondary"
                      size="sm"
                      *hasPermission="'promo.approve'"
                      (click)="activate(p)"
                    >
                      Publicar
                    </button>
                  } @else {
                    <button
                      type="button"
                      uiButton
                      variant="ghost"
                      size="sm"
                      *hasPermission="'promo.create'"
                      (click)="edit(p)"
                    >
                      Editar
                    </button>
                  }
                  <ui-menu label="Ver, editar, activar, duplicar">
                    <button type="button" (click)="goToDetail(p)">Ver</button>
                    <button type="button" *hasPermission="'order.manage'" (click)="simulate(p)">
                      Simular
                    </button>
                    <button type="button" *hasPermission="'promo.create'" (click)="duplicate(p)">
                      Duplicar
                    </button>
                    <button type="button" *hasPermission="'promo.create'" (click)="edit(p)">
                      Editar
                    </button>
                    @if (p.active) {
                      <button
                        type="button"
                        *hasPermission="'promo.approve'"
                        (click)="deactivate(p)"
                      >
                        Desactivar
                      </button>
                    } @else {
                      <button type="button" *hasPermission="'promo.approve'" (click)="activate(p)">
                        Activar
                      </button>
                    }
                    <button type="button" *hasPermission="'promo.create'" (click)="remove(p)">
                      Borrar
                    </button>
                  </ui-menu>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="promo-table-mobile">
          @for (p of promos(); track p.promoId) {
            <a [routerLink]="['/promociones', p.promoId]" class="promo-card-mobile">
              <div class="promo-card-mobile-head">
                <span class="promo-card-mobile-name"
                  >{{ p.name }}
                  @if (p.featured) {
                    <ui-badge tone="accent" class="promo-featured-badge"
                      ><span class="material-icons" aria-hidden="true">star</span>
                      Destacada</ui-badge
                    >
                  }
                </span>
                <ui-status [label]="p.statusLabel || ''" />
              </div>
              <div class="promo-card-mobile-scope">{{ p.scopeSummary }}</div>
              <div class="promo-card-mobile-benefit">
                {{ p.benefitSummary }}
                @if (p.repeats) {
                  <span class="promo-badge-repeats">Se repite</span>
                }
              </div>
              <div class="promo-card-mobile-vigencia">{{ vigencia(p) }}</div>
            </a>
          }
        </div>
      </ui-table>

      <div class="promo-menu-hint">
        <strong>Menú de fila</strong> — ver y duplicar siempre; editar solo si la promoción está
        apagada; activar o desactivar según el estado. Nunca más de un botón visible por fila.
      </div>
    </section>
  `,
  styles: [
    `
      .promo-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .promo-page-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .promo-page-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .promo-alert {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 20px;
        padding: 12px 16px;
        border: 1px solid var(--accent);
        background: color-mix(in srgb, var(--accent) 8%, transparent);
        color: var(--ink);
        font-size: 13px;
      }
      .promo-alert .material-icons {
        flex: none;
        font-size: 20px;
        color: var(--accent-ink);
      }
      .promo-alert span:nth-child(2) {
        flex: 1;
      }
      .promo-filters {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) 180px 180px 200px;
        gap: 12px;
        margin: 24px 0 0;
      }
      .promo-chips-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin: 16px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .promo-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .promo-chip {
        appearance: none;
        cursor: pointer;
        border: 2px solid var(--divider);
        background: var(--surface);
        color: var(--ink-muted);
        font-weight: 700;
        font-size: 13px;
        padding: 7px 14px;
        border-radius: var(--radius-pill);
      }
      .promo-chip.on {
        border-color: var(--accent);
        background: var(--accent);
        color: var(--on-accent);
      }
      .promo-clear-link {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        color: var(--accent-ink);
        font-weight: 700;
        font-size: 13px;
        white-space: nowrap;
      }
      .promo-name-link {
        font-weight: 800;
        text-decoration: none;
        color: var(--ink);
      }
      .promo-name-link:hover {
        color: var(--accent);
      }
      .promo-type-sub {
        margin-top: 2px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .promo-featured-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        margin-left: 8px;
        vertical-align: middle;
      }
      .promo-featured-badge .material-icons {
        font-size: 13px;
      }
      .promo-reward-badge {
        display: inline-block;
        padding: 3px 10px;
        font-weight: 800;
        font-size: 13px;
        color: var(--accent-ink);
        background: color-mix(in srgb, var(--accent) 12%, transparent);
        border-radius: var(--radius-pill);
      }
      .promo-badge-repeats {
        display: inline-block;
        margin-left: 8px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border: 1px solid var(--accent);
        color: var(--accent-ink);
      }
      .promo-cell-muted {
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .promo-vigencia-cell {
        font-variant-numeric: var(--tnum);
        min-width: 150px;
      }
      .promo-vigencia-hint {
        margin-top: 2px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .promo-vigencia-hint-alert {
        color: var(--accent-ink);
        font-weight: 700;
      }
      .promo-vigencia-track {
        margin-top: 6px;
        width: 100px;
        height: 4px;
        background: var(--faint);
      }
      .promo-vigencia-fill {
        height: 100%;
        background: var(--success);
      }
      .promo-channel-pill {
        display: inline-block;
        padding: 3px 10px;
        font-size: 12px;
        font-weight: 700;
        color: var(--ink-muted);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-pill);
      }
      .promo-row-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        white-space: nowrap;
      }
      .promo-menu-hint {
        margin-top: 28px;
        padding: 16px 18px;
        border: 1px solid var(--hairline);
        background: var(--faint);
        font-size: 13px;
        color: var(--ink-muted);
      }
      .promo-table-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .promo-page {
          padding: var(--sp-4);
        }
        .promo-filters {
          grid-template-columns: 1fr;
        }
        .promo-table-desktop {
          display: none;
        }
        .promo-table-mobile {
          display: grid;
          gap: 10px;
        }
        .promo-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .promo-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .promo-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .promo-card-mobile-scope {
          font-size: 13px;
          margin-top: 6px;
        }
        .promo-card-mobile-benefit {
          font-size: 13px;
          font-weight: 800;
          color: var(--accent-ink);
        }
        .promo-card-mobile-vigencia {
          font-size: 12px;
          color: var(--ink-muted);
          margin-top: 4px;
        }
      }
    `,
  ],
})
export class PromoListPage implements OnInit, OnDestroy {
  private promoSvc = inject(PromoService);
  private lookupSvc = inject(LookupService);
  private catalogLookupSvc = inject(CatalogLookupService);
  private router = inject(Router);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected columns = [
    'Promoción',
    'Qué debe comprar',
    'Qué gana',
    'Vigencia',
    'Canal',
    'Estado',
    '',
  ];
  protected sortOptions = SORT_OPTIONS;

  protected nameQuery = signal('');
  protected brandId = signal('');
  protected channelId = signal('');
  protected statusChip = signal('');
  protected sortKey = signal<SortKey>('vigencia');

  protected brandOptions = signal<{ value: string; label: string }[]>([
    { value: '', label: 'Todas las marcas' },
  ]);
  protected channelOptions = signal<{ value: string; label: string }[]>([
    { value: '', label: 'Todos los canales' },
  ]);

  /**
   * Todo lo que trae el servidor con nombre/marca/canal — el estado se
   * filtra en el navegador (chips) para poder mostrar el conteo de las
   * cuatro categorías a la vez, igual que la pantalla de Planillas.
   */
  protected loadedPromos = signal<PromoSummary[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  protected vigencia = (p: PromoSummary) => vigenciaText(p.startDate, p.endDate);
  protected vigenciaHint = (p: PromoSummary) => vigenciaHintText(p);
  protected vigenciaPct = (p: PromoSummary) => vigenciaPercent(p.startDate, p.endDate);

  protected statusChips = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this.loadedPromos()) {
      const label = p.statusLabel || '—';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return STATUS_CHIP_ORDER.filter((s) => counts.has(s)).map((s) => ({
      value: s,
      label: s === 'Vigente' ? 'Vigentes' : s === 'Borrador' ? 'Borradores' : s + 's',
      count: counts.get(s)!,
    }));
  });

  protected promos = computed(() => {
    const chip = this.statusChip();
    let rows = chip
      ? this.loadedPromos().filter((p) => p.statusLabel === chip)
      : this.loadedPromos();
    rows = [...rows].sort(this.comparator(this.sortKey()));
    return rows;
  });

  protected overdueDraftsCount = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.loadedPromos().filter(
      (p) => p.statusLabel === 'Borrador' && p.startDate && p.startDate < today,
    ).length;
  });

  private reload$ = new Subject<void>();
  private filtersEffect = effect(() => {
    // Se leen para que el effect reaccione a cualquiera (el estado y el
    // orden se resuelven en el navegador: no disparan una nueva carga).
    this.nameQuery();
    this.brandId();
    this.channelId();
    this.reload$.next();
  });

  ngOnInit() {
    this.loadLookups();
    this.reload$.pipe(debounceTime(250)).subscribe(() => this.load());
  }

  ngOnDestroy() {
    this.reload$.complete();
  }

  protected summaryText(): string {
    const total = this.loadedPromos().length;
    const parts = [total === 1 ? '1 campaña' : `${total} campañas`];
    for (const chip of this.statusChips()) {
      parts.push(`${chip.count} ${chip.label.toLowerCase()}`);
    }
    return parts.join(' · ');
  }

  protected hasActiveFilters(): boolean {
    return !!(this.nameQuery() || this.brandId() || this.channelId() || this.statusChip());
  }

  protected clearFilters() {
    this.nameQuery.set('');
    this.brandId.set('');
    this.channelId.set('');
    this.statusChip.set('');
  }

  private comparator(key: SortKey): (a: PromoSummary, b: PromoSummary) => number {
    if (key === 'name') {
      return (a, b) => (a.name ?? '').localeCompare(b.name ?? '');
    }
    if (key === 'recent') {
      return (a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '');
    }
    // Vigencia más próxima: sin fecha de fin al final.
    return (a, b) => {
      if (!a.endDate && !b.endDate) return 0;
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      return a.endDate.localeCompare(b.endDate);
    };
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.promoSvc
      .list({
        name: this.nameQuery() || undefined,
        brandId: this.brandId() ? Number(this.brandId()) : undefined,
        channelId: this.channelId() ? Number(this.channelId()) : undefined,
        size: 200,
      })
      .subscribe({
        next: (page) => {
          this.loadedPromos.set(page.content ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  private loadLookups() {
    this.catalogLookupSvc.brands().subscribe((items) => {
      this.brandOptions.set([
        { value: '', label: 'Todas las marcas' },
        ...items.map((b) => ({ value: String(b.brandId), label: b.name })),
      ]);
    });
    this.lookupSvc.salesChannels().subscribe((items) => {
      this.channelOptions.set([
        { value: '', label: 'Todos los canales' },
        ...items.map((i) => ({ value: String(i.id), label: i.name ?? '' })),
      ]);
    });
  }

  protected goToDetail(p: PromoSummary) {
    this.router.navigate(['/promociones', p.promoId]);
  }

  protected goToWizard() {
    this.router.navigate(['/promociones/nueva']);
  }

  protected duplicate(p: PromoSummary) {
    this.router.navigate(['/promociones/nueva'], { queryParams: { duplicateFrom: p.promoId } });
  }

  protected edit(p: PromoSummary) {
    // Con definitionEditable = false el propio asistente redirige al
    // detalle (sección 7.1): no hace falta duplicar ese chequeo aquí.
    this.router.navigate(['/promociones', p.promoId, 'editar']);
  }

  protected simulate(p: PromoSummary) {
    this.router.navigate(['/promociones/simular'], { queryParams: { promoId: p.promoId } });
  }

  protected activate(p: PromoSummary) {
    this.promoSvc.approve(p.promoId!).subscribe(() => this.load());
  }

  protected remove(p: PromoSummary) {
    this.dialog
      .confirm({
        title: 'Borrar promoción',
        message: '¿Borrar esta promoción? Esta acción no se puede deshacer.',
        confirmLabel: 'Borrar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.promoSvc.remove(p.promoId!).subscribe({
          next: () => this.load(),
          error: (err) => {
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.toast.error(
              detalle || 'No pudimos borrar la promoción: ya se aplicó en algún pedido.',
            );
          },
        });
      });
  }

  protected deactivate(p: PromoSummary) {
    this.promoSvc.deactivate(p.promoId!).subscribe(() => this.load());
  }
}
