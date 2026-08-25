import { Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Placeholder único y reutilizable para los módulos que todavía no se
 * rediseñan. Sin acciones, sin datos falsos, sin ilustración — alineado a la
 * izquierda, igual que un estado vacío del sistema nuevo.
 *
 * Se puede usar con `[title]` directo o, cableado como componente de ruta,
 * tomando `data.title` de la propia definición de la ruta.
 */
@Component({
  selector: 'app-coming-soon',
  template: `
    <section class="coming-soon-page">
      <div class="coming-soon">
        <div class="coming-soon-eyebrow">Próximamente</div>
        <h1 class="coming-soon-title">{{ resolvedTitle() }}</h1>
        <p class="coming-soon-body">Este módulo se rediseñará próximamente.</p>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        font-family: var(--font-sans);
      }
      .coming-soon-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .coming-soon {
        max-width: 560px;
        border: 1px solid var(--hairline);
        padding: 48px 32px;
        text-align: left;
      }
      .coming-soon-eyebrow {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .coming-soon-title {
        font-size: 22px;
        margin: 6px 0 8px;
        color: var(--ink);
      }
      .coming-soon-body {
        font-size: 14px;
        color: var(--ink-muted);
        margin: 0;
        line-height: 1.5;
      }

      @media (max-width: 767px) {
        .coming-soon-page {
          padding: var(--sp-4);
        }
        .coming-soon {
          padding: 32px 20px;
        }
      }
    `,
  ],
})
export class ComingSoonPage {
  private route = inject(ActivatedRoute, { optional: true });

  title = input<string>('');

  protected resolvedTitle = computed(
    () => this.title() || (this.route?.snapshot.data['title'] as string) || 'Próximamente',
  );
}
