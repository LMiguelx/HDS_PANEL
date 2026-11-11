import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

const SPLASH_MS = 1100;

/**
 * Pantalla breve entre el login y el panel: mismo degradado de marca que
 * login.ts (`--brand-gradient`), solo el logo con un fade-in corto. Navega
 * sola a /dashboard después de SPLASH_MS; si entran aquí sin sesión,
 * authGuard ya manda de vuelta a /login antes de montar este componente.
 * Ruta de imagen relativa: ver nota en login.ts sobre el empaquetado
 * Electron (`file://`).
 */
@Component({
  selector: 'app-splash',
  template: `
    <div class="splash-wrap">
      <img class="splash-logo" src="hispanica.png" alt="Hispánica Distribuciones" />
    </div>
  `,
  styles: [
    `
      :host {
        font-family: var(--font-sans);
      }
      .splash-wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: var(--brand-gradient);
      }
      .splash-logo {
        width: 200px;
        max-width: 55vw;
        height: auto;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-card);
        animation: splash-fade-in 0.7s var(--ease-standard);
      }
      @keyframes splash-fade-in {
        from {
          opacity: 0;
          transform: scale(0.94);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .splash-logo {
          animation: none;
        }
      }
    `,
  ],
})
export class SplashPage {
  private router = inject(Router);

  constructor() {
    setTimeout(() => void this.router.navigateByUrl('/dashboard'), SPLASH_MS);
  }
}
