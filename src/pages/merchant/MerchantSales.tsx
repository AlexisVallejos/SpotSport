import { FormEvent, useState } from 'react';
import { Badge, Button, Card, Empty, formatDate, Loading, Notice, PageTitle, Table, TextField } from '../../components/ui';
import { listMySales, merchantCouponStats, registerSale } from '../../lib/api/coupons';
import { commissionFor, formatPercent } from '../../lib/coupons';
import { formatPrice, parsePrice } from '../../lib/money';
import { useAsync } from '../../lib/useAsync';
import type { SaleStatus } from '../../lib/types';
import styles from '../coupons.module.css';

const STATUS: Record<SaleStatus, { tone: 'warn' | 'ok' | 'neutral'; label: string }> = {
  pending: { tone: 'warn', label: 'Comisión pendiente' },
  paid: { tone: 'ok', label: 'Comisión pagada' },
  void: { tone: 'neutral', label: 'Anulada' },
};

export default function MerchantSales() {
  const sales = useAsync(() => listMySales(), []);
  const stats = useAsync(() => merchantCouponStats(7), []);
  const percent = stats.data?.commission_percent ?? 5;
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const cents = parsePrice(amount);
  const preview = cents ? commissionFor(cents, percent) : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setOk('');
    if (!code.trim()) return setError('Ingresá el código del voucher.');
    if (!cents) return setError('Ingresá el monto de la venta, por ejemplo 25.000.');
    setBusy(true);
    try {
      const sale = await registerSale(code, cents);
      setOk(`Venta registrada. La comisión de SPOT es ${formatPrice(Number(sale.commission_cents))} (${formatPercent(Number(sale.commission_percent))}).`);
      setCode('');
      setAmount('');
      sales.reload();
      stats.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos registrar la venta.');
    } finally {
      setBusy(false);
    }
  };

  const list = sales.data ?? [];
  const pending = list.filter((sale) => sale.status === 'pending').reduce((sum, sale) => sum + Number(sale.commission_cents), 0);

  return (
    <>
      <PageTitle
        title="Ventas con cupón"
        subtitle={`Cuando alguien compra con un voucher de SPOT, cargá el código y el monto. SPOT cobra ${formatPercent(percent)} de esa venta.`}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {ok ? <Notice tone="ok">{ok}</Notice> : null}

      <Card title="Registrar una venta">
        <form onSubmit={(event) => void submit(event)} className={styles.saleForm}>
          <TextField label="Código del voucher" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="SPOT20-A1B2C3" autoComplete="off" required />
          <TextField label="Monto de la venta" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="25.000" hint="Lo que pagó la persona, con el descuento ya aplicado." required />
          <div className={styles.salePreview}>
            <span>Comisión de SPOT</span>
            <strong>{preview === null ? '—' : formatPrice(preview)}</strong>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Registrando…' : 'Registrar venta'}
          </Button>
        </form>
      </Card>

      {sales.error ? <Notice tone="error">{sales.error}</Notice> : null}
      {sales.loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty title="Todavía no registraste ventas">
          <p>Cada venta que cargues suma a tu estadística de conversión.</p>
        </Empty>
      ) : (
        <>
          <h2 className={styles.sectionTitle}>
            Ventas registradas <small className={styles.sectionNote}>· comisión pendiente de pago: {formatPrice(pending)}</small>
          </h2>
          <Table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Código</th>
                <th>Cupón</th>
                <th>Monto</th>
                <th>Comisión</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((sale) => (
                <tr key={sale.id}>
                  <td>{formatDate(sale.reported_at)}</td>
                  <td>
                    <code>{sale.code}</code>
                  </td>
                  <td>{sale.coupon_title}</td>
                  <td>{formatPrice(Number(sale.amount_cents))}</td>
                  <td>
                    {formatPrice(Number(sale.commission_cents))} <small style={{ color: 'var(--text-3)' }}>({formatPercent(Number(sale.commission_percent))})</small>
                  </td>
                  <td>
                    <Badge tone={STATUS[sale.status].tone}>{STATUS[sale.status].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}
