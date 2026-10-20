import type { ReactNode } from 'react';
import { images } from '../../data/images';
import { compactLeft, timeLeft } from '../../lib/coupons';
import styles from './Ticket.module.css';

type TicketProps = {
  /** Etiqueta de arriba a la derecha: "Cupón" o "Voucher". */
  kicker: string;
  merchant: string;
  discount: string;
  title: string;
  description?: string;
  expired?: boolean;
  children: ReactNode;
};

/** El ticket de SPOT: logo, comercio, descuento y, debajo de la línea de corte, lo que cada pantalla necesite. */
export function Ticket({ kicker, merchant, discount, title, description, expired = false, children }: TicketProps) {
  return (
    <article className={`${styles.ticket} ${expired ? styles.expired : ''}`}>
      <header className={styles.head}>
        <img className={styles.logo} src={images.logoDarkBg} alt="SPOT" />
        <span className={styles.kicker}>{kicker}</span>
      </header>
      <div className={styles.body}>
        <p className={styles.merchant}>{merchant}</p>
        <p className={styles.discount}>{discount}</p>
        <h2 className={styles.title}>{title}</h2>
        {description ? <p className={styles.desc}>{description}</p> : null}
      </div>
      <div className={styles.cut} aria-hidden="true" />
      <div className={styles.foot}>{children}</div>
      {expired ? <span className={styles.stamp}>VENCIDO</span> : null}
    </article>
  );
}

const SIZE = 64;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const LOW_MS = 3_600_000;

/** Anillo que se vacía a medida que el voucher se acerca a su vencimiento, con el reloj al lado. */
export function Countdown({ createdAt, expiresAt, now }: { createdAt: string; expiresAt: string; now: number }) {
  const left = timeLeft(expiresAt, now);
  const total = Math.max(1, new Date(expiresAt).getTime() - new Date(createdAt).getTime());
  const ratio = left.expired ? 0 : Math.min(1, left.ms / total);
  const low = !left.expired && left.ms < LOW_MS;
  const until = new Date(expiresAt).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className={styles.timer} role="timer" aria-label={left.label}>
      <div className={styles.ring} aria-hidden="true">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle className={styles.ringTrack} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} />
          <circle
            className={`${styles.ringFill} ${low ? styles.ringLow : ''}`}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          />
        </svg>
        <span className={styles.ringText}>{left.expired ? '0' : compactLeft(left.ms)}</span>
      </div>
      <div className={styles.timerText}>
        <p className={`${styles.timerMain} ${low ? styles.timerLow : ''}`}>{left.label}</p>
        <p className={styles.timerSub}>{left.expired ? 'Ya no se puede usar' : `Vence ${until}`}</p>
      </div>
    </div>
  );
}

export { styles as ticketStyles };
