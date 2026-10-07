import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../atoms';
import { videos } from '../../../data/images';
import styles from './IntroSplash.module.css';

const MAX_WAIT_MS = 8000;
const FADE_MS = 600;

const shouldPlayIntro = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const IntroSplash: FunctionComponent = () => {
  const [visible, setVisible] = useState(shouldPlayIntro);
  const [leaving, setLeaving] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const finish = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), FADE_MS);
  }, []);

  // Se intenta reproducir con sonido. Si el navegador lo bloquea (política de
  // autoplay), arranca en silencio y el botón permite activar el audio.
  useEffect(() => {
    const video = videoRef.current;
    if (!visible || !video) return;
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      video.play().catch(finish);
    });
  }, [visible, finish]);

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

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (video.paused) video.play().catch(() => undefined);
  };

  if (!visible) return null;

  return (
    <div
      className={`${styles.introSplash} ${leaving ? styles.leaving : ''}`}
      role="dialog"
      aria-label="Intro de SPOT"
    >
      <video
        ref={videoRef}
        className={styles.video}
        src={videos.intro}
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      />
      <button type="button" className={styles.sound} onClick={toggleSound} aria-pressed={!muted}>
        <Icon name={muted ? 'volumeOff' : 'volume'} />
        {muted ? 'Activar sonido' : 'Silenciar'}
      </button>
      <button type="button" className={styles.skip} onClick={finish}>
        Saltar intro
      </button>
    </div>
  );
};

export default IntroSplash;
