import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MaintenanceStatusView } from '../../shared/models/maintenance.models';

@Injectable({ providedIn: 'root' })
export class MaintenanceAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/maintenance`;

  /** Falla si el modo mantenimiento ya estaba activo. */
  turnOn(reason?: string) {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    return this.http.post<MaintenanceStatusView>(`${this.base}/on`, {}, { params });
  }

  /** Falla si el modo mantenimiento ya estaba inactivo. */
  turnOff() {
    return this.http.post<MaintenanceStatusView>(`${this.base}/off`, {});
  }
}
