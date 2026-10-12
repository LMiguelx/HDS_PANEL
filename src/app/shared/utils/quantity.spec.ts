import { isWholeQuantity, round2, toWholeQuantity } from './quantity';

describe('round2', () => {
  it('redondea a 2 decimales', () => {
    expect(round2(2.456)).toBe(2.46);
  });

  it('deja igual un entero y el cero', () => {
    expect(round2(3)).toBe(3);
    expect(round2(0)).toBe(0);
  });
});

describe('isWholeQuantity', () => {
  it('acepta enteros, aunque vengan con ceros decimales', () => {
    expect(isWholeQuantity(3)).toBe(true);
    expect(isWholeQuantity(12.0)).toBe(true);
    expect(isWholeQuantity(0)).toBe(true);
  });

  it('rechaza fracciones', () => {
    expect(isWholeQuantity(2.5)).toBe(false);
    expect(isWholeQuantity(0.01)).toBe(false);
  });

  it('rechaza valores que no son números finitos', () => {
    expect(isWholeQuantity(Number.NaN)).toBe(false);
    expect(isWholeQuantity(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('toWholeQuantity', () => {
  it('deja igual un entero dentro del rango', () => {
    expect(toWholeQuantity(3)).toBe(3);
    expect(toWholeQuantity(3, 1, 10)).toBe(3);
  });

  it('redondea una fracción al entero más cercano', () => {
    expect(toWholeQuantity(2.4)).toBe(2);
    expect(toWholeQuantity(2.5)).toBe(3);
  });

  it('respeta el mínimo', () => {
    expect(toWholeQuantity(0, 1)).toBe(1);
    expect(toWholeQuantity(-5)).toBe(0);
  });

  it('respeta el máximo', () => {
    expect(toWholeQuantity(10, 0, 6)).toBe(6);
  });

  it('devuelve null si no es un número finito', () => {
    expect(toWholeQuantity(Number.NaN)).toBeNull();
    expect(toWholeQuantity(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
