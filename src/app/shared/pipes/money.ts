import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private fmt = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

  transform(value: number | null | undefined): string {
    return value == null ? '—' : this.fmt.format(value);
  }
}
