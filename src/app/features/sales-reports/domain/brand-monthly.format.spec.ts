import { describe, expect, it } from 'vitest';
import {
  formatSolesInt,
  monthShortName,
  peakText,
  peakUnitsText,
  variationPctText,
  variationTone,
} from './brand-monthly.format';

describe('monthShortName', () => {
  it('devuelve el mes corto', () => {
    expect(monthShortName(1)).toBe('Ene');
    expect(monthShortName(12)).toBe('Dic');
  });

  it('devuelve — con null o fuera de rango', () => {
    expect(monthShortName(null)).toBe('—');
    expect(monthShortName(0)).toBe('—');
    expect(monthShortName(13)).toBe('—');
  });
});

describe('variationPctText', () => {
  it('calcula el signo y el porcentaje', () => {
    expect(variationPctText(120, 100)).toBe('+20.0 %');
    expect(variationPctText(80, 100)).toBe('−20.0 %');
    expect(variationPctText(100, 100)).toBe('0.0 %');
  });

  it('devuelve — sin base o sin información', () => {
    expect(variationPctText(100, null)).toBe('—');
    expect(variationPctText(100, 0)).toBe('—');
  });
});

describe('variationTone', () => {
  it('clasifica subida, bajada y neutral', () => {
    expect(variationTone(120, 100)).toBe('pos');
    expect(variationTone(80, 100)).toBe('neg');
    expect(variationTone(100, 100)).toBe('neutral');
    expect(variationTone(100, null)).toBe('neutral');
  });
});

describe('peakText / peakUnitsText', () => {
  it('formatea el mes pico', () => {
    expect(peakText(3, 182400)).toMatch(/^Mar · S\/\s?182,400\.00$/);
    expect(peakText(null, 100)).toBe('—');
    expect(peakUnitsText(3, 420)).toBe('Mar · 420 u.');
    expect(peakUnitsText(3, null)).toBe('—');
  });
});

describe('formatSolesInt', () => {
  it('agrupa miles sin decimales ni símbolo', () => {
    expect(formatSolesInt(509382)).toBe('509,382');
    expect(formatSolesInt(0)).toBe('0');
  });

  it('devuelve — con null', () => {
    expect(formatSolesInt(null)).toBe('—');
    expect(formatSolesInt(undefined)).toBe('—');
  });
});
