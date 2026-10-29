import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas del módulo de Asignaciones, mismo patrón que PromoModuleTabs. */
@Component({
  selector: 'app-assignment-module-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="asg-tabs">
      <a
        routerLink="/asignaciones"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        >Inicio</a
      >
      <a routerLink="/asignaciones/listado" routerLinkActive="active">Listado</a>
      <a routerLink="/asignaciones/huerfanos" routerLinkActive="active">Huérfanos</a>
      <a routerLink="/asignaciones/ausencias" routerLinkActive="active">Ausencias</a>
      <a routerLink="/asignaciones/mapa" routerLinkActive="active">Mapa</a>
      <a routerLink="/asignaciones/coberturas" routerLinkActive="active">Coberturas</a>
      <a routerLink="/asignaciones/pendientes" routerLinkActive="active">Horario incompleto</a>
    </nav>
  `,
  styles: [
    `
      .asg-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      @media (max-width: 767px) {
        .asg-tabs {
          padding: 0 var(--sp-4);
        }
        .asg-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
      .asg-tabs a {
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 14px;
        padding: 16px 18px;
        min-height: var(--touch-min);
        display: flex;
        align-items: center;
        white-space: nowrap;
        color: var(--ink-muted);
        text-decoration: none;
        border-bottom: 3px solid transparent;
      }
      .asg-tabs a:hover {
        color: var(--ink);
      }
      .asg-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class AssignmentModuleTabs {}
