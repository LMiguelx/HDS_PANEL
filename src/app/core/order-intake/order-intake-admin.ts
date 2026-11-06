import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ChangeClosureEndCommand,
  ClosureView,
  IntakeStatusView,
  ScheduleClosureCommand,
} from '../../shared/models/order-intake.models';

/**
 * OrderIntakeController, /api/order-intake — doc 65, sección 2.5. Programar,
 * extender/acortar, reabrir o anular cierres requiere `order.intake.manage`;
 * `status` también la pueden pedir `order.create` y `order.view_all`.
 */
@Injectable({ providedIn: 'root' })
export class OrderIntakeAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/order-intake`;

  status() {
    return this.http.get<IntakeStatusView>(`${this.base}/status`);
  }

  /** `from` opcional — por defecto, últimos 7 días. Más recientes primero, máximo 200. */
  closures(from?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    return this.http.get<ClosureView[]>(`${this.base}/closures`, { params });
  }

  scheduleClosure(cmd: ScheduleClosureCommand) {
    return this.http.post<ClosureView>(`${this.base}/closures`, cmd);
  }

  /** Extiende o acorta (cambia solo el fin). */
  changeClosureEnd(closureId: number, cmd: ChangeClosureEndCommand) {
    return this.http.patch<ClosureView>(`${this.base}/closures/${closureId}`, cmd);
  }

  /** En curso: reabrir ahora. Programado: anular. */
  endClosure(closureId: number) {
    return this.http.post<ClosureView>(`${this.base}/closures/${closureId}/end`, {});
  }
}
