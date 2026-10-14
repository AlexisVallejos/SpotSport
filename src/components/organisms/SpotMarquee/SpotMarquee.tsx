import ScrollVelocity from '../../reactbits/ScrollVelocity';
import styles from './SpotMarquee.module.css';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Banda que acelera con el scroll (React Bits · ScrollVelocity). */
const SpotMarquee = () => (
  <div className={styles.band}>
    <p className={styles.srOnly}>No es solo deporte. Es tu forma de moverte. Running, entrenamiento, fútbol y sportstyle.</p>
    <div aria-hidden="true">
      <ScrollVelocity
        // Una sola fila y más lenta: acompaña sin competir con la portada.
        texts={[<>NO ES SOLO DEPORTE <i>✦</i> ES TU FORMA DE MOVERTE <i>✦</i> RUNNING <i>/</i> ENTRENAMIENTO <i>/</i> FÚTBOL <i>/</i> SPORTSTYLE <i>✦</i></>]}
        velocity={reduced() ? 0 : 18}
        numCopies={4}
        className={styles.text}
        parallaxClassName={styles.row}
        scrollerClassName={styles.scroller}
      />
    </div>
  </div>
);

export default SpotMarquee;
