import { FunctionComponent } from 'react';
import { Wordmark } from '../../atoms';
import { ActionButton, KitItem, SectionMarker } from '../../molecules';
import { kitItems } from '../../../data/kit';
import styles from './CuratedKit.module.css';

const CuratedKit: FunctionComponent = () => {
  return (
    <div className={styles.seleccinSpotEquipoDeRut}>
      <div className={styles.curatedKitScene}>
        <div className={styles.productOrbit} />
        <div className={styles.integratedIdentity}>
          <Wordmark variant="kit" />
        </div>
        <img className={styles.runningShoeFocus} alt="" />
        <img className={styles.runningAccessoryIcon} alt="" />
        <div className={styles.sceneCaption}>SPOT OBJECTS / RUTA 01</div>
      </div>
      <div className={styles.kitDetails}>
        <SectionMarker variant="kit" label="06 / SELECCIÓN SPOT" />
        <b className={styles.selectionTitle}>MENOS VUELTAS.<br/>MÁS KILÓMETROS.</b>
        <div className={styles.selectionIntroduction}>Una selección para salir a correr: del primer cordón al último detalle.</div>
        <div className={styles.kitContents}>
          {kitItems.map((item) => (
            <KitItem key={item.name} {...item} />
          ))}
        </div>
        <ActionButton variant="kit" label="Descubrí la selección" />
        <div className={styles.conceptDisclosure}>Productos conceptuales propios de SPOT.</div>
      </div>
    </div>
  );
};

export default CuratedKit;
