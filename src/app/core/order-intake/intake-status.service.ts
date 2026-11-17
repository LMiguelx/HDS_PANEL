import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IntakeStatusView } from '../../shared/models/order-intake.models';

const POLL_MS = 5 * 60_000;

/**
 * Estado compartido de la toma de pedidos (doc 65, sección 2.8): un solo
 * signal que usan la tarjeta de Empresa → Sistema, la barra superior y las
 * pantallas de pedidos, igual que `MaintenanceService` para el modo
 * mantenimiento. Solo se llama cuando el usuario tiene `order.create`,
 * `order.view_all` u `order.intake.manage`.
 */
@Injectable({ providedIn: 'root' })
export class IntakeStatusService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/order-intake`;

  readonly status = signal<IntakeStatusView | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private eventHandle: ReturnType<typeof setTimeout> | null = null;

  refresh() {
    this.loading.set(true);
    this.error.set(false);
    this.http.get<IntakeStatusView>(`${this.base}/status`).subscribe({
      next: (s) => {
        this.status.set(s);
        this.loading.set(false);
        this.scheduleNextEvent(s);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  /** Cada 5 minutos mientras la ventana esté abierta — doc 65, sección 2.8. */
  startPolling() {
    this.stopPolling();
    this.pollHandle = setInterval(() => this.refresh(), POLL_MS);
  }

  stopPolling() {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.clearScheduledEvent();
  }

  private clearScheduledEvent() {
    if (this.eventHandle) {
      clearTimeout(this.eventHandle);
      this.eventHandle = null;
    }
  }

  /**
   * Refresca en el instante exacto en que empieza `next` o termina
   * `current`, contra `serverTime` — nunca contra la hora del equipo (doc
   * 65, sección 2.8). El desfase cliente/servidor se calcula una vez por
   * respuesta y se aplica al objetivo antes de programar el `setTimeout`.
   */
  private scheduleNextEvent(s: IntakeStatusView) {
    this.clearScheduledEvent();
    const offset = Date.now() - new Date(s.serverTime).getTime();
    const targets: number[] = [];
    if (s.current) targets.push(new Date(s.current.endsAt).getTime());
    if (s.next) targets.push(new Date(s.next.startsAt).getTime());
    if (targets.length === 0) return;
    const delay = Math.min(...targets) + offset - Date.now();
    if (delay <= 0) return; // ya pasó — lo atrapa el siguiente sondeo de 5 minutos
    this.eventHandle = setTimeout(() => this.refresh(), delay);
  }
}
