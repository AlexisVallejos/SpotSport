import { FormEvent, useState } from 'react';
import { Badge, Button, ButtonLink, Card, Notice, PageTitle, TextArea, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { requestMerchant, updateMerchant } from '../../lib/api/account';
import { MERCHANT_STATUS_LABEL } from '../../lib/types';
import styles from '../pages.module.css';

export default function BecomeMerchant() {
  const { profile, merchant, refresh } = useAuth();
  const [name, setName] = useState(merchant?.name ?? '');
  const [description, setDescription] = useState(merchant?.description ?? '');
  const [city, setCity] = useState(merchant?.city ?? '');
  const [email, setEmail] = useState(merchant?.contact_email ?? profile?.email ?? '');
  const [phone, setPhone] = useState(merchant?.contact_phone ?? profile?.phone ?? '');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setError('');
    setDone('');
    setBusy(true);
    try {
      const data = { name: name.trim(), description: description.trim(), city: city.trim(), contact_email: email.trim(), contact_phone: phone.trim() };
      if (merchant) {
        await updateMerchant(merchant.id, data);
        setDone('Guardamos los datos de tu comercio.');
      } else {
        await requestMerchant(profile.id, data);
        setDone('Recibimos tu pedido. Lo vamos a revisar y te avisamos acá mismo.');
      }
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos enviar el pedido.');
    } finally {
      setBusy(false);
    }
  };

  const reapply = async () => {
    if (!merchant) return;
    setBusy(true);
    setError('');
    try {
      await updateMerchant(merchant.id, { status: 'pending' });
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos reenviar el pedido.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Vender en SPOT" subtitle="Sumá tu comercio y publicá tus productos. Cada afiliación la aprueba el equipo de SPOT." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
        {merchant ? (
          <Card title="Estado de tu solicitud">
            <p>
              <Badge tone={merchant.status === 'approved' ? 'ok' : merchant.status === 'pending' ? 'warn' : 'bad'}>{MERCHANT_STATUS_LABEL[merchant.status]}</Badge>
            </p>
            {merchant.status === 'pending' ? <Notice>Estamos revisando tu pedido. Mientras tanto podés ajustar los datos de abajo.</Notice> : null}
            {merchant.status === 'approved' ? (
              <p>
                <ButtonLink to="/comercio">Ir a mi panel de comercio</ButtonLink>
              </p>
            ) : null}
            {merchant.status === 'rejected' ? (
              <>
                <Notice tone="error">No pudimos aprobarlo{merchant.rejection_reason ? `: ${merchant.rejection_reason}` : '.'}</Notice>
                <p>
                  <Button onClick={() => void reapply()} disabled={busy}>
                    Corregir y volver a pedir
                  </Button>
                </p>
              </>
            ) : null}
            {merchant.status === 'suspended' ? <Notice tone="error">Tu comercio está suspendido{merchant.rejection_reason ? `: ${merchant.rejection_reason}` : '.'} Escribinos para resolverlo.</Notice> : null}
          </Card>
        ) : null}

        {merchant?.status === 'approved' || merchant?.status === 'suspended' ? null : (
          <Card title={merchant ? 'Datos de tu comercio' : 'Contanos de tu comercio'}>
            <form className={styles.form} onSubmit={submit}>
              {error ? <Notice tone="error">{error}</Notice> : null}
              {done ? <Notice tone="ok">{done}</Notice> : null}
              <TextField label="Nombre del comercio" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
              <TextArea label="Qué vendés" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Calzado de running, indumentaria de fútbol…" />
              <TextField label="Ciudad" value={city} onChange={(event) => setCity(event.target.value)} />
              <TextField label="Email de contacto" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <TextField label="Teléfono de contacto" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <div>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Enviando…' : merchant ? 'Guardar cambios' : 'Enviar pedido de afiliación'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
