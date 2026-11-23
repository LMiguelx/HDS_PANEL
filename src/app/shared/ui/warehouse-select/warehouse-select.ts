import { Component, computed, inject, input, model, signal } from '@angular/core';
import { UiMenu } from '../menu/menu';
import { UiBadge } from '../badge/badge';
import { CatalogLookupService } from '../../../features/catalog/catalog-lookup';
import { WarehouseView } from '../../models/inventory.models';

export type WarehouseSelectMode = 'all' | 'sale' | 'orders';

interface WarehouseGroup {
  branchName: string;
  warehouses: WarehouseView[];
}

/**
 * Selector de almacén único, reutilizado en todo el panel — doc 82, sección
 * 1. Agrupado por sucursal, con la insignia "Venta" en los `isDefault`
 * (reutiliza `ui-menu` como base flotante: un `<select>` nativo no puede
 * mostrar grupos con una insignia dentro de cada opción). Recuerda el
 * último almacén elegido en esa pantalla (clave `storageKey`) en el
 * navegador, no en el servidor.
 */
@Component({
  selector: 'ui-warehouse-select',
  imports: [UiMenu, UiBadge],
  template: `
    <div class="ws-field">
      <label>{{ label() }}</label>
      @if (!allowAll() && options().length <= 1) {
        <div class="ws-fixed">
          @if (options()[0]; as w) {
            <span>{{ w.name }} · {{ w.branchName }}</span>
            @if (w.isDefault) {
              <ui-badge tone="neutral">Venta</ui-badge>
            }
          } @else {
            <span class="ws-muted">Sin almacenes disponibles</span>
          }
        </div>
      } @else {
        <ui-menu [triggerLabel]="triggerText()" label="Elegir almacén">
          @if (allowAll()) {
            <button
              type="button"
              class="ws-option"
              [class.on]="value() === null"
              (click)="pickAll()"
            >
              <span>Todos</span>
            </button>
          }
          @for (group of groups(); track group.branchName) {
            <div class="ws-group-label">{{ group.branchName }}</div>
            @for (w of group.warehouses; track w.warehouseId) {
              <button
                type="button"
                class="ws-option"
                [class.on]="w.warehouseId === value()"
                [title]="'Código ' + w.code"
                (click)="pick(w)"
              >
                <span>{{ w.name }}</span>
                @if (w.isDefault) {
                  <ui-badge tone="neutral">Venta</ui-badge>
                }
              </button>
            }
          }
        </ui-menu>
      }
      @if (hint()) {
        <div class="ws-hint">{{ hint() }}</div>
      }
    </div>
  `,
  styles: [
    `
      .ws-field {
        display: grid;
        gap: 6px;
        min-width: 0;
      }
      label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .ws-fixed {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: var(--touch-min);
        padding: 0 12px;
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        border-radius: var(--radius-control, 0);
        color: var(--ink-muted);
        font-size: 15px;
      }
      .ws-muted {
        color: var(--ink-muted);
      }
      .ws-hint {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .ws-group-label {
        padding: 8px 12px 4px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .ws-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .ws-option.on {
        background: var(--accent-wash);
        color: var(--accent-ink);
      }
    `,
  ],
})
export class UiWarehouseSelect {
  mode = input<WarehouseSelectMode>('all');
  label = input('Almacén');
  hint = input('');
  /** Agrega la opción "Todos" (value null) — para filtros, no para selección obligatoria. */
  allowAll = input(false);
  /** Clave para recordar el último elegido en esta pantalla — `hds.warehouse.<storageKey>`. */
  storageKey = input.required<string>();

  value = model<number | null>(null);

  private catalogSvc = inject(CatalogLookupService);
  private warehouses = signal<WarehouseView[]>([]);

  /** doc 82, sección 1: "orders" hoy es solo el almacén de venta de OFICINA PRINCIPAL (la única sucursal con vendedores activos). */
  protected options = computed<WarehouseView[]>(() => {
    const list = this.warehouses();
    if (this.mode() === 'sale') return list.filter((w) => w.isDefault);
    if (this.mode() === 'orders') {
      return list.filter((w) => w.isDefault && w.branchName === 'OFICINA PRINCIPAL');
    }
    return list;
  });

  protected groups = computed<WarehouseGroup[]>(() => {
    const byBranch = new Map<string, WarehouseView[]>();
    for (const w of this.options()) {
      if (!byBranch.has(w.branchName)) byBranch.set(w.branchName, []);
      byBranch.get(w.branchName)!.push(w);
    }
    return Array.from(byBranch, ([branchName, warehouses]) => ({ branchName, warehouses }));
  });

  private selected = computed(
    () => this.options().find((w) => w.warehouseId === this.value()) ?? null,
  );
  protected triggerText = computed(() => {
    if (this.value() === null && this.allowAll()) return 'Todos';
    const w = this.selected();
    return w ? `${w.name} · ${w.branchName}` : 'Elegir almacén';
  });

  private initialized = false;

  constructor() {
    this.catalogSvc.warehouses().subscribe((list) => {
      this.warehouses.set(list);
      this.initializeValue();
    });
  }

  /** Se corre una sola vez, cuando llega la lista — doc 82, sección 1: recuerda el último elegido o, si no hay nada guardado, el de venta de OFICINA PRINCIPAL ("Todos" en los filtros con `allowAll`). */
  private initializeValue() {
    if (this.initialized) return;
    this.initialized = true;
    const options = this.options();
    if (!this.allowAll() && options.length === 1) {
      this.value.set(options[0].warehouseId);
      return;
    }
    if (this.value() != null) return; // ya vino con un valor (query param u otro origen)
    const stored = this.readStored();
    if (stored === 'all') {
      if (this.allowAll()) return; // se queda en null → "Todos"
    } else if (stored != null && options.some((w) => w.warehouseId === stored)) {
      this.value.set(stored);
      return;
    }
    if (!this.allowAll()) {
      const fallback = options.find((w) => w.isDefault) ?? options[0] ?? null;
      if (fallback) this.value.set(fallback.warehouseId);
    }
  }

  protected pick(w: WarehouseView) {
    this.value.set(w.warehouseId);
    this.writeStored(w.warehouseId);
  }

  protected pickAll() {
    this.value.set(null);
    this.writeStored(null);
  }

  private key(): string {
    return `hds.warehouse.${this.storageKey()}`;
  }

  private readStored(): number | 'all' | null {
    try {
      const raw = localStorage.getItem(this.key());
      if (raw === 'all') return 'all';
      return raw ? Number(raw) : null;
    } catch {
      return null;
    }
  }

  private writeStored(id: number | null) {
    try {
      localStorage.setItem(this.key(), id == null ? 'all' : String(id));
    } catch {
      // localStorage no disponible (privado/bloqueado) — se pierde el recuerdo, sin romper el selector.
    }
  }
}
