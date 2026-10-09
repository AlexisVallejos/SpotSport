import { FunctionComponent } from 'react';
import { Icon } from '../../atoms';
import { CATEGORY, type Exercise } from '../../../lib/wger';
import styles from './ExerciseCard.module.css';

export type ExerciseCardProps = {
  exercise: Exercise;
  hasPose: boolean;
  selected: boolean;
  onSelect: () => void;
};

const ExerciseCard: FunctionComponent<ExerciseCardProps> = ({ exercise, hasPose, selected, onSelect }) => {
  const meta = [CATEGORY[exercise.category], ...exercise.muscles.slice(0, 2)].filter(Boolean).join(' · ');
  return (
    <button type="button" className={`${styles.card} ${selected ? styles.selected : ''}`} onClick={onSelect} aria-pressed={selected}>
      <span className={styles.media}>
        {exercise.image ? (
          <img src={exercise.image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            {exercise.name.charAt(0)}
          </span>
        )}
        {hasPose ? (
          <span className={styles.badge}>
            <Icon name="camera" size={16} /> Postura
          </span>
        ) : null}
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{exercise.name}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </span>
    </button>
  );
};

export default ExerciseCard;
