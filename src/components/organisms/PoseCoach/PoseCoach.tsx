import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { Clapperboard, Maximize, Minimize, Pause, Play } from 'lucide-react';
import ExerciseVideo from '../../molecules/ExerciseVideo/ExerciseVideo';
import { cuesFor } from '../../../lib/pose/demo';
import { Icon } from '../../atoms';
import { measure, type Reading } from '../../../lib/pose/debug';
import { createTracker, isSetDone, type Tracker, type TrackerState } from '../../../lib/pose/engine';
import { fallbackLandmarker, loadLandmarker, type LandmarkerInfo, type Quality } from '../../../lib/pose/landmarker';
import { drawOverlay } from '../../../lib/pose/overlay';
import type { PoseRule, Triple } from '../../../lib/pose/rules';
import { phrasesFor } from '../../../lib/pose/phrases';
import { createNarrator, introText, nextSetText, setDoneText, summaryText, type Narrator } from '../../../lib/pose/script';
import { activity, readConfig, saveSession, sumSets, tempo, withTarget, writeConfig, type Activity, type SessionConfig, type SetResult } from '../../../lib/pose/session';
import { createSmoother } from '../../../lib/pose/smoothing';
import { readVoicePref, speak, stopSpeaking, voiceSupported, warmVoice, writeVoicePref } from '../../../lib/voice';
import type { Exercise } from '../../../lib/wger';
import RepDots from './RepDots';
import SessionSetup from './SessionSetup';
import SessionSummary from './SessionSummary';
import styles from './PoseCoach.module.css';

export type PoseCoachProps = {
  exercise: Exercise;
  rule: PoseRule | null;
  onExit: () => void;
};

type Phase = 'setup' | 'starting' | 'live' | 'done' | 'error';
type Problem = 'denied' | 'nocamera' | 'insecure' | 'model' | 'other';
type Flash = { key: number; text: string; tone: 'ok' | 'warn' | 'info' };

/** Below this many analyzed frames per second, for a few seconds in a row, the full model is swapped for lite. */
const SLOW_FPS = 14;
const SLOW_WINDOWS = 3;
/** Once a machine proved slow, the next session starts with lite directly. */
let preferred: Quality = 'full';

const PROBLEMS: Record<Problem, { title: string; text: string }> = {
  denied: { title: 'Sin permiso para la cámara', text: 'Tocá el ícono de la cámara o del candado en la barra de direcciones, elegí «Permitir» y volvé a intentar.' },
  nocamera: { title: 'No encontramos una cámara', text: 'Conectá una webcam o cerrá otras apps que la estén usando (Zoom, Meet, OBS…).' },
  insecure: { title: 'La cámara necesita HTTPS', text: 'Abrí la página con https:// o desde localhost: el navegador bloquea la cámara en sitios sin cifrar.' },
  model: { title: 'No se pudo cargar el analizador', text: 'Revisá tu conexión a internet e intentá de nuevo.' },
  other: { title: 'No pudimos abrir la cámara', text: 'Intentá de nuevo. Si sigue fallando, recargá la página.' },
};

/** What went wrong, technically: shown small under the explanation, to tell apart a driver from a permission. */
function detailOf(error: unknown): string {
  if (error instanceof Error || error instanceof DOMException) return `${error.name}: ${error.message}`.slice(0, 180);
  return String(error).slice(0, 180);
}

/** Ideal resolution first; some webcams and drivers reject any constraint, so then the plainest request. */
async function openCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'NotFoundError') throw error;
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

/** play() is interrupted when the stream is attached twice (React's dev double effects); once more is enough. */
async function playVideo(video: HTMLVideoElement) {
  try {
    await video.play();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') await video.play();
    else throw error;
  }
}

function problemOf(error: unknown): Problem {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') return 'nocamera';
  return 'other';
}

const toResult = (state: TrackerState): SetResult => ({ reps: state.reps, badReps: state.badReps, holdMs: state.holdMs, log: state.log, errors: state.errors });
const hasActivity = (state: TrackerState | null) => !!state && (state.reps + state.badReps > 0 || state.holdMs >= 1000);

