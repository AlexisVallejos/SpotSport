import { describe, expect, it } from 'vitest';
import { campaignLabel, couponUrl, hasPlaceholder, normalizePrefix, timeLeft, validateCoupon, type CouponInput } from './coupons';

const base: CouponInput = {
  title: 'Bienvenida',
  description: '',
  discount_label: '20% OFF',
  code_prefix: 'SPOT20',
  destination_url: 'https://tienda.test/?cupon={codigo}',
  valid_hours: 24,
  starts_at: '2026-10-15T10:00:00.000Z',
  ends_at: null,
  max_claims: null,
};

describe('couponUrl', () => {
  it('reemplaza el código en el link', () => {
    expect(couponUrl('https://tienda.test/?cupon={codigo}', 'SPOT20-A1B2C3')).toBe('https://tienda.test/?cupon=SPOT20-A1B2C3');
  });
  it('lo reemplaza en todos los lugares y lo codifica', () => {
    expect(couponUrl('https://t.test/{codigo}?c={codigo}', 'A B')).toBe('https://t.test/A%20B?c=A%20B');
  });
  it('sin {codigo} deja el link como está', () => {
    expect(couponUrl('https://tienda.test/oferta', 'X')).toBe('https://tienda.test/oferta');
    expect(hasPlaceholder('https://tienda.test/oferta')).toBe(false);
    expect(hasPlaceholder('https://tienda.test/?c={codigo}')).toBe(true);
  });
});

describe('normalizePrefix', () => {
  it('deja mayúsculas y números, hasta 12', () => {
    expect(normalizePrefix('spot-20 off!')).toBe('SPOT20OFF');
    expect(normalizePrefix('abcdefghijklmnop')).toHaveLength(12);
  });
});

describe('timeLeft', () => {
  const now = Date.parse('2026-10-15T12:00:00.000Z');
  const at = (ms: number) => new Date(now + ms).toISOString();
  it('días y horas', () => expect(timeLeft(at(2 * 86_400_000 + 3 * 3_600_000), now).label).toBe('Quedan 2 d 3 h'));
  it('horas y minutos', () => expect(timeLeft(at(5 * 3_600_000 + 7 * 60_000), now).label).toBe('Quedan 5 h 07 min'));
  it('minutos y segundos', () => expect(timeLeft(at(12 * 60_000 + 30_000), now).label).toBe('Quedan 12 min 30 s'));
  it('vencido', () => {
    expect(timeLeft(at(0), now)).toEqual({ expired: true, ms: 0, label: 'Venció' });
    expect(timeLeft(at(-5000), now).expired).toBe(true);
    expect(timeLeft('no-es-fecha', now).expired).toBe(true);
  });
});

describe('validateCoupon', () => {
  it('acepta un cupón correcto', () => expect(validateCoupon(base)).toBeNull());
  it('pide título, descuento y código', () => {
    expect(validateCoupon({ ...base, title: 'ab' })).toMatch(/título/);
    expect(validateCoupon({ ...base, discount_label: ' ' })).toMatch(/descuento/);
    expect(validateCoupon({ ...base, code_prefix: 'a' })).toMatch(/código base/);
  });
  it('el link tiene que ser https', () => {
    expect(validateCoupon({ ...base, destination_url: 'http://tienda.test/{codigo}' })).toMatch(/https/);
    expect(validateCoupon({ ...base, destination_url: 'tienda' })).toMatch(/no es válido/);
  });
  it('controla fechas y límite', () => {
    expect(validateCoupon({ ...base, ends_at: '2026-10-14T10:00:00.000Z' })).toMatch(/después de empezar/);
    expect(validateCoupon({ ...base, max_claims: 0 })).toMatch(/mayor a 0/);
    expect(validateCoupon({ ...base, valid_hours: 0 })).toMatch(/cuánto dura/);
  });
});

describe('campaignLabel', () => {
  it('muestra fin y cupos que quedan', () => {
    expect(campaignLabel({ ends_at: null, max_claims: null, claims_count: 0 })).toBe('');
    expect(campaignLabel({ ends_at: null, max_claims: 10, claims_count: 4 })).toBe('quedan 6');
  });
});

import { barRatio, commissionFor, compactLeft, dayLabel, formatPercent, percentOf } from './coupons';

describe('estadísticas', () => {
  it('percentOf', () => {
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 0)).toBe(0);
  });
  it('formatPercent', () => {
    expect(formatPercent(5)).toBe('5 %');
    expect(formatPercent(8.5)).toBe('8,5 %');
  });
  it('commissionFor coincide con la base', () => {
    expect(commissionFor(2_500_000, 5)).toBe(125_000);
    expect(commissionFor(1_000_001, 8.5)).toBe(85_000);
    expect(commissionFor(0, 5)).toBe(0);
  });
  it('dayLabel', () => expect(dayLabel('2026-10-05')).toBe('5/10'));
  it('barRatio', () => {
    expect(barRatio(0, 10)).toBe(0);
    expect(barRatio(10, 10)).toBe(1);
    expect(barRatio(1, 1000)).toBe(0.04);
    expect(barRatio(5, 0)).toBe(0);
  });
});

describe('compactLeft', () => {
  it('usa la unidad más grande', () => {
    expect(compactLeft(2 * 86_400_000 + 5000)).toBe('2d');
    expect(compactLeft(5 * 3_600_000)).toBe('5h');
    expect(compactLeft(12 * 60_000 + 30_000)).toBe('12m');
    expect(compactLeft(45_000)).toBe('45s');
    expect(compactLeft(-1)).toBe('0s');
  });
});
