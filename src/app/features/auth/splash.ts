import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

const SPLASH_MS = 1100;

/**
 * Pantalla breve entre el login y el panel — doc del traspaso de diseño,
 * punto 5: logo animado antes de entrar. Navega sola a /dashboard después
 * de SPLASH_MS; si el usuario entra aquí sin sesión, authGuard ya lo manda
 * de vuelta a /login antes de montar este componente.
 */
@Component({
  selector: 'app-splash',
  template: `
    <div class="splash-wrap">
      <img class="splash-logo" src="/brand/logo.jpg" alt="Hispánica Distribuciones" />
      <div class="splash-bar">
        <div class="splash-bar-fill"></div>
      </div>
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
        gap: 28px;
        background: var(--bg);
      }
      .splash-logo {
        width: 220px;
        max-width: 60vw;
        height: auto;
        animation: splash-pop 0.5s var(--ease-standard);
      }
      @keyframes splash-pop {
        from {
          opacity: 0;
          transform: scale(0.92);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .splash-bar {
        width: 160px;
        height: 4px;
        background: var(--faint);
        overflow: hidden;
      }
      .splash-bar-fill {
        height: 100%;
        width: 40%;
        background: linear-gradient(90deg, #c9166e, #e8832b, #1aa6a6, #4a3a9e);
        animation: splash-sweep 1.1s var(--ease-standard) infinite;
      }
      @keyframes splash-sweep {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(350%);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .splash-logo {
          animation: none;
        }
        .splash-bar-fill {
          animation: none;
          width: 100%;
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
