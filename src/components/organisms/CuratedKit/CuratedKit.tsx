import { FunctionComponent, useState } from 'react';
import { ColorSwatch, type SwatchColor } from '../../atoms';
import { productColors } from '../../../data/productColors';
import ProductViewer from '../../molecules/ProductViewer/ProductViewer';
import { ActionButton, KitItem, SectionMarker } from '../../molecules';
import { kitItems } from '../../../data/kit';
import styles from './CuratedKit.module.css';

const CuratedKit: FunctionComponent = () => {
  const [color, setColor] = useState<SwatchColor>('ivory');
  return (
    <section className={styles.seleccinSpotEquipoDeRut} aria-labelledby="seleccion-titulo">
      <div className={styles.curatedKitScene}>
        <ProductViewer name="SPOT Órbita 01" image="/images/footwear-orbita-01.png" featured color={color} baseColor="ivory" />
        <div className={styles.sceneColors}><span aria-live="polite">ÓRBITA 01 / {productColors[color].label.toUpperCase()}</span><div role="group" aria-label="Colores de la selección Órbita 01">{(['ivory', 'charcoal', 'orange'] as SwatchColor[]).map(option => <ColorSwatch key={option} color={option} selected={color === option} onSelect={() => setColor(option)} />)}</div><small>Vista de color conceptual</small></div>
      </div>
      <div className={styles.kitDetails}>
        <SectionMarker variant="kit" label="EL ESTUDIO SPOT" />
        <h2 id="seleccion-titulo" className={styles.selectionTitle}>MENOS VUELTAS.<br/>MÁS KILÓMETROS.</h2>
        <div className={styles.selectionIntroduction}>El movimiento empieza en los detalles. Elegí el color de tu Órbita 01 y armá tu próxima salida.</div>
        <div className={styles.kitContents}>
          {kitItems.map((item) => (
            <KitItem key={item.name} {...item} />
          ))}
        </div>
        <ActionButton variant="kit" label="Descubrí la selección" />
        <div className={styles.conceptDisclosure}>Productos conceptuales propios de SPOT.</div>
      </div>
    </section>
  );
};

export default CuratedKit;
