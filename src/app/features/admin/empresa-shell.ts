import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../shared/components/page-header';

@Component({
  selector: 'app-empresa-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, PageHeaderComponent],
  template: `
    <div class="page">
      <app-page-header title="Empresa" subtitle="Configuración de la distribuidora"></app-page-header>
      <nav class="tabs">
        <a
          routerLink="/empresa"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
        >Datos</a
        >
        <a routerLink="/empresa/sedes" routerLinkActive="active">Sedes</a>
        <a routerLink="/empresa/configuracion" routerLinkActive="active">Configuración</a>
        <a routerLink="/empresa/mantenimiento" routerLinkActive="active">Mantenimiento</a>
      </nav>
      <router-outlet />
    </div>
  `,
  styles: [
    `
      .tabs {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin: 4px 0 16px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .tabs a {
        padding: 8px 14px;
        text-decoration: none;
        color: var(--mat-sys-on-surface-variant);
        border-bottom: 2px solid transparent;
        font-weight: 500;
      }
      .tabs a.active {
        color: var(--mat-sys-primary);
        border-bottom-color: var(--mat-sys-primary);
      }
    `,
  ],
})
export class EmpresaShell {}
