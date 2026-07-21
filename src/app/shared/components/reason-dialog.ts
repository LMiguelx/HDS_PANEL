import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ReasonData {
  title: string;
  label?: string;
  confirmText?: string;
}

/** Diálogo que pide un motivo. Devuelve el texto (trim) o undefined si se cancela. */
@Component({
  selector: 'app-reason-dialog',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full">
        <mat-label>{{ data.label ?? 'Motivo' }}</mat-label>
        <textarea
          matInput
          rows="3"
          [value]="reason()"
          (input)="reason.set($any($event.target).value)"
        ></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button
        mat-flat-button
        color="warn"
        [disabled]="!reason().trim()"
        [mat-dialog-close]="reason().trim()"
      >
        {{ data.confirmText ?? 'Rechazar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full {
        width: 100%;
      }
      mat-dialog-content {
        padding-top: 8px;
      }
    `,
  ],
})
export class ReasonDialog {
  readonly data = inject<ReasonData>(MAT_DIALOG_DATA);
  readonly reason = signal('');
}
