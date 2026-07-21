import { Pipe, PipeTransform } from '@angular/core';

const FMT = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

export function formatSoles(value: number | null | undefined): string {
  return value == null ? '—' : FMT.format(value);
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private fmt = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

  transform(value: number | null | undefined): string {
    return value == null ? '—' : this.fmt.format(value);
  }
}
