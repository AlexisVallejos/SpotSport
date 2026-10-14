import { describe, expect, it } from 'vitest';
import { parseSearch, removeToken } from './smartQuery';

describe('parseSearch', () => {
  it('convierte palabras conocidas en filtros', () => {
    const { tokens, text, query } = parseSearch('botines nike baratos');
    expect(tokens.map((token) => token.label)).toEqual(['Botines', 'Nike', 'Más baratos']);
    expect(text).toBe('');
    expect(query).toMatchObject({ category: 'calzado', type: 'Botines', sport: 'Fútbol', brand: 'Nike', sort: 'menor', q: '' });
  });

  it('deja como texto lo que no reconoce y entiende tildes y frases', () => {
    const { tokens, text, query } = parseSearch('Remera Running para mujer Miler');
    expect(tokens.map((token) => token.kind)).toEqual(['type', 'sport', 'gender']);
    expect(text).toBe('Miler');
    expect(query).toMatchObject({ category: 'indumentaria', type: 'Remera', sport: 'Running', gender: 'Mujer', q: 'Miler' });
    expect(parseSearch('zapatillas de fútbol en open sports').query).toMatchObject({ sport: 'Fútbol', store: 'opensports', q: '' });
  });

  it('usa una sola marca y no confunde palabras parecidas', () => {
    expect(parseSearch('nike adidas').query).toMatchObject({ brand: 'Nike', q: 'adidas' });
    expect(parseSearch('Topper Squat').tokens.map((token) => token.label)).toEqual(['Topper']);
    expect(parseSearch('botines top sala').query).toMatchObject({ type: 'Botines', q: 'top sala' });
  });

  it('respeta los filtros que ya había y quita palabras de un token', () => {
    expect(parseSearch('samba', { category: 'calzado' }).query).toMatchObject({ category: 'calzado', q: 'samba' });
    const [token] = parseSearch('remera running').tokens;
    expect(removeToken('Remera running', token)).toBe('running');
  });
});
