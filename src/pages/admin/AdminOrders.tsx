import { useState } from 'react';
import OrderCard from '../../components/shop/OrderCard';
import { Button, Empty, Loading, Notice, PageTitle } from '../../components/ui';
import { listAllOrders } from '../../lib/api/admin';
import { markOrderPaid, setOrderStatus } from '../../lib/api/merchant';
import { NEXT_ORDER_STATUS } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';

export default function AdminOrders() {
  const orders = useAsync(listAllOrders, []);
  const [error, setError] = useState('');

  const run = async (action: () => Promise<void>) => {
    setError('');
    try {
      await action();
      orders.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos actualizar el pedido.');
    }
  };

  return (
    <>
      <PageTitle title="Pedidos" subtitle="Últimos 200 pedidos de todos los comercios." />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {orders.error ? <Notice tone="error">{orders.error}</Notice> : null}
      {orders.loading ? (
        <Loading />
      ) : (orders.data ?? []).length === 0 ? (
        <Empty title="Todavía no hay pedidos" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(orders.data ?? []).map((order) => {
            const next = NEXT_ORDER_STATUS[order.status];
            return (
              <OrderCard
                key={order.id}
                order={order}
                showCustomer
                actions={
                  <>
                    {next ? (
                      <Button small onClick={() => void run(() => setOrderStatus(order.id, next.status))}>
                        {next.label}
                      </Button>
                    ) : null}
                    {order.payment_status === 'unpaid' && order.status !== 'cancelled' ? (
                      <Button variant="secondary" small onClick={() => void run(() => markOrderPaid(order.id))}>
                        Registrar cobro
                      </Button>
                    ) : null}
                    {order.status === 'pending' || order.status === 'preparing' ? (
                      <Button variant="danger" small onClick={() => window.confirm('¿Cancelar este pedido?') && void run(() => setOrderStatus(order.id, 'cancelled'))}>
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
