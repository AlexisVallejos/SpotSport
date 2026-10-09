import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { Icon } from '../../atoms';
import { createTracker, isSetDone, type Tracker, type TrackerState } from '../../../lib/pose/engine';
import type { Landmarks } from '../../../lib/pose/geometry';
import { loadLandmarker, POSE_CONNECTIONS } from '../../../lib/pose/landmarker';
import type { PoseRule } from '../../../lib/pose/rules';
import type { Exercise } from '../../../lib/wger';
import styles from './PoseCoach.module.css';

export type PoseCoachProps = {
  exercise: Exercise;
  rule: PoseRule | null;
  onExit: () => void;
};

type Phase = 'setup' | 'starting' | 'live' | 'done' | 'error';
type Problem = 'denied' | 'nocamera' | 'insecure' | 'model' | 'other';
type Totals = { reps: number; badReps: number; holdMs: number; errors: Record<string, number> };

const SETS = 3;
const EMPTY: Totals = { reps: 0, badReps: 0, holdMs: 0, errors: {} };
const OK = '#3ddc84';
const BAD = '#ff3b30';
const NEUTRAL = '#ff7900';

const PROBLEMS: Record<Problem, { title: string; text: string }> = {
  denied: { title: 'Sin permiso para la cámara', text: 'Tocá el ícono de la cámara o del candado en la barra de direcciones, elegí «Permitir» y volvé a intentar.' },
  nocamera: { title: 'No encontramos una cámara', text: 'Conectá una webcam o cerrá otras apps que la estén usando (Zoom, Meet, OBS…).' },
  insecure: { title: 'La cámara necesita HTTPS', text: 'Abrí la página con https:// o desde localhost: el navegador bloquea la cámara en sitios sin cifrar.' },
  model: { title: 'No se pudo cargar el analizador', text: 'Revisá tu conexión a internet e intentá de nuevo.' },
  other: { title: 'No pudimos abrir la cámara', text: 'Intentá de nuevo. Si sigue fallando, recargá la página.' },
};

function problemOf(error: unknown): Problem {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') return 'nocamera';
  return 'other';
}

function add(totals: Totals, state: TrackerState): Totals {
  const errors = { ...totals.errors };
  for (const [key, count] of Object.entries(state.errors)) errors[key] = (errors[key] ?? 0) + count;
  return { reps: totals.reps + state.reps, badReps: totals.badReps + state.badReps, holdMs: totals.holdMs + state.holdMs, errors };
}

/** Skeleton over the video: face points skipped, joints red when a check fails. */
function draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, lm: Landmarks | null, failing: number[], judged: boolean) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, width, height);
  if (!lm) return;
  const seen = (index: number) => index >= 11 && (lm[index]?.visibility ?? 1) >= 0.5;
  const bad = new Set(failing);
  context.lineWidth = Math.max(3, width / 280);
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  for (const { start, end } of POSE_CONNECTIONS) {
    if (!seen(start) || !seen(end)) continue;
    context.beginPath();
    context.moveTo(lm[start].x * width, lm[start].y * height);
    context.lineTo(lm[end].x * width, lm[end].y * height);
    context.stroke();
  }
  lm.forEach((point, index) => {
    if (!seen(index)) return;
    context.beginPath();
    context.fillStyle = bad.has(index) ? BAD : judged ? OK : NEUTRAL;
    context.arc(point.x * width, point.y * height, bad.has(index) ? width / 80 : width / 150, 0, Math.PI * 2);
    context.fill();
  });
}

