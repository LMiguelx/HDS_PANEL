import { Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';

/**
 * Placeholder único y reutilizable para los módulos que todavía no se
 * rediseñan. Sin acciones, sin datos falsos, sin ilustración — alineado a la
 * izquierda, igual que un estado vacío del sistema nuevo.
 *
 * Se puede usar con inputs directos (`[title]`/`[icon]`) o, cuando está
 * cableado como componente de ruta, tomando `data.title`/`data.icon` de la
 * propia definición de la ruta.
 */
@Component({
  selector: 'app-coming-soon',
  imports: [MatIconModule],
  template: `
    <div class="coming-soon">
      @if (resolvedIcon()) {
        <mat-icon class="coming-soon-icon">{{ resolvedIcon() }}</mat-icon>
      }
      <h1 class="coming-soon-title">{{ resolvedTitle() }}</h1>
      <p class="coming-soon-body">Este módulo se rediseñará próximamente.</p>
    </div>
  `,
  styles: [
    `
      .coming-soon {
        max-width: 560px;
        padding: 48px 32px;
        text-align: left;
      }
      .coming-soon-icon {
        color: var(--ink-muted, #6b7280);
        margin-bottom: 12px;
      }
      .coming-soon-title {
        font-size: 22px;
        margin: 0 0 8px;
      }
      .coming-soon-body {
        font-size: 14px;
        color: var(--ink-muted, #6b7280);
        margin: 0;
      }
    `,
  ],
})
export class ComingSoonPage {
  private route = inject(ActivatedRoute, { optional: true });

  title = input<string>('');
  icon = input<string>('');

  protected resolvedTitle = () => this.title() || (this.route?.snapshot.data['title'] as string) || 'Próximamente';
  protected resolvedIcon = () => this.icon() || (this.route?.snapshot.data['icon'] as string) || '';
}
