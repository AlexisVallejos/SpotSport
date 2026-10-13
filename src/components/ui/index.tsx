import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useId } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { formatPrice } from '../../lib/money';
import styles from './ui.module.css';

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

type ButtonStyle = { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; small?: boolean; block?: boolean };
const buttonClass = ({ variant = 'primary', small, block }: ButtonStyle, extra?: string) => cx(styles.button, styles[variant], small && styles.small, block && styles.block, extra);

export function Button({ variant, small, block, className, type = 'button', ...rest }: ButtonStyle & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClass({ variant, small, block }, className)} {...rest} />;
}

export function ButtonLink({ variant, small, block, className, ...rest }: ButtonStyle & LinkProps) {
  return <Link className={buttonClass({ variant, small, block }, className)} {...rest} />;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {error ? <span className={styles.fieldError}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

/** Campo con etiqueta y un <input>. */
export function TextField({ label, hint, error, className, ...rest }: { label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label} hint={hint} error={error}>{(id) => <input id={id} className={cx(styles.input, className)} {...rest} />}</Field>;
}

export function TextArea({ label, hint, error, className, ...rest }: { label: string; hint?: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Field label={label} hint={hint} error={error}>{(id) => <textarea id={id} className={cx(styles.input, className)} {...rest} />}</Field>;
}

export function SelectField({ label, hint, error, className, children, ...rest }: { label: string; hint?: string; error?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <select id={id} className={cx(styles.input, className)} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Checkbox({ label, ...rest }: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={styles.check}>
      <input type="checkbox" {...rest} /> {label}
    </label>
  );
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx(styles.card, className)}>
      {title ? <h2 className={styles.cardTitle}>{title}</h2> : null}
      {children}
    </section>
  );
}

type Tone = 'ok' | 'warn' | 'bad' | 'brand' | 'neutral';
const TONE: Record<Tone, string | undefined> = { ok: styles.toneOk, warn: styles.toneWarn, bad: styles.toneBad, brand: styles.toneBrand, neutral: undefined };

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx(styles.badge, TONE[tone])}>{children}</span>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: ReactNode }) {
  return (
    <div className={cx(styles.notice, tone === 'error' && styles.noticeError, tone === 'ok' && styles.noticeOk)} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className={styles.pageTitle}>
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.row}>{actions}</div> : null}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className={styles.spinner} role="status">
      {label}
    </div>
  );
}

export function Stats({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className={styles.stats}>
      {items.map((item) => (
        <div key={item.label} className={styles.stat}>
          <span className={styles.statValue}>{item.value}</span>
          <span className={styles.statLabel}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>{children}</table>
    </div>
  );
}

export const Row = ({ children }: { children: ReactNode }) => <div className={styles.row}>{children}</div>;
export const Stack = ({ children }: { children: ReactNode }) => <div className={styles.stack}>{children}</div>;
export const Grid = ({ children }: { children: ReactNode }) => <div className={styles.grid2}>{children}</div>;
export const Muted = ({ children }: { children: ReactNode }) => <span className={styles.muted}>{children}</span>;
export const Price = ({ cents }: { cents: number }) => <>{formatPrice(cents)}</>;

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}
