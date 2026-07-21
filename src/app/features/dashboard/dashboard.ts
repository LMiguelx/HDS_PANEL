import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth';

@Component({
  selector: 'app-dashboard',
  imports: [MatCardModule, MatIconModule],
  template: `
    <div class="page">
      <h1>Bienvenido{{ user()?.fullName ? ', ' + user()?.fullName : '' }}</h1>
      <p class="muted">Panel administrativo de hdsapp. Aquí irán tus indicadores según permisos.</p>

      <div class="grid">
        <mat-card class="tile"
          ><mat-icon>groups</mat-icon>
          <div>
            <strong>Clientes</strong>
            <p class="muted">Próximamente</p>
          </div></mat-card
        >
        <mat-card class="tile"
          ><mat-icon>receipt_long</mat-icon>
          <div>
            <strong>Pedidos</strong>
            <p class="muted">Próximamente</p>
          </div></mat-card
        >
        <mat-card class="tile"
          ><mat-icon>local_shipping</mat-icon>
          <div>
            <strong>Reparto</strong>
            <p class="muted">Próximamente</p>
          </div></mat-card
        >
        <mat-card class="tile"
          ><mat-icon>fact_check</mat-icon>
          <div>
            <strong>Conciliación</strong>
            <p class="muted">Próximamente</p>
          </div></mat-card
        >
      </div>
    </div>
  `,
  styles: [
    `
      h1 {
        margin: 0 0 4px;
      }
      .grid {
        margin-top: 20px;
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      }
      .tile {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 18px;
      }
      .tile mat-icon {
        font-size: 34px;
        width: 34px;
        height: 34px;
        color: var(--mat-sys-primary);
      }
      .tile p {
        margin: 2px 0 0;
      }
    `,
  ],
})
export class DashboardPage {
  private auth = inject(AuthService);
  readonly user = this.auth.currentUser;
}
