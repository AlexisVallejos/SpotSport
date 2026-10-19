import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import NotConfigured from '../../components/layout/NotConfigured';
import { Button, Card, Notice, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import styles from '../pages.module.css';
import { safeNext } from './Login';

export default function Register() {
  const { configured, session, signUp } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const loginLink = `/login${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!configured) return <NotConfigured />;
  if (session && !confirmEmail) return <Navigate to={next} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (password !== repeat) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp(email, password, name);
      if (needsConfirmation) setConfirmEmail(true);
      else navigate(next, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos crear la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  if (confirmEmail) {
    return (
      <div className={styles.authWrap}>
        <Card title="Revisá tu email">
          <Notice tone="ok">Te enviamos un enlace a {email}. Confirmá tu cuenta y después ingresá.</Notice>
          <p className={styles.alt}>
            <Link to={loginLink}>Ir a ingresar</Link>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.authWrap}>
      <Card title="Crear cuenta">
        <form className={styles.form} onSubmit={submit}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <TextField label="Nombre y apellido" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
          <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField label="Contraseña" type="password" autoComplete="new-password" required minLength={6} hint="Mínimo 6 caracteres." value={password} onChange={(event) => setPassword(event.target.value)} />
          <TextField label="Repetí la contraseña" type="password" autoComplete="new-password" required value={repeat} onChange={(event) => setRepeat(event.target.value)} />
          <Button type="submit" block disabled={busy}>
            {busy ? 'Creando…' : 'Crear cuenta'}
          </Button>
          <p className={styles.alt}>
            ¿Ya tenés cuenta? <Link to={loginLink}>Ingresá</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