const PoseCoach: FunctionComponent<PoseCoachProps> = ({ exercise, rule: baseRule, onExit }) => {
  const stageRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const infoRef = useRef<LandmarkerInfo | null>(null);
  const trackerRef = useRef<Tracker | null>(null);
  const liveRef = useRef<TrackerState | null>(null);
  const narratorRef = useRef<Narrator | null>(null);
  const voiceOnRef = useRef(readVoicePref());
  const setRef = useRef(1);
  const resultsRef = useRef<SetResult[]>([]);
  const restUntilRef = useRef(0);
  const pausedRef = useRef(false);
  const [config, setConfig] = useState<SessionConfig | null>(() => (baseRule ? readConfig(baseRule) : null));
  // The rule with the target the person chose: the tracker, the coach and the screen read it from here.
  const rule = baseRule && config ? withTarget(baseRule, config.target) : null;
  const ruleRef = useRef(rule);
  ruleRef.current = rule;
  const sets = config?.sets ?? 1;
  const [phase, setPhase] = useState<Phase>('setup');
  const [problem, setProblem] = useState<Problem>('other');
  const [problemDetail, setProblemDetail] = useState('');
  const [live, setLive] = useState<TrackerState | null>(null);
  const [set, setSet] = useState(1);
  const [results, setResults] = useState<SetResult[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [personSeen, setPersonSeen] = useState(false);
  const [bodySeen, setBodySeen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(voiceOnRef.current);
  const [stats, setStats] = useState<Activity | null>(null);
  // Miniatura de la técnica correcta: aparece un rato cada vez que algo sale mal, o fija si la persona la pide.
  const [techniquePinned, setTechniquePinned] = useState(false);
  const [techniqueFlash, setTechniqueFlash] = useState(false);
  // Live numbers for calibrating: the Datos button, or ?debug in the address.
  const debugRef = useRef(typeof location !== 'undefined' && /[?&]debug/.test(location.href));
  const [debugOn, setDebugOn] = useState(debugRef.current);
  const [reading, setReading] = useState<Reading | null>(null);
  const [fps, setFps] = useState(0);
  const [model, setModel] = useState<LandmarkerInfo | null>(null);
  const canSpeak = voiceSupported();
  // iPhone Safari only lets a <video> go fullscreen, not the whole stage: there the button would do nothing.
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  const say = useCallback((text: string, urgent = false) => {
    if (voiceOnRef.current) speak(text, urgent);
  }, []);

  // Short on purpose: what we are doing and where to stand. The steps are in the demo.
  const intro = useCallback(() => introText(baseRule), [baseRule]);

  useEffect(() => {
    warmVoice(phrasesFor(baseRule, sets));
  }, [baseRule, sets]);

  function changeConfig(next: SessionConfig) {
    setConfig(next);
    if (baseRule) writeConfig(baseRule, next);
  }

  function toggleVoice() {
    const next = !voiceOnRef.current;
    voiceOnRef.current = next;
    writeVoicePref(next);
    setVoiceOn(next);
    if (!next) stopSpeaking();
    else if (phase === 'setup') speak(intro());
  }

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  const fail = useCallback(
    (kind: Problem, error?: unknown) => {
      stop();
      stopSpeaking();
      setProblem(kind);
      setProblemDetail(error === undefined ? '' : detailOf(error));
      setPhase('error');
    },
    [stop],
  );

  useEffect(() => stop, [stop]);
  useEffect(() => stopSpeaking, []);

  // Like a teacher at the start of the class: what we are doing and how, while you get in position.
  useEffect(() => {
    if (phase === 'setup') say(intro());
  }, [phase, intro, say]);

  // Each screen starts at the top: on a phone the camera button is at the bottom of a long setup screen.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current && !!stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const warning = phase === 'live' && live?.status === 'active' && live.tone === 'warn';
  useEffect(() => {
    if (!warning) return;
    setTechniqueFlash(true);
    const timer = window.setTimeout(() => setTechniqueFlash(false), 5000);
    return () => window.clearTimeout(timer);
  }, [warning, live?.message]);

  const showFlash = useCallback((text: string, tone: Flash['tone']) => setFlash({ key: performance.now(), text, tone }), []);

  const finish = useCallback(() => {
    // A set left halfway still counts for the summary, if something was done in it.
    if (hasActivity(liveRef.current)) resultsRef.current = [...resultsRef.current, toResult(liveRef.current!)];
    liveRef.current = null;
    setResults(resultsRef.current);
    stop();
    setPhase('done');
    const current = ruleRef.current;
    const totals = sumSets(resultsRef.current);
    const history = saveSession({ at: Date.now(), exercise: exercise.name, rule: current?.id ?? null, sets: resultsRef.current.length, reps: totals.reps, badReps: totals.badReps, holdMs: totals.holdMs });
    setStats(activity(history, Date.now()));
    say(summaryText(current, totals), true);
  }, [stop, say, exercise.name]);

  const completeSet = useCallback(
    (state: TrackerState) => {
      resultsRef.current = [...resultsRef.current, toResult(state)];
      liveRef.current = null;
      setResults(resultsRef.current);
      if (setRef.current >= sets) {
        finish();
        return;
      }
      say(setDoneText(setRef.current, sets), true);
      // A real rest: nothing counts and nothing is said until it ends or you skip it.
      const restMs = (config?.restS ?? 15) * 1000;
      restUntilRef.current = performance.now() + restMs;
      setRestLeft(Math.ceil(restMs / 1000));
      setRef.current += 1;
      setSet(setRef.current);
      setLive(null);
    },
    [finish, say, sets, config?.restS],
  );

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!video || !canvas || !ctx) return;
    const smoother = createSmoother();
    let lastVideoTime = -1;
    let lastPaint = 0;
    let frames = 0;
    let windowStart = performance.now();
    let slowWindows = 0;
    let downgrading = false;
    let lastLog = 0;
    let wasReady = false;
    let switching = false;

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick);
      const landmarker = landmarkerRef.current;
      if (!landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      let raw = null;
      try {
        raw = landmarker.detectForVideo(video, now).landmarks[0] ?? null;
      } catch (error) {
        // Some GPU drivers load the model and fail on the first frame: step down to a safer landmarker.
        if (switching) return;
        const next = infoRef.current ? fallbackLandmarker(infoRef.current) : null;
        if (!next) {
          fail('model', error);
          return;
        }
        switching = true;
        landmarkerRef.current = null;
        next
          .then(({ landmarker: safer, info }) => {
            landmarkerRef.current = safer;
            infoRef.current = info;
            preferred = 'lite';
            setModel(info);
            switching = false;
          })
          .catch((reason: unknown) => fail('model', reason));
        return;
      }
      const lm = smoother.smooth(raw, now);
      const current = ruleRef.current;
      const plain = { failing: [], judged: false, measured: null, degrees: null, reached: false, guide: false };

      frames += 1;
      if (now - windowStart > 1000) {
        const rate = (frames * 1000) / (now - windowStart);
        if (debugRef.current) setFps(Math.round(rate));
        // A machine that cannot keep up gives late, jumpy angles: lite is less precise but steadier there.
        slowWindows = infoRef.current?.quality === 'full' && rate < SLOW_FPS ? slowWindows + 1 : 0;
        if (slowWindows >= SLOW_WINDOWS && !downgrading) {
          downgrading = true;
          preferred = 'lite';
          void loadLandmarker('lite')
            .then(({ landmarker: lite, info }) => {
              landmarkerRef.current = lite;
              infoRef.current = info;
              setModel(info);
            })
            .catch(() => {});
        }
        frames = 0;
        windowStart = now;
      }

      if (restUntilRef.current > 0) {
        drawOverlay(ctx, width, height, { lm, ...plain });
        if (now < restUntilRef.current) {
          if (now - lastPaint > 250) {
            lastPaint = now;
            setRestLeft(Math.ceil((restUntilRef.current - now) / 1000));
          }
          return;
        }
        restUntilRef.current = 0;
        setRestLeft(0);
        trackerRef.current?.reset();
        lastLog = 0;
        wasReady = false;
        say(nextSetText(setRef.current), true);
        return;
      }

      if (pausedRef.current) {
        drawOverlay(ctx, width, height, { lm, ...plain });
        return;
      }

      const tracker = trackerRef.current;
      const state = tracker ? tracker.update(lm, now) : null;
      liveRef.current = state;
      const line = state ? narratorRef.current?.update(state, now) : null;
      if (line) say(line.text, line.urgent);

      // The counted angle, drawn on the body while it is being judged.
      let measured: Triple | null = null;
      let degrees: number | null = null;
      if (current?.mode === 'reps' && lm && state?.status === 'active' && state.side) {
        measured = current.measured(lm, state.side);
        degrees = current.metric(lm, state.side);
      }
      drawOverlay(ctx, width, height, {
        lm,
        failing: state?.failing ?? [],
        judged: !!state && state.status === 'active',
        measured,
        degrees,
        reached: !!state && state.progress >= 1,
        guide: !lm || state?.status === 'framing',
      });

      if (state) {
        if (state.log.length > lastLog) {
          const mark = state.log[state.log.length - 1];
          showFlash(mark.ok ? `+1` : 'No contó', mark.ok ? 'ok' : 'warn');
          lastLog = state.log.length;
        }
        if (state.ready && !wasReady && state.log.length === 0 && state.holdMs < 1000) showFlash('¡Listo! Arrancá', 'info');
        wasReady = state.ready;
      }

      if (now - lastPaint > 100) {
        lastPaint = now;
        if (debugRef.current) setReading(current && lm ? measure(current, lm, state?.side ?? undefined) : null);
        setLive(state);
        setBodySeen(!!lm);
        if (lm) setPersonSeen(true);
      }
      if (state && current && isSetDone(current, state)) completeSet(state);
    };
    tick();
  }, [completeSet, say, showFlash, fail]);

  async function start() {
    stopSpeaking();
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
    setProblemDetail('');
    let stream: MediaStream;
    try {
      stream = await openCamera();
    } catch (error) {
      fail(problemOf(error), error);
      return;
    }
    streamRef.current = stream;
    try {
      const { landmarker, info } = await loadLandmarker(preferred);
      landmarkerRef.current = landmarker;
      infoRef.current = info;
      setModel(info);
    } catch (error) {
      fail('model', error);
      return;
    }
    if (streamRef.current !== stream) return;
    trackerRef.current = rule ? createTracker(rule) : null;
    narratorRef.current = rule ? createNarrator(rule) : null;
    liveRef.current = null;
    setRef.current = 1;
    resultsRef.current = [];
    restUntilRef.current = 0;
    pausedRef.current = false;
    setSet(1);
    setResults([]);
    setLive(null);
    setRestLeft(0);
    setPaused(false);
    setPersonSeen(false);
    setBodySeen(false);
    setPhase('live');
  }

  useEffect(() => {
    if (phase !== 'live') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    let cancelled = false;
    playVideo(video)
      .then(() => {
        if (!cancelled) loop();
      })
      .catch((error: unknown) => {
        if (!cancelled) fail('other', error);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
    };
  }, [phase, loop, stop]);

  function exit() {
    stop();
    stopSpeaking();
    onExit();
  }

  function togglePause() {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) stopSpeaking();
    // Coming back, the starting position is asked again: whatever happened during the pause does not count.
    else trackerRef.current?.rearm();
  }

  function toggleFullscreen() {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void stage.requestFullscreen?.().catch(() => {});
  }

  const voiceButton = canSpeak ? (
    <button type="button" className={styles.voice} onClick={toggleVoice} aria-pressed={voiceOn}>
      <Icon name={voiceOn ? 'volume' : 'volumeOff'} size={18} /> Voz: {voiceOn ? 'sí' : 'no'}
    </button>
  ) : null;

  if (phase === 'error') {
    const { title, text } = PROBLEMS[problem];
    return (
      <section className={styles.card} role="alert">
        <p className={styles.kicker}>{exercise.name}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        {problemDetail ? <p className={styles.detail}>Detalle técnico: {problemDetail}</p> : null}
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
    return <SessionSetup exercise={exercise} rule={baseRule} config={config} starting={phase === 'starting'} voiceButton={voiceButton} onConfig={changeConfig} onStart={start} onBack={exit} />;
  }

  if (phase === 'done') {
    return <SessionSummary exercise={exercise} rule={rule} sets={results} activity={stats} onAgain={start} onAdjust={() => setPhase('setup')} onExit={exit} />;
  }

  const target = rule?.target ?? 0;
  const count = rule && live ? (rule.mode === 'reps' ? live.reps : Math.floor(live.holdMs / 1000)) : 0;
  const fill = rule && live ? (rule.mode === 'reps' ? live.progress : Math.min(1, live.holdMs / (rule.target * 1000))) : 0;
  const framing = !rule ? !personSeen : !live || live.status === 'framing';
  const message =
    restLeft > 0
      ? `Descansá. Después seguimos con la serie ${set}.`
      : paused
        ? 'En pausa.'
        : rule
          ? (live?.message ?? 'Ubicate frente a la cámara.')
          : personSeen
            ? 'Te veo: controlá el movimiento con tu esqueleto.'
            : 'Buscándote… ubicate frente a la cámara.';
  const tone = rule && restLeft === 0 && !paused ? (live?.tone ?? 'info') : 'info';
  const pill = !bodySeen
    ? { tone: styles.pillBad, text: 'No te veo' }
    : framing
      ? { tone: styles.pillWarn, text: live?.missing.length ? `Me falta ver: ${live.missing.join(', ')}` : 'Te veo a medias' }
      : { tone: styles.pillOk, text: 'Te veo bien' };
  const pace = live ? tempo(live.log) : null;

  return (
    <section ref={stageRef} className={`${styles.stage} ${fullscreen ? styles.stageFull : ''}`} aria-label={`Entrenando: ${exercise.name}`}>
      {/* Sobre el video todo queda oscuro en los dos temas: se lee mejor encima de una imagen. */}
      <div className={`${styles.videoWrap} theme-dark`}>
        <video ref={videoRef} className={styles.video} muted playsInline />
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

        <p className={`${styles.pill} ${pill.tone}`} role="status">
          <span className={styles.pillDot} aria-hidden="true" />
          {pill.text}
        </p>

        {rule ? (
          <div className={styles.counter} aria-hidden="true">
            <span className={styles.counterSet}>
              SERIE {set}/{sets}
            </span>
            <span className={styles.counterValue}>
              {count}
              <small>
                /{target}
                {rule.mode === 'hold' ? ' s' : ''}
              </small>
            </span>
            {rule.mode === 'reps' ? <RepDots log={live?.log ?? []} target={target} /> : null}
          </div>
        ) : null}

        {rule ? (
          <div className={styles.gauge} aria-hidden="true">
            <div className={`${styles.gaugeFill} ${fill >= 1 ? styles.gaugeDone : ''}`} style={{ height: `${Math.round(fill * 100)}%` }} />
            <span className={styles.gaugeLabel}>{rule.mode === 'reps' ? 'PROFUNDIDAD' : 'TIEMPO'}</span>
          </div>
        ) : null}

        {restLeft === 0 && !paused ? <p className={`${styles.banner} ${styles[tone]}`}>{message}</p> : null}

        {flash ? (
          <p key={flash.key} className={`${styles.flash} ${styles[`flash_${flash.tone}`]}`} aria-hidden="true">
            {flash.text}
          </p>
        ) : null}

        {restLeft > 0 ? (
          <div className={styles.rest} role="status">
            <p className={styles.restTitle}>Descansá</p>
            <p className={styles.restTime}>{restLeft}</p>
            <p className={styles.restNext}>
              Después: serie {set} de {sets}
            </p>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                restUntilRef.current = performance.now();
              }}>
              Seguir ya
            </button>
          </div>
        ) : null}

        {paused && restLeft === 0 ? (
          <div className={styles.rest} role="status">
            <p className={styles.restTitle}>En pausa</p>
            <p className={styles.restNext}>Cuando vuelvas, ponete en la posición de inicio.</p>
            <button type="button" className={styles.primary} onClick={togglePause}>
              <Play size={18} aria-hidden="true" /> Seguir
            </button>
          </div>
        ) : null}

        {baseRule && (techniquePinned || techniqueFlash) && restLeft === 0 && !paused ? (
          <div className={styles.technique}>
            <ExerciseVideo id={baseRule.id} />
            <p>
              <strong>ASÍ SE HACE</strong>
              {cuesFor(baseRule.id).peak}
            </p>
          </div>
        ) : null}

        <div className={styles.videoControls}>
          {baseRule ? (
            <button type="button" onClick={() => setTechniquePinned((on) => !on)} aria-pressed={techniquePinned} aria-label="Ver la técnica correcta" title="Ver la técnica correcta">
              <Clapperboard size={20} aria-hidden="true" />
            </button>
          ) : null}
          {rule ? (
            <button type="button" onClick={togglePause} aria-label={paused ? 'Seguir' : 'Pausar'} title={paused ? 'Seguir' : 'Pausar'}>
              {paused ? <Play size={20} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}
            </button>
          ) : null}
          {canFullscreen ? (
            <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (se ve mejor de lejos)'}>
              {fullscreen ? <Minimize size={20} aria-hidden="true" /> : <Maximize size={20} aria-hidden="true" />}
            </button>
          ) : null}
        </div>
      </div>

      <aside className={styles.panel}>
        <p className={styles.kicker}>{exercise.name}</p>
        {rule ? (
          <>
            <p className={styles.setLabel}>
              SERIE {set} DE {sets}
            </p>
            <p className={styles.count} aria-live="polite">
              {count}
              <span className={styles.target}>
                /{target}
                {rule.mode === 'hold' ? ' s' : ''}
              </span>
            </p>
            <div className={styles.bar} aria-hidden="true">
              <div className={`${styles.barFill} ${fill >= 1 ? styles.barDone : ''}`} style={{ width: `${Math.round(fill * 100)}%` }} />
            </div>
            <p className={`${styles.message} ${styles[tone]}`} aria-live="polite">
              {message}
            </p>
            {rule.mode === 'reps' ? (
              <>
                <RepDots log={live?.log ?? []} large />
                <p className={styles.stats}>
                  Bien: {live?.reps ?? 0} · Para corregir: {live?.badReps ?? 0}
                  {pace !== null ? ` · ${(pace / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s por repetición` : ''}
                </p>
              </>
            ) : null}
            {results.length > 0 ? (
              <ol className={styles.doneSets} aria-label="Series terminadas">
                {results.map((result, index) => (
                  <li key={index}>
                    Serie {index + 1}: {rule.mode === 'reps' ? `${result.reps} bien · ${result.badReps} a corregir` : `${Math.round(result.holdMs / 1000)} s`}
                  </li>
                ))}
              </ol>
            ) : null}
            {exercise.tip ? (
              <p className={styles.tipLine}>
                <strong>Tip:</strong> {exercise.tip}
              </p>
            ) : null}
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
          {voiceButton}
          <button
            type="button"
            className={styles.voice}
            aria-pressed={debugOn}
            onClick={() => {
              debugRef.current = !debugRef.current;
              setDebugOn(debugRef.current);
            }}>
            Datos
          </button>
        </div>
        {debugOn ? (
          <div className={styles.debug} aria-live="off">
            <p>
              modelo: <b>{model ? `${model.quality} · ${model.delegate}` : '…'}</b> · {fps} fps
            </p>
            {reading && rule ? (
              <>
                <p>
                  lado: <b>{reading.side === 'left' ? 'izquierdo' : 'derecho'}</b> · articulaciones: <b>{reading.visible}/{reading.total}</b> · visibilidad mín: <b>{reading.minVisibility.toFixed(2)}</b>
                </p>
                {reading.metric !== null ? (
                  <p>
                    ángulo: <b>{Math.round(reading.metric)}°</b> · reposo {reading.rest}° → profundidad {reading.peak}° · progreso <b>{Math.round((reading.progress ?? 0) * 100)}%</b>
                  </p>
                ) : null}
                {reading.checks.map((check) => (
                  <p key={check.message} className={check.ok ? styles.checkOk : styles.checkBad}>
                    {check.ok ? '✓' : '✗'} {check.message}
                  </p>
                ))}
              </>
            ) : (
              <p>Sin cuerpo detectado</p>
            )}
          </div>
        ) : null}
      </aside>
    </section>
  );
};

export default PoseCoach;
