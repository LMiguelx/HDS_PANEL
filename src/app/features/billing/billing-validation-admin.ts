import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  BillingSendResult,
  BillingValidationResult,
  SendBillingCommand,
  ValidateBillingCommand,
} from '../../shared/models/billing-validation.models';

/**
 * OrderController, /api/orders/billing — validación y envío a facturación
 * (doc 32). `order.send_to_billing`. Validar no modifica nada; enviar no se
 * puede deshacer. Ambos trabajan por tandas — ver sección 4.2 del doc — el
 * llamador hace varias llamadas en serie, esta clase solo expone cada una.
 */
@Injectable({ providedIn: 'root' })
export class BillingValidationAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/orders/billing`;

  /** El body es obligatorio aunque vaya vacío: {} valida la primera página de hoy. */
  validate(cmd: ValidateBillingCommand) {
    return this.http.post<BillingValidationResult>(`${this.base}/validate`, cmd);
  }

  /** De 1 a 100 ids por llamada. Responde 200 aunque algunos no se hayan enviado. */
  send(cmd: SendBillingCommand) {
    return this.http.post<BillingSendResult>(`${this.base}/send`, cmd);
  }
}
