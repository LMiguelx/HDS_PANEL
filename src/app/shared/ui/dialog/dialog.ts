import { Component, Injectable, InjectionToken, Injector, Type, inject } from '@angular/core';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Observable, Subject, map } from 'rxjs';
import { UiButton } from '../button/button';

export const UI_DIALOG_DATA = new InjectionToken<unknown>('UI_DIALOG_DATA');

export interface UiDialogConfig<D = unknown> {
  data?: D;
  width?: string;
  disableClose?: boolean;
}

/**
 * Referencia a un diálogo abierto. Foco atrapado con cdkTrapFocus, Esc
 * cierra (salvo `disableClose`).
 */
export class UiDialogRef<R = unknown> {
  private closed$ = new Subject<R | undefined>();

  constructor(private overlayRef: import('@angular/cdk/overlay').OverlayRef) {}

  afterClosed(): Observable<R | undefined> {
    return this.closed$.asObservable();
  }

  close(result?: R) {
    this.closed$.next(result);
    this.closed$.complete();
    this.overlayRef.dispose();
  }
}

@Injectable({ providedIn: 'root' })
export class UiDialogService {
  private overlay = inject(Overlay);
  private injector = inject(Injector);

  /** Abre un componente arbitrario dentro de la capa flotante del diálogo. */
  open<T, D = unknown, R = unknown>(component: Type<T>, config: UiDialogConfig<D> = {}): UiDialogRef<R> {
    const overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'ui-dialog-backdrop',
      panelClass: 'ui-dialog-panel',
      width: config.width ?? '480px',
      maxWidth: '92vw',
      maxHeight: '90vh',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });

    const dialogRef = new UiDialogRef<R>(overlayRef);

    const dialogInjector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: UI_DIALOG_DATA, useValue: config.data },
        { provide: UiDialogRef, useValue: dialogRef },
      ],
    });

    overlayRef.attach(new ComponentPortal(component, null, dialogInjector));

    if (!config.disableClose) {
      overlayRef.backdropClick().subscribe(() => dialogRef.close());
      overlayRef.keydownEvents().subscribe((ev) => {
        if (ev.key === 'Escape') dialogRef.close();
      });
    }

    return dialogRef;
  }

  /** Atajo para el caso más común: confirmación / acción destructiva. */
  confirm(opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }): Observable<boolean> {
    return this.open<UiConfirmDialog, typeof opts, boolean>(UiConfirmDialog, {
      data: opts,
      width: '420px',
    })
      .afterClosed()
      .pipe(map((r) => !!r));
  }
}

@Component({
  selector: 'ui-confirm-dialog',
  imports: [UiButton, CdkTrapFocus],
  template: `
    <div cdkTrapFocus cdkTrapFocusAutoCapture="true">
      <h2 class="ui-dialog-title">{{ data.title }}</h2>
      <p class="ui-dialog-message">{{ data.message }}</p>
      <div class="ui-dialog-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">
          {{ data.cancelLabel || 'Cancelar' }}
        </button>
        <button uiButton variant="primary" (click)="ref.close(true)">
          {{ data.confirmLabel || 'Confirmar' }}
        </button>
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .ui-dialog-title {
        font-size: 20px;
        margin: 0 0 10px;
        color: var(--ink);
      }
      .ui-dialog-message {
        font-size: 14px;
        color: var(--ink-muted);
        line-height: 1.5;
        margin: 0 0 22px;
      }
      .ui-dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class UiConfirmDialog {
  data = inject<{ title: string; message: string; confirmLabel?: string; cancelLabel?: string }>(
    UI_DIALOG_DATA,
  );
  ref = inject(UiDialogRef<boolean>);
}
