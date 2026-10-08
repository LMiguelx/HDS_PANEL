import {
  Component,
  ElementRef,
  TemplateRef,
  ViewContainerRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Overlay, OverlayRef, ConnectedPosition } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

/** Forma mínima de un resultado de búsqueda (coincide con LookupItem del backend). */
export interface UiLookupItem {
  id: number;
  code?: string | null;
  name: string;
  extraInfo?: string | null;
  recent?: boolean | null;
}

const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

let nextId = 0;

/**
 * Buscador por nombre (nunca por código). Busca escribiendo, muestra
 * resultados en una capa flotante (CDK Overlay). `clearOnPick` sirve para los
 * casos donde elegir agrega a una lista externa y el campo vuelve a quedar
 * listo para buscar de nuevo (condiciones, audiencia); si es falso el campo
 * conserva el valor elegido (vendedor, producto, cliente del simulador).
 */
@Component({
  selector: 'ui-typeahead',
  template: `
    <div class="ui-field">
      <label [for]="id">{{ label() }}</label>
      <div class="ui-ta-wrap" #origin>
        @if (icon()) {
          <span class="material-icons ui-ta-icon" aria-hidden="true">{{ icon() }}</span>
        }
        <input
          [id]="id"
          class="ui-input"
          [class.ui-input-icon]="!!icon()"
          type="text"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [value]="query()"
          [attr.aria-invalid]="!!error()"
          autocomplete="off"
          (input)="onInput($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
          (keydown.escape)="close()"
        />
        @if (selected() && !clearOnPick()) {
          <button
            type="button"
            class="ui-ta-clear"
            aria-label="Quitar selección"
            (mousedown)="$event.preventDefault()"
            (click)="clearSelection()"
          >
            ✕
          </button>
        }
      </div>
      @if (error()) {
        <div class="ui-field-hint ui-field-error-text">{{ error() }}</div>
      } @else if (hint()) {
        <div class="ui-field-hint">{{ hint() }}</div>
      }
    </div>

    <ng-template #panel>
      <div class="ui-ta-panel" [style.width.px]="panelWidth()">
        @if (loading()) {
          <div class="ui-ta-msg">Buscando…</div>
        } @else if (networkError()) {
          <div class="ui-ta-msg ui-ta-error">No pudimos buscar. Intenta de nuevo.</div>
        } @else if (results().length === 0) {
          <div class="ui-ta-msg">No encontramos ese nombre.</div>
        } @else {
          @for (item of results(); track item.id) {
            <button
              type="button"
              class="ui-ta-option"
              (mousedown)="$event.preventDefault()"
              (click)="pick(item)"
            >
              <span class="ui-ta-option-name">{{ item.name }}</span>
              @if (item.extraInfo) {
                <span class="ui-ta-option-extra">{{ item.extraInfo }}</span>
              }
            </button>
          }
        }
      </div>
    </ng-template>
  `,
  styles: [
    `
      .ui-field {
        display: grid;
        gap: 6px;
        min-width: 0;
      }
      label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .ui-ta-wrap {
        position: relative;
      }
      .ui-ta-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 20px;
        color: var(--ink-muted);
        pointer-events: none;
      }
      .ui-input-icon {
        padding-left: 40px;
      }
      .ui-input {
        font-family: var(--font-sans);
        font-size: 15px;
        color: var(--ink);
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        border-radius: var(--radius-control, 0);
        min-height: var(--touch-min);
        padding: 0 40px 0 12px;
        width: 100%;
        box-sizing: border-box;
      }
      .ui-input:hover:not(:disabled) {
        border-color: var(--ink-muted);
      }
      .ui-input:focus-visible {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 1px var(--accent);
      }
      .ui-input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .ui-ta-clear {
        position: absolute;
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
        width: 36px;
        height: 36px;
        border: 0;
        background: transparent;
        cursor: pointer;
        color: var(--ink-muted);
      }
      .ui-ta-clear:hover {
        color: var(--ink);
      }
      .ui-field-hint {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .ui-field-error-text {
        color: var(--accent-ink);
      }

      .ui-ta-panel {
        background: var(--bg);
        border: 1px solid var(--divider);
        box-shadow: var(--elev-menu);
        max-height: 280px;
        overflow-y: auto;
      }
      .ui-ta-msg {
        padding: 14px 16px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ui-ta-error {
        color: var(--accent-ink);
      }
      .ui-ta-option {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        width: 100%;
        text-align: left;
        padding: 10px 16px;
        min-height: var(--touch-min);
        justify-content: center;
        border: 0;
        background: transparent;
        cursor: pointer;
        font-family: var(--font-sans);
        color: var(--ink);
      }
      .ui-ta-option:hover,
      .ui-ta-option:focus-visible {
        background: var(--faint);
        outline: none;
      }
      .ui-ta-option-name {
        font-weight: 600;
        font-size: 14px;
      }
      .ui-ta-option-extra {
        font-size: 12px;
        color: var(--ink-muted);
      }
    `,
  ],
})
export class UiTypeahead {
  label = input.required<string>();
  placeholder = input('Escribe el nombre');
  /** Ícono (ligadura de Material Icons) a la izquierda del input. Opcional. */
  icon = input('');
  hint = input('');
  error = input('');
  disabled = input(false);
  clearOnPick = input(false);
  search = input.required<(query: string) => import('rxjs').Observable<UiLookupItem[]>>();

