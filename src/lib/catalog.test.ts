import { describe, expect, it } from 'vitest';
import { availableVariants, emptyProduct, emptyVariant, inStock, options, priceFrom, ProductDraft, slugify, validateProduct, variantLabel } from './catalog';
import type { Variant } from './types';

const variant = (patch: Partial<Variant> = {}): Variant => ({ id: 'v', product_id: 'p', size: '42', color: 'Negro', sku: '', price_cents: 10000, stock: 3, is_active: true, ...patch });

describe('catálogo', () => {
  it('calcula el precio desde, las variantes disponibles y el stock', () => {
    const product = { variants: [variant({ price_cents: 15000 }), variant({ id: 'b', price_cents: 9000, stock: 0 }), variant({ id: 'c', price_cents: 1000, is_active: false })] };
    expect(priceFrom(product)).toBe(9000);
    expect(availableVariants(product)).toHaveLength(1);
    expect(inStock(product)).toBe(true);
    expect(inStock({ variants: [variant({ stock: 0 })] })).toBe(false);
    expect(priceFrom({ variants: [] })).toBeNull();
    expect(priceFrom({})).toBeNull();
  });

  it('arma etiquetas y opciones sin repetidos', () => {
    expect(variantLabel({ size: 'M', color: 'Blanco' })).toBe('M · Blanco');
    expect(variantLabel({ size: '', color: 'Rojo' })).toBe('Rojo');
    expect(variantLabel({ size: '', color: '' })).toBe('Único');
    const result = options([variant({ size: 'M', color: 'Blanco' }), variant({ id: 'b', size: 'L', color: 'Blanco' }), variant({ id: 'c', size: 'M', color: 'Negro' }), variant({ id: 'd', size: 'XL', is_active: false })]);
    expect(result).toEqual({ sizes: ['M', 'L'], colors: ['Blanco', 'Negro'] });
  });

  it('slugify saca tildes y símbolos', () => {
    expect(slugify('Fútbol Total & Más!')).toBe('futbol-total-mas');
    expect(slugify('  Running   Shop  ')).toBe('running-shop');
  });
});

describe('validación del formulario de producto', () => {
  const draft = (patch: Partial<ProductDraft> = {}): ProductDraft => ({
    ...emptyProduct(),
    name: 'Zapatilla Ruta',
    category_id: 'cat-1',
    variants: [{ ...emptyVariant(), size: '42', color: 'Negro', price: '12.500', stock: '5' }],
    ...patch,
  });

  it('convierte precios y stock', () => {
    const result = validateProduct(draft());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.variants[0]).toMatchObject({ price_cents: 1250000, stock: 5 });
      expect(result.input.category_id).toBe('cat-1');
    }
  });

  it('pide nombre, variantes y precios válidos', () => {
    const result = validateProduct(draft({ name: ' ', variants: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/nombre.*variante/s);
    const bad = validateProduct(draft({ variants: [{ ...emptyVariant(), price: 'gratis', stock: '-2' }] }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors).toHaveLength(2);
  });

  it('rechaza dos variantes con el mismo talle y color', () => {
    const v = { ...emptyVariant(), size: 'M', color: 'Azul', price: '100', stock: '1' };
    const result = validateProduct(draft({ variants: [v, { ...v, size: ' m ', color: 'AZUL' }] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/mismo talle y color/);
  });

  it('acepta un producto de talle único', () => {
    const result = validateProduct(draft({ variants: [{ ...emptyVariant(), price: '5000', stock: '10' }] }));
    expect(result.ok).toBe(true);
  });
});
