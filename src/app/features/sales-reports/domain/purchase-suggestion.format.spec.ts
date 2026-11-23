import {
  coveragePct,
  erpStockMissingText,
  isErpStockStale,
  purchaseFormulaText,
  stockLevel,
  suggestedMainText,
  suggestedSubText,
  trendText,
} from './purchase-suggestion.format';

describe('stockLevel', () => {
  const targetDays = 15;

  it('NO_MOVEMENT cuando no hay consumo, aunque falte stock', () => {
    expect(stockLevel({ consumptionPerDay: 0, erpStock: 0, coverageDays: null }, targetDays)).toBe(
      'NO_MOVEMENT',
    );
  });

  it('CRITICAL con stock en cero', () => {
    expect(stockLevel({ consumptionPerDay: 10, erpStock: 0, coverageDays: 0 }, targetDays)).toBe(
      'CRITICAL',
    );
  });

  it('CRITICAL con cobertura por debajo de la mitad de los días a cubrir', () => {
    expect(stockLevel({ consumptionPerDay: 10, erpStock: 70, coverageDays: 7 }, targetDays)).toBe(
      'CRITICAL',
    );
  });

  it('borde: cobertura EXACTAMENTE la mitad no es crítica (ya es Pedir)', () => {
    expect(stockLevel({ consumptionPerDay: 10, erpStock: 75, coverageDays: 7.5 }, targetDays)).toBe(
      'ORDER',
    );
  });

  it('ORDER con cobertura por debajo de los días a cubrir', () => {
    expect(stockLevel({ consumptionPerDay: 10, erpStock: 120, coverageDays: 12 }, targetDays)).toBe(
      'ORDER',
    );
  });

  it('borde: cobertura EXACTAMENTE los días a cubrir ya no es Pedir (es OK)', () => {
    expect(stockLevel({ consumptionPerDay: 10, erpStock: 150, coverageDays: 15 }, targetDays)).toBe(
      'OK',
    );
  });

  it('OK entre los días a cubrir y 4 veces', () => {
    expect(stockLevel({ consumptionPerDay: 10, erpStock: 300, coverageDays: 30 }, targetDays)).toBe(
      'OK',
    );
  });

  it('borde: cobertura EXACTAMENTE 4 veces los días a cubrir todavía es OK', () => {
    expect(stockLevel({ consumptionPerDay: 10, erpStock: 600, coverageDays: 60 }, targetDays)).toBe(
      'OK',
    );
  });

  it('OVERSTOCK con cobertura por encima de 4 veces los días a cubrir', () => {
    expect(
      stockLevel({ consumptionPerDay: 10, erpStock: 1000, coverageDays: 100 }, targetDays),
    ).toBe('OVERSTOCK');
  });
});

describe('trendText', () => {
  it('"Nuevo" sin historia previa', () => {
    expect(trendText(null)).toBe('Nuevo');
  });

  it('flecha arriba en verde a partir de +10 %', () => {
    expect(trendText(18.1)).toBe('↑ +18.1 %');
  });

  it('flecha abajo a partir de -10 %', () => {
    expect(trendText(-15)).toBe('↓ -15.0 %');
  });

  it('flecha lateral entre -10 % y +10 %', () => {
    expect(trendText(2)).toBe('→ +2.0 %');
  });
});

describe('isErpStockStale', () => {
  const now = new Date('2026-11-23T12:00:00Z');

  it('false sin fecha (nunca subió)', () => {
    expect(isErpStockStale(null, now)).toBe(false);
  });

  it('false con menos de 24 horas', () => {
    expect(isErpStockStale('2026-11-23T10:00:00Z', now)).toBe(false);
  });

  it('true con más de 24 horas', () => {
    expect(isErpStockStale('2026-11-20T10:00:00Z', now)).toBe(true);
  });
});

describe('erpStockMissingText', () => {
  it('"Sin subida del ERP" cuando nunca subió', () => {
    expect(erpStockMissingText(null)).toBe('Sin subida del ERP');
  });

  it('vacío si sí hay fecha', () => {
    expect(erpStockMissingText('2026-11-23T10:00:00Z')).toBe('');
  });
});

describe('suggestedMainText / suggestedSubText', () => {
  it('"—" cuando no hay que pedir', () => {
    expect(suggestedMainText(0, null)).toBe('—');
    expect(suggestedSubText(0, null)).toBe('');
  });

  it('paquetes arriba, unidades abajo cuando maneja paquetes', () => {
    expect(suggestedMainText(600, 50)).toBe('50 paq');
    expect(suggestedSubText(600, 50)).toBe('600 und');
  });

  it('solo unidades cuando el producto no maneja paquetes', () => {
    expect(suggestedMainText(120, null)).toBe('120 und');
    expect(suggestedSubText(120, null)).toBe('');
  });
});

describe('coveragePct', () => {
  it('0 sin cobertura', () => {
    expect(coveragePct(null, 15)).toBe(0);
  });

  it('acotado a 100 cuando la cobertura excede los días a cubrir', () => {
    expect(coveragePct(60, 15)).toBe(100);
  });

  it('mínimo 4 para que la barra sea visible aunque la cobertura sea mínima', () => {
    expect(coveragePct(0.1, 15)).toBeGreaterThanOrEqual(4);
  });
});

describe('purchaseFormulaText', () => {
  it('ejemplo del doc 94: DOFFI LAVANDA 1 KG a 15 días', () => {
    const text = purchaseFormulaText(
      {
        consumptionPerDay: 49,
        erpStock: 140,
        suggestedUnits: 600,
        suggestedPackages: 50,
        unitsPerPackage: 12,
      },
      15,
    );
    expect(text).toBe('49.00 × 15 días − 140 = 595 → 50 paq de 12 = 600 und');
  });

  it('sin paquetes, solo unidades', () => {
    const text = purchaseFormulaText(
      {
        consumptionPerDay: 5,
        erpStock: 10,
        suggestedUnits: 40,
        suggestedPackages: null,
        unitsPerPackage: null,
      },
      15,
    );
    expect(text).toBe('5.00 × 15 días − 10 = 65 → 40 und');
  });

  it('no hace falta pedir', () => {
    const text = purchaseFormulaText(
      {
        consumptionPerDay: 5,
        erpStock: 200,
        suggestedUnits: 0,
        suggestedPackages: 0,
        unitsPerPackage: 12,
      },
      15,
    );
    expect(text).toBe('5.00 × 15 días − 200 = 0 → no hace falta pedir');
  });
});