const PoseCoach: FunctionComponent<PoseCoachProps> = ({ exercise, rule, onExit }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const trackerRef = useRef<Tracker | null>(null);
  const liveRef = useRef<TrackerState | null>(null);
  const setRef = useRef(1);
  const totalsRef = useRef<Totals>(EMPTY);
  const [phase, setPhase] = useState<Phase>('setup');
  const [problem, setProblem] = useState<Problem>('other');
  const [live, setLive] = useState<TrackerState | null>(null);
  const [set, setSet] = useState(1);
  const [totals, setTotals] = useState<Totals>(EMPTY);
  const [flash, setFlash] = useState('');
  const [personSeen, setPersonSeen] = useState(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(''), 3000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const finish = useCallback(() => {
    if (liveRef.current) totalsRef.current = add(totalsRef.current, liveRef.current);
    liveRef.current = null;
    setTotals(totalsRef.current);
    stop();
    setPhase('done');
  }, [stop]);

  const completeSet = useCallback(
    (state: TrackerState) => {
      if (setRef.current >= SETS) {
        finish();
        return;
      }
      totalsRef.current = add(totalsRef.current, state);
      setTotals(totalsRef.current);
      setFlash(`¡Serie ${setRef.current} completa! Respirá y seguí con la ${setRef.current + 1}.`);
      setRef.current += 1;
      setSet(setRef.current);
      trackerRef.current?.reset();
      liveRef.current = null;
    },
    [finish],
  );

  const loop = useCallback(
    (landmarker: PoseLandmarker) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      let lastVideoTime = -1;
      let lastPaint = 0;
      const tick = () => {
        frameRef.current = requestAnimationFrame(tick);
        if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;
        const now = performance.now();
        const lm = landmarker.detectForVideo(video, now).landmarks[0] ?? null;
        const tracker = trackerRef.current;
        const state = tracker ? tracker.update(lm, now) : null;
        liveRef.current = state;
        draw(canvas, video, lm, state?.failing ?? [], !!tracker);
        if (now - lastPaint > 100) {
          lastPaint = now;
          setLive(state);
          if (lm) setPersonSeen(true);
        }
        if (state && rule && isSetDone(rule, state)) completeSet(state);
      };
      tick();
    },
    [rule, completeSet],
  );

  async function start() {
    if (!window.isSecureContext) {
      setProblem('insecure');
      setPhase('error');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem('nocamera');
      setPhase('error');
      return;
    }
    setPhase('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (error) {
      setProblem(problemOf(error));
      setPhase('error');
      return;
    }
    streamRef.current = stream;
    try {
      await loadLandmarker();
    } catch {
      stop();
      setProblem('model');
      setPhase('error');
      return;
    }
    if (streamRef.current !== stream) return;
    trackerRef.current = rule ? createTracker(rule) : null;
    liveRef.current = null;
    setRef.current = 1;
    totalsRef.current = EMPTY;
    setSet(1);
    setTotals(EMPTY);
    setLive(null);
    setPersonSeen(false);
    setPhase('live');
  }

  useEffect(() => {
    if (phase !== 'live') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    let cancelled = false;
    video
      .play()
      .then(() => loadLandmarker())
      .then((landmarker) => {
        if (!cancelled) loop(landmarker);
      })
      .catch(() => {
        if (cancelled) return;
        stop();
        setProblem('other');
        setPhase('error');
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
    };
  }, [phase, loop, stop]);

  function exit() {
    stop();
    onExit();
  }

  if (phase === 'error') {
    const { title, text } = PROBLEMS[problem];
    return (
      <section className={styles.card} role="alert">
        <p className={styles.kicker}>{exercise.name}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={start}>
            Reintentar
          </button>
          <button type="button" className={styles.secondary} onClick={exit}>
            Elegir otro ejercicio
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'setup' || phase === 'starting') {
    return (
      <section className={styles.card} aria-labelledby="coach-titulo">
        <p className={styles.kicker}>PREPARATE</p>
        <h1 id="coach-titulo" className={styles.title}>
          {exercise.name}
        </h1>
        <ul className={styles.list}>
          <li>{rule ? rule.setup : 'Ubicá la cámara a 2–3 metros, que se te vea el cuerpo entero.'}</li>
          <li>Buena luz de frente, nada brillante detrás tuyo.</li>
          <li>El video se analiza en esta compu: no se graba ni se sube.</li>
          {rule ? <li>{SETS} series de {rule.mode === 'reps' ? `${rule.target} repeticiones` : `${rule.target} segundos`}. Las repeticiones mal hechas no cuentan.</li> : <li>Este ejercicio no tiene corrección todavía: vas a ver tu esqueleto en vivo.</li>}
        </ul>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={start} disabled={phase === 'starting'}>
            <Icon name="camera" /> {phase === 'starting' ? 'Abriendo cámara…' : 'Activar cámara'}
          </button>
          <button type="button" className={styles.secondary} onClick={exit}>
            Volver
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'done') {
    const worst = Object.entries(totals.errors).sort((a, b) => b[1] - a[1])[0];
    return (
      <section className={styles.card} aria-labelledby="resumen-titulo">
        <p className={styles.kicker}>RESUMEN</p>
        <h1 id="resumen-titulo" className={styles.title}>
          {exercise.name}
        </h1>
        {rule ? (
          <div className={styles.summary}>
            {rule.mode === 'reps' ? (
              <div className={styles.stat}>
                <span className={styles.statValue}>{totals.reps}</span>
                <span className={styles.statLabel}>repeticiones bien hechas</span>
              </div>
            ) : (
              <div className={styles.stat}>
                <span className={styles.statValue}>{Math.round(totals.holdMs / 1000)} s</span>
                <span className={styles.statLabel}>en buena postura</span>
              </div>
            )}
            {rule.mode === 'reps' ? (
              <div className={styles.stat}>
                <span className={styles.statValue}>{totals.badReps}</span>
                <span className={styles.statLabel}>para corregir</span>
              </div>
            ) : null}
            <div className={styles.stat}>
              <span className={styles.statValue}>{worst ? worst[1] : 0}</span>
              <span className={styles.statLabel}>{worst ? `veces: «${worst[0]}»` : 'correcciones'}</span>
            </div>
          </div>
        ) : (
          <p className={styles.text}>Sesión terminada.</p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={start}>
            Otra vez
          </button>
          <button type="button" className={styles.secondary} onClick={exit}>
            Elegir otro ejercicio
          </button>
        </div>
      </section>
    );
  }

  const target = rule?.target ?? 0;
  const count = rule && live ? (rule.mode === 'reps' ? live.reps : Math.floor(live.holdMs / 1000)) : 0;
  const fill = rule && live ? (rule.mode === 'reps' ? live.progress : Math.min(1, live.holdMs / (rule.target * 1000))) : 0;
  const framing = !rule ? !personSeen : !live || live.status === 'framing';

  return (
    <section className={styles.stage} aria-label={`Entrenando: ${exercise.name}`}>
      <div className={styles.videoWrap}>
        <video ref={videoRef} className={styles.video} muted playsInline />
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        {framing ? <p className={styles.framing}>{live?.message ?? 'Buscándote… ubicate frente a la cámara.'}</p> : null}
        {flash ? <p className={styles.flash}>{flash}</p> : null}
      </div>

      <aside className={styles.panel}>
        <p className={styles.kicker}>{exercise.name}</p>
        {rule ? (
          <>
            <p className={styles.setLabel}>
              SERIE {set}/{SETS}
            </p>
            <p className={styles.count} aria-live="polite">
              {count}
              <span className={styles.target}>
                /{target}
                {rule.mode === 'hold' ? ' s' : ''}
              </span>
            </p>
            <div className={styles.bar} aria-hidden="true">
              <div className={styles.barFill} style={{ width: `${Math.round(fill * 100)}%` }} />
            </div>
            <p className={`${styles.message} ${styles[live?.tone ?? 'info']}`} aria-live="polite">
              {live?.message ?? 'Ubicate frente a la cámara.'}
            </p>
            {rule.mode === 'reps' ? <p className={styles.stats}>Para corregir en esta serie: {live?.badReps ?? 0}</p> : null}
          </>
        ) : (
          <p className={`${styles.message} ${styles.info}`}>Análisis de postura todavía no disponible para este ejercicio. Mirá tu esqueleto para controlar el movimiento.</p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={finish}>
            Terminar
          </button>
          <button type="button" className={styles.secondary} onClick={exit}>
            Salir
          </button>
        </div>
      </aside>
    </section>
  );
};

export default PoseCoach;
