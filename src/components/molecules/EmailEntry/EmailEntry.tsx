import { FormEvent, FunctionComponent, useState } from 'react';
import { Icon } from '../../atoms';
import styles from './EmailEntry.module.css';

export type EmailEntryProps = {
  placeholder: string;
};

type Status = { kind: 'idle' | 'sending' | 'done' | 'subscribed' | 'error'; text?: string };

async function send(path: string, email: string): Promise<string> {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? 'No pudimos anotarte. Probá de nuevo en un rato.');
  return body.estado as string;
}

// Newsletter "Seguí en movimiento": guarda sólo el mail (ver /legal#privacidad) y permite darse de baja.
const EmailEntry: FunctionComponent<EmailEntryProps> = ({ placeholder }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ kind: 'sending' });
    try {
      const estado = await send('/api/suscripciones', email);
      setStatus(estado === 'nuevo' ? { kind: 'done', text: '¡Listo! Ya estás en la lista de SPOT.' } : { kind: 'subscribed', text: 'Ese mail ya estaba anotado.' });
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'No pudimos anotarte.' });
    }
  };

  const unsubscribe = async () => {
    setStatus({ kind: 'sending' });
    try {
      await send('/api/suscripciones/baja', email);
      setStatus({ kind: 'done', text: 'Te dimos de baja. No vas a recibir más novedades.' });
      setEmail('');
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'No pudimos darte de baja.' });
    }
  };

  return (
    <div className={styles.wrapper}>
      <form className={styles.emailEntry} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="email"
          required
        />
        <button type="submit" className={styles.submit} aria-label="Suscribirme" disabled={status.kind === 'sending'}>
          <Icon name="arrowRight" />
        </button>
      </form>
      <p className={status.kind === 'error' ? styles.error : styles.message} role="status" aria-live="polite">
        {status.text}
        {status.kind === 'subscribed' ? (
          <>
            {' '}
            <button type="button" className={styles.unsubscribe} onClick={unsubscribe}>
              Darme de baja
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
};

export default EmailEntry;
