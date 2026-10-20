import { FormEvent, useState } from 'react';
import { Badge, Button, Card, Empty, Loading, Notice, PageTitle, SelectField, Table, TextArea, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { couponClicks, createCoupon, deleteCoupon, listMyCoupons, setCouponActive } from '../../lib/api/coupons';
import { campaignLabel, hasPlaceholder, normalizePrefix, validateCoupon, VALIDITY_OPTIONS } from '../../lib/coupons';
import { fromLocalInput } from '../../lib/dates';
import { useAsync } from '../../lib/useAsync';
import type { Coupon } from '../../lib/types';
import styles from '../coupons.module.css';

type Form = {
  title: string;
  description: string;
  discount_label: string;
  code_prefix: string;
  destination_url: string;
  valid_hours: string;
  starts_at: string;
  ends_at: string;
  max_claims: string;
};

const EMPTY: Form = { title: '', description: '', discount_label: '', code_prefix: '', destination_url: 'https://', valid_hours: '24', starts_at: '', ends_at: '', max_claims: '' };

function status(coupon: Coupon): { tone: 'ok' | 'warn' | 'neutral' | 'bad'; label: string } {
  const now = Date.now();
  if (!coupon.is_active) return { tone: 'neutral', label: 'Pausado' };
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() <= now) return { tone: 'bad', label: 'Terminó' };
  if (new Date(coupon.starts_at).getTime() > now) return { tone: 'warn', label: 'Programado' };
  if (coupon.max_claims !== null && coupon.claims_count >= coupon.max_claims) return { tone: 'warn', label: 'Agotado' };
  return { tone: 'ok', label: 'Activo' };
}

export default function MerchantCoupons() {
  const { merchant } = useAuth();
  const coupons = useAsync(() => listMyCoupons(merchant!.id), [merchant?.id]);
  const clicks = useAsync(() => couponClicks((coupons.data ?? []).map((coupon) => coupon.id)), [coupons.data]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof Form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const run = async (action: () => Promise<void>) => {
    setError('');
    try {
      await action();
      coupons.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar el cambio.');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setOk('');
    const input = {
      title: form.title.trim(),
      description: form.description.trim(),
      discount_label: form.discount_label.trim(),
      code_prefix: form.code_prefix,
      destination_url: form.destination_url.trim(),
      valid_hours: Number(form.valid_hours),
      starts_at: fromLocalInput(form.starts_at) ?? new Date().toISOString(),
      ends_at: fromLocalInput(form.ends_at),
      max_claims: form.max_claims ? Number(form.max_claims) : null,
    };
    const problem = validateCoupon(input);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await createCoupon(merchant!.id, input);
      setForm(EMPTY);
      setOpen(false);
      setOk('Cupón publicado. Ya lo pueden obtener desde la sección Cupones.');
      coupons.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos publicar el cupón.');
    } finally {
      setBusy(false);
    }
  };

  const list = coupons.data ?? [];

  return (
    <>
      <PageTitle
        title="Cupones"
        subtitle="Cada persona que lo obtiene recibe un código propio que vence. Desde ahí la mandamos a tu web con el cupón aplicado."
        actions={<Button onClick={() => setOpen((value) => !value)}>{open ? 'Cerrar' : 'Nuevo cupón'}</Button>}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {ok ? <Notice tone="ok">{ok}</Notice> : null}
      {coupons.error ? <Notice tone="error">{coupons.error}</Notice> : null}

      {open ? (
        <Card title="Nuevo cupón">
          <form onSubmit={(event) => void submit(event)} className={styles.formGrid}>
            <TextField label="Título" value={form.title} onChange={set('title')} maxLength={80} required placeholder="Bienvenida SPOT" />
            <TextField label="Descuento (lo que se ve)" value={form.discount_label} onChange={set('discount_label')} maxLength={40} required placeholder="20% OFF" />
            <div className={styles.formWide}>
              <TextArea label="Descripción (opcional)" value={form.description} onChange={set('description')} maxLength={300} rows={2} placeholder="Válido en toda la tienda, no acumulable." />
            </div>
            <TextField
              label="Código base"
              hint="Cada persona recibe uno propio: SPOT20-A1B2C3."
              value={form.code_prefix}
              onChange={(event) => setForm((current) => ({ ...current, code_prefix: normalizePrefix(event.target.value) }))}
              required
              placeholder="SPOT20"
            />
            <SelectField label="Cuánto dura cada cupón" hint="Se cuenta desde que la persona lo obtiene." value={form.valid_hours} onChange={set('valid_hours')}>
              {VALIDITY_OPTIONS.map((option) => (
                <option key={option.hours} value={option.hours}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <div className={styles.formWide}>
              <TextField
                label="Link de tu tienda"
                hint="Usá {codigo} donde tu tienda recibe el cupón. Ejemplo: https://mitienda.com/?cupon={codigo}"
                value={form.destination_url}
                onChange={set('destination_url')}
                type="url"
                required
              />
              {form.destination_url.length > 8 && !hasPlaceholder(form.destination_url) ? (
                <Notice>Sin {'{codigo}'} en el link, la persona llega a tu tienda pero tiene que pegar el código a mano.</Notice>
              ) : null}
            </div>
            <TextField label="Se puede obtener desde (opcional)" type="datetime-local" value={form.starts_at} onChange={set('starts_at')} hint="Vacío: desde ahora." />
            <TextField label="Hasta (opcional)" type="datetime-local" value={form.ends_at} onChange={set('ends_at')} hint="Vacío: sin fecha de cierre." />
            <TextField label="Límite de cupones (opcional)" type="number" min={1} value={form.max_claims} onChange={set('max_claims')} hint="Vacío: sin límite." />
            <div className={`${styles.formWide} ${styles.actions}`}>
              <Button type="submit" disabled={busy}>
                {busy ? 'Publicando…' : 'Publicar cupón'}
              </Button>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {coupons.loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty title="Todavía no publicaste cupones">
          <p>Creá el primero para llevar compradores a tu web.</p>
        </Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Cupón</th>
              <th>Campaña</th>
              <th>Obtenidos</th>
              <th>Clicks a tu web</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((coupon) => {
              const state = status(coupon);
              return (
                <tr key={coupon.id}>
                  <td>
                    <strong>{coupon.title}</strong>
                    <br />
                    <small style={{ color: 'var(--text-3)' }}>
                      {coupon.discount_label} · {coupon.code_prefix}-… · {VALIDITY_OPTIONS.find((option) => option.hours === coupon.valid_hours)?.label ?? `${coupon.valid_hours} h`}
                    </small>
                    <span className={styles.url} title={coupon.destination_url}>
                      {coupon.destination_url}
                    </span>
                  </td>
                  <td>{campaignLabel(coupon) || 'Sin límite'}</td>
                  <td>
                    {coupon.claims_count}
                    {coupon.max_claims !== null ? ` / ${coupon.max_claims}` : ''}
                  </td>
                  <td>{clicks.data?.[coupon.id] ?? 0}</td>
                  <td>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <Button variant="secondary" small onClick={() => void run(() => setCouponActive(coupon.id, !coupon.is_active))}>
                        {coupon.is_active ? 'Pausar' : 'Activar'}
                      </Button>
                      <Button
                        variant="danger"
                        small
                        onClick={() => {
                          if (window.confirm(`¿Eliminar "${coupon.title}"? Los códigos que ya se entregaron dejan de servir.`)) void run(() => deleteCoupon(coupon.id));
                        }}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
