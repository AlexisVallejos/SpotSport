import { FunctionComponent, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ColorSwatch, type SwatchColor } from '../../atoms';
import { productColors } from '../../../data/productColors';
import ProductViewer from '../../molecules/ProductViewer/ProductViewer';
import { ActionButton, KitItem, SectionMarker } from '../../molecules';
import { kitSlots } from '../../../data/kit';
import { STORES, formatPrice, preciosLink, searchProducts, type Product } from '../../../lib/precios';
import PriceDrawer from '../PriceDrawer/PriceDrawer';
import styles from './CuratedKit.module.css';

const CuratedKit: FunctionComponent = () => {
  const [color, setColor] = useState<SwatchColor>('ivory');
  const [kit, setKit] = useState<(Product | null)[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(kitSlots.map(({ query }) => searchProducts({ ...query, limit: 1 }).then((result) => result.items[0] ?? null, () => null))).then((items) => {
      if (alive) setKit(items);
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section className={styles.seleccinSpotEquipoDeRut} aria-labelledby="seleccion-titulo">
      <div className={styles.curatedKitScene}>
        <ProductViewer name="SPOT Órbita 01" image="/images/footwear-orbita-01.webp" featured color={color} baseColor="ivory" />
        <div className={styles.sceneColors}><span aria-live="polite">ÓRBITA 01 / {productColors[color].label.toUpperCase()}</span><div role="group" aria-label="Colores de la selección Órbita 01">{(['ivory', 'charcoal', 'orange'] as SwatchColor[]).map(option => <ColorSwatch key={option} color={option} selected={color === option} onSelect={() => setColor(option)} />)}</div><small>Vista de color conceptual</small></div>
      </div>
      <div className={styles.kitDetails}>
        <SectionMarker variant="kit" label="EL ESTUDIO SPOT" />
        <h2 id="seleccion-titulo" className={styles.selectionTitle}>MENOS VUELTAS.<br/>MÁS KILÓMETROS.</h2>
        <div className={styles.selectionIntroduction}>El movimiento empieza en los detalles. Armá tu próxima salida con lo más conveniente de Open Sports, Dexter y Trip Store.</div>
        <div className={styles.kitContents}>
          {kitSlots.map((slot, index) => {
            const product = kit[index];
            return product ? (
              <KitItem key={slot.label} name={product.title} category={`${slot.label} · ${formatPrice(product.best)} en ${STORES[product.offers[0].store].name}`} onSelect={() => setSelected(product)} />
            ) : (
              <KitItem key={slot.label} name={slot.label} category={kit.length ? 'Sin precios por ahora' : 'Buscando el mejor precio…'} />
            );
          })}
        </div>
        <ActionButton variant="kit" label="Descubrí la selección" href={preciosLink({ sport: 'Running' })} />
        <div className={styles.conceptDisclosure}>Órbita 01 es un diseño conceptual SPOT. La selección de arriba es real, con el mejor precio de hoy.</div>
        <AnimatePresence>{selected ? <PriceDrawer key={selected.id} id={selected.id} preview={selected} onClose={() => setSelected(null)} /> : null}</AnimatePresence>
      </div>
    </section>
  );
};

export default CuratedKit;
