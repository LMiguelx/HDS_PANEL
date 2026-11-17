import { Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiStatus } from '../../../../shared/ui/status/status';
import { TelesalesApi } from '../../data-access/televentas.api';
import { OrderSummary } from '../../../../shared/models/order.models';
import { deliveryColumnText, orderStatusName, originName } from '../../../orders/order-format';
import { dateTimeText } from '../../../assignments/assignment-format';
import { formatSoles } from '../../../../shared/pipes/money';

/** Mis pedidos — doc 42, sección 9.1. Del más reciente al más antiguo. */
@Component({
  selector: 'app-my-orders',
  imports: [UiButton, UiEmpty, UiStatus],
  templateUrl: './my-orders.html',
  styleUrls: ['./my-orders.scss'],
})
export class MyOrdersPage {
  private api = inject(TelesalesApi);
  private router = inject(Router);

  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;
  protected orderStatusName = orderStatusName;
  protected originName = originName;
  protected deliveryColumnText = deliveryColumnText;

  protected rows = signal<OrderSummary[]>([]);
  protected page = signal(0);
  protected size = 20;
  protected totalPages = signal(0);
  protected loading = signal(true);
  protected error = signal(false);

  private retryTick = signal(0);
  private request = computed(() => ({ page: this.page(), tick: this.retryTick() }));

  constructor() {
    toObservable(this.request)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(false);
        }),
        switchMap((req) =>
          this.api.myOrders(req.page, this.size).pipe(catchError(() => of(undefined))),
        ),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result === undefined) {
          this.error.set(true);
          return;
        }
        this.rows.set(result.content ?? []);
        this.totalPages.set(result.totalPages ?? 0);
      });
  }

  protected retry() {
    this.retryTick.update((n) => n + 1);
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
  }
  protected nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
  }

  protected goToOrder(orderId: number) {
    this.router.navigate(['/pedidos/detalle', orderId]);
  }
}
