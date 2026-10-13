import { describe, expect, it } from 'vitest';
import { appearsAt, isShown, ownerAt, planJump, progressAt, resolvePending, SLOWDOWN } from './heroShoes';

// Los tiempos de los tests son los del video original; el publicado va ×SLOWDOWN.
const s = (seconds: number) => seconds * SLOWDOWN;

describe('línea de tiempo del video de portada', () => {
  it('sabe qué zapatilla está en cada momento', () => {
    expect(ownerAt(s(0.5))).toBe(0);
    expect(ownerAt(s(5))).toBe(1);
    expect(ownerAt(s(10))).toBe(2);
    expect(ownerAt(s(14))).toBe(0);
  });

  it('muestra el texto sólo con la zapatilla completa', () => {
    expect(isShown(0, s(0.5))).toBe(true);
    expect(isShown(0, s(14))).toBe(true);
    expect(isShown(1, s(2.8))).toBe(false);
    expect(isShown(1, s(5))).toBe(true);
    expect(isShown(2, s(12))).toBe(false);
  });

  it('cada zapatilla aparece desde la lava vacía de la anterior', () => {
    expect(appearsAt(0)).toBeCloseTo(s(12.4));
    expect(appearsAt(1)).toBeCloseTo(s(2.5));
    expect(appearsAt(2)).toBeCloseTo(s(7.4));
  });

  it('la barra de progreso va de 0 a 1 dentro de cada zapatilla', () => {
    for (const t of [0, 1, 2, 4, 6.8, 7, 11, 12, 14.9]) {
      expect(progressAt(s(t))).toBeGreaterThanOrEqual(0);
      expect(progressAt(s(t))).toBeLessThanOrEqual(1);
    }
  });
});

describe('cambio de zapatilla', () => {
  it('a la siguiente: deja que la actual se desintegre y el video sigue solo', () => {
    expect(planJump(s(0.5), 1)).toEqual({ seekTo: s(1.75), pending: null });
  });

  it('a otra que no es la siguiente: se desintegra y salta con la lava vacía', () => {
    const jump = planJump(s(0.5), 2)!;
    expect(jump).toEqual({ seekTo: s(1.75), pending: { from: 0, to: 2 } });
    expect(resolvePending(s(2.0), jump.pending!)).toBeNull();
    expect(resolvePending(s(2.5), jump.pending!)).toBeCloseTo(s(7.4));
  });

  it('desde la lava vacía va directo a la elegida', () => {
    expect(planJump(s(2.8), 2)).toEqual({ seekTo: s(7.4), pending: null });
  });

  it('elegir la que ya está no hace nada', () => {
    expect(planJump(s(5), 1)).toBeNull();
    expect(planJump(s(0.5), 2, 2)).toBeNull();
  });
});
