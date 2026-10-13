import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play } from 'lucide-react';
import BlurText from '../../reactbits/BlurText';
import { heroShoes, isShown, ownerAt, planJump, progressAt, resolvePending } from '../../../data/heroShoes';
import { INTRO_DONE_EVENT } from '../IntroSplash/IntroSplash';
import styles from './LavaHero.module.css';

const MOBILE_QUERY = '(max-width: 720px)';
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const next = (i: number) => (i + 1) % heroShoes.length;
const previous = (i: number) => (i + heroShoes.length - 1) % heroShoes.length;

/**
 * Portada: el video de la lava manda. Cada zapatilla se forma, se queda y se
 * desintegra; el texto aparece al costado sólo mientras está completa en pantalla.
 * Al elegir otra zapatilla no se corta: se deja que la actual se desintegre y,
 * con la lava vacía, se salta al momento en que se forma la elegida.
 */
const LavaHero = () => {
  const video = useRef<HTMLVideoElement>(null);
  const section = useRef<HTMLElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  // Zapatilla elegida que espera a que la actual termine de irse.
  const pending = useRef<{ from: number; to: number } | null>(null);
  const [reduced] = useState(prefersReducedMotion);
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [owner, setOwner] = useState(0);
  const [shown, setShown] = useState(true);
  const [paused, setPaused] = useState(reduced);
  const [flash, setFlash] = useState(0);
  const userPaused = useRef(reduced);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const seek = useCallback((time: number) => {
    const element = video.current;
    if (!element) return;
    element.currentTime = time;
    setFlash(value => value + 1);
  }, []);

  // Sincroniza el estado con el cuadro que se está viendo. Con requestVideoFrameCallback
  // sólo trabaja cuando el video presenta un cuadro nuevo (nada si está pausado o
  // fuera de pantalla); en navegadores sin soporte cae a requestAnimationFrame.
  useEffect(() => {
    const element = video.current;
    if (reduced || !element) return;
    let handle = 0;
    let alive = true;
    const sync = () => {
      const t = element.currentTime;
      const target = pending.current && resolvePending(t, pending.current);
      if (target != null) {
        pending.current = null;
        seek(target);
      }
      const current = ownerAt(t);
      setOwner(pending.current?.to ?? current);
      setShown(!pending.current && isShown(current, t));
      progress.current?.style.setProperty('--progress', pending.current ? '0' : progressAt(t).toFixed(3));
    };
    const supportsFrames = 'requestVideoFrameCallback' in element;
    const loop = () => {
      if (!alive) return;
      sync();
      handle = supportsFrames ? element.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
    };
    loop();
    element.addEventListener('seeked', sync);
    return () => {
      alive = false;
      element.removeEventListener('seeked', sync);
      if (supportsFrames) element.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
    };
  }, [reduced, mobile, seek]);

  // Fuera de pantalla, con la pestaña oculta o mientras corre la intro, el video
  // no gasta batería. React no escribe el atributo `muted`, y sin él algunos
  // navegadores (Safari, ahorro de energía) bloquean el autoplay al recargar.
  useEffect(() => {
    const element = video.current;
    const root = section.current;
    if (reduced || !element || !root) return;
    element.muted = true;
    element.defaultMuted = true;
    element.setAttribute('muted', '');
    let visible = true;
    const sync = () => {
      const ready = document.documentElement.dataset.introDone === 'true';
      if (ready && visible && !document.hidden && !userPaused.current) {
        element.play().then(() => setPaused(false)).catch(() => setPaused(true));
      } else element.pause();
    };
    const onIntroDone = () => { element.currentTime = 0; sync(); };
    // Si el navegador bloqueó el autoplay, el primer toque o scroll lo destraba.
    const unlock = () => { if (element.paused) sync(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.15 });
    observer.observe(root);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener(INTRO_DONE_EVENT, onIntroDone);
    element.addEventListener('canplay', unlock);
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('scroll', unlock, { passive: true, once: true });
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener(INTRO_DONE_EVENT, onIntroDone);
      element.removeEventListener('canplay', unlock);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('scroll', unlock);
    };
  }, [reduced, mobile]);

  const goTo = (target: number) => {
    if (reduced) { setOwner(target); return; }
    const element = video.current;
    if (!element) return;
    const jump = planJump(element.currentTime, target, pending.current?.to);
    if (!jump) return;
    pending.current = jump.pending;
    seek(jump.seekTo);
    if (userPaused.current) togglePause();
  };

  const togglePause = () => {
    const element = video.current;
    if (reduced || !element) return;
    userPaused.current = !userPaused.current;
    setPaused(userPaused.current);
    if (userPaused.current) element.pause();
    else element.play().catch(() => undefined);
  };

  const shoe = heroShoes[owner];
  const textVisible = reduced || shown;

  return (
    <section ref={section} className={styles.hero} aria-roledescription="carrusel" aria-label="Zapatillas SPOT en la lava">
      <div className={styles.stage}>
        {reduced ? (
          <img className={styles.media} src={mobile ? shoe.posterMobile : shoe.poster} alt={`${shoe.name} sobre lava volcánica`} />
        ) : (
          <video
            ref={video}
            key={mobile ? 'mobile' : 'desktop'}
            className={styles.media}
            src={mobile ? '/video/hero-lava-mobile.mp4' : '/video/hero-lava-desktop.mp4'}
            poster={mobile ? heroShoes[0].posterMobile : heroShoes[0].poster}
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          />
        )}
        <span key={flash} className={flash ? styles.ember : undefined} aria-hidden="true" />
        <div className={styles.shade} aria-hidden="true" />
      </div>

      <h1 className={styles.tagline}>Todo el deporte<br />en un solo lugar</h1>

      <div className={`${styles.copy} ${textVisible ? styles.copyVisible : ''}`} aria-live="polite">
        <span className={styles.index}><b>{shoe.index}</b> / 03 · {shoe.discipline}</span>
        <BlurText key={shoe.key} as="h2" text={shoe.name} animateBy="letters" delay={28} stepDuration={0.28} direction="bottom" play={textVisible} className={styles.name} />
        <p className={styles.line}>{shoe.line}</p>
        <a href={shoe.href} className={styles.cta} tabIndex={textVisible ? 0 : -1}>Ver {shoe.discipline.toLowerCase()} <ArrowUpRight size={16} /></a>
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.round} onClick={() => goTo(previous(owner))} aria-label="Zapatilla anterior"><ArrowLeft size={15} /></button>
        <div className={styles.thumbs} role="group" aria-label="Elegí una zapatilla">
          {heroShoes.map((item, index) => (
            <button key={item.key} type="button" className={`${styles.thumb} ${index === owner ? styles.thumbActive : ''}`} onClick={() => goTo(index)} aria-label={`Mostrar ${item.name}`} aria-pressed={index === owner}>
              <img src={item.thumb} alt="" width={92} height={60} />
              {index === owner && !reduced && <div ref={progress} className={styles.progress} />}
            </button>
          ))}
        </div>
        <button type="button" className={styles.round} onClick={() => goTo(next(owner))} aria-label="Siguiente zapatilla"><ArrowRight size={15} /></button>
        {!reduced && (
          <button type="button" className={`${styles.round} ${styles.pause}`} onClick={togglePause} aria-label={paused ? 'Reproducir video' : 'Pausar video'}>
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
        )}
      </div>

      <a href="#deportes" className={styles.scrollCue}>Bajá <span aria-hidden="true" /></a>
    </section>
  );
};

export default LavaHero;
