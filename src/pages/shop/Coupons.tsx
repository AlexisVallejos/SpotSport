import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NotConfigured from '../../components/layout/NotConfigured';
import { Ticket, ticketStyles } from '../../components/shop/Ticket';
import { Button, Empty, Loading, Notice, PageTitle } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { claimCoupon, listPublicCoupons } from '../../lib/api/coupons';
import { campaignLabel } from '../../lib/coupons';
import { useAsync } from '../../lib/useAsync';
import styles from '../coupons.module.css';

const validity = (hours: number) => (hours % 24 === 0 && hours >= 48 ? `${hours / 24} días` : hours === 24 ? '24 horas' : hours === 1 ? '1 hora' : `${hours} horas`);

export default function Coupons() {
  const { configured, session } = useAuth();
  const navigate = useNavigate();
  const coupons = useAsync(() => listPublicCoupons(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!configured) return <NotConfigured />;

  const claim = async (id: string) => {
    if (!session) {
      navigate('/login?next=/cupones');
      return;
    }
    setError('');
    setBusy(id);
    try {
      await claimCoupon(id);
      navigate('/cuenta/cupones');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos obtener el cupón.');
      setBusy(null);
      coupons.reload();
    }
  };

  return (
    <>
      <PageTitle title="Cupones" subtitle="Obtenelos acá y usalos en la tienda del comercio antes de que venzan." />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {coupons.error ? <Notice tone="error">{coupons.error}</Notice> : null}
      {coupons.loading ? (
        <Loading />
      ) : (coupons.data ?? []).length === 0 ? (
        <Empty title="Todavía no hay cupones disponibles">
          <p>Cuando un comercio publique uno, lo vas a ver acá.</p>
        </Empty>
      ) : (
        <div className={styles.grid}>
          {(coupons.data ?? []).map((coupon) => {
            const campaign = campaignLabel(coupon);
            return (
              <Ticket
                key={coupon.id}
                kicker="Cupón"
                merchant={coupon.merchant?.name ?? 'Comercio'}
                discount={coupon.discount_label}
                title={coupon.title}
                description={coupon.description}>
                <p className={ticketStyles.meta}>
                  Dura {validity(coupon.valid_hours)} desde que lo obtenés{campaign ? ` · ${campaign}` : ''}
                </p>
                <Button block disabled={busy === coupon.id} onClick={() => void claim(coupon.id)}>
                  {busy === coupon.id ? 'Obteniendo…' : session ? 'Obtener cupón' : 'Ingresá para obtenerlo'}
                </Button>
              </Ticket>
            );
          })}
        </div>
      )}
    </>
  );
}
