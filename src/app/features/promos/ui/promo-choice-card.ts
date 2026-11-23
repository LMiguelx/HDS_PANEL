import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../../shared/ui/button/button';
import { UiBadge } from '../../../shared/ui/badge/badge';
import { UiCard } from '../../../shared/ui/card/card';
import { HasPermissionDirective } from '../../../shared/directives/has-permission';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { PromoService } from '../promo';
import { ChoiceOptionView, PendingChoiceView } from '../promo.types';
import { dateText, waitingText } from '../promo-format';
import { benefitText } from '../domain/promo-texts';
import { quantityText } from '../../sales-reports/sales-report-format';

let nextRadioGroup = 0;

/**
 * Tarjeta de un premio pendiente de elección — doc 47, sección 9.5. Se
 * reutiliza en Premios pendientes y en el alcance de la promoción (acción
 * "Resolver" sobre una fila `PENDING`). Autosuficiente: ella misma llama a
 * resolve/decline y muestra el toast; el padre solo escucha `resolved` /
 * `declined` / `stale` para quitar la tarjeta y refrescar el indicador.
 */
@Component({
  selector: 'app-promo-choice-card',
  imports: [RouterLink, UiButton, UiBadge, UiCard, HasPermissionDirective],
  template: `
    <ui-card variant="work" [saving]="busy()">
      <div class="pcc-head">
        <div>
          <div class="pcc-title">
            {{ item().promoName }}
            <span class="pcc-tier">· Tramo {{ item().tier }}</span>
          </div>
          <div class="pcc-customer">{{ item().customerName }} · {{ item().customerCode }}</div>
          <div class="pcc-meta">
            Vendedor {{ item().salespersonName }} · Pedido del {{ dateText(item().orderDate) }}
            <a [routerLink]="['/pedidos/detalle', item().orderId]">Ver pedido</a>
          </div>
        </div>
        <span class="pcc-wait">Pendiente desde {{ waitingText(item().createdAt!) }}</span>
      </div>

      <div class="pcc-options-head">
        <span class="pcc-options-eyebrow"
          >{{ item().groupLabel || 'Premio a elegir' }} · el cliente elige
          {{ item().chooseCount }} de {{ item().options?.length ?? 0 }}</span
        >
        @if (multi()) {
          <span class="pcc-selected-count"
            >Elegidas {{ selected().size }} de {{ item().chooseCount }}</span
          >
        }
      </div>

      <div class="pcc-options">
        @for (opt of item().options; track opt.optionId) {
          <label class="pcc-option" [class.selected]="isSelected(opt)">
            <input
              [type]="multi() ? 'checkbox' : 'radio'"
              [name]="radioName"
              [checked]="isSelected(opt)"
              [disabled]="busy()"
              (change)="toggle(opt)"
            />
            <span class="pcc-option-text">{{ opt.displayText || optionText(opt) }}</span>
            @if (lowStock(opt)) {
              <ui-badge tone="warning">Sin stock: quedará pendiente de stock</ui-badge>
            } @else if (opt.availableStock != null) {
              <span class="pcc-option-stock"
                >Stock ref. {{ quantityText(opt.availableStock) }}</span
              >
            }
          </label>
        }
      </div>

      @if (error()) {
        <div class="pcc-error">{{ error() }}</div>
      }

      <div class="pcc-actions" *hasPermission="'promo.resolve_choice'">
        <button uiButton variant="secondary" [disabled]="busy()" (click)="decline()">
          No otorgar
        </button>
        <button
          uiButton
          variant="primary"
          [disabled]="!canResolve() || busy()"
          [loading]="busy()"
          (click)="resolve()"
        >
          Otorgar premio
        </button>
      </div>
    </ui-card>
  `,
  styles: [
    `
      .pcc-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-4);
      }
      .pcc-title {
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        color: var(--ink);
      }
      .pcc-tier {
        font-weight: 600;
        color: var(--ink-muted);
      }
      .pcc-customer {
        margin-top: 2px;
        font-weight: 700;
        color: var(--ink);
      }
      .pcc-meta {
        margin-top: 2px;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .pcc-meta a {
        margin-left: 6px;
        color: var(--accent-ink);
        font-weight: 700;
        text-decoration: none;
      }
      .pcc-meta a:hover {
        text-decoration: underline;
      }
      .pcc-wait {
        flex: none;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
        white-space: nowrap;
      }
      .pcc-options-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--sp-3);
        margin-top: var(--sp-4);
        flex-wrap: wrap;
      }
      .pcc-options-eyebrow {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .pcc-selected-count {
        font-size: var(--fs-meta);
        font-weight: 700;
        color: var(--accent-ink);
      }
      .pcc-options {
        display: grid;
        gap: var(--sp-2);
        margin-top: var(--sp-3);
      }
      .pcc-option {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-4);
        border: 2px solid var(--divider);
        border-radius: var(--radius-card);
        cursor: pointer;
      }
      .pcc-option.selected {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }
      .pcc-option input {
        flex: none;
        width: 18px;
        height: 18px;
        accent-color: var(--accent);
        cursor: pointer;
      }
      .pcc-option-text {
        flex: 1;
        font-weight: 700;
        color: var(--ink);
      }
      .pcc-option-stock {
        flex: none;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .pcc-error {
        margin-top: var(--sp-3);
        font-size: var(--fs-dense);
        color: var(--status-danger);
      }
      .pcc-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--sp-3);
        margin-top: var(--sp-4);
      }
    `,
  ],
})
export class PromoChoiceCard {
  private promoSvc = inject(PromoService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  item = input.required<PendingChoiceView>();

  /** Se resolvió (otorgó) el premio. */
  resolved = output<PendingChoiceView>();
  /** Se marcó como no otorgado. */
  declined = output<PendingChoiceView>();
  /** El premio ya no está pendiente en el servidor: el padre debe recargar su lista. */
  stale = output<PendingChoiceView>();

  protected dateText = dateText;
  protected waitingText = waitingText;
  protected quantityText = quantityText;
  protected radioName = `pcc-${nextRadioGroup++}`;

  protected selected = signal<Set<number>>(new Set());
  protected busy = signal(false);
  protected error = signal('');

  protected multi = computed(() => (this.item().chooseCount ?? 1) > 1);

  protected canResolve(): boolean {
    return this.selected().size === (this.item().chooseCount ?? 1);
  }

  protected isSelected(opt: ChoiceOptionView): boolean {
    return opt.optionId != null && this.selected().has(opt.optionId);
  }

  protected lowStock(opt: ChoiceOptionView): boolean {
    return opt.availableStock != null && opt.availableStock <= 0;
  }

  protected optionText(opt: ChoiceOptionView): string {
    return benefitText(opt);
  }

  protected toggle(opt: ChoiceOptionView) {
    if (opt.optionId == null) return;
    const id = opt.optionId;
    if (!this.multi()) {
      this.selected.set(new Set([id]));
      return;
    }
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected resolve() {
    const item = this.item();
    if (!this.canResolve()) return;
    const chosenOptionIds = Array.from(this.selected());
    const opciones = (item.options ?? [])
      .filter((o) => o.optionId != null && chosenOptionIds.includes(o.optionId))
      .map((o) => o.displayText || this.optionText(o))
      .join(' y ');
    this.dialog
      .confirm({
        title: 'Otorgar premio',
        message: `Se otorgará ${opciones} al pedido de ${item.customerName}. El pedido se recalcula. ¿Continuar?`,
        confirmLabel: 'Otorgar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.error.set('');
        this.busy.set(true);
        this.promoSvc.resolveChoice(item.promoApplicationId!, { chosenOptionIds }).subscribe({
          next: () => {
            this.busy.set(false);
            this.toast.success('Premio otorgado');
            this.resolved.emit(item);
          },
          error: (err) => this.handleError(err, item),
        });
      });
  }

  protected decline() {
    const item = this.item();
    this.dialog
      .confirm({
        title: 'No otorgar el premio',
        message: 'El cliente no recibirá este premio y no se volverá a pedir. ¿Continuar?',
        confirmLabel: 'No otorgar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.error.set('');
        this.busy.set(true);
        this.promoSvc.declineChoice(item.promoApplicationId!).subscribe({
          next: () => {
            this.busy.set(false);
            this.toast.success('Premio marcado como no otorgado');
            this.declined.emit(item);
          },
          error: (err) => this.handleError(err, item),
        });
      });
  }

  private handleError(
    err: { status?: number; error?: { detail?: string } },
    item: PendingChoiceView,
  ) {
    this.busy.set(false);
    const detail = err?.error?.detail ?? '';
    if (err?.status === 404) {
      this.error.set('Este premio ya no está pendiente.');
      this.stale.emit(item);
      return;
    }
    if (err?.status === 409) {
      if (/resuelto por otra persona/i.test(detail)) {
        this.error.set(detail);
        this.stale.emit(item);
        return;
      }
      const exact = detail.match(/exactamente (\d+)/i);
      if (exact) {
        this.error.set(`Elige ${exact[1]} opción(es).`);
        return;
      }
      if (/no pertenece a este premio/i.test(detail)) {
        this.error.set('Las opciones cambiaron. Vuelve a elegir.');
        this.stale.emit(item);
        return;
      }
      if (/no se puede modificar/i.test(detail)) {
        this.error.set(
          'El pedido ya no se puede modificar, así que el premio no se puede resolver.',
        );
        this.stale.emit(item);
        return;
      }
      this.error.set(detail || 'No se pudo completar la operación. Intenta de nuevo.');
      return;
    }
    this.error.set('No se pudo completar la operación. Intenta de nuevo.');
  }
}
