import { FunctionComponent } from 'react';
import { Wordmark } from '../../atoms';
import { ActionButton, SectionMarker } from '../../molecules';
import { images } from '../../../data/images';
import styles from './RunningCampaign.module.css';

const RunningCampaign: FunctionComponent = () => {
  return (
    <section className={styles.campaaRunningTuPropiaR} aria-labelledby="running-titulo">
      <img className={styles.runningPanoramaIcon} src={images.runningPanorama} alt="" loading="lazy" decoding="async" />
      <div className={styles.editorialScrim} />
      <div className={styles.orbitArc} />
      <div className={styles.runningCopy}>
        <SectionMarker variant="light" label="RUNNING / A TU RITMO" />
        <h2 id="running-titulo" className={styles.campaignHeadline}>SALÍ DE<br/>LA VUELTA.<br/>ENTRÁ EN<br/>TU ÓRBITA.</h2>
        <div className={styles.campaignDescription}>No importa el tiempo ni la distancia. Importa ese primer paso que es tuyo.</div>
        <ActionButton variant="campaign" label="Encontrá tu equipo de running" />
      </div>
      <div className={styles.floatingCampaignIdentity}>
        <Wordmark variant="running" />
      </div>
      <div className={styles.campaignSignature}>SPOT / RUNNING EDIT</div>
    </section>
  );
};

export default RunningCampaign;
