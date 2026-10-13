import { describe, expect, it } from 'vitest';
import { fromLocalInput, toLocalInput } from './dates';

describe('fechas de formularios', () => {
  it('ida y vuelta sin perder el momento', () => {
    const iso = '2026-10-13T15:30:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });

  it('vacío o inválido es null / cadena vacía', () => {
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('basura')).toBe('');
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('no es fecha')).toBeNull();
  });

  it('el formato es el que espera datetime-local', () => {
    expect(toLocalInput('2026-10-13T15:30:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
