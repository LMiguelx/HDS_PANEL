import { excelDate, excelDateTime } from './excel-dates';

describe('excelDate', () => {
  it('null sin fecha', () => {
    expect(excelDate(null)).toBeNull();
    expect(excelDate(undefined)).toBeNull();
    expect(excelDate('')).toBeNull();
  });

  it('medianoche UTC para que Excel muestre 00:00, sin desfase de huso horario', () => {
    const d = excelDate('2026-11-20')!;
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(10);
    expect(d.getUTCDate()).toBe(20);
    expect(d.getUTCHours()).toBe(0);
  });

  it('acepta un ISO con hora y se queda solo con la fecha', () => {
    const d = excelDate('2026-11-20T07:57:00')!;
    expect(d.getUTCDate()).toBe(20);
    expect(d.getUTCHours()).toBe(0);
  });
});

describe('excelDateTime', () => {
  it('hora exacta, sin desfase de huso horario (caso del doc 95)', () => {
    const d = excelDateTime('2026-11-20', '07:57')!;
    expect(d.getUTCHours()).toBe(7);
    expect(d.getUTCMinutes()).toBe(57);
    expect(d.getUTCDate()).toBe(20);
  });

  it('toma la hora del propio ISO combinado si no se pasa `time`', () => {
    const d = excelDateTime('2026-11-20T09:06:00')!;
    expect(d.getUTCHours()).toBe(9);
    expect(d.getUTCMinutes()).toBe(6);
  });

  it('sin hora disponible, cae a excelDate (medianoche UTC)', () => {
    const d = excelDateTime('2026-11-20')!;
    expect(d.getUTCHours()).toBe(0);
  });

  it('con segundos en la hora', () => {
    const d = excelDateTime('2026-11-20', '07:57:30')!;
    expect(d.getUTCSeconds()).toBe(30);
  });
});
