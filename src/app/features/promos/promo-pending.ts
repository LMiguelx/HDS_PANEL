import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiCard } from '../../shared/ui/card/card';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { PromoModuleTabs } from './ui/module-tabs';
import { PromoService } from './promo';
import { PendingCountStore } from './pending-count';
import { ChoiceOptionView, PendingChoiceView } from './promo.types';
import { dateText, waitingText } from './promo-format';

@Component({
  selector: 'app-promo-pending',
  imports: [UiButton, UiField, UiCard, UiEmpty, PromoModuleTabs],
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
          body="Cuando un vendedor registre un pedido que gane un premio a elección, la tarjeta aparece acá. Mientras tanto puedes revisar las campañas vigentes."
          actionLabel="Ver promociones vigentes"
          (action)="goToPromos()"
        />
      } @else {
        <div class="pending-grid">
          @for (item of filtered(); track item.promoApplicationId) {
            <ui-card variant="work" [saving]="resolvingId() === item.promoApplicationId">
              <div class="pending-card-head">
                <div>
                  <div class="pending-card-customer">{{ item.customerName }}</div>
                  <div class="pending-card-meta">
                    Pedido {{ item.orderId }} · {{ item.salespersonName }} · {{ dateText(item.orderDate) }}
                  </div>
                </div>
                <span class="pending-card-wait">{{ waitingText(item.createdAt!) }}</span>
              </div>
              <div class="pending-card-instruction">
                Elige el premio que se entrega ({{ item.groupLabel || ('Tramo ' + item.tier) }}). Un clic resuelve.
              </div>
              <div class="pending-card-options">
                @for (opt of item.options; track opt.optionId) {
                  <button
                    type="button"
                    uiButton
                    variant="secondary"
                    class="pending-option"
                    [disabled]="!optionAvailable(opt) || resolvingId() === item.promoApplicationId"
                    (click)="resolve(item, opt)"
                  >
                    <span class="pending-option-name">{{ opt.displayText || opt.label }}</span>
                    <span class="pending-option-stock">{{ stockText(opt) }}</span>
                  </button>
                }
              </div>
            </ui-card>
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
        grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
        gap: 18px;
        margin-top: 20px;
      }
      .pending-card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }
      .pending-card-customer {
        font-weight: 800;
        font-size: 18px;
        color: var(--ink);
      }
      .pending-card-meta {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .pending-card-wait {
        font-size: 12px;
        font-weight: 800;
        color: var(--st-pendiente);
        white-space: nowrap;
      }
      .pending-card-instruction {
        font-size: 13px;
        color: var(--ink-muted);
        margin: 12px 0 8px;
      }
      .pending-card-options {
        display: grid;
        gap: 8px;
      }
      .pending-option {
        min-height: 56px;
        height: auto;
        width: 100%;
        justify-content: flex-start;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        padding: 10px 14px;
      }
      .pending-option-name {
        font-weight: 800;
        font-size: 15px;
      }
      .pending-option-stock {
        font-size: 12px;
        color: var(--ink-muted);
      }
    `,
  ],
})
export class PromoPendingPage {
  private promoSvc = inject(PromoService);
  private pendingStore = inject(PendingCountStore);
  private router = inject(Router);

  protected dateText = dateText;
  protected waitingText = waitingText;

  protected items = signal<PendingChoiceView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected resolvingId = signal<number | null>(null);
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
    return n === 1 ? 'Falta 1 premio por resolver.' : `Faltan ${n} premios por resolver.`;
  }

  protected optionAvailable(opt: ChoiceOptionView): boolean {
    return opt.availableStock === undefined || opt.availableStock === null || opt.availableStock > 0;
  }

  protected stockText(opt: ChoiceOptionView): string {
    if (opt.availableStock === undefined || opt.availableStock === null) return '';
    return opt.availableStock > 0 ? `Disponible: ${opt.availableStock}` : 'Sin stock — no elegible';
  }

  protected resolve(item: PendingChoiceView, opt: ChoiceOptionView) {
    if (!this.optionAvailable(opt) || !opt.optionId) return;
    this.resolvingId.set(item.promoApplicationId!);
    this.promoSvc.resolveChoice(item.promoApplicationId!, { chosenOptionIds: [opt.optionId] }).subscribe({
      next: () => {
        this.items.update((list) => list.filter((x) => x.promoApplicationId !== item.promoApplicationId));
        this.resolvingId.set(null);
        this.pendingStore.refresh();
      },
      error: () => this.resolvingId.set(null),
    });
  }

  protected goToPromos() {
    this.router.navigate(['/promociones']);
  }
}
