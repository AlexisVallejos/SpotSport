import { describe, expect, it } from 'vitest';
import { averageRating, formatPrice, fromParams, genderLabel, preciosLink, timeAgo, toParams } from './precios';

describe('formato', () => {
  it('muestra precios argentinos sin centavos', () => {
    expect(formatPrice(259999)).toBe('$259.999');
  });

  it('dice hace cuánto se actualizó', () => {
    const now = Date.parse('2026-10-13T12:00:00Z');
    expect(timeAgo('2026-10-13T11:58:00Z', now)).toBe('hace 2 min');
    expect(timeAgo('2026-10-13T09:00:00Z', now)).toBe('hace 3 horas');
    expect(timeAgo(null, now)).toBe('todavía no');
  });

  it('nombra el género', () => {
    expect(genderLabel(['Hombre', 'Mujer'])).toBe('Unisex');
    expect(genderLabel(['Niños'])).toBe('Niños');
    expect(genderLabel([])).toBe('');
  });

  it('promedia estrellas', () => {
    expect(averageRating([{ source: 'spot', author: 'a', title: null, text: 'x', rating: 5, date: null }, { source: 'trip', author: 'b', title: null, text: 'y', rating: 4, date: null }])).toBe(4.5);
    expect(averageRating([])).toBeNull();
  });
});

describe('filtros en la URL', () => {
  it('arma links con los nombres en castellano y sin el orden por defecto', () => {
    expect(preciosLink()).toBe('/precios');
    expect(preciosLink({ category: 'calzado', sport: 'Fútbol', sort: 'recomendado' })).toBe('/precios?categoria=calzado&deporte=F%C3%BAtbol');
    expect(toParams({ q: ' samba ', compared: true, offset: 48, limit: 48 }).toString()).toBe('q=samba&comparables=1&desde=48&limite=48');
  });

  it('lee los filtros de vuelta e ignora valores inventados', () => {
    const query = fromParams(new URLSearchParams('categoria=indumentaria&deporte=Running&genero=Mujer&tienda=dexter&orden=descuento&comparables=1&marca=Nike'));
    expect(query).toMatchObject({ category: 'indumentaria', sport: 'Running', gender: 'Mujer', store: 'dexter', sort: 'descuento', compared: true, brand: 'Nike' });
    expect(fromParams(new URLSearchParams('categoria=autos&deporte=ajedrez&orden=x'))).toMatchObject({ category: null, sport: null, sort: 'recomendado' });
  });
});
