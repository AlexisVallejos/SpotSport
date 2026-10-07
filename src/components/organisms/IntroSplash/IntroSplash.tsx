import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { videos } from '../../../data/images';
import styles from './IntroSplash.module.css';

const MAX_WAIT_MS = 8000;
const FADE_MS = 600;

const shouldPlayIntro = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const IntroSplash: FunctionComponent = () => {
  const [visible, setVisible] = useState(shouldPlayIntro);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), FADE_MS);
  }, []);

  useEffect(() => {
    if (!visible) return;
    document.body.style.overflow = 'hidden';
    const timeout = window.setTimeout(finish, MAX_WAIT_MS);
    return () => {
      document.body.style.overflow = '';
      window.clearTimeout(timeout);
    };
  }, [visible, finish]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, finish]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.introSplash} ${leaving ? styles.leaving : ''}`}
      role="dialog"
      aria-label="Intro de SPOT"
    >
      <video
        className={styles.video}
        src={videos.intro}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      />
      <button type="button" className={styles.skip} onClick={finish}>
        Saltar intro
      </button>
    </div>
  );
};

export default IntroSplash;
