import { FormEvent, useState } from 'react';
import { Button, Card, Notice, PageTitle, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { updateProfile } from '../../lib/api/account';
import styles from '../pages.module.css';

export default function Profile() {
  const { profile, refresh } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateProfile(profile.id, { full_name: name.trim(), phone: phone.trim() });
      await refresh();
      setMessage({ tone: 'ok', text: 'Guardamos tus datos.' });
    } catch (failure) {
      setMessage({ tone: 'error', text: failure instanceof Error ? failure.message : 'No pudimos guardar.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Mis datos" />
      <Card>
        <form className={styles.form} onSubmit={submit} style={{ maxWidth: 480 }}>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          <TextField label="Email" value={profile?.email ?? ''} disabled readOnly hint="El email no se puede cambiar desde acá." />
          <TextField label="Nombre y apellido" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          <TextField label="Teléfono" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
