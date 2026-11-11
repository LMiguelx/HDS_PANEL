import { Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UiButton } from '../../../shared/ui/button/button';
import { AuthService } from '../../../core/auth/auth';
import { MapCustomerPopupView } from '../../../shared/models/assignment-map.models';
import {
  mapVendorColorVar,
  pointStatusInfo,
  distanceText,
  orderStatusBadge,
  scheduleText,
} from '../map-format';
import { formatSoles } from '../../../shared/pipes/money';
import { timeText } from '../assignment-format';

/**
 * Ventana del punto (doc 40, sección 10): se abre al hacer clic en
 * cualquier marcador de las tres vistas. Ventana flotante posicionada en
 * el punto de clic; en pantallas angostas pasa a panel inferior por CSS
 * (sección 10, "o panel inferior en pantallas angostas").
 */
@Component({
  selector: 'app-map-customer-popup',
  imports: [UiButton, RouterLink],
  templateUrl: './customer-popup.html',
  styleUrls: ['./customer-popup.scss'],
})
export class MapCustomerPopup {
  private auth = inject(AuthService);
  private router = inject(Router);

  data = input<MapCustomerPopupView | null>(null);
  loading = input(false);
  error = input(false);
  /** Posición en píxeles dentro del contenedor del mapa, en el momento del clic. */
  position = input<{ x: number; y: number } | null>(null);
  /** Extra de seguimiento (sección 7.1): distancia al cliente y "#orden · hora". */
  trackingExtra = input<{ distanceMeters: number; order: number; time: string } | null>(null);
  /** Umbral de "lejos del cliente" (sección 6.2 `thresholds.farFromCustomerMeters`) para resaltar la distancia de una visita. */
  distanceThresholdMeters = input(150);

  close = output<void>();
  assignVendor = output<void>();

  protected canViewFicha = computed(() => this.auth.hasAny('customer.view'));
  protected canViewOrder = computed(() => this.auth.hasAny('order.view_all'));
  protected mapVendorColorVar = mapVendorColorVar;
  protected pointStatusInfo = pointStatusInfo;
  protected distanceText = distanceText;
  protected orderStatusBadge = orderStatusBadge;
  protected formatSoles = formatSoles;
  protected timeText = timeText;
  protected scheduleText = scheduleText;

  protected lastOrderId = computed(() => {
    const visits = this.data()?.visits ?? [];
    for (let i = visits.length - 1; i >= 0; i--) {
      if (visits[i].orderId != null) return visits[i].orderId;
    }
    return null;
  });

  protected viewOrder() {
    const orderId = this.lastOrderId();
    if (orderId != null) this.router.navigate(['/pedidos/detalle', orderId]);
  }
}
