import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { PERMISSIONS } from '../../core/auth/permissions';
import { PendingBonusAdminService } from './pending-bonus-admin';
import { CompanyAdminService } from '../company/company-admin';
import { BranchView } from '../../shared/models/tenant.models';
import {
  BatchResolutionResult,
  PendingBonusGroupView,
  PendingBonusInboxView,
  PendingBonusOrderRow,
} from '../../shared/models/order.models';
import {
  SubstituteBonusDialog,
  SubstituteBonusDialogData,
  SubstituteBonusDialogResult,
} from './ui/substitute-bonus-dialog';
import { ResolveBatchResultDialog } from './ui/resolve-batch-result-dialog';
import { originName } from './order-format';
import { dateTimeText } from '../assignments/assignment-format';
import { quantityText } from '../sales-reports/sales-report-format';
import { OrderModuleTabs } from './ui/module-tabs';

function groupKey(promoId: number, productId: number): string {
  return `${promoId}-${productId}`;
}

/** "Sin stock" (0) · "Stock parcial" (>0 y <debido) · "Hay stock" (≥debido) — doc 51, sección 5.3. */
function stockBadge(group: PendingBonusGroupView): { colorVar: string; text: string } {
  const stock = group.availableStock ?? 0;
  if (stock <= 0) return { colorVar: '--status-danger', text: 'Sin stock' };
  if (stock < group.totalQuantity) return { colorVar: '--st-no-purchase', text: 'Stock parcial' };
  return { colorVar: '--success', text: 'Hay stock' };
}

/**
 * Ventas → Bonificaciones sin stock — doc 51, sección 5. Reemplaza a
 * "Bonificaciones pendientes" (doc 27, sección 7): bandeja agrupada por
 * promoción y producto, con selección por tarjeta y resolución de a una o
 * en lote. Las dotaciones del vendedor van aparte, solo para seguimiento.
 */
