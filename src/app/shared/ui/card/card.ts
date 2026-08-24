import { Component, computed, input, output } from '@angular/core';

export type UiCardVariant = 'container' | 'section' | 'work';

/**
 * Contenedor con borde 2px (container), sub-bloque 1px (section) o tarjeta
 * de trabajo de bandeja (work). La sombra queda reservada para overlays del
 * CDK; las tarjetas nunca llevan sombra.
 */
@Component({
  selector: 'ui-card',
  template: `
    <div
      class="ui-card"
      [class]="hostClass()"
      [attr.role]="clickable() ? 'button' : null"
      [attr.tabindex]="clickable() ? 0 : null"
      (click)="clickable() && cardClick.emit()"
      (keydown.enter)="clickable() && cardClick.emit()"
    >
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      .ui-card {
        background: var(--bg);
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

  cardClick = output<void>();

  protected hostClass = computed(() => {
    const classes = [`ui-card-${this.variant()}`];
    if (this.clickable()) classes.push('ui-card-clickable');
    if (this.selected()) classes.push('ui-card-selected');
    if (this.resolved()) classes.push('ui-card-resolved');
    if (this.saving()) classes.push('ui-card-saving');
    return classes.join(' ');
  });
}
