import { Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { UiField } from '../../../../shared/ui/field/field';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiStatus } from '../../../../shared/ui/status/status';
import { TelesalesApi } from '../../data-access/televentas.api';
import { DailyOrderSummaryView } from '../../domain/televentas.models';
import { orderStatusName, originName } from '../../../orders/order-format';
import { dateTimeText } from '../../../assignments/assignment-format';
import { formatSoles } from '../../../../shared/pipes/money';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface OriginBreakdown {
  code: string;
  label: string;
  orderCount: number;
  netAmount: number;
}

/** Liquidación del día — doc 42, sección 10. Campo + televentas, como la app. */
@Component({
  selector: 'app-daily-settlement',
  imports: [UiField, UiEmpty, UiStatus],
  templateUrl: './daily-settlement.html',
  styleUrls: ['./daily-settlement.scss'],
})
export class DailySettlementPage {
  private api = inject(TelesalesApi);
  private router = inject(Router);

  protected formatSoles = formatSoles;
  protected dateTimeText = dateTimeText;
  protected originName = originName;
  protected orderStatusName = orderStatusName;

  protected date = signal(todayIso());
  protected loading = signal(true);
  protected error = signal(false);
  protected summary = signal<DailyOrderSummaryView | null>(null);
  private retryTick = signal(0);
  private request = computed(() => ({ date: this.date(), tick: this.retryTick() }));

  /** Filtro por marca — doc 51, sección 13.5: al tocar una marca de "Por marca". */
  protected selectedBrandId = signal<number | null>(null);
  protected selectedBrandName = computed(
    () =>
      this.summary()?.salesByBrand.find((b) => b.brandId === this.selectedBrandId())?.brandName ??
      '',
  );
  protected filteredOrders = computed(() => {
    const brandId = this.selectedBrandId();
    const orders = this.summary()?.orders ?? [];
    if (brandId == null) return orders;
    return orders.filter((o) => o.brands.some((b) => b.brandId === brandId));
  });

  protected originBreakdown = computed<OriginBreakdown[]>(() => {
    const orders = this.summary()?.orders ?? [];
    const byOrigin = new Map<string, OriginBreakdown>();
    for (const o of orders) {
      if (o.statusCode === 'CANCELLED') continue;
      const key = o.originCode;
      const row = byOrigin.get(key) ?? {
        code: key,
        label: originName(key) || key,
        orderCount: 0,
        netAmount: 0,
      };
      row.orderCount++;
      row.netAmount += o.netAmount;
      byOrigin.set(key, row);
    }
    return Array.from(byOrigin.values());
  });

  constructor() {
    toObservable(this.request)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(false);
        }),
        switchMap((req) => this.api.myDailySummary(req.date).pipe(catchError(() => of(undefined)))),
      )
      .subscribe((summary) => {
        this.loading.set(false);
        this.selectedBrandId.set(null);
        if (summary === undefined) {
          this.error.set(true);
          this.summary.set(null);
          return;
        }
        this.summary.set(summary);
      });
  }

  protected retry() {
    this.retryTick.update((n) => n + 1);
  }

  protected toggleBrandFilter(brandId: number) {
    this.selectedBrandId.set(this.selectedBrandId() === brandId ? null : brandId);
  }

  protected clearBrandFilter() {
    this.selectedBrandId.set(null);
  }

  /** Monto de ESA marca en el pedido, para la columna extra con el filtro activo. */
  protected brandAmountFor(order: { brands: { brandId: number; netAmount: number }[] }): number {
    const brandId = this.selectedBrandId();
    if (brandId == null) return 0;
    return order.brands.find((b) => b.brandId === brandId)?.netAmount ?? 0;
  }

  protected goToOrder(orderId: number) {
    this.router.navigate(['/pedidos/detalle', orderId]);
  }
}
