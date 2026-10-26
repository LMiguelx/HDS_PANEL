import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { PromoModuleTabs } from './ui/module-tabs';
import { PromoChoiceCard } from './ui/promo-choice-card';
import { PromoService } from './promo';
import { PendingCountStore } from './pending-count';
import { PendingChoiceView } from './promo.types';

/**
 * Premios pendientes de elección — doc 47, sección 9.5. Cada tarjeta es
 * `app-promo-choice-card` (Otorgar con confirmación, No otorgar con
 * confirmación); esta página solo lista, filtra por vendedor y quita la
 * tarjeta cuando el componente avisa que se resolvió, se marcó como no
 * otorgado o quedó obsoleta (otra persona ya la resolvió).
 */
@Component({
  selector: 'app-promo-pending',
  imports: [UiField, UiEmpty, PromoModuleTabs, PromoChoiceCard],
  template: `
    <app-promo-module-tabs />
    <section class="pending-page">
      <div class="pending-head">
        <div>
          <h1>Premios pendientes de elección</h1>
          <p class="pending-sub">{{ headerText() }}</p>
        </div>
        <ui-field
          label="Vendedor"
          type="select"
          [(value)]="salespersonFilter"
          [options]="salespersonOptions()"
          class="pending-filter"
        />
      </div>
      <hr class="pending-rule" />

      @if (loading()) {
        <div class="pending-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar los premios pendientes"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (filtered().length === 0) {
        <ui-empty
          variant="al-dia"
          eyebrow="Al día"
          title="No hay premios por resolver"
          body="Cuando un vendedor deje un premio sin elegir, aparecerá aquí."
          actionLabel="Ver promociones vigentes"
          (action)="goToPromos()"
        />
      } @else {
        <div class="pending-grid">
          @for (item of filtered(); track item.promoApplicationId) {
            <app-promo-choice-card
              [item]="item"
              (resolved)="onResolved($event)"
              (declined)="onResolved($event)"
              (stale)="onResolved($event)"
            />
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .pending-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .pending-head {
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
      .pending-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .pending-filter {
        width: 220px;
      }
      .pending-rule {
        border: 0;
        border-top: var(--border-hair);
        margin: 16px 0 0;
      }
      .pending-skeleton {
        height: 200px;
        background: var(--faint);
        margin-top: 20px;
      }
      .pending-grid {
        display: grid;
        /* min() evita que las tarjetas fuercen 420px y provoquen scroll
           horizontal a 360px (regla 4 del traspaso). */
        grid-template-columns: repeat(auto-fill, minmax(min(460px, 100%), 1fr));
        gap: 18px;
        margin-top: 20px;
      }

      @media (max-width: 767px) {
        .pending-page {
          padding: var(--sp-4);
        }
        .pending-filter {
          width: 100%;
        }
      }
    `,
  ],
})
export class PromoPendingPage {
  private promoSvc = inject(PromoService);
  private pendingStore = inject(PendingCountStore);
  private router = inject(Router);

  protected items = signal<PendingChoiceView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected salespersonFilter = signal('');

  protected salespersonOptions = computed<UiFieldOption[]>(() => {
    const map = new Map<number, string>();
    for (const i of this.items()) {
      if (i.salespersonId != null) map.set(i.salespersonId, i.salespersonName ?? '');
    }
    return [
      { value: '', label: 'Todos los vendedores' },
      ...Array.from(map, ([id, name]) => ({ value: String(id), label: name })),
    ];
  });

  protected filtered = computed(() => {
    const filter = this.salespersonFilter();
    if (!filter) return this.items();
    return this.items().filter((i) => String(i.salespersonId) === filter);
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.promoSvc.pendingChoices().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected headerText(): string {
    const n = this.items().length;
    if (n === 0) return 'Todo resuelto.';
    return n === 1 ? '1 premio espera una decisión.' : `${n} premios esperan una decisión.`;
  }

  protected onResolved(item: PendingChoiceView) {
    this.items.update((list) =>
      list.filter((x) => x.promoApplicationId !== item.promoApplicationId),
    );
    this.pendingStore.refresh();
  }

  protected goToPromos() {
    this.router.navigate(['/promociones']);
  }
}
