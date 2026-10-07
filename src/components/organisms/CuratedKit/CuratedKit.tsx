import { FunctionComponent } from 'react';
import ProductViewer from '../../molecules/ProductViewer/ProductViewer';
import { ActionButton, KitItem, SectionMarker } from '../../molecules';
import { images } from '../../../data/images';
import { kitItems } from '../../../data/kit';
import styles from './CuratedKit.module.css';

const CuratedKit: FunctionComponent = () => {
  return (
    <section className={styles.seleccinSpotEquipoDeRut} aria-labelledby="seleccion-titulo">
      <div className={styles.curatedKitScene}>
        <ProductViewer name="SPOT Órbita 01" image={images.kitShoe} featured />
      </div>
      <div className={styles.kitDetails}>
        <SectionMarker variant="kit" label="EL ESTUDIO SPOT" />
        <h2 id="seleccion-titulo" className={styles.selectionTitle}>MENOS VUELTAS.<br/>MÁS KILÓMETROS.</h2>
        <div className={styles.selectionIntroduction}>El movimiento empieza en los detalles. Explorá Órbita 01 desde todos sus ángulos y armá tu próxima salida.</div>
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
