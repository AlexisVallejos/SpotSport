import { FunctionComponent } from 'react';
import { Wordmark } from '../../atoms';
import { ActionButton, SectionMarker } from '../../molecules';
import { images } from '../../../data/images';
import ShinyText from '../../reactbits/ShinyText';
import styles from './BrandClosing.module.css';

const BrandClosing: FunctionComponent = () => {
  return (
    <section className={styles.cierreDeMarcaSiempreEnM} aria-labelledby="cierre-titulo">
      <img className={styles.brandAtmosphereIcon} src={images.brandAtmosphere} alt="" loading="lazy" decoding="async" />
      <div className={styles.atmosphereTint} />
      <div className={styles.brandStatement}>
        <div className={styles.manifestoCopy}>
          <SectionMarker label="EL MOVIMIENTO NOS ENCUENTRA" />
          <h2 id="cierre-titulo" className={styles.statement}><ShinyText text="TU DEPORTE. TU LUGAR." color="#ffffff" shineColor="#ff7900" speed={3.2} glow={0.4} /></h2>
        </div>
        <div className={styles.closingInvitation}>
          <div className={styles.invitation}>En la calle, en la cancha o donde empiece tu próxima meta. Nos vemos en movimiento.</div>
          <ActionButton variant="light" label="Explorá el universo SPOT" />
        </div>
      </div>
      <div className={styles.brandFinale}>
        <Wordmark variant="closing" />
      </div>
      <p className={styles.brandSlogan}>TODO EL DEPORTE EN UN SOLO LUGAR</p>
    </section>
  );
};

export default BrandClosing;
