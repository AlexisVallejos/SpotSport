import { FunctionComponent } from 'react';
import type { RepMark } from '../../../lib/pose/engine';
import styles from './PoseCoach.module.css';

/** One dot per repetition of the set: green if it counted, red if it did not. Empty slots up to the target. */
const RepDots: FunctionComponent<{ log: RepMark[]; target?: number; large?: boolean }> = ({ log, target = 0, large }) => {
  const empty = Math.max(0, target - log.filter((mark) => mark.ok).length);
  if (log.length === 0 && empty === 0) return null;
  const good = log.filter((mark) => mark.ok).length;
  return (
    <span className={`${styles.dots} ${large ? styles.dotsLarge : ''}`} role="img" aria-label={`${good} bien, ${log.length - good} para corregir`}>
      {log.map((mark, index) => (
        <span key={index} className={mark.ok ? styles.dotOk : styles.dotBad} />
      ))}
      {Array.from({ length: empty }, (_, index) => (
        <span key={`e${index}`} className={styles.dotEmpty} />
      ))}
    </span>
  );
};

export default RepDots;
