import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Notice, PageTitle, TextArea, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { placeOrder } from '../../lib/api/account';
import { formatPrice } from '../../lib/money';
import type { PaymentMethod } from '../../lib/types';
import styles from '../pages.module.css';

const METHODS: { value: PaymentMethod; title: string; text: string; enabled: boolean }[] = [
  { value: 'cash_on_delivery', title: 'Pago contra entrega', text: 'Pagás cuando recibís el pedido. Te lo llevan a la dirección que indiques.', enabled: true },
  { value: 'pickup', title: 'Retiro y pago en el local', text: 'Pasás a buscarlo por el comercio y pagás ahí.', enabled: true },
  { value: 'mercado_pago', title: 'Mercado Pago', text: 'Próximamente.', enabled: false },
];

export default function Checkout() {
  const cart = useCart();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PaymentMethod>('cash_on_delivery');
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (cart.lines.length === 0) {
    return (
      <Empty title="No hay nada para comprar">
        <p>
          <Link to="/tienda">Volver a la tienda</Link>
        </p>
      </Empty>
    );
  }

  const needsAddress = payment === 'cash_on_delivery';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await placeOrder(cart.lines, { name, phone, address, city, notes }, payment);
      cart.clear();
      navigate('/cuenta/pedidos', { replace: true, state: { placed: true } });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos confirmar la compra.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Confirmar compra" />
      <form onSubmit={submit} className={styles.cartLayout}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error ? <Notice tone="error">{error}</Notice> : null}

          <Card title="Datos de contacto">
            <div className={styles.form}>
              <TextField label="Nombre y apellido" required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              <TextField label="Teléfono" required value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" hint="Para coordinar la entrega." />
            </div>
          </Card>

          <Card title="Cómo pagás">
            <div className={styles.form}>
              {METHODS.map((method) => (
                <label key={method.value} className={`${styles.radioCard} ${payment === method.value ? styles.radioOn : ''} ${method.enabled ? '' : styles.radioOff}`}>
                  <input type="radio" name="payment" value={method.value} checked={payment === method.value} disabled={!method.enabled} onChange={() => setPayment(method.value)} />
                  <span>
                    <strong>{method.title}</strong>
                    <small>{method.text}</small>
                  </span>
                </label>
              ))}
            </div>
          </Card>

          {needsAddress ? (
            <Card title="Dirección de entrega">
              <div className={styles.form}>
                <TextField label="Calle y número" required value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" />
                <TextField label="Ciudad" required value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" />
                <TextArea label="Indicaciones (opcional)" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Piso, timbre, horario…" />
              </div>
            </Card>
          ) : null}
        </div>

        <Card title="Tu pedido" className={styles.summary}>
          {cart.groups.map((group) => (
            <div key={group.merchantId} style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 13, color: '#ff7900' }}>{group.merchantName}</strong>
              {group.lines.map((line) => (
                <div key={line.variantId} className={styles.sumRow}>
                  <span>
                    {line.quantity} × {line.name} <small style={{ color: '#8a8c94' }}>{line.variantLabel}</small>
                  </span>
                  <span>{formatPrice(line.priceCents * line.quantity)}</span>
                </div>
              ))}
            </div>
          ))}
          <div className={`${styles.sumRow} ${styles.sumTotal}`}>
            <span>Total</span>
            <span>{formatPrice(cart.subtotalCents)}</span>
          </div>
          <Button type="submit" block disabled={busy}>
            {busy ? 'Confirmando…' : 'Confirmar compra'}
          </Button>
        </Card>
      </form>
    </>
  );
}
