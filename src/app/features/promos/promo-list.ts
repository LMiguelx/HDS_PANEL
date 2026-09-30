import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiMenu } from '../../shared/ui/menu/menu';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { PromoModuleTabs } from './ui/module-tabs';
import { PromoService } from './promo';
import { PromoSummary } from './promo.types';
import { LookupService } from './lookup';
import { vigenciaText } from './promo-format';

@Component({
  selector: 'app-promo-list',
  imports: [
    RouterLink,
    UiButton,
    UiField,
    UiTable,
    UiStatus,
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
          <p class="promo-page-sub">{{ countText() }}</p>
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

      <div class="promo-filters">
        <ui-field
          label="Buscar por nombre"
          placeholder="Escribe el nombre de la campaña"
          [(value)]="nameQuery"
        />
        <ui-field label="Estado" type="select" [(value)]="status" [options]="statusOptions" />
        <ui-field label="Marca" type="select" [(value)]="brandId" [options]="brandOptions()" />
        <ui-field label="Canal" type="select" [(value)]="channelId" [options]="channelOptions()" />
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
              <th>Nombre</th>
              <th>Tipo</th>
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
                </td>
                <td>{{ p.promoTypeName || p.promoType }}</td>
                <td>{{ p.scopeSummary }}</td>
                <td class="promo-cell-strong">
                  {{ p.benefitSummary }}
                  @if (p.repeats) {
                    <span class="promo-badge-repeats">Se repite</span>
                  }
                </td>
                <td class="promo-cell-muted">{{ vigencia(p) }}</td>
                <td>{{ p.salesChannelName }}</td>
                <td><ui-status [label]="p.statusLabel || ''" /></td>
                <td class="promo-row-menu-cell">
                  <ui-menu label="Ver, editar, activar, duplicar">
                    <button type="button" (click)="goToDetail(p)">Ver</button>
                    <button type="button" (click)="duplicate(p)">Duplicar</button>
                    @if (!p.active) {
                      <button type="button" (click)="edit(p)">Editar</button>
                    }
                    @if (p.active) {
                      <button type="button" (click)="deactivate(p)">Desactivar</button>
                    } @else {
                      <button type="button" (click)="activate(p)">Activar</button>
                    }
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
                <span class="promo-card-mobile-name">{{ p.name }}</span>
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
      .promo-filters {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) 180px 180px 180px;
        gap: 12px;
        margin: 24px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .promo-name-link {
        font-weight: 800;
        text-decoration: none;
        color: var(--ink);
      }
      .promo-name-link:hover {
        color: var(--accent);
      }
      .promo-cell-strong {
        font-weight: 800;
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
      .promo-row-menu-cell {
        text-align: right;
        width: 44px;
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
  private router = inject(Router);

  protected columns = [
    'Nombre',
    'Tipo',
    'Qué debe comprar',
    'Qué gana',
    'Vigencia',
    'Canal',
    'Estado',
    '',
  ];

  protected nameQuery = signal('');
  protected status = signal('');
  protected brandId = signal('');
  protected channelId = signal('');

  protected statusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'Vigente', label: 'Vigente' },
    { value: 'Programada', label: 'Programada' },
    { value: 'Vencida', label: 'Vencida' },
    { value: 'Apagada', label: 'Apagada' },
  ];
  protected brandOptions = signal<{ value: string; label: string }[]>([
    { value: '', label: 'Todas las marcas' },
  ]);
  protected channelOptions = signal<{ value: string; label: string }[]>([
    { value: '', label: 'Todos los canales' },
  ]);

  protected promos = signal<PromoSummary[]>([]);
  protected totalElements = signal(0);
  protected loading = signal(true);
  protected error = signal(false);

  protected vigencia = (p: PromoSummary) => vigenciaText(p.startDate, p.endDate);

  private reload$ = new Subject<void>();
  private filtersEffect = effect(() => {
    // Se leen las cuatro señales para que el effect reaccione a cualquiera.
    this.nameQuery();
    this.status();
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

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 campaña' : `${n} campañas`;
  }

  protected hasActiveFilters(): boolean {
    return !!(this.nameQuery() || this.status() || this.brandId() || this.channelId());
  }

  protected clearFilters() {
    // No llama a load(): al cambiar las señales, el effect de filtros ya
    // dispara la recarga (llamarlo aquí además pediría dos veces lo mismo).
    this.nameQuery.set('');
    this.status.set('');
    this.brandId.set('');
    this.channelId.set('');
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.promoSvc
      .list({
        name: this.nameQuery() || undefined,
        status: this.status() || undefined,
        brandId: this.brandId() ? Number(this.brandId()) : undefined,
        channelId: this.channelId() ? Number(this.channelId()) : undefined,
        size: 100,
      })
      .subscribe({
        next: (page) => {
          this.promos.set(page.content ?? []);
          this.totalElements.set(page.totalElements ?? page.content?.length ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  private loadLookups() {
    this.lookupSvc.brands().subscribe((items) => {
      this.brandOptions.set([
        { value: '', label: 'Todas las marcas' },
        ...items.map((i) => ({ value: String(i.id), label: i.name ?? '' })),
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
    this.router.navigate(['/promociones', p.promoId, 'editar']);
  }

  protected activate(p: PromoSummary) {
    this.promoSvc.approve(p.promoId!).subscribe(() => this.load());
  }

  protected deactivate(p: PromoSummary) {
    this.promoSvc.deactivate(p.promoId!).subscribe(() => this.load());
  }
}
