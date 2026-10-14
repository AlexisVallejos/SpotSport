import { STORES, type Review, type StoreId } from '../../shared/precios';
import { chunks, pick, text } from './html';
import type { FetchPage } from './stores';

/** Reseñas de la lista pública de Magento (Open Sports y Trip): /review/product/listAjax/id/<id>/ */
export function parseMagentoReviews(html: string, store: StoreId): Review[] {
  return chunks(html, 'class="item review-item"')
    .map((chunk) => {
      const percent = Number(pick(chunk, /rating-result"[^>]*title="(\d+)%"/) ?? pick(chunk, /itemprop="ratingValue">(\d+)%/));
      return {
        source: store,
        author: text(pick(chunk, /itemprop="author"[^>]*>([\s\S]*?)<\//) ?? '') || 'Cliente',
        title: text(pick(chunk, /class="review-title"[^>]*>([\s\S]*?)<\/div>/) ?? '') || null,
        text: text(pick(chunk, /class="review-content"[^>]*>([\s\S]*?)<\/div>/) ?? ''),
        rating: percent ? Math.max(1, Math.min(5, Math.round(percent / 20))) : null,
        date: pick(chunk, /datetime="([^"]+)"/),
      };
    })
    .filter((review) => review.text.length > 0);
}

export async function fetchStoreReviews(store: StoreId, storeProductId: string, fetchPage: FetchPage): Promise<Review[]> {
  // Dexter no publica reseñas propias (las estrellas de su ficha son un valor fijo de la plantilla).
  if (store === 'dexter') return [];
  try {
    const html = await fetchPage(`${STORES[store].site}/review/product/listAjax/id/${encodeURIComponent(storeProductId)}/`);
    return parseMagentoReviews(html, store);
  } catch (error) {
    // Con las reseñas apagadas, Magento redirige a su página "no existe": no es una falla, es que no hay.
    if (error instanceof Error && error.message.includes('respondió 404')) return [];
    throw error;
  }
}

export type NewReview = { author: string; rating: number; text: string };

/** Valida una reseña escrita en SPOT. Devuelve el motivo si no se puede publicar. */
export function validateReview(input: unknown): NewReview | string {
  if (!input || typeof input !== 'object') return 'Faltan datos.';
  const { author, rating, text: body, website } = input as Record<string, unknown>;
  if (typeof website === 'string' && website.trim()) return 'No se pudo publicar.'; // Campo trampa para bots.
  const name = typeof author === 'string' ? author.replace(/\s+/g, ' ').trim() : '';
  const content = typeof body === 'string' ? body.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '';
  const stars = Number(rating);
  if (name.length < 2 || name.length > 40) return 'Poné un nombre de 2 a 40 letras.';
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return 'Elegí de 1 a 5 estrellas.';
  if (content.length < 10 || content.length > 600) return 'La reseña tiene que tener entre 10 y 600 caracteres.';
  if (/https?:\/\/|www\.|\.com\b/i.test(content + name)) return 'Las reseñas no pueden tener enlaces.';
  return { author: name, rating: stars, text: content };
}
