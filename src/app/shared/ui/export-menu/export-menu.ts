import {
  Component,
  ElementRef,
  HostListener,
  TemplateRef,
  ViewContainerRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Overlay, OverlayRef, ConnectedPosition } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { UiButton } from '../button/button';
import { ExportFormat } from '../../utils/export/export.models';

const POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Botón "Exportar ▾" con Excel (.xlsx) y CSV — doc 43, secciones 2.1 y
 * 8.10. Presentacional: no inyecta servicios ni sabe de `TableExporter`,
 * solo emite el formato elegido.
 */
@Component({
  selector: 'ui-export-menu',
  imports: [UiButton, CdkTrapFocus],
  template: `
    <button
      type="button"
      uiButton
      variant="secondary"
      size="sm"
      #trigger
      [disabled]="disabled() || busy()"
      [title]="disabled() && !busy() ? 'No hay datos para exportar' : ''"
      [loading]="busy()"
      (click)="toggle()"
    >
      @if (!busy()) {
        <span class="material-icons" aria-hidden="true">file_download</span>
        Exportar
        <span class="uem-caret">▾</span>
      } @else {
        {{ progressText() || 'Exportando…' }}
      }
    </button>

    <ng-template #panel>
      <div class="uem-panel" cdkTrapFocus cdkTrapFocusAutoCapture>
        <button type="button" (click)="pick('xlsx')">Excel (.xlsx)</button>
        <button type="button" (click)="pick('csv')">CSV</button>
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      .uem-caret {
        font-size: 10px;
        margin-left: 2px;
      }
      .uem-panel {
        display: flex;
        flex-direction: column;
        min-width: 160px;
        background: var(--bg);
        border: 1px solid var(--divider);
        box-shadow: var(--elev-menu);
        padding: 4px;
      }
      .uem-panel button {
        appearance: none;
        border: 0;
        background: transparent;
        text-align: left;
        font-family: var(--font-sans);
        font-size: var(--fs-dense);
        color: var(--ink);
        padding: var(--sp-2) var(--sp-3);
        min-height: var(--touch-min);
        cursor: pointer;
        width: 100%;
      }
      .uem-panel button:hover {
        background: var(--faint);
      }
    `,
  ],
})
export class UiExportMenu {
  disabled = input(false);
  busy = input(false);
  progressText = input('');
  exportFormat = output<ExportFormat>({ alias: 'export' });

  private trigger = viewChild('trigger', { read: ElementRef<HTMLElement> });
  private panelTpl = viewChild<TemplateRef<unknown>>('panel');
  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);
  private overlayRef: OverlayRef | null = null;
  protected open = signal(false);

  protected toggle() {
    this.open() ? this.close() : this.openMenu();
  }

  protected pick(format: ExportFormat) {
    this.close();
    this.exportFormat.emit(format);
  }

  private close() {
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

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.close();
  }
}
