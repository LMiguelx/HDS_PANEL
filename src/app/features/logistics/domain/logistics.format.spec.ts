import { describe, expect, it } from 'vitest';
import {
  batchesNotReadyLevel,
  erpStockDetailText,
  erpStockLevel,
  erpStockTimeText,
  negativeProductsLevel,
  receiptsInReviewLevel,
  receiptsNotTakenLevel,
  relativeTimeText,
  shortDateTimeText,
} from './logistics.format';

describe('relativeTimeText', () => {
  it('formatea minutos, horas y días', () => {
    const now = Date.now();
    expect(relativeTimeText(new Date(now - 5 * 60_000).toISOString())).toBe('hace 5 min');
    expect(relativeTimeText(new Date(now - 3 * 3_600_000).toISOString())).toBe('hace 3 h');
    expect(relativeTimeText(new Date(now - 2 * 86_400_000).toISOString())).toBe('hace 2 días');
  });

  it('devuelve — con null', () => {
    expect(relativeTimeText(null)).toBe('—');
    expect(relativeTimeText(undefined)).toBe('—');
  });
});

describe('shortDateTimeText', () => {
  it('devuelve — con null', () => {
    expect(shortDateTimeText(null)).toBe('—');
  });

  it('formatea dd/MM HH:mm del año actual', () => {
    const d = new Date();
    d.setMonth(0, 1);
    d.setHours(8, 5, 0, 0);
    expect(shortDateTimeText(d.toISOString())).toMatch(/^01\/01 \d{2}:\d{2}$/);
  });
});

describe('niveles de aviso', () => {
  it('batchesNotReadyLevel', () => {
    expect(batchesNotReadyLevel(null)).toBeNull();
    expect(batchesNotReadyLevel(0)).toBe('ok');
    expect(batchesNotReadyLevel(3)).toBe('warn');
  });

  it('negativeProductsLevel', () => {
    expect(negativeProductsLevel(null)).toBeNull();
    expect(negativeProductsLevel(0)).toBe('ok');
    expect(negativeProductsLevel(1)).toBe('danger');
  });

  it('receiptsInReviewLevel', () => {
    expect(receiptsInReviewLevel(null)).toBeNull();
    expect(receiptsInReviewLevel({ count: 0, oldestAt: null })).toBe('ok');
    expect(receiptsInReviewLevel({ count: 2, oldestAt: new Date().toISOString() })).toBe('warn');
    const old = new Date(Date.now() - 30 * 3_600_000).toISOString();
    expect(receiptsInReviewLevel({ count: 2, oldestAt: old })).toBe('danger');
  });

  it('receiptsNotTakenLevel', () => {
    expect(receiptsNotTakenLevel(null)).toBeNull();
    expect(receiptsNotTakenLevel({ count: 0, oldestAt: null })).toBe('ok');
    expect(receiptsNotTakenLevel({ count: 2, oldestAt: new Date().toISOString() })).toBe('info');
    const old = new Date(Date.now() - 30 * 3_600_000).toISOString();
    expect(receiptsNotTakenLevel({ count: 2, oldestAt: old })).toBe('warn');
  });

  it('erpStockLevel', () => {
    expect(erpStockLevel(null)).toBeNull();
    expect(
      erpStockLevel({
        lastUploadAt: null,
        minutesSinceLastUpload: null,
        pendingUploads: 0,
        failedProducts: 0,
        lastResyncAt: null,
      }),
    ).toBe('muted');
    expect(
      erpStockLevel({
        lastUploadAt: new Date().toISOString(),
        minutesSinceLastUpload: 10,
        pendingUploads: 0,
        failedProducts: 0,
        lastResyncAt: null,
      }),
    ).toBe('ok');
    expect(
      erpStockLevel({
        lastUploadAt: new Date().toISOString(),
        minutesSinceLastUpload: 10,
        pendingUploads: 5,
        failedProducts: 0,
        lastResyncAt: null,
      }),
    ).toBe('warn');
    expect(
      erpStockLevel({
        lastUploadAt: new Date().toISOString(),
        minutesSinceLastUpload: 10,
        pendingUploads: 0,
        failedProducts: 2,
        lastResyncAt: null,
      }),
    ).toBe('danger');
    expect(
      erpStockLevel({
        lastUploadAt: new Date().toISOString(),
        minutesSinceLastUpload: 25 * 60,
        pendingUploads: 0,
        failedProducts: 0,
        lastResyncAt: null,
      }),
    ).toBe('danger');
  });

  it('erpStockTimeText y erpStockDetailText', () => {
    expect(erpStockTimeText(null)).toBe('Sin subidas');
    const a = {
      lastUploadAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      minutesSinceLastUpload: 180,
      pendingUploads: 0,
      failedProducts: 0,
      lastResyncAt: null,
    };
    expect(erpStockTimeText(a)).toBe('hace 3 h');
    expect(erpStockDetailText(a)).toBe('Al día');
    expect(erpStockDetailText({ ...a, pendingUploads: 4 })).toBe('4 por procesar');
    expect(erpStockDetailText({ ...a, failedProducts: 2, pendingUploads: 4 })).toBe(
      '2 con cuadre fallido',
    );
  });
});
