import { FunctionComponent, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import PriceCard from '../../molecules/PriceCard/PriceCard';
import PriceDrawer from '../PriceDrawer/PriceDrawer';
import { searchProducts, type Product, type SearchQuery } from '../../../lib/precios';
import styles from './PriceShowcase.module.css';

export type PriceShowcaseProps = {
  query: SearchQuery;
  /** Cuántas cartas mostrar (la landing muestra una fila o dos). */
  limit?: number;
};

/**
 * Productos reales del comparador dentro de una sección de la landing.
 * Al tocar una carta, el panel con precios y reseñas se abre ahí mismo.
 */
const PriceShowcase: FunctionComponent<PriceShowcaseProps> = ({ query, limit = 8 }) => {
  const [items, setItems] = useState<Product[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const key = JSON.stringify(query);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    searchProducts({ ...query, limit }, controller.signal)
      .then((result) => setItems(result.items))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limit]);

  return (
    <>
      {failed ? (
        <p className={styles.note}>Los precios no están disponibles en este momento. Probá de nuevo en un rato.</p>
      ) : items && items.length === 0 ? (
        <p className={styles.note}>Estamos actualizando los precios de las tiendas. En unos minutos aparecen acá.</p>
      ) : (
        <div className={styles.grid} aria-busy={!items}>
          {items
            ? items.map((product) => <PriceCard key={product.id} product={product} onOpen={setSelected} />)
            : Array.from({ length: Math.min(limit, 4) }, (_, index) => <span key={index} className={styles.placeholder} aria-hidden="true" />)}
        </div>
      )}
      <AnimatePresence>{selected ? <PriceDrawer key={selected.id} id={selected.id} preview={selected} onClose={() => setSelected(null)} /> : null}</AnimatePresence>
    </>
  );
};

export default PriceShowcase;
