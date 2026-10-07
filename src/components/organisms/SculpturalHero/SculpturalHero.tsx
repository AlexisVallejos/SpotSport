import { FunctionComponent } from 'react';
import { Text, Wordmark } from '../../atoms';
import { ActionButton } from '../../molecules';
import { images } from '../../../data/images';
import styles from './SculpturalHero.module.css';

const SculpturalHero: FunctionComponent = () => {
  return (
    <section className={styles.sculpturalHero} aria-label="Portada">
      <img className={styles.sportCinemaIcon} src={images.heroRunner} alt="" fetchPriority="high" decoding="async" />
      <div className={styles.cinemaScrim} />
      <div className={styles.orbitalTrajectory} />
      <div className={styles.campaignMetadata}>
        <Text>SPOT / EN MOVIMIENTO</Text>
        <div className={styles.sceneLabel}>ÓRBITA 01 / EL IMPULSO</div>
      </div>
      <div className={styles.foregroundIdentity}>
        <Wordmark variant="hero" />
      </div>
      <div className={styles.heroMessage}>
        <h1 className={styles.brandPromise}>TODO EL DEPORTE<br/>EN UN SOLO LUGAR</h1>
        <div className={styles.heroActionRow}>
          <ActionButton variant="hero" label="Encontrá tu próximo movimiento" />
          <div className={styles.collectionNote}>Calzado, indumentaria y actitud.</div>
        </div>
      </div>

    </section>
  );
};

export default SculpturalHero;
