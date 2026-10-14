import { GENDERS, SPORTS, type Offer, type Product, type StoreId } from '../../shared/precios';
import type { Listing } from './stores';

// Cuando dos tiendas nombran distinto el mismo modelo, usamos el nombre de la primera que lo tenga.
const NAME_PREFERENCE: StoreId[] = ['opensports', 'trip', 'dexter'];
const MAX_IMAGES = 6;

/** Un mismo producto aparece en "Hombre" y en "Mujer" si es unisex: lo juntamos en una sola oferta (con todos sus géneros y deportes). */
function mergeSameStore(listings: Listing[]): Listing[] {
  const byId = new Map<string, Listing>();
  for (const listing of listings) {
    const key = `${listing.offer.store}:${listing.offer.storeProductId}`;
    const previous = byId.get(key);
    if (!previous) {
      byId.set(key, { ...listing, sports: [...listing.sports], offer: { ...listing.offer, genders: [...listing.offer.genders] } });
      continue;
    }
    for (const gender of listing.offer.genders) if (!previous.offer.genders.includes(gender)) previous.offer.genders.push(gender);
    for (const sport of listing.sports) if (!previous.sports.includes(sport)) previous.sports.push(sport);
  }
  return [...byId.values()];
}

/**
 * Cruza los listados de las tres tiendas por código de modelo del fabricante (el mismo color en todas),
 * y arma una ficha por modelo con sus ofertas ordenadas de la más barata a la más cara.
 */
export function buildProducts(listings: Listing[], firstSeen: (id: string) => string | null = () => null): Product[] {
  const groups = new Map<string, Listing[]>();
  for (const listing of mergeSameStore(listings)) {
    const key = listing.code ? listing.code.toLowerCase() : `${listing.offer.store}-${listing.offer.storeProductId}`.toLowerCase();
    const group = groups.get(key);
    if (group) group.push(listing);
    else groups.set(key, [listing]);
  }

  const products: Product[] = [];
  for (const [id, group] of groups) {
    // Si una tienda tiene el mismo código dos veces, nos quedamos con su precio más bajo.
    const cheapestPerStore = new Map<StoreId, Listing>();
    for (const listing of group) {
      const current = cheapestPerStore.get(listing.offer.store);
      if (!current || listing.offer.price < current.offer.price) cheapestPerStore.set(listing.offer.store, listing);
    }
    const chosen = [...cheapestPerStore.values()];
    const offers: Offer[] = chosen.map((listing) => listing.offer).sort((a, b) => a.price - b.price);
    const named = NAME_PREFERENCE.map((store) => cheapestPerStore.get(store)).find(Boolean)!;
    const genders = GENDERS.filter((gender) => chosen.some((listing) => listing.offer.genders.includes(gender)));
    const sports = SPORTS.filter((sport) => chosen.some((listing) => listing.sports.includes(sport)));
    const best = offers[0];
    const worst = offers[offers.length - 1];

    products.push({
      id,
      name: named.clean.name,
      title: named.clean.title,
      brand: named.clean.brand,
      category: named.category,
      type: named.type,
      sports,
      genders,
      thumb: named.offer.thumb || best.thumb,
      images: [...new Set([named.offer, ...offers].flatMap((offer) => offer.images))].slice(0, MAX_IMAGES),
      offers,
      best: best.price,
      worst: worst.price,
      savings: worst.price - best.price,
      discount: best.listPrice ? Math.round(((best.listPrice - best.price) / best.listPrice) * 100) : 0,
      firstSeen: firstSeen(id),
    });
  }
  return products;
}
