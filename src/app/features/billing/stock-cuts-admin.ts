import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ApplyStockCutsCommand,
  ApplyStockCutsResult,
  StockCutPreview,
  StockCutPreviewCommand,
} from '../../shared/models/stock-cuts.models';

/** "Recortar negativos" — doc 78, sección 4. `order.send_to_billing`. */
@Injectable({ providedIn: 'root' })
export class StockCutsAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/orders/billing/stock-cuts`;

  /** No cambia nada: solo muestra qué pedidos se recortarían. */
  preview(cmd: StockCutPreviewCommand) {
    return this.http.post<StockCutPreview>(`${this.base}/preview`, cmd);
  }

  /** Recorta. Máximo 100 pedidos por llamada. */
  apply(cmd: ApplyStockCutsCommand) {
    return this.http.post<ApplyStockCutsResult>(`${this.base}/apply`, cmd);
  }
}
