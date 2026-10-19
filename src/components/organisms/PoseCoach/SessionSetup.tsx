import { FunctionComponent, ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Icon } from '../../atoms';
import ExerciseVideo from '../../molecules/ExerciseVideo/ExerciseVideo';
import ExerciseDemo from '../ExerciseDemo/ExerciseDemo';
import type { PoseRule } from '../../../lib/pose/rules';
import { LIMITS, targetRange, type SessionConfig } from '../../../lib/pose/session';
import type { Exercise } from '../../../lib/wger';
import styles from './PoseCoach.module.css';

type StepperProps = { label: string; value: number; unit?: string; min: number; max: number; step: number; onChange: (value: number) => void };

const Stepper: FunctionComponent<StepperProps> = ({ label, value, unit, min, max, step, onChange }) => (
  <div className={styles.stepper}>
    <span className={styles.stepperLabel}>{label}</span>
    <div className={styles.stepperControls}>
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label={`Menos ${label.toLowerCase()}`}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <output aria-live="polite">
        {value}
        {unit ? <small>{unit}</small> : null}
      </output>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label={`Más ${label.toLowerCase()}`}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  </div>
);

/** Rough length of the session, to decide before starting: a calm rep takes about 3 seconds. */
function minutes(rule: PoseRule, config: SessionConfig): number {
  const work = rule.mode === 'reps' ? config.target * 3 : config.target + 5;
  return Math.max(1, Math.round((config.sets * work + (config.sets - 1) * config.restS) / 60));
}

export type SessionSetupProps = {
  exercise: Exercise;
  rule: PoseRule | null;
  config: SessionConfig | null;
  starting: boolean;
  voiceButton: ReactNode;
  onConfig: (config: SessionConfig) => void;
  onStart: () => void;
  onBack: () => void;
};

const SessionSetup: FunctionComponent<SessionSetupProps> = ({ exercise, rule, config, starting, voiceButton, onConfig, onStart, onBack }) => {
  const range = rule ? targetRange(rule) : null;
  return (
    <section className={`${styles.card} ${rule ? styles.withDemo : ''}`} aria-labelledby="coach-titulo">
      {rule ? (
        <div className={styles.setupBg} aria-hidden="true">
          <ExerciseVideo id={rule.id} />
        </div>
      ) : null}
      {rule ? (
        <div className={styles.demoSlot}>
          <ExerciseDemo rule={rule} />
        </div>
      ) : null}
      <div className={styles.setupText}>
        <p className={styles.kicker}>PREPARATE</p>
        <h1 id="coach-titulo" className={styles.title}>
          {exercise.name}
        </h1>

        {rule && config && range ? (
          <div className={styles.config} role="group" aria-label="Tu sesión">
            <Stepper label="Series" value={config.sets} {...LIMITS.sets} onChange={(sets) => onConfig({ ...config, sets })} />
            <Stepper label={rule.mode === 'reps' ? 'Repeticiones' : 'Segundos'} value={config.target} unit={rule.mode === 'hold' ? 's' : undefined} {...range} onChange={(target) => onConfig({ ...config, target })} />
            <Stepper label="Descanso" value={config.restS} unit="s" {...LIMITS.rest} onChange={(restS) => onConfig({ ...config, restS })} />
            <p className={styles.configNote}>
              {config.sets} {config.sets === 1 ? 'serie' : 'series'} de {config.target} {rule.mode === 'reps' ? 'repeticiones' : 'segundos'} · {minutes(rule, config) === 1 ? 'un minuto' : `unos ${minutes(rule, config)} minutos`}. Las repeticiones mal hechas no cuentan.
            </p>
          </div>
        ) : null}

        <ol className={styles.checklist}>
          <li>
            <strong>Cámara</strong>
            {rule ? rule.setup : 'Ubicá la cámara a 2–3 metros, que se te vea el cuerpo entero.'}
          </li>
          <li>
            <strong>Luz</strong>
            De frente, sin una ventana brillante detrás tuyo.
          </li>
          <li>
            <strong>Privado</strong>
            El video se analiza en esta compu: no se graba ni se sube.
          </li>
          {rule ? null : (
            <li>
              <strong>Sin corrección</strong>
              Este ejercicio todavía no tiene análisis: vas a ver tu esqueleto en vivo.
            </li>
          )}
        </ol>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onStart} disabled={starting}>
            <Icon name="camera" /> {starting ? 'Abriendo cámara…' : 'Activar cámara'}
          </button>
          <button type="button" className={styles.secondary} onClick={onBack}>
            Volver
          </button>
          {voiceButton}
        </div>
      </div>
    </section>
  );
};

export default SessionSetup;
