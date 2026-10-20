import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Countdown, Ticket, ticketStyles } from '../../components/shop/Ticket';
import { Button, Empty, Loading, Notice, PageTitle } from '../../components/ui';
import { listMyVouchers, voucherRedirect } from '../../lib/api/coupons';
import { timeLeft } from '../../lib/coupons';
import { useAsync } from '../../lib/useAsync';
import styles from '../coupons.module.css';

/** Reloj que avanza cada segundo mientras haya algo que contar. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);
  return now;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function Vouchers() {
  const vouchers = useAsync(() => listMyVouchers(), []);
  const list = vouchers.data ?? [];
  const now = useNow(list.length > 0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [going, setGoing] = useState<string | null>(null);

  const go = async (id: string) => {
    setError('');
    setGoing(id);
    try {
      window.location.assign(await voucherRedirect(id));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos abrir la tienda.');
      setGoing(null);
      vouchers.reload();
    }
  };

  const copyCode = async (id: string, code: string) => {
    if (await copy(code)) {
      setCopied(id);
      setTimeout(() => setCopied((current) => (current === id ? null : current)), 2000);
    }
  };

  const active = list.filter((voucher) => !timeLeft(voucher.expires_at, now).expired);
  const past = list.filter((voucher) => timeLeft(voucher.expires_at, now).expired);

  const card = (voucher: (typeof list)[number]) => {
    const expired = timeLeft(voucher.expires_at, now).expired;
    return (
      <Ticket
        key={voucher.id}
        kicker="Voucher"
        merchant={voucher.coupon?.merchant?.name ?? 'Comercio'}
        discount={voucher.coupon?.discount_label ?? 'Cupón'}
        title={voucher.coupon?.title ?? 'Cupón'}
        expired={expired}>
        <div className={ticketStyles.code}>
          <div>
            <span className={ticketStyles.codeLabel}>Tu código</span>
            <span className={ticketStyles.codeText}>{voucher.code}</span>
          </div>
          <Button small variant="secondary" onClick={() => void copyCode(voucher.id, voucher.code)} disabled={expired}>
            {copied === voucher.id ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <Countdown createdAt={voucher.created_at} expiresAt={voucher.expires_at} now={now} />
        {expired ? (
          <p className={ticketStyles.meta}>
            <Link to="/cupones">Buscá otro cupón</Link>
          </p>
        ) : (
          <Button block disabled={going === voucher.id} onClick={() => void go(voucher.id)}>
            {going === voucher.id ? 'Abriendo…' : 'Ir a la tienda con el cupón'}
          </Button>
        )}
      </Ticket>
    );
  };

  return (
    <>
      <PageTitle title="Mis cupones" subtitle="Cada código es tuyo y vence en el tiempo que fijó el comercio." />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {vouchers.error ? <Notice tone="error">{vouchers.error}</Notice> : null}
      {vouchers.loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty title="Todavía no obtuviste cupones">
          <p>
            <Link to="/cupones">Mirá los cupones disponibles</Link>
          </p>
        </Empty>
      ) : (
        <>
          {active.length > 0 ? <div className={styles.grid}>{active.map(card)}</div> : null}
          {past.length > 0 ? (
            <>
              <h2 style={{ margin: '32px 0 16px', fontSize: 16, color: 'var(--text-3)' }}>Vencidos</h2>
              <div className={styles.grid}>{past.map(card)}</div>
            </>
          ) : null}
        </>
      )}
    </>
  );
}
