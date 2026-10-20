import { barRatio, dayLabel } from '../../lib/coupons';
import type { CouponDay } from '../../lib/types';
import styles from './ActivityChart.module.css';

/** Cupones obtenidos y clicks a la web por día, en barras. Sin librerías: son divs con altura en porcentaje. */
export default function ActivityChart({ days }: { days: CouponDay[] }) {
  const max = Math.max(0, ...days.flatMap((day) => [day.claims, day.clicks]));
  const total = days.reduce((sum, day) => sum + day.claims + day.clicks, 0);
  // Una etiqueta cada tantos días para que no se amontonen.
  const every = Math.max(1, Math.ceil(days.length / 10));

  return (
    <div className={styles.wrap}>
      <div className={styles.legend} aria-hidden="true">
        <span>
          <i className={`${styles.swatch} ${styles.claims}`} /> Cupones obtenidos
        </span>
        <span>
          <i className={`${styles.swatch} ${styles.clicks}`} /> Clicks a tu web
        </span>
      </div>
      <div
        className={styles.plot}
        role="img"
        aria-label={`Actividad de los últimos ${days.length} días: ${days.reduce((sum, day) => sum + day.claims, 0)} cupones obtenidos y ${days.reduce((sum, day) => sum + day.clicks, 0)} clicks`}>
        {days.map((day) => (
          <div key={day.day} className={styles.day} title={`${dayLabel(day.day)}: ${day.claims} obtenidos, ${day.clicks} clicks`}>
            <div className={`${styles.bar} ${styles.claims}`} style={{ height: `${barRatio(day.claims, max) * 100}%` }} />
            <div className={`${styles.bar} ${styles.clicks}`} style={{ height: `${barRatio(day.clicks, max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className={styles.axis} aria-hidden="true">
        {days.map((day, index) => (
          <span key={day.day}>{index % every === 0 || index === days.length - 1 ? dayLabel(day.day) : ''}</span>
        ))}
      </div>
      {total === 0 ? <p className={styles.empty}>Todavía no hay actividad en este período.</p> : null}
    </div>
  );
}
