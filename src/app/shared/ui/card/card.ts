import { Component, computed, input, output } from '@angular/core';

export type UiCardVariant = 'container' | 'section' | 'work';

/**
 * Tarjeta del sistema de diseño (ver DESIGN.md): superficie elevada sobre
 * el lienzo de página, radio 14px. `title`/`subtitle` opcionales pintan la
 * cabecera "título + texto de ayuda" que piden las pantallas nuevas; si se
 * omiten, el contenido proyectado ocupa toda la tarjeta como antes.
 *
 * Los manejadores de eventos NO devuelven valor a propósito: en Angular, un
 * manejador que devuelve `false` llama a `preventDefault()`, y eso cancelaba
 * los clics y el Enter de todo lo que hubiera dentro de la tarjeta
 * (checkboxes, enlaces, saltos de línea en un textarea).
 */
@Component({
  selector: 'ui-card',
  template: `
    <div
      class="ui-card"
      [class]="hostClass()"
      [attr.role]="clickable() ? 'button' : null"
      [attr.tabindex]="clickable() ? 0 : null"
      (click)="onClick()"
      (keydown.enter)="onEnter($event)"
    >
      @if (title()) {
        <div class="ui-card-head">
          <h3 class="ui-card-title">{{ title() }}</h3>
          @if (subtitle()) {
            <p class="ui-card-subtitle">{{ subtitle() }}</p>
          }
        </div>
      }
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      .ui-card {
        background: var(--surface);
        border-radius: var(--radius-card, 0);
      }
      .ui-card-container {
        border: 2px solid var(--divider);
        padding: 18px;
      }
      .ui-card-section {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
      }
      .ui-card-work {
        border: 2px solid var(--divider);
        padding: 18px;
      }
      .ui-card-head {
        margin-bottom: 14px;
      }
      .ui-card-title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--ink);
      }
      .ui-card-subtitle {
        margin: 2px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ui-card-clickable {
        cursor: pointer;
      }
      .ui-card-clickable:hover {
        border-color: var(--accent);
      }
      .ui-card-clickable:focus-visible {
        outline: var(--border-focus);
        outline-offset: 2px;
      }
      .ui-card-selected {
        border-color: var(--accent);
        background: var(--accent-wash);
      }
      .ui-card-resolved {
        opacity: 0.6;
      }
      .ui-card-saving {
        opacity: 0.75;
        pointer-events: none;
      }
    `,
  ],
})
export class UiCard {
  variant = input<UiCardVariant>('container');
  clickable = input(false);
  selected = input(false);
  resolved = input(false);
  saving = input(false);
  title = input('');
  subtitle = input('');

  cardClick = output<void>();

  protected hostClass = computed(() => {
    const classes = [`ui-card-${this.variant()}`];
    if (this.clickable()) classes.push('ui-card-clickable');
    if (this.selected()) classes.push('ui-card-selected');
    if (this.resolved()) classes.push('ui-card-resolved');
    if (this.saving()) classes.push('ui-card-saving');
    return classes.join(' ');
  });

  protected onClick(): void {
    if (this.clickable()) this.cardClick.emit();
  }

  /** Solo con el foco en la tarjeta misma: un Enter dentro de un campo es del campo. */
  protected onEnter(event: Event): void {
    if (this.clickable() && event.target === event.currentTarget) this.cardClick.emit();
  }
}
