import { FunctionComponent, useEffect, useState } from 'react';
import { Icon } from '../components/atoms';
// Directo y no desde el barrel: así MediaPipe queda fuera del bundle de la landing.
import ExerciseCatalog from '../components/organisms/ExerciseCatalog/ExerciseCatalog';
import PoseCoach from '../components/organisms/PoseCoach/PoseCoach';
import { ruleFor } from '../lib/exercises/match';
import type { Exercise } from '../lib/wger';
import styles from './Entrenar.module.css';

const Entrenar: FunctionComponent = () => {
  const [exercise, setExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Entrená con cámara — SPOT';
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [exercise]);

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <a href="#inicio" className={styles.back}>
          <Icon name="arrowLeft" size={18} /> SPOT
        </a>
        <span className={styles.section}>Entrená con cámara</span>
      </header>
      <main className={styles.main}>
        {exercise ? <PoseCoach key={exercise.id} exercise={exercise} rule={ruleFor(exercise.name)} onExit={() => setExercise(null)} /> : <ExerciseCatalog onStart={setExercise} />}
      </main>
    </div>
  );
};

export default Entrenar;
