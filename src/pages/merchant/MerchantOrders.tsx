import { useState } from 'react';
import OrderCard from '../../components/shop/OrderCard';
import { Button, Empty, Loading, Notice, PageTitle } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { listMerchantOrders, markOrderPaid, setOrderStatus } from '../../lib/api/merchant';
import { NEXT_ORDER_STATUS, type OrderStatus } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

export default function MerchantOrders() {
  const { merchant } = useAuth();
  const orders = useAsync(() => listMerchantOrders(merchant!.id), [merchant?.id]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<void>) => {
    setError('');
    setBusy(id);
    try {
      await action();
      orders.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos actualizar el pedido.');
    } finally {
      setBusy(null);
    }
  };

  const all = orders.data ?? [];
  const shown = filter === 'open' ? all.filter((order) => !['delivered', 'cancelled'].includes(order.status)) : all;

  return (
    <>
      <PageTitle title="Pedidos" subtitle="Lo que te compraron" />
      <div className={styles.filters}>
        <button type="button" className={`${styles.chip} ${filter === 'open' ? styles.chipOn : ''}`} onClick={() => setFilter('open')}>
          Por atender
        </button>
        <button type="button" className={`${styles.chip} ${filter === 'all' ? styles.chipOn : ''}`} onClick={() => setFilter('all')}>
          Todos
        </button>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {orders.error ? <Notice tone="error">{orders.error}</Notice> : null}
      {orders.loading ? (
        <Loading />
      ) : shown.length === 0 ? (
        <Empty title={filter === 'open' ? 'No tenés pedidos por atender' : 'Todavía no tuviste ventas'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shown.map((order) => {
            const next = NEXT_ORDER_STATUS[order.status];
            const cancellable: OrderStatus[] = ['pending', 'preparing'];
            return (
              <OrderCard
                key={order.id}
                order={order}
                actions={
                  <>
                    {next ? (
                      <Button small disabled={busy === order.id} onClick={() => void run(order.id, () => setOrderStatus(order.id, next.status))}>
                        {next.label}
                      </Button>
                    ) : null}
                    {order.payment_status === 'unpaid' && order.status !== 'cancelled' ? (
                      <Button variant="secondary" small disabled={busy === order.id} onClick={() => void run(order.id, () => markOrderPaid(order.id))}>
                        Registrar cobro
                      </Button>
                    ) : null}
                    {cancellable.includes(order.status) ? (
                      <Button
                        variant="danger"
                        small
                        disabled={busy === order.id}
                        onClick={() => {
                          if (window.confirm('¿Cancelar este pedido? El stock vuelve a quedar disponible.')) void run(order.id, () => setOrderStatus(order.id, 'cancelled'));
                        }}>
                        Cancelar
                      </Button>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
