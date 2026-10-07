import { FunctionComponent } from 'react';
import { Wordmark } from '../../atoms';
import { ActionButton, SectionMarker } from '../../molecules';
import styles from './RunningCampaign.module.css';

const RunningCampaign: FunctionComponent = () => {
  return (
    <div className={styles.campaaRunningTuPropiaR}>
      <img className={styles.runningPanoramaIcon} alt="" />
      <div className={styles.editorialScrim} />
      <div className={styles.orbitArc} />
      <div className={styles.runningCopy}>
        <SectionMarker variant="light" label="03 / RUNNING — A TU RITMO" />
        <b className={styles.campaignHeadline}>SALÍ DE<br/>LA VUELTA.<br/>ENTRÁ EN<br/>TU ÓRBITA.</b>
        <div className={styles.campaignDescription}>No importa el tiempo ni la distancia. Importa ese primer paso que es tuyo.</div>
        <ActionButton variant="campaign" label="Encontrá tu equipo de running" />
      </div>
      <div className={styles.floatingCampaignIdentity}>
        <Wordmark variant="running" />
      </div>
      <div className={styles.campaignSignature}>SPOT / RUNNING EDIT</div>
    </div>
  );
};

export default RunningCampaign;
