import { Component, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { PortfolioScheduleFilter } from '../../shared/models/assignment-admin.models';

/**
 * Las pestañas *Listado*, *Huérfanos* y *Horario incompleto* se eliminaron:
 * son Cartera con un filtro de horario — doc 68, sección 3. Esta pantalla
 * no pinta nada, solo reenvía a Cartera con `schedule` ya puesto, para que
 * un enlace o favorito viejo (`/asignaciones/huerfanos`, etc.) siga
 * funcionando.
 */
@Component({
  selector: 'app-assignments-redirect',
  template: '',
})
export class AssignmentsRedirectPage {
  private router = inject(Router);

  schedule = input.required<PortfolioScheduleFilter>();

  constructor() {
    effect(() => {
      this.router.navigate(['/asignaciones'], {
        queryParams: { schedule: this.schedule() },
        replaceUrl: true,
      });
    });
  }
}