  selected = model<UiLookupItem | null>(null);
  picked = output<UiLookupItem>();

  protected id = `ui-ta-${nextId++}`;
  protected query = signal('');
  protected results = signal<UiLookupItem[]>([]);
  protected loading = signal(false);
  protected networkError = signal(false);
  protected panelWidth = signal(280);

  private origin = viewChild<ElementRef<HTMLElement>>('origin');
  private panelTpl = viewChild<TemplateRef<unknown>>('panel');
  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);
  private overlayRef: OverlayRef | null = null;
  private input$ = new Subject<string>();

  constructor() {
    this.input$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q.trim()) {
            this.loading.set(false);
            return of<UiLookupItem[]>([]);
          }
          this.loading.set(true);
          this.networkError.set(false);
          return this.search()(q).pipe(
            catchError(() => {
              this.networkError.set(true);
              return of<UiLookupItem[]>([]);
            }),
          );
        }),
      )
      .subscribe((items) => {
        this.loading.set(false);
        this.results.set(items);
        if (this.overlayRef?.hasAttached()) {
          this.overlayRef.updatePosition();
        } else {
          this.openPanel();
        }
      });
  }

  protected onInput(ev: Event) {
    const value = (ev.target as HTMLInputElement).value;
    this.query.set(value);
    if (this.selected() && !this.clearOnPick()) this.selected.set(null);
    this.input$.next(value);
    if (!value.trim()) {
      this.results.set([]);
      this.close();
    }
  }

  protected onFocus() {
    if (this.results().length > 0) this.openPanel();
  }

  protected onBlur() {
    // Se cierra con un pequeño retardo para permitir el click en una opción
    // (el mousedown de cada opción ya evita que el input pierda el valor).
    setTimeout(() => this.close(), 120);
  }

  protected pick(item: UiLookupItem) {
    this.selected.set(item);
    this.picked.emit(item);
    this.query.set(this.clearOnPick() ? '' : item.name);
    this.results.set([]);
    this.close();
  }

  protected clearSelection() {
    this.selected.set(null);
    this.query.set('');
    this.results.set([]);
  }

  protected close() {
    this.overlayRef?.detach();
  }

  private openPanel() {
    const originEl = this.origin();
    const panelTpl = this.panelTpl();
    if (!originEl || !panelTpl) return;

    this.panelWidth.set(originEl.nativeElement.getBoundingClientRect().width);

    if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({
        positionStrategy: this.overlay
          .position()
          .flexibleConnectedTo(originEl)
          .withPositions(POSITIONS)
          .withFlexibleDimensions(false)
          .withPush(false),
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
        width: originEl.nativeElement.getBoundingClientRect().width,
      });
    }
    if (!this.overlayRef.hasAttached()) {
      this.overlayRef.attach(new TemplatePortal(panelTpl, this.vcr));
    }
  }
}
