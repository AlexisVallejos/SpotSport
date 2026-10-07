import { FunctionComponent } from 'react';
import { Label } from '../../atoms';
import { ActionButton, SectionMarker, TrainingCategoryRow } from '../../molecules';
import { images } from '../../../data/images';
import { trainingCategories } from '../../../data/training';
import styles from './TrainingCampaign.module.css';

const TrainingCampaign: FunctionComponent = () => {
  return (
    <section className={styles.campaaEntrenamientoVolv} aria-labelledby="training-titulo">
      <div className={styles.trainingCinema}>
        <img className={styles.trainingPhotographIcon} src={images.trainingLift} alt="" loading="lazy" decoding="async" />
        <p className={styles.campaignWord}>VOLVÉ MÁS FUERTE.</p>
        <div className={styles.campaignBadge}>
          <Label>SPOT / TRAINING EDIT</Label>
        </div>
      </div>
      <div className={styles.trainingStory}>
        <SectionMarker label="05 / ENTRENAMIENTO" />
        <h2 id="training-titulo" className={styles.headline}>TU FUERZA.<br/>TUS REGLAS.</h2>
        <div className={styles.description13}>Hay días de avanzar y días de volver a empezar. Equipate para los dos. El resto lo ponés vos.</div>
        <div className={styles.trainingCategories}>
          {trainingCategories.map((category) => (
            <TrainingCategoryRow key={category} label={category} />
          ))}
        </div>
        <ActionButton variant="campaign" label="Armá tu equipo de training" />
      </div>
    </section>
  );
};

export default TrainingCampaign;
