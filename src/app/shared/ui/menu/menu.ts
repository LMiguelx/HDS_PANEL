import {
  Component,
  ElementRef,
  TemplateRef,
  ViewContainerRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Overlay, OverlayRef, ConnectedPosition } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { UiButton } from '../button/button';

const POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Botón «···» que abre un menú de acciones en capa flotante (CDK Overlay).
 * El contenido proyectado son los botones de acción; el menú se cierra al
 * elegir una (basta con que cada botón cierre el menú a través de su propio
 * handler, o usando el metodo público `close()` vía referencia de plantilla).
 */
@Component({
  selector: 'ui-menu',
  template: `
    <button
      type="button"
      uiButton
      [variant]="triggerLabel() ? 'secondary' : 'icon'"
      [size]="triggerLabel() ? 'sm' : 'md'"
      [attr.title]="label()"
      [attr.aria-label]="label()"
      #trigger
      (click)="toggle()"
    >
      {{ triggerLabel() ? triggerLabel() + ' ▾' : '···' }}
    </button>

    <ng-template #panel>
      <div class="ui-menu-panel" cdkTrapFocus cdkTrapFocusAutoCapture (click)="close()">
        <ng-content></ng-content>
      </div>
    </ng-template>
  `,
  imports: [CdkTrapFocus, UiButton],
  styles: [
    `
      :host {
        display: inline-block;
      }
      .ui-menu-panel {
        display: flex;
        flex-direction: column;
        min-width: 180px;
        background: var(--bg);
        border: 1px solid var(--divider);
        box-shadow: var(--elev-menu);
        padding: 4px;
      }
      ::ng-deep .ui-menu-panel button {
        appearance: none;
        border: 0;
        background: transparent;
        text-align: left;
        font-family: var(--font-sans);
        font-size: 14px;
        color: var(--ink);
        padding: 10px 12px;
        min-height: var(--touch-min);
        cursor: pointer;
        width: 100%;
      }
      ::ng-deep .ui-menu-panel button:hover {
        background: var(--faint);
      }
      ::ng-deep .ui-menu-panel button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    `,
  ],
})
export class UiMenu {
  label = input('Más acciones');
  /** Si se da, el botón muestra este texto + "▾" en vez del ícono "···". */
  triggerLabel = input<string | null>(null);

  private trigger = viewChild('trigger', { read: ElementRef<HTMLElement> });
  private panelTpl = viewChild<TemplateRef<unknown>>('panel');
  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);
  private overlayRef: OverlayRef | null = null;
  protected open = signal(false);

  toggle() {
    this.open() ? this.close() : this.openMenu();
  }

  close() {
    this.overlayRef?.detach();
    this.open.set(false);
  }

  private openMenu() {
    const originEl = this.trigger();
    const panelTpl = this.panelTpl();
    if (!originEl || !panelTpl) return;

    if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({
        hasBackdrop: true,
        backdropClass: 'cdk-overlay-transparent-backdrop',
        positionStrategy: this.overlay
          .position()
          .flexibleConnectedTo(originEl)
          .withPositions(POSITIONS)
          .withPush(false),
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
      });
      this.overlayRef.backdropClick().subscribe(() => this.close());
      this.overlayRef.keydownEvents().subscribe((ev) => {
        if (ev.key === 'Escape') this.close();
      });
    }
    this.overlayRef.attach(new TemplatePortal(panelTpl, this.vcr));
    this.open.set(true);
  }
}
