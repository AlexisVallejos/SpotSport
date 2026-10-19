import { FormEvent, useState } from 'react';
import { Badge, Button, Card, Notice, PageTitle, TextArea, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { updateMerchant } from '../../lib/api/account';
import { uploadImage } from '../../lib/api/merchant';
import { MERCHANT_STATUS_LABEL } from '../../lib/types';
import styles from '../pages.module.css';

export default function MerchantProfile() {
  const { merchant, refresh } = useAuth();
  const [name, setName] = useState(merchant?.name ?? '');
  const [description, setDescription] = useState(merchant?.description ?? '');
  const [city, setCity] = useState(merchant?.city ?? '');
  const [email, setEmail] = useState(merchant?.contact_email ?? '');
  const [phone, setPhone] = useState(merchant?.contact_phone ?? '');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!merchant) return null;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await updateMerchant(merchant.id, { name: name.trim(), description: description.trim(), city: city.trim(), contact_email: email.trim(), contact_phone: phone.trim() });
      await refresh();
      setMessage({ tone: 'ok', text: 'Guardamos los datos.' });
    } catch (failure) {
      setMessage({ tone: 'error', text: failure instanceof Error ? failure.message : 'No pudimos guardar.' });
    } finally {
      setBusy(false);
    }
  };

  const changeLogo = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const url = await uploadImage(merchant.id, file);
      await updateMerchant(merchant.id, { logo_url: url });
      await refresh();
    } catch (failure) {
      setMessage({ tone: 'error', text: failure instanceof Error ? failure.message : 'No pudimos subir el logo.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Datos del comercio" actions={<Badge tone="ok">{MERCHANT_STATUS_LABEL[merchant.status]}</Badge>} />
      <Card>
        <form className={styles.form} onSubmit={save} style={{ maxWidth: 560 }}>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className={styles.productThumb} style={{ width: 72, height: 72, fontSize: 28 }}>
              {merchant.logo_url ? <img src={merchant.logo_url} alt="" /> : merchant.name.charAt(0)}
            </span>
            <label style={{ cursor: 'pointer', color: 'var(--accent-text)', fontWeight: 600 }}>
              Cambiar logo
              <input type="file" accept="image/*" hidden disabled={busy} onChange={(event) => void changeLogo(event.target.files)} />
            </label>
          </div>
          <TextField label="Nombre" required value={name} onChange={(event) => setName(event.target.value)} />
          <TextArea label="Descripción" value={description} onChange={(event) => setDescription(event.target.value)} />
          <TextField label="Ciudad" value={city} onChange={(event) => setCity(event.target.value)} />
          <TextField label="Email de contacto" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField label="Teléfono de contacto" value={phone} onChange={(event) => setPhone(event.target.value)} />
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
