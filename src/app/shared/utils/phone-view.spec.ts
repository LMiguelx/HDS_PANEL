import { isValidPhoneFormat, normalizePhoneForCompare, phoneView } from './phone-view';

describe('phoneView', () => {
  it('9 dígitos (celular): agrupado, sin badge', () => {
    expect(phoneView('959330176')).toEqual({ text: '959 330 176', needsReview: false });
  });

  it('9 dígitos empezando en 0: igual, agrupado sin badge', () => {
    expect(phoneView('054455310')).toEqual({ text: '054 455 310', needsReview: false });
  });

  it('con + y dígitos: tal cual, sin badge', () => {
    expect(phoneView('+51959330176')).toEqual({ text: '+51959330176', needsReview: false });
  });

  it('"true": texto crudo con badge', () => {
    expect(phoneView('true')).toEqual({ text: 'true', needsReview: true });
  });

  it('"NO": texto crudo con badge', () => {
    expect(phoneView('NO')).toEqual({ text: 'NO', needsReview: true });
  });

  it('con punto final: texto crudo con badge', () => {
    expect(phoneView('973 597 537.')).toEqual({ text: '973 597 537.', needsReview: true });
  });

  it('con salto de línea: se reemplaza por espacio, con badge', () => {
    expect(phoneView('973 100 084\r\n')).toEqual({ text: '973 100 084', needsReview: true });
  });

  it('null: "—" con badge', () => {
    expect(phoneView(null)).toEqual({ text: '—', needsReview: true });
  });

  it('vacío: "—" con badge', () => {
    expect(phoneView('')).toEqual({ text: '—', needsReview: true });
  });

  it('undefined: "—" con badge', () => {
    expect(phoneView(undefined)).toEqual({ text: '—', needsReview: true });
  });
});

describe('normalizePhoneForCompare', () => {
  it('quita espacios, puntos, guiones y paréntesis', () => {
    expect(normalizePhoneForCompare('959 330-176.')).toBe('959330176');
    expect(normalizePhoneForCompare('(959) 330 176')).toBe('959330176');
  });

  it('conserva el + inicial', () => {
    expect(normalizePhoneForCompare('+51 959 330 176')).toBe('+51959330176');
  });
});

describe('isValidPhoneFormat', () => {
  it('válido: 6 a 15 dígitos, con o sin +', () => {
    expect(isValidPhoneFormat('959330176')).toBe(true);
    expect(isValidPhoneFormat('959 330-176')).toBe(true);
    expect(isValidPhoneFormat('+51959330176')).toBe(true);
  });

  it('inválido: texto, muy corto o vacío', () => {
    expect(isValidPhoneFormat('NO TIENE')).toBe(false);
    expect(isValidPhoneFormat('123')).toBe(false);
    expect(isValidPhoneFormat('959/330176')).toBe(false);
    expect(isValidPhoneFormat('')).toBe(false);
  });
});
