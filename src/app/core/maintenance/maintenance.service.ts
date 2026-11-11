import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MaintenanceStatusView } from '../../shared/models/maintenance.models';

const POLL_MS = 5 * 60_000;

/**
 * Estado compartido del modo mantenimiento (doc 38, sección 10.3): un solo
 * signal que usan la tarjeta de Empresa → Sistema y el aviso de la barra
 * superior, en vez de pedirlo cada uno por su lado. Solo se llama cuando el
 * usuario tiene `system.maintenance.manage` (si no, el GET respondería 403).
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/maintenance`;

  readonly status = signal<MaintenanceStatusView | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  refresh() {
    this.loading.set(true);
    this.error.set(false);
    this.http.get<MaintenanceStatusView>(this.base).subscribe({
      next: (s) => {
        this.status.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  turnOn(reason: string) {
    const params = reason.trim() ? new HttpParams().set('reason', reason.trim()) : undefined;
    return this.http.post<MaintenanceStatusView>(`${this.base}/on`, null, { params });
  }

  turnOff() {
    return this.http.post<MaintenanceStatusView>(`${this.base}/off`, null);
  }

  /** Cada 5 minutos mientras la ventana esté abierta — doc 38, sección 10.3. */
  startPolling() {
    this.stopPolling();
    this.pollHandle = setInterval(() => this.refresh(), POLL_MS);
  }

  stopPolling() {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }
}
