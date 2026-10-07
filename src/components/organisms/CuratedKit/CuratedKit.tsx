import { FunctionComponent } from 'react';
import { Wordmark } from '../../atoms';
import { ActionButton, KitItem, SectionMarker } from '../../molecules';
import { images } from '../../../data/images';
import { kitItems } from '../../../data/kit';
import styles from './CuratedKit.module.css';

const CuratedKit: FunctionComponent = () => {
  return (
    <section className={styles.seleccinSpotEquipoDeRut} aria-labelledby="seleccion-titulo">
      <div className={styles.curatedKitScene}>
        <div className={styles.productOrbit} />
        <div className={styles.integratedIdentity}>
          <Wordmark variant="kit" />
        </div>
        <img className={styles.runningShoeFocus} src={images.kitShoe} alt="Zapatilla de running SPOT Órbita 01" loading="lazy" decoding="async" />
        <img className={styles.runningAccessoryIcon} src={images.kitCap} alt="Gorra SPOT Trayecto" loading="lazy" decoding="async" />
        <div className={styles.sceneCaption}>SPOT OBJECTS / RUTA 01</div>
      </div>
      <div className={styles.kitDetails}>
        <SectionMarker variant="kit" label="06 / SELECCIÓN SPOT" />
        <h2 id="seleccion-titulo" className={styles.selectionTitle}>MENOS VUELTAS.<br/>MÁS KILÓMETROS.</h2>
        <div className={styles.selectionIntroduction}>Una selección para salir a correr: del primer cordón al último detalle.</div>
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
