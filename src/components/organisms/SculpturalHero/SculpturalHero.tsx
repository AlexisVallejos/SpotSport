import { FunctionComponent } from 'react';
import { Icon, Text, Wordmark } from '../../atoms';
import { ActionButton } from '../../molecules';
import styles from './SculpturalHero.module.css';

const SculpturalHero: FunctionComponent = () => {
  return (
    <div className={styles.sculpturalHero}>
      <img className={styles.sportCinemaIcon} alt="" />
      <div className={styles.cinemaScrim} />
      <div className={styles.orbitalTrajectory} />
      <div className={styles.campaignMetadata}>
        <Text>SPOT / EN MOVIMIENTO</Text>
        <div className={styles.sceneLabel}>ÓRBITA 01 — EL IMPULSO</div>
      </div>
      <div className={styles.foregroundIdentity}>
        <Wordmark variant="hero" />
      </div>
      <div className={styles.heroMessage}>
        <b className={styles.brandPromise}>TODO EL DEPORTE<br/>EN UN SOLO LUGAR</b>
        <div className={styles.heroActionRow}>
          <ActionButton variant="hero" label="Encontrá tu próximo movimiento" />
          <div className={styles.collectionNote}>Calzado, indumentaria y actitud.</div>
        </div>
      </div>
      <div className={styles.scrollCue}>
        <Text>SEGUÍ EL RECORRIDO</Text>
        <Icon />
      </div>
    </div>
  );
};

export default SculpturalHero;
