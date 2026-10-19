import { FunctionComponent, useEffect, useState } from 'react';
import SiteHeader from '../components/organisms/SiteHeader/SiteHeader';
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
    // Cámara y demo 3D se leen mejor sobre oscuro: esta página queda oscura en los dos temas.
    <div className={`${styles.page}`}>
      <SiteHeader />
      <main className={styles.main}>
        {exercise ? <PoseCoach key={exercise.id} exercise={exercise} rule={ruleFor(exercise.name)} onExit={() => setExercise(null)} /> : <ExerciseCatalog onStart={setExercise} />}
      </main>
    </div>
  );
};

export default Entrenar;
