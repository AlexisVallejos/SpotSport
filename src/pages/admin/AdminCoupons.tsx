import { useState } from 'react';
import ActivityChart from '../../components/shop/ActivityChart';
import { Badge, Button, Card, Empty, formatDate, Loading, Notice, PageTitle, Stats, Table, TextField } from '../../components/ui';
import { adminCouponOverview, adminListSales, setDefaultCommission, setMerchantCommission, setSaleStatus, settleMerchant } from '../../lib/api/coupons';
import { formatPercent, percentOf } from '../../lib/coupons';
import { formatPrice } from '../../lib/money';
import { useAsync } from '../../lib/useAsync';
import type { SaleStatus } from '../../lib/types';
import styles from '../coupons.module.css';

const STATUS: Record<SaleStatus, { tone: 'warn' | 'ok' | 'neutral'; label: string }> = {
  pending: { tone: 'warn', label: 'Pendiente' },
  paid: { tone: 'ok', label: 'Cobrada' },
  void: { tone: 'neutral', label: 'Anulada' },
};

/** "" → null (usa el general); 0 a 50 → número; cualquier otra cosa → undefined (no válido). */
function parseRate(text: string): number | null | undefined {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 && value <= 50 ? value : undefined;
}

export default function AdminCoupons() {
  const overview = useAsync(() => adminCouponOverview(30), []);
  const sales = useAsync(() => adminListSales(), []);
  const [defaultRate, setDefaultRate] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const data = overview.data;
  const rateText = defaultRate ?? String(data?.default_percent ?? 5);

  const run = async (action: () => Promise<string | void>) => {
    setError('');
    setOk('');
    try {
      const message = await action();
      if (message) setOk(message);
      overview.reload();
      sales.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar el cambio.');
    }
  };

  const saveDefault = () => {
    const value = parseRate(rateText);
    if (value === undefined || value === null) return setError('El porcentaje general tiene que estar entre 0 y 50.');
    void run(async () => {
      await setDefaultCommission(value);
      setDefaultRate(null);
      return `Porcentaje general: ${formatPercent(value)}. Las ventas que ya se registraron conservan el que tenían.`;
    });
  };

  const saveMerchant = (id: string, text: string, current: number | null) => {
    const value = parseRate(text);
    if (value === undefined) return setError('El porcentaje de un comercio tiene que estar entre 0 y 50 (vacío usa el general).');
    if (value === current) return;
    void run(async () => {
      await setMerchantCommission(id, value);
      return value === null ? 'Ese comercio vuelve a usar el porcentaje general.' : `Porcentaje del comercio: ${formatPercent(value)}.`;
    });
  };

  const totals = data?.overall.totals;

  return (
    <>
      <PageTitle title="Cupones y comisiones" subtitle="Lo que mueven los cupones y lo que le corresponde a SPOT por cada venta." />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {ok ? <Notice tone="ok">{ok}</Notice> : null}
      {overview.error ? <Notice tone="error">{overview.error}</Notice> : null}

      {overview.loading && !data ? (
        <Loading />
      ) : data && totals ? (
        <>
          <Stats
            items={[
              { label: 'Cupones obtenidos', value: totals.claims },
              { label: 'Clicks a comercios', value: totals.clicks },
              { label: 'Ventas con cupón', value: totals.sales },
              { label: 'Facturado', value: formatPrice(Number(totals.sales_cents)) },
              { label: 'Comisión pendiente', value: formatPrice(Number(totals.commission_pending_cents)) },
              { label: 'Comisión cobrada', value: formatPrice(Number(totals.commission_paid_cents)) },
            ]}
          />

          <div className={styles.twoCols}>
            <Card title="Actividad · últimos 30 días">
              <ActivityChart days={data.overall.daily} />
            </Card>
            <Card title="Porcentaje general">
              <div className={styles.rateRow}>
                <TextField label="Comisión de SPOT sobre cada venta (%)" value={rateText} onChange={(event) => setDefaultRate(event.target.value)} inputMode="decimal" hint="Entre 0 y 50. Cada comercio puede tener uno propio en la tabla de abajo." />
                <Button onClick={saveDefault}>Guardar</Button>
              </div>
            </Card>
          </div>

          <h2 className={styles.sectionTitle}>Por comercio</h2>
          {data.merchants.length === 0 ? (
            <Empty title="No hay comercios aprobados" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Comercio</th>
                  <th>Obtenidos</th>
                  <th>Clicks</th>
                  <th>Ventas</th>
                  <th>Facturado</th>
                  <th>% propio</th>
                  <th>Pendiente</th>
                  <th>Cobrada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.merchants.map((merchant) => (
                  <tr key={merchant.id}>
                    <td>
                      <strong>{merchant.name}</strong>
                      <br />
                      <small style={{ color: 'var(--text-3)' }}>
                        Usa {formatPercent(Number(merchant.effective_percent))} · {merchant.claims > 0 ? `${percentOf(merchant.sales, merchant.claims)} % compra` : 'sin cupones'}
                      </small>
                    </td>
                    <td>{merchant.claims}</td>
                    <td>{merchant.clicks}</td>
                    <td>{merchant.sales}</td>
                    <td>{formatPrice(Number(merchant.sales_cents))}</td>
                    <td>
                      <input
                        className={styles.rateInput}
                        defaultValue={merchant.commission_percent ?? ''}
                        placeholder={String(data.default_percent)}
                        inputMode="decimal"
                        aria-label={`Porcentaje propio de ${merchant.name}`}
                        onBlur={(event) => saveMerchant(merchant.id, event.target.value, merchant.commission_percent === null ? null : Number(merchant.commission_percent))}
                      />
                    </td>
                    <td>{formatPrice(Number(merchant.commission_pending_cents))}</td>
                    <td>{formatPrice(Number(merchant.commission_paid_cents))}</td>
                    <td>
                      <Button
                        small
                        variant="secondary"
                        disabled={Number(merchant.commission_pending_cents) === 0}
                        onClick={() => {
                          if (window.confirm(`¿Marcar como cobradas las comisiones pendientes de ${merchant.name} (${formatPrice(Number(merchant.commission_pending_cents))})?`)) {
                            void run(async () => `Marcadas como cobradas: ${await settleMerchant(merchant.id)} ventas.`);
                          }
                        }}>
                        Marcar cobrado
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      ) : null}

      <h2 className={styles.sectionTitle}>Últimas ventas registradas</h2>
      {sales.error ? <Notice tone="error">{sales.error}</Notice> : null}
      {sales.loading ? (
        <Loading />
      ) : (sales.data ?? []).length === 0 ? (
        <Empty title="Todavía no hay ventas con cupón" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Comercio</th>
              <th>Código</th>
              <th>Monto</th>
              <th>Comisión</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(sales.data ?? []).map((sale) => (
              <tr key={sale.id}>
                <td>{formatDate(sale.reported_at)}</td>
                <td>{sale.merchant?.name ?? '—'}</td>
                <td>
                  <code>{sale.code}</code>
                </td>
                <td>{formatPrice(Number(sale.amount_cents))}</td>
                <td>
                  {formatPrice(Number(sale.commission_cents))} <small style={{ color: 'var(--text-3)' }}>({formatPercent(Number(sale.commission_percent))})</small>
                </td>
                <td>
                  <Badge tone={STATUS[sale.status].tone}>{STATUS[sale.status].label}</Badge>
                </td>
                <td>
                  {sale.status === 'void' ? (
                    <Button small variant="secondary" onClick={() => void run(() => setSaleStatus(sale.id, 'pending'))}>
                      Reactivar
                    </Button>
                  ) : (
                    <Button
                      small
                      variant="danger"
                      onClick={() => {
                        if (window.confirm('¿Anular esta venta? Deja de sumar a las estadísticas y a la comisión.')) void run(() => setSaleStatus(sale.id, 'void'));
                      }}>
                      Anular
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
