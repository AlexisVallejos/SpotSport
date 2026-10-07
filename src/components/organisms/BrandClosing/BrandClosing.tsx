import { FunctionComponent } from 'react';
import { Wordmark } from '../../atoms';
import { ActionButton, SectionMarker } from '../../molecules';
import styles from './BrandClosing.module.css';

const BrandClosing: FunctionComponent = () => {
  return (
    <div className={styles.cierreDeMarcaSiempreEnM}>
      <img className={styles.brandAtmosphereIcon} alt="" />
      <div className={styles.atmosphereTint} />
      <div className={styles.brandStatement}>
        <div className={styles.manifestoCopy}>
          <SectionMarker label="07 / EL MOVIMIENTO NOS ENCUENTRA" />
          <b className={styles.statement}>TU DEPORTE. TU LUGAR.</b>
        </div>
        <div className={styles.closingInvitation}>
          <div className={styles.invitation}>En la calle, en la cancha o donde empiece tu próxima meta. Nos vemos en movimiento.</div>
          <ActionButton variant="light" label="Explorá el universo SPOT" />
        </div>
      </div>
      <div className={styles.brandFinale}>
        <Wordmark variant="closing" />
      </div>
      <div className={styles.brandSlogan}>TODO EL DEPORTE EN UN SOLO LUGAR</div>
    </div>
  );
};

export default BrandClosing;
