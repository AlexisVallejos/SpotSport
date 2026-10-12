import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { cuesFor, figureAt, loop } from '../../../lib/pose/demo';
import { createDemoScene } from '../../../lib/pose/demoScene';
import type { PoseRule } from '../../../lib/pose/rules';
import styles from './ExerciseDemo.module.css';

export type ExerciseDemoProps = {
  rule: PoseRule;
};

type View = 'side' | 'front';
const AZIMUTH: Record<View, number> = { side: 0.12, front: Math.PI / 2 - 0.1 };

/** A 3D mannequin doing the exercise with the exact technique the analyzer will accept. */
const ExerciseDemo: FunctionComponent<ExerciseDemoProps> = ({ rule }) => {
  const host = useRef<HTMLDivElement>(null);
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [view, setView] = useState<View>('side');
  const [slow, setSlow] = useState(false);
  const [playing, setPlaying] = useState(!reduced.current);
  const [cue, setCue] = useState<'start' | 'peak'>('start');
  const [unavailable, setUnavailable] = useState(false);

  // What the animation loop reads every frame, without re-creating the scene.
  const live = useRef({ view, slow, playing, manual: 0, dragging: false, lastX: 0, auto: true });
  live.current.view = view;
  live.current.slow = slow;
  live.current.playing = playing;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const scene = createDemoScene(element);
    if (!scene) {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    scene.fit([0, 0.5, 1].map((p) => figureAt(rule.id, p)));
    const period = rule.mode === 'reps' ? 3.4 : 4.4;
    let frame = 0;
    let last = performance.now();
    // Starts a little before the deepest point so the first thing seen is already the movement.
    let clock = reduced.current ? period / 2 : 0;
    let azimuth = AZIMUTH.side;
    let shownCue: 'start' | 'peak' = 'start';

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const state = live.current;
      if (state.playing) clock += dt * (state.slow ? 0.45 : 1);
      const p = loop((clock / period) % 1);
      scene.show(figureAt(rule.id, p));

      const wanted = AZIMUTH[state.view] + state.manual + (state.auto && state.playing ? 0.32 * Math.sin(now / 1000 / 2.6) : 0);
      azimuth += (wanted - azimuth) * Math.min(1, dt * 6);
      scene.setView(azimuth, 0.22);
      scene.render();

      const next = p > 0.62 ? 'peak' : p < 0.38 ? 'start' : shownCue;
      if (next !== shownCue) {
        shownCue = next;
        setCue(next);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      scene.dispose();
    };
  }, [rule]);

  const cues = cuesFor(rule.id);
  const text = cue === 'peak' ? cues.peak : cues.start;

  function choose(next: View) {
    live.current.manual = 0;
    live.current.auto = true;
    setView(next);
  }

  if (unavailable) {
    return (
      <div className={styles.fallback} role="note">
        <p className={styles.kicker}>CÓMO SE HACE</p>
        <p>{cues.start}</p>
        <p>{cues.peak}</p>
      </div>
    );
  }

  return (
    <div className={styles.demo}>
      <div
        ref={host}
        className={styles.stage}
        role="img"
        aria-label={`Demostración en 3D de ${rule.name}. ${cues.start} ${cues.peak}`}
        onPointerDown={(event) => {
          live.current.dragging = true;
          live.current.lastX = event.clientX;
          live.current.auto = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!live.current.dragging) return;
          live.current.manual += (event.clientX - live.current.lastX) * 0.012;
          live.current.lastX = event.clientX;
        }}
        onPointerUp={() => {
          live.current.dragging = false;
        }}
        onPointerCancel={() => {
          live.current.dragging = false;
        }}
      />
      <p className={styles.cue} aria-live="off">
        {text}
      </p>
      <div className={styles.controls}>
        <button type="button" className={`${styles.chip} ${view === 'side' ? styles.on : ''}`} aria-pressed={view === 'side'} onClick={() => choose('side')}>
          Lado
        </button>
        <button type="button" className={`${styles.chip} ${view === 'front' ? styles.on : ''}`} aria-pressed={view === 'front'} onClick={() => choose('front')}>
          Frente
        </button>
        <button type="button" className={`${styles.chip} ${slow ? styles.on : ''}`} aria-pressed={slow} onClick={() => setSlow((value) => !value)}>
          Lento
        </button>
        <button type="button" className={styles.chip} onClick={() => setPlaying((value) => !value)}>
          {playing ? 'Pausa' : 'Reproducir'}
        </button>
      </div>
      <span className={styles.hint}>Arrastrá para girar</span>
    </div>
  );
};

export default ExerciseDemo;
