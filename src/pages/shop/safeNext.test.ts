import { describe, expect, it } from 'vitest';
import { safeNext } from './Login';

describe('safeNext', () => {
  it('vuelve a rutas internas', () => {
    expect(safeNext('/checkout')).toBe('/checkout');
    expect(safeNext('/tienda?q=nike')).toBe('/tienda?q=nike');
  });

  it('nunca manda a otro sitio', () => {
    expect(safeNext('https://evil.com')).toBe('/cuenta');
    expect(safeNext('//evil.com')).toBe('/cuenta');
    expect(safeNext('/\\evil.com')).toBe('/cuenta');
    expect(safeNext('javascript:alert(1)')).toBe('/cuenta');
  });

  it('usa el destino por defecto si no hay', () => {
    expect(safeNext(null)).toBe('/cuenta');
    expect(safeNext('', '/')).toBe('/');
  });
});
