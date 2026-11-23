import { Component, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { PendingBonusAdminService } from '../pending-bonus-admin';
import { SubstituteCandidateView } from '../../../shared/models/order.models';

export interface SubstituteBonusDialogData {
  promoName: string;
  originalProductName: string;
  /** "Pedido N.º 279107" | "2 pedidos seleccionados · Se deben 3 unidades" */
  contextText: string;
  /** "La misma que se debía (2)" | "La misma que se debía en cada pedido" */
  sameQuantityLabel: string;
  /** `minStock` por defecto y valor inicial de "Otra cantidad" — doc 51, sección 6.3. */
  defaultQuantity: number;
  branchId: number | null;
  excludeOrderId?: number;
}

export interface SubstituteBonusDialogResult {
  product: SubstituteCandidateView;
  /** null = la misma cantidad que se debía (no se envía `substituteQuantity`). */
  quantity: number | null;
}

/**
 * Modal "Sustituir premio" — doc 51, sección 6.4. Reutilizado desde la
 * bandeja (uno o en lote), el detalle del pedido y la validación de
 * facturación: solo elige el sustituto y la cantidad; quien abre el modal
 * se encarga de la confirmación (secciones 7.3/8.3) y de llamar a resolver.
 */
@Component({
  selector: 'app-substitute-bonus-dialog',
  imports: [UiButton, UiField, UiEmpty],
  template: `
    <div class="sbd">
      <div class="sbd-head">
        <h2 class="sbd-title">Sustituir premio</h2>
        <button type="button" class="sbd-close" aria-label="Cerrar" (click)="ref.close()">✕</button>
      </div>
      <p class="sbd-subtitle">
        {{ data.promoName ? data.promoName + ' · ' : '' }}premio original:
        {{ data.originalProductName }}
      </p>
      <p class="sbd-context">{{ data.contextText }}</p>

      <ui-field
        label="Buscar producto bonificable con stock"
        icon="search"
        placeholder="Código o nombre del producto…"
        [(value)]="searchText"
      />

      @if (loading()) {
        <div class="sbd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No se pudieron cargar los productos."
          actionLabel="Reintentar"
          (action)="search$.next(searchText())"
        />
      } @else if (candidates().length === 0) {
        <ui-empty
          title="No hay productos bonificables con stock suficiente en esta sede."
          body="Prueba con otra cantidad o elige No otorgar."
        />
      } @else {
        <div class="sbd-list">
          @for (c of candidates(); track c.productId) {
            <label class="sbd-option">
              <input
                type="radio"
                name="sbd-product"
                [checked]="selected()?.productId === c.productId"
                (change)="selected.set(c)"
              />
              <span class="sbd-option-main">
                <span class="sbd-option-name">{{ c.name }}</span>
                <span class="sbd-option-meta"
                  >{{ c.code }} · {{ c.brandName }} · Stock {{ c.availableStock }}
                  {{ c.unitOfMeasure }}</span
                >
              </span>
            </label>
          }
        </div>
      }

      <div class="sbd-qty">
        <p class="sbd-qty-title">Cantidad a entregar</p>
        <label class="sbd-qty-option">
          <input
            type="radio"
            name="sbd-qty"
            [checked]="quantityMode() === 'same'"
            (change)="selectSameQuantity()"
          />
          {{ data.sameQuantityLabel }}
        </label>
        <label class="sbd-qty-option">
          <input
            type="radio"
            name="sbd-qty"
            [checked]="quantityMode() === 'other'"
            (change)="selectOtherQuantityMode()"
          />
          Otra cantidad:
          <input
            type="number"
            min="0.01"
            step="0.01"
            class="sbd-qty-input"
            [value]="otherQuantity()"
            [disabled]="quantityMode() !== 'other'"
            (input)="setOtherQuantity($event)"
          />
          <span class="sbd-qty-hint">(la misma para todos los pedidos)</span>
        </label>
      </div>

      <p class="sbd-help">
        El cliente recibirá este producto en lugar del premio original. Si el pedido se edita, la
        sustitución se mantiene.
      </p>

      <div class="sbd-actions">
        <button uiButton variant="secondary" (click)="ref.close()">Cancelar</button>
        <button uiButton variant="primary" [disabled]="!canSubmit()" (click)="submit()">
          Sustituir
        </button>
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .sbd {
        display: grid;
        gap: 14px;
        max-width: 100%;
      }
      .sbd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .sbd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .sbd-close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--ink-muted);
        font-size: 16px;
        padding: 2px;
      }
      .sbd-subtitle {
        margin: 0;
        font-size: 13px;
        color: var(--ink);
      }
      .sbd-context {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .sbd-skeleton {
        height: 140px;
        background: var(--faint);
      }
      .sbd-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
        max-height: 240px;
        overflow-y: auto;
      }
      .sbd-option {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--bg);
        padding: 10px 12px;
        cursor: pointer;
      }
      .sbd-option:hover {
        background: var(--faint);
      }
      .sbd-option input {
        accent-color: var(--accent);
        flex: none;
      }
      .sbd-option-main {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .sbd-option-name {
        font-weight: 700;
        color: var(--ink);
        font-size: 13px;
      }
      .sbd-option-meta {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .sbd-qty {
        border-top: 1px solid var(--hairline);
        padding-top: 12px;
        display: grid;
        gap: 8px;
      }
      .sbd-qty-title {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--ink);
      }
      .sbd-qty-option {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--ink);
      }
      .sbd-qty-option input[type='radio'] {
        accent-color: var(--accent);
        flex: none;
      }
      .sbd-qty-input {
        width: 90px;
        padding: 6px 8px;
        border: 1px solid var(--divider);
        background: var(--surface);
        color: var(--ink);
        font-family: var(--font-sans);
      }
      .sbd-qty-hint {
        color: var(--ink-muted);
        font-size: 12px;
      }
      .sbd-help {
        margin: 0;
        font-size: 12px;
        color: var(--ink-muted);
        border-left: 3px solid var(--accent);
        padding-left: 10px;
      }
      .sbd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class SubstituteBonusDialog {
  protected data = inject<SubstituteBonusDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<SubstituteBonusDialogResult>);
  private pendingBonusSvc = inject(PendingBonusAdminService);

  protected searchText = signal('');
  protected candidates = signal<SubstituteCandidateView[]>([]);
  protected selected = signal<SubstituteCandidateView | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  protected quantityMode = signal<'same' | 'other'>('same');
  protected otherQuantity = signal<number | null>(null);

  protected search$ = new Subject<string>();

  constructor() {
    this.otherQuantity.set(this.data.defaultQuantity);

    toObservable(this.searchText).subscribe((q) => this.search$.next(q));

    this.search$
      .pipe(
        debounceTime(300),
        switchMap((q) => {
          this.loading.set(true);
          this.error.set(false);
          const minStock =
            this.quantityMode() === 'other' && this.otherQuantity()
              ? this.otherQuantity()!
              : this.data.defaultQuantity;
          return this.pendingBonusSvc
            .substitutes({
              q: q.trim().length >= 2 ? q.trim() : undefined,
              branchId: this.data.branchId,
              minStock,
              excludeOrderId: this.data.excludeOrderId,
            })
            .pipe(catchError(() => of(undefined)));
        }),
      )
      .subscribe((list) => {
        this.loading.set(false);
        if (list === undefined) {
          this.error.set(true);
          this.candidates.set([]);
          return;
        }
        this.candidates.set(list);
        if (this.selected() && !list.some((c) => c.productId === this.selected()!.productId)) {
          this.selected.set(null);
        }
      });

    this.search$.next('');
  }

  protected selectSameQuantity() {
    this.quantityMode.set('same');
    this.search$.next(this.searchText());
  }

  protected selectOtherQuantityMode() {
    this.quantityMode.set('other');
    this.search$.next(this.searchText());
  }

  protected setOtherQuantity(ev: Event) {
    const raw = (ev.target as HTMLInputElement).value;
    const value = raw === '' ? null : Number(raw);
    this.otherQuantity.set(value != null && value > 0 ? value : null);
    this.search$.next(this.searchText());
  }

  protected canSubmit(): boolean {
    if (!this.selected()) return false;
    if (this.quantityMode() === 'other') {
      const q = this.otherQuantity();
      return q != null && q > 0;
    }
    return true;
  }

  protected submit() {
    const product = this.selected();
    if (!product || !this.canSubmit()) return;
    const quantity = this.quantityMode() === 'other' ? this.otherQuantity() : null;
    this.ref.close({ product, quantity });
  }
}
