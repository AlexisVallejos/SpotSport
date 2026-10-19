import { FunctionComponent } from 'react';
import type { PoseRule } from '../../../lib/pose/rules';
import { quality, sumSets, tempo, worstError, type Activity, type SetResult } from '../../../lib/pose/session';
import type { Exercise } from '../../../lib/wger';
import RepDots from './RepDots';
import styles from './PoseCoach.module.css';

export type SessionSummaryProps = {
  exercise: Exercise;
  rule: PoseRule | null;
  sets: SetResult[];
  activity: Activity | null;
  onAgain: () => void;
  onAdjust: () => void;
  onExit: () => void;
};

const seconds = (ms: number) => `${(ms / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`;

const SessionSummary: FunctionComponent<SessionSummaryProps> = ({ exercise, rule, sets, activity, onAgain, onAdjust, onExit }) => {
  const totals = sumSets(sets);
  const worst = worstError(totals.errors);
  const share = quality(totals);
  const pace = tempo(sets.flatMap((set) => set.log));
  const best = Math.max(0, ...sets.map((set) => set.holdMs));

  return (
    <section className={`${styles.card} ${styles.summaryCard}`} aria-labelledby="resumen-titulo">
      <p className={styles.kicker}>RESUMEN</p>
      <h1 id="resumen-titulo" className={styles.title}>
        {exercise.name}
      </h1>

      {rule ? (
        <>
          <div className={styles.summary}>
            {rule.mode === 'reps' ? (
              <>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{totals.reps}</span>
                  <span className={styles.statLabel}>repeticiones bien hechas</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{share === null ? '—' : `${Math.round(share * 100)}%`}</span>
                  <span className={styles.statLabel}>de técnica correcta ({totals.badReps} para corregir)</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{pace === null ? '—' : seconds(pace)}</span>
                  <span className={styles.statLabel}>por repetición, en promedio</span>
                </div>
              </>
            ) : (
              <>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{Math.round(totals.holdMs / 1000)} s</span>
                  <span className={styles.statLabel}>en buena postura</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{Math.round(best / 1000)} s</span>
                  <span className={styles.statLabel}>tu mejor serie</span>
                </div>
              </>
            )}
          </div>

          {sets.length > 0 ? (
            <ol className={styles.setList} aria-label="Series">
              {sets.map((set, index) => (
                <li key={index}>
                  <span className={styles.setName}>Serie {index + 1}</span>
                  {rule.mode === 'reps' ? (
                    <>
                      <RepDots log={set.log} />
                      <span className={styles.setNumbers}>
                        {set.reps} bien · {set.badReps} a corregir
                        {tempo(set.log) !== null ? ` · ${seconds(tempo(set.log)!)} c/u` : ''}
                      </span>
                    </>
                  ) : (
                    <span className={styles.setNumbers}>
                      {Math.round(set.holdMs / 1000)} s de {rule.target} s
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : null}

          {worst ? (
            <p className={styles.lesson}>
              <strong>Para la próxima:</strong> «{worst[0]}» ({worst[1]} {worst[1] === 1 ? 'vez' : 'veces'}).{exercise.tip ? ` ${exercise.tip}` : ''}
            </p>
          ) : totals.reps + totals.holdMs > 0 ? (
            <p className={styles.lesson}>
              <strong>Impecable:</strong> no hubo nada para corregir.
            </p>
          ) : null}
        </>
      ) : (
        <p className={styles.text}>Sesión terminada.</p>
      )}

      {activity && activity.week > 0 ? (
        <p className={styles.saved}>
          Guardado en tu actividad: {activity.week} {activity.week === 1 ? 'sesión' : 'sesiones'} esta semana
          {activity.streak > 1 ? ` · ${activity.streak} días seguidos` : ''}.
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onAgain}>
          Otra vez
        </button>
        {rule ? (
          <button type="button" className={styles.secondary} onClick={onAdjust}>
            Ajustar series
          </button>
        ) : null}
        <button type="button" className={styles.secondary} onClick={onExit}>
          Elegir otro ejercicio
        </button>
      </div>
    </section>
  );
};

export default SessionSummary;
