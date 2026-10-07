import { FunctionComponent } from 'react';
import { Label } from '../../atoms';
import { ActionButton, SectionMarker, TrainingCategoryRow } from '../../molecules';
import { trainingCategories } from '../../../data/training';
import styles from './TrainingCampaign.module.css';

const TrainingCampaign: FunctionComponent = () => {
  return (
    <div className={styles.campaaEntrenamientoVolv}>
      <div className={styles.trainingCinema}>
        <img className={styles.trainingPhotographIcon} alt="" />
        <b className={styles.campaignWord}>VOLVÉ MÁS FUERTE.</b>
        <div className={styles.campaignBadge}>
          <Label>SPOT / TRAINING EDIT</Label>
        </div>
      </div>
      <div className={styles.trainingStory}>
        <SectionMarker label="05 / ENTRENAMIENTO" />
        <b className={styles.headline}>TU FUERZA.<br/>TUS REGLAS.</b>
        <div className={styles.description13}>Hay días de avanzar y días de volver a empezar. Equipate para los dos. El resto lo ponés vos.</div>
        <div className={styles.trainingCategories}>
          {trainingCategories.map((category) => (
            <TrainingCategoryRow key={category} label={category} />
          ))}
        </div>
        <ActionButton variant="campaign" label="Armá tu equipo de training" />
      </div>
    </div>
  );
};

export default TrainingCampaign;