@Component({
  selector: 'app-pending-bonuses',
  imports: [RouterLink, UiButton, UiField, UiEmpty, HasPermissionDirective, OrderModuleTabs],
  template: `
    <app-order-module-tabs />
    <section class="pb-page">
      <div class="pb-head">
        <div>
          <h1>Bonificaciones sin stock</h1>
          <p class="pb-sub">{{ countText() }}</p>
          <p class="pb-help">
            Pedidos abiertos que ganaron un producto de regalo sin stock. Mientras estén aquí no se
            pueden facturar ni entregar. Puedes esperar a que entre stock, sustituir el premio por
            otro producto o no otorgarlo.
          </p>
        </div>
        <div class="pb-toolbar">
          <ui-field
            label="Sede"
            type="select"
            [(value)]="branchFilter"
            [options]="branchOptions()"
            (valueChange)="onBranchChange()"
          />
          <button uiButton variant="secondary" [loading]="loading()" (click)="load()">
            ↻ Actualizar
          </button>
        </div>
      </div>

      @if (loading() && !inbox()) {
        <div class="pb-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las bonificaciones sin stock"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (inbox(); as data) {
        @if (data.promoBonuses.length === 0 && data.allocationBonuses.length === 0) {
          <ui-empty
            variant="al-dia"
            eyebrow="Al día"
            [title]="
              branchFilter()
                ? 'No hay bonificaciones sin stock en esta sede.'
                : 'No hay bonificaciones sin stock.'
            "
            body="Los pedidos abiertos tienen todos sus premios reservados."
          />
        } @else {
          <div class="pb-groups">
            @for (group of data.promoBonuses; track groupKeyOf(group)) {
              <div class="pb-group-card">
                <div class="pb-group-head">
                  <div>
                    <div class="pb-group-promo">{{ group.promoName }} · {{ group.promoCode }}</div>
                    <div class="pb-group-product">
                      Premio: {{ group.productName }} · {{ group.productCode }} ·
                      {{ group.brandName }}
                    </div>
                  </div>
                  @if (group.availableStock != null) {
                    <span
                      class="pb-stock-badge"
                      [style.color]="'var(' + badgeColorVar(group) + ')'"
                    >
                      ■ {{ badgeText(group) }}
                    </span>
                  }
                </div>
                <div class="pb-group-meta">
                  {{ group.orderCount }} pedido{{ group.orderCount === 1 ? '' : 's' }} · Se
                  {{ group.orderCount === 1 ? 'debe' : 'deben' }}
                  {{ quantityText(group.totalQuantity) }} unidad{{
                    group.totalQuantity === 1 ? '' : 'es'
                  }}
                  @if (group.availableStock != null) {
                    · Stock hoy: {{ quantityText(group.availableStock) }}
                  } @else {
                    · Pedidos de varias sedes: ver el stock en cada pedido
                  }
                </div>
                @if (group.availableStock != null && group.availableStock >= group.totalQuantity) {
                  <p class="pb-group-hint">
                    Ya hay stock: edita el pedido o vuelve a guardarlo para que se reserve el premio
                    original.
                  </p>
                }

                <table class="ui-table-grid pb-table">
                  <thead>
                    <tr>
                      <th class="pb-check-cell">
                        <input
                          type="checkbox"
                          [checked]="allSelected(group)"
                          (change)="toggleSelectAll(group, $event)"
                        />
                      </th>
                      <th>N.º pedido</th>
                      <th>Fecha</th>
                      <th>Origen</th>
                      <th>Cliente</th>
                      <th>Vendedor</th>
                      <th>Debe</th>
                      @if (group.availableStock == null) {
                        <th>Stock</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (o of sortedOrders(group); track o.orderId) {
                      <tr>
                        <td class="pb-check-cell">
                          <input
                            type="checkbox"
                            [checked]="isSelected(group, o.orderId)"
                            (change)="toggleSelect(group, o.orderId)"
                          />
                        </td>
                        <td>
                          <a [routerLink]="['/pedidos/detalle', o.orderId]" class="pb-order-link">{{
                            o.orderId
                          }}</a>
                        </td>
                        <td class="pb-muted">{{ dateTimeText(o.orderDate) }}</td>
                        <td class="pb-muted">{{ originName(o.originCode) }}</td>
                        <td>
                          <span class="pb-muted">{{ o.customerCode }}</span> {{ o.customerName }}
                        </td>
                        <td>
                          <span class="pb-muted">{{ o.salespersonCode }}</span>
                          {{ o.salespersonName }}
                        </td>
                        <td class="pb-cell-strong">{{ quantityText(o.quantity) }}</td>
                        @if (group.availableStock == null) {
                          <td class="pb-muted">{{ quantityText(o.availableStock ?? 0) }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>

                <div class="pb-group-actions" *hasPermission="PERMISSIONS.ORDER_MANAGE">
                  <span class="pb-selected-count"
                    >{{ selectedCount(group) }} seleccionado{{
                      selectedCount(group) === 1 ? '' : 's'
                    }}</span
                  >
                  <button
                    uiButton
                    variant="secondary"
                    size="sm"
                    [disabled]="selectedCount(group) === 0 || busyGroup() === groupKeyOf(group)"
                    (click)="resolveGroup(group, 'decline')"
                  >
                    No otorgar
                  </button>
                  <button
                    uiButton
                    variant="primary"
                    size="sm"
                    [loading]="busyGroup() === groupKeyOf(group)"
                    [disabled]="selectedCount(group) === 0"
                    (click)="resolveGroup(group, 'substitute')"
                  >
                    Sustituir por otro producto…
                  </button>
                </div>
              </div>
            }
          </div>

          @if (data.allocationBonuses.length > 0) {
            <div class="pb-alloc-card">
              <div class="pb-alloc-head">Dotaciones del vendedor (solo seguimiento)</div>
              <p class="pb-alloc-hint">Se resuelven editando la dotación en el pedido.</p>
              <div class="pb-alloc-list">
                @for (a of data.allocationBonuses; track a.orderId + '-' + a.allocationId) {
                  <div class="pb-alloc-row">
                    <span class="pb-cell-strong">{{ a.orderId }}</span>
                    <span class="pb-muted">{{ dateTimeText(a.orderDate) }}</span>
                    <span
                      ><span class="pb-muted">{{ a.customerCode }}</span> {{ a.customerName }}</span
                    >
                    <span
                      ><span class="pb-muted">{{ a.salespersonCode }}</span>
                      {{ a.salespersonName }}</span
                    >
                    <span>{{ a.productName }}</span>
                    <span class="pb-cell-strong">{{ quantityText(a.quantity) }}</span>
                    <span class="pb-muted">Stock {{ quantityText(a.availableStock) }}</span>
                    <button
                      uiButton
                      variant="ghost"
                      size="sm"
                      [routerLink]="['/pedidos/detalle', a.orderId]"
                    >
                      Ver pedido
                    </button>
                  </div>
                }
              </div>
            </div>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      .pb-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .pb-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .pb-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .pb-help {
        margin: 6px 0 0;
        max-width: 560px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .pb-toolbar {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }
      .pb-toolbar ui-field {
        width: 200px;
      }
      .pb-skeleton {
        height: 200px;
        background: var(--faint);
        margin-top: 20px;
      }
      .pb-groups {
        display: grid;
        gap: 20px;
        margin-top: 20px;
      }
      .pb-group-card {
        border: 2px solid var(--divider);
        border-radius: var(--radius-card);
        padding: var(--sp-5);
        display: grid;
        gap: 10px;
      }
      .pb-group-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .pb-group-promo {
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        color: var(--ink);
      }
      .pb-group-product {
        font-size: 13px;
        color: var(--ink-muted);
        margin-top: 2px;
      }
      .pb-stock-badge {
        flex: none;
        font-size: 12px;
        font-weight: 800;
      }
      .pb-group-meta {
        font-size: 13px;
        color: var(--ink);
      }
      .pb-group-hint {
        margin: 0;
        font-size: 12px;
        color: var(--ink-muted);
        border-left: 3px solid var(--success);
        padding-left: 10px;
      }
      .pb-table {
        width: 100%;
      }
      .pb-check-cell {
        width: 32px;
        text-align: center;
      }
      .pb-order-link {
        color: var(--accent-ink);
        font-weight: 700;
        text-decoration: none;
      }
      .pb-order-link:hover {
        text-decoration: underline;
      }
      .pb-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .pb-cell-strong {
        font-weight: 800;
      }
      .pb-group-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        border-top: 1px solid var(--hairline);
        padding-top: 12px;
      }
      .pb-selected-count {
        font-size: 13px;
        color: var(--ink-muted);
        margin-right: auto;
      }
      .pb-alloc-card {
        margin-top: 24px;
        border: 1px solid var(--hairline);
        padding: var(--sp-5);
        display: grid;
        gap: 10px;
      }
      .pb-alloc-head {
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        color: var(--ink);
      }
      .pb-alloc-hint {
        margin: 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .pb-alloc-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .pb-alloc-row {
        display: flex;
        align-items: center;
        gap: 14px;
        background: var(--bg);
        padding: 10px 12px;
        font-size: 13px;
        flex-wrap: wrap;
      }

      @media (max-width: 767px) {
        .pb-page {
          padding: var(--sp-4);
        }
        .pb-table {
          display: none;
        }
      }
    `,
  ],
})
export class PendingBonusesPage {
  private pendingBonusSvc = inject(PendingBonusAdminService);
  private companySvc = inject(CompanyAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected PERMISSIONS = PERMISSIONS;
  protected dateTimeText = dateTimeText;
  protected originName = originName;
  protected quantityText = quantityText;
  protected groupKeyOf = (g: PendingBonusGroupView) => groupKey(g.promoId, g.productId);
  protected badgeColorVar = (g: PendingBonusGroupView) => stockBadge(g).colorVar;
  protected badgeText = (g: PendingBonusGroupView) => stockBadge(g).text;

  protected branches = signal<BranchView[]>([]);
  protected branchFilter = signal('');
  protected branchOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todas' },
    ...this.branches().map((b) => ({ value: String(b.branchId), label: `${b.code} ${b.name}` })),
  ]);

  protected inbox = signal<PendingBonusInboxView | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected busyGroup = signal<string | null>(null);

  private selections = signal<Map<string, Set<number>>>(new Map());

  constructor() {
    const lastBranchId = this.pendingBonusSvc.lastBranchId();
    if (lastBranchId) this.branchFilter.set(String(lastBranchId));
    this.companySvc.branches().subscribe((list) => this.branches.set(list));
    this.load();
  }

  protected countText(): string {
    const data = this.inbox();
    if (!data) return '';
    return `${data.orderCount} pedido${data.orderCount === 1 ? '' : 's'} · ${data.lineCount} bonificaci${data.lineCount === 1 ? 'ón' : 'ones'} sin stock`;
  }

  protected onBranchChange() {
    const id = this.branchFilter() ? Number(this.branchFilter()) : null;
    this.pendingBonusSvc.lastBranchId.set(id);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    const branchId = this.branchFilter() ? Number(this.branchFilter()) : undefined;
    this.pendingBonusSvc.inbox(branchId).subscribe({
      next: (data) => {
        this.inbox.set(data);
        this.loading.set(false);
        this.selections.set(new Map());
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected sortedOrders(group: PendingBonusGroupView): PendingBonusOrderRow[] {
    return [...group.orders].sort(
      (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
    );
  }

  protected isSelected(group: PendingBonusGroupView, orderId: number): boolean {
    return this.selections().get(this.groupKeyOf(group))?.has(orderId) ?? false;
  }

  protected selectedCount(group: PendingBonusGroupView): number {
    return this.selections().get(this.groupKeyOf(group))?.size ?? 0;
  }

  protected allSelected(group: PendingBonusGroupView): boolean {
    return group.orders.length > 0 && this.selectedCount(group) === group.orders.length;
  }

  protected toggleSelect(group: PendingBonusGroupView, orderId: number) {
    const key = this.groupKeyOf(group);
    const next = new Map(this.selections());
    const set = new Set(next.get(key) ?? []);
    if (set.has(orderId)) set.delete(orderId);
    else set.add(orderId);
    next.set(key, set);
    this.selections.set(next);
  }

  protected toggleSelectAll(group: PendingBonusGroupView, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    const key = this.groupKeyOf(group);
    const next = new Map(this.selections());
    next.set(key, checked ? new Set(group.orders.map((o) => o.orderId)) : new Set());
    this.selections.set(next);
  }

  private selectedOrders(group: PendingBonusGroupView): PendingBonusOrderRow[] {
    const ids = this.selections().get(this.groupKeyOf(group)) ?? new Set();
    return group.orders.filter((o) => ids.has(o.orderId));
  }

  protected resolveGroup(group: PendingBonusGroupView, action: 'substitute' | 'decline') {
    const selected = this.selectedOrders(group);
    if (selected.length === 0) return;
    if (selected.length > 100) {
      this.toast.info('Selecciona como máximo 100 pedidos por acción.');
      return;
    }
    // Sin una sede elegida en el filtro no sabemos qué almacén mirar para
    // más de un pedido a la vez (la bandeja no trae el branchId de cada
    // grupo) — doc 51, sección 6.3.
    if (selected.length > 1 && !this.branchFilter()) {
      this.toast.info('Elige una sede en el filtro para resolver varios pedidos a la vez.');
      return;
    }
    if (action === 'decline') {
      this.confirmDecline(group, selected);
    } else {
      this.openSubstituteModal(group, selected);
    }
  }

  private openSubstituteModal(group: PendingBonusGroupView, selected: PendingBonusOrderRow[]) {
    const single = selected.length === 1;
    const defaultQuantity = single
      ? selected[0].quantity
      : Math.max(...selected.map((o) => o.quantity));
    const totalSelected = selected.reduce((sum, o) => sum + o.quantity, 0);
    const branchId = this.branchFilter() ? Number(this.branchFilter()) : null;
    const data: SubstituteBonusDialogData = {
      promoName: group.promoName,
      originalProductName: group.productName,
      contextText: single
        ? `Pedido N.º ${selected[0].orderId}`
        : `${selected.length} pedidos seleccionados · Se deben ${quantityText(totalSelected)} unidades`,
      sameQuantityLabel: single
        ? `La misma que se debía (${quantityText(defaultQuantity)})`
        : 'La misma que se debía en cada pedido',
      defaultQuantity,
      branchId,
      excludeOrderId: single ? selected[0].orderId : undefined,
    };
    this.dialog
      .open<SubstituteBonusDialog, SubstituteBonusDialogData, SubstituteBonusDialogResult>(
        SubstituteBonusDialog,
        { data, width: '560px' },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.confirmSubstitute(group, selected, result);
      });
  }

  private confirmSubstitute(
    group: PendingBonusGroupView,
    selected: PendingBonusOrderRow[],
    result: SubstituteBonusDialogResult,
  ) {
    const single = selected.length === 1;
    const message = single
      ? `El pedido ${selected[0].orderId} entregará ${quantityText(result.quantity ?? selected[0].quantity)} de ${result.product.name} en lugar de ${group.productName}. ¿Sustituir?`
      : `${selected.length} pedidos entregarán ${result.product.name} en lugar de ${group.productName}: ${
          result.quantity != null
            ? `${quantityText(result.quantity)} en cada uno`
            : 'la misma cantidad que se debía en cada uno'
        }. ¿Sustituir?`;
    this.dialog
      .confirm({ title: 'Sustituir premio', message, confirmLabel: 'Sustituir' })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        if (single) {
          this.applySingle(group, selected[0].orderId, result.product.productId, result.quantity);
        } else {
          this.applyBatch(group, selected, result.product.productId, result.quantity);
        }
      });
  }

  private confirmDecline(group: PendingBonusGroupView, selected: PendingBonusOrderRow[]) {
    const single = selected.length === 1;
    const message = single
      ? `El cliente ${selected[0].customerName} no recibirá ${quantityText(selected[0].quantity)} de ${group.productName} de la promoción ${group.promoName}. Esta decisión se mantiene aunque el pedido se edite. ¿No otorgar?`
      : `${selected.length} clientes no recibirán ${group.productName} de la promoción ${group.promoName}. Esta decisión se mantiene aunque los pedidos se editen. ¿No otorgar?`;
    this.dialog
      .confirm({ title: 'No otorgar', message, confirmLabel: 'No otorgar', destructive: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        if (single) {
          this.applySingle(group, selected[0].orderId, null, null);
        } else {
          this.applyBatch(group, selected, null, null);
        }
      });
  }

  private applySingle(
    group: PendingBonusGroupView,
    orderId: number,
    substituteProductId: number | null,
    substituteQuantity: number | null,
  ) {
    const key = this.groupKeyOf(group);
    this.busyGroup.set(key);
    this.pendingBonusSvc
      .resolve(orderId, {
        resolutions: [
          { originalProductId: group.productId, substituteProductId, substituteQuantity },
        ],
      })
      .subscribe({
        next: () => {
          this.busyGroup.set(null);
          this.toast.success(substituteProductId ? 'Premio sustituido' : 'Premio no otorgado');
          this.load();
        },
        error: (err) => {
          this.busyGroup.set(null);
          const detalle = err?.error?.detail;
          this.toast.error(detalle || 'No se pudo completar la acción. Inténtalo de nuevo.');
          this.load();
        },
      });
  }

  private applyBatch(
    group: PendingBonusGroupView,
    selected: PendingBonusOrderRow[],
    substituteProductId: number | null,
    substituteQuantity: number | null,
  ) {
    const key = this.groupKeyOf(group);
    this.busyGroup.set(key);
    this.pendingBonusSvc
      .resolveBatch({
        promoId: group.promoId,
        originalProductId: group.productId,
        orderIds: selected.map((o) => o.orderId),
        substituteProductId,
        substituteQuantity,
      })
      .subscribe({
        next: (res: BatchResolutionResult) => {
          this.busyGroup.set(null);
          if (res.failed === 0) {
            this.toast.success(
              `${res.resolved} pedido${res.resolved === 1 ? '' : 's'} resuelto${res.resolved === 1 ? '' : 's'}`,
            );
          } else {
            this.dialog.open(ResolveBatchResultDialog, { data: res, width: '560px' });
          }
          this.load();
        },
        error: (err) => {
          this.busyGroup.set(null);
          const detalle = err?.error?.detail;
          this.toast.error(detalle || 'No se pudo completar la acción. Inténtalo de nuevo.');
          this.load();
        },
      });
  }
}
