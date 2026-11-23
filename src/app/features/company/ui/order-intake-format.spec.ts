import { closureStatusKey, lastChangeText, shortDateTimeText } from './order-intake-format';
import { ClosureView } from '../../../shared/models/order-intake.models';

function closure(overrides: Partial<ClosureView> = {}): ClosureView {
  return {
    closureId: 1,
    startsAt: '2026-11-21T16:40:00',
    endsAt: '2026-11-23T02:00:00',
    reason: null,
    statusCode: 'FINISHED',
    statusName: 'Terminado',
    changeable: false,
    createdBy: 1,
    createdByName: 'Jose Luis Pacco Jachuco',
    createdAt: '2026-11-21T16:30:00',
    updatedBy: null,
    updatedByName: null,
    updatedAt: null,
    endedBy: null,
    endedByName: null,
    endedAt: null,
    ...overrides,
  };
}

describe('closureStatusKey', () => {
  it('SCHEDULED → azul informativo', () => {
    expect(closureStatusKey('SCHEDULED')).toBe('programada');
  });
  it('ACTIVE → ámbar', () => {
    expect(closureStatusKey('ACTIVE')).toBe('en ruta');
  });
  it('FINISHED → neutro', () => {
    expect(closureStatusKey('FINISHED')).toBe('cerrado');
  });
  it('REOPENED → ámbar (--status-warn), igual que ACTIVE', () => {
    expect(closureStatusKey('REOPENED')).toBe(closureStatusKey('ACTIVE'));
  });
  it('CANCELLED → rojo', () => {
    expect(closureStatusKey('CANCELLED')).toBe('rechazado');
  });
});

describe('shortDateTimeText', () => {
  it('formatea con día de la semana abreviado', () => {
    expect(shortDateTimeText('2026-11-21T16:40:00')).toBe('sáb 21/11 16:40');
  });
});

describe('lastChangeText', () => {
  it('sin cambios: —', () => {
    expect(lastChangeText(closure())).toBe('—');
  });

  it('reabierto antes de tiempo', () => {
    const c = closure({
      statusCode: 'REOPENED',
      endedAt: '2026-11-22T10:00:00',
      endedByName: 'Ana Torres',
    });
    expect(lastChangeText(c)).toBe('Reabierto por Ana Torres el dom 22/11 10:00');
  });

  it('anulado', () => {
    const c = closure({
      statusCode: 'CANCELLED',
      endedAt: '2026-11-22T10:00:00',
      endedByName: 'Ana Torres',
    });
    expect(lastChangeText(c)).toBe('Anulado por Ana Torres el dom 22/11 10:00');
  });

  it('extendido (cambio de fin, sin reabrir/anular)', () => {
    const c = closure({ updatedAt: '2026-11-22T09:00:00', updatedByName: 'Luis Quispe' });
    expect(lastChangeText(c)).toBe('Extendido por Luis Quispe el dom 22/11 09:00');
  });
});
