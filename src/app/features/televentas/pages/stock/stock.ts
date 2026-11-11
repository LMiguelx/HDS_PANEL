import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../../shared/ui/field/field';
import { UiToggle } from '../../../../shared/ui/toggle/toggle';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { TelesalesSessionService } from '../../data-access/televentas-session';
import { InventoryAdminService } from '../../../inventory/inventory-admin';
import { WarehouseStockItem } from '../../../../shared/models/inventory.models';
import { dateTimeText } from '../../../assignments/assignment-format';

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Stock del almacén de su sede — doc 42, sección 11. Solo para consultar, no para vender. */
@Component({
  selector: 'app-televentas-stock',
  imports: [UiButton, UiField, UiToggle, UiEmpty],
  templateUrl: './stock.html',
  styleUrls: ['./stock.scss'],
})
export class TelesalesStockPage {
  protected session = inject(TelesalesSessionService);
  private inventorySvc = inject(InventoryAdminService);

  protected dateTimeText = dateTimeText;

  protected loading = signal(true);
  protected error = signal(false);
  protected warehouseName = signal('');
  protected items = signal<WarehouseStockItem[]>([]);

  protected search = signal('');
  protected brandId = signal('');
  protected familyId = signal('');
  protected onlyWithStock = signal(false);

  protected brandOptions = computed<UiFieldOption[]>(() => {
    const seen = new Map<number, string>();
    for (const i of this.items()) seen.set(i.brandId, i.brandName);
    return [
      { value: '', label: 'Todas las marcas' },
      ...Array.from(seen, ([id, name]) => ({ value: String(id), label: name })),
    ];
  });

  protected familyOptions = computed<UiFieldOption[]>(() => {
    const seen = new Map<number, string>();
    for (const i of this.items()) seen.set(i.familyId, i.familyName);
    return [
      { value: '', label: 'Todas las familias' },
      ...Array.from(seen, ([id, name]) => ({ value: String(id), label: name })),
    ];
  });

  protected visibleItems = computed(() => {
    const q = normalize(this.search());
    const brandId = this.brandId() ? Number(this.brandId()) : null;
    const familyId = this.familyId() ? Number(this.familyId()) : null;
    return this.items().filter((i) => {
      if (brandId != null && i.brandId !== brandId) return false;
      if (familyId != null && i.familyId !== familyId) return false;
      if (this.onlyWithStock() && i.quantity <= 0) return false;
      if (!q) return true;
      return normalize(i.productName).includes(q) || normalize(i.productCode).includes(q);
    });
  });

  private loadedWarehouseId: number | null = null;

  constructor() {
    this.session.ensureLoaded();
    // El almacén lo resuelve `TelesalesSessionService` de forma asíncrona
    // (doc 42, sección 4.1): se pide el stock apenas quede disponible.
    effect(() => {
      const warehouseId = this.session.warehouseId();
      const sessionLoading = this.session.loading();
      untracked(() => {
        if (warehouseId && warehouseId !== this.loadedWarehouseId) {
          this.loadedWarehouseId = warehouseId;
          this.load(warehouseId);
        } else if (!warehouseId && !sessionLoading) {
          this.loading.set(false);
        }
      });
    });
  }

  protected load(warehouseId?: number) {
    const id = warehouseId ?? this.loadedWarehouseId;
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this.inventorySvc.warehouseStock(id).subscribe({
      next: (res) => {
        this.warehouseName.set(res.warehouseName);
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
}
