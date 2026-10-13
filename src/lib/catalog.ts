import { parsePrice } from './money';
import type { Product, Variant } from './types';

/** Variantes que se pueden comprar ahora. */
export const availableVariants = (product: Pick<Product, 'variants'>): Variant[] =>
  (product.variants ?? []).filter((variant) => variant.is_active && variant.stock > 0);

/** El precio más bajo entre las variantes activas (con o sin stock), o null si no hay. */
export function priceFrom(product: Pick<Product, 'variants'>): number | null {
  const prices = (product.variants ?? []).filter((variant) => variant.is_active).map((variant) => variant.price_cents);
  return prices.length ? Math.min(...prices) : null;
}

export const inStock = (product: Pick<Product, 'variants'>): boolean => availableVariants(product).length > 0;

export const variantLabel = (variant: Pick<Variant, 'size' | 'color'>): string => [variant.size, variant.color].filter(Boolean).join(' · ') || 'Único';

/** Talles y colores distintos de las variantes activas, en el orden en que aparecen. */
export function options(variants: Variant[]) {
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
  const active = variants.filter((variant) => variant.is_active);
  return { sizes: unique(active.map((variant) => variant.size)), colors: unique(active.map((variant) => variant.color)) };
}

export type VariantDraft = { id?: string; size: string; color: string; sku: string; price: string; stock: string; is_active: boolean };
export type ProductDraft = {
  id?: string;
  name: string;
  description: string;
  brand: string;
  category_id: string;
  images: string[];
  is_active: boolean;
  variants: VariantDraft[];
};

export const emptyVariant = (): VariantDraft => ({ size: '', color: '', sku: '', price: '', stock: '0', is_active: true });
export const emptyProduct = (): ProductDraft => ({ name: '', description: '', brand: '', category_id: '', images: [], is_active: true, variants: [emptyVariant()] });

export type ProductInput = {
  id?: string;
  name: string;
  description: string;
  brand: string;
  category_id: string | null;
  images: string[];
  is_active: boolean;
  variants: { id?: string; size: string; color: string; sku: string; price_cents: number; stock: number; is_active: boolean }[];
};

/** Valida el formulario de producto y lo convierte a lo que espera la base. Devuelve errores en español. */
export function validateProduct(draft: ProductDraft): { ok: true; input: ProductInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (name.length < 2 || name.length > 120) errors.push('El nombre debe tener entre 2 y 120 caracteres.');
  if (draft.variants.length === 0) errors.push('Agregá al menos una variante con su precio.');

  const seen = new Set<string>();
  const variants: ProductInput['variants'] = [];
  draft.variants.forEach((variant, index) => {
    const label = `Variante ${index + 1}`;
    const price = parsePrice(variant.price);
    const stock = Number(variant.stock);
    if (price === null) errors.push(`${label}: el precio no es válido.`);
    if (!Number.isInteger(stock) || stock < 0) errors.push(`${label}: el stock debe ser un número entero, 0 o más.`);
    const key = `${variant.size.trim().toLowerCase()}|${variant.color.trim().toLowerCase()}`;
    if (seen.has(key)) errors.push(`${label}: ya hay otra variante con el mismo talle y color.`);
    seen.add(key);
    if (price !== null && Number.isInteger(stock) && stock >= 0) {
      variants.push({ id: variant.id, size: variant.size.trim(), color: variant.color.trim(), sku: variant.sku.trim(), price_cents: price, stock, is_active: variant.is_active });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      id: draft.id,
      name,
      description: draft.description.trim(),
      brand: draft.brand.trim(),
      category_id: draft.category_id || null,
      images: draft.images,
      is_active: draft.is_active,
      variants,
    },
  };
}

/** "Zapatillas Ruta 2" → "zapatillas-ruta-2" (sin tildes ni símbolos). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
