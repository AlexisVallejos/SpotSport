import { FunctionComponent, useEffect, useRef } from 'react';
import { videoFor } from '../../../data/trainingVideos';
import type { RuleId } from '../../../lib/pose/rules';
import styles from './ExerciseVideo.module.css';

export type ExerciseVideoProps = { id: RuleId; className?: string };

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Loop de técnica: se reproduce sólo mientras está a la vista (ocho a la vez cansan a una compu modesta). */
const ExerciseVideo: FunctionComponent<ExerciseVideoProps> = ({ id, className }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const { src, poster } = videoFor(id);

  useEffect(() => {
    const video = ref.current;
    if (!video || reducedMotion()) return;
    if (typeof IntersectionObserver === 'undefined') {
      void video.play().catch(() => {});
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.2 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  return <video ref={ref} className={`${styles.video} ${className ?? ''}`} src={src} poster={poster} muted loop playsInline preload="none" aria-hidden="true" />;
};

export default ExerciseVideo;
