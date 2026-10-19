import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import NotConfigured from '../../components/layout/NotConfigured';
import { Button, Card, Notice, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import styles from '../pages.module.css';

/** Solo se vuelve a rutas internas: nunca a un sitio externo. */
export function safeNext(value: string | null, fallback = '/cuenta'): string {
  // "/\\sitio.com" el navegador lo lee como "//sitio.com": también se descarta.
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : fallback;
}

export default function Login() {
  const { configured, session, signIn } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!configured) return <NotConfigured />;
  if (session) return <Navigate to={next} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(next, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos ingresar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.authWrap}>
      <Card title="Ingresar">
        <form className={styles.form} onSubmit={submit}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          <Button type="submit" variant="primary" block disabled={busy}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </Button>
          <p className={styles.alt}>
            ¿Primera vez? <Link to={`/registro${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Creá tu cuenta</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
