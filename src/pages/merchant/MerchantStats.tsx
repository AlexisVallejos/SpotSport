import { useState } from 'react';
import { Link } from 'react-router-dom';
import ActivityChart from '../../components/shop/ActivityChart';
import { Button, Card, Empty, Loading, Notice, PageTitle, Stats, Table } from '../../components/ui';
import { merchantCouponStats } from '../../lib/api/coupons';
import { formatPercent, percentOf } from '../../lib/coupons';
import { formatPrice } from '../../lib/money';
import { useAsync } from '../../lib/useAsync';
import styles from '../coupons.module.css';

const RANGES = [7, 30, 90] as const;

export default function MerchantStats() {
  const [days, setDays] = useState<number>(30);
  const stats = useAsync(() => merchantCouponStats(days), [days]);
  const data = stats.data;
  const totals = data?.totals;

  return (
    <>
      <PageTitle
        title="Estadísticas de cupones"
        subtitle="Cuánta gente movilizamos desde SPOT hacia tu web."
        actions={
          <>
            {RANGES.map((range) => (
              <Button key={range} small variant={range === days ? 'primary' : 'secondary'} onClick={() => setDays(range)}>
                {range} días
              </Button>
            ))}
          </>
        }
      />
      {stats.error ? <Notice tone="error">{stats.error}</Notice> : null}
      {stats.loading && !data ? (
        <Loading />
      ) : data && totals ? (
        <>
          <Stats
            items={[
              { label: 'Cupones obtenidos', value: totals.claims },
              { label: 'Clicks a tu web', value: totals.clicks },
              { label: 'Personas que entraron', value: totals.unique_clickers },
              { label: 'Ventas con cupón', value: totals.sales },
              { label: 'Facturado con cupones', value: formatPrice(Number(totals.sales_cents)) },
              { label: `Comisión SPOT (${formatPercent(data.commission_percent ?? 5)})`, value: formatPrice(Number(totals.commission_cents)) },
            ]}
          />

          <div className={styles.twoCols}>
            <Card title={`Actividad · últimos ${days} días`}>
              <ActivityChart days={data.daily} />
            </Card>
            <Card title="Del cupón a la venta">
              <div className={styles.funnel}>
                <FunnelStep label="Obtuvieron el cupón" value={totals.claims} base={totals.claims} />
                <FunnelStep label="Entraron a tu web" value={totals.unique_clickers} base={totals.claims} />
                <FunnelStep label="Compraron" value={totals.sales} base={totals.claims} />
              </div>
              <p className={styles.note}>
                Las ventas salen de lo que registrás en <Link to="/comercio/ventas">Ventas con cupón</Link>. Cargalas para ver tu conversión real.
              </p>
            </Card>
          </div>

          {data.coupons.length === 0 ? (
            <Empty title="Todavía no tenés cupones">
              <p>
                <Link to="/comercio/cupones">Publicá el primero</Link>
              </p>
            </Empty>
          ) : (
            <>
              <h2 className={styles.sectionTitle}>Por cupón</h2>
              <Table>
                <thead>
                  <tr>
                    <th>Cupón</th>
                    <th>Obtenidos</th>
                    <th>Clicks</th>
                    <th>Personas</th>
                    <th>Ventas</th>
                    <th>Facturado</th>
                    <th>Conversión</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coupons.map((coupon) => (
                    <tr key={coupon.id}>
                      <td>
                        <strong>{coupon.title}</strong>
                      </td>
                      <td>{coupon.claims}</td>
                      <td>{coupon.clicks}</td>
                      <td>{coupon.unique_clickers}</td>
                      <td>{coupon.sales}</td>
                      <td>{formatPrice(Number(coupon.sales_cents))}</td>
                      <td>{coupon.claims > 0 ? `${percentOf(coupon.sales, coupon.claims)} %` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </>
      ) : null}
    </>
  );
}

function FunnelStep({ label, value, base }: { label: string; value: number; base: number }) {
  const percent = percentOf(value, base);
  return (
    <div className={styles.funnelStep}>
      <div className={styles.funnelHead}>
        <span>{label}</span>
        <strong>
          {value}
          {base > 0 ? <small> · {percent} %</small> : null}
        </strong>
      </div>
      <div className={styles.funnelTrack}>
        <div className={styles.funnelFill} style={{ width: `${base > 0 ? Math.max(percent, value > 0 ? 3 : 0) : 0}%` }} />
      </div>
    </div>
  );
}
