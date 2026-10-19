import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, Button, Card, Empty, Loading, Notice, PageTitle, formatDate } from '../../components/ui';
import { cancelOrder, listMyOrders } from '../../lib/api/account';
import { formatPrice } from '../../lib/money';
import { groupByCheckout } from '../../lib/orders';
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

export default function Orders() {
  const location = useLocation();
  const placed = Boolean((location.state as { placed?: boolean } | null)?.placed);
  const orders = useAsync(listMyOrders, []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const cancel = async (id: string) => {
    if (!window.confirm('¿Cancelar este pedido? Se devuelve el stock al comercio.')) return;
    setError('');
    setBusy(id);
    try {
      await cancelOrder(id);
      orders.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos cancelar el pedido.');
    } finally {
      setBusy(null);
    }
  };

  const checkouts = groupByCheckout(orders.data ?? []);

  return (
    <>
      <PageTitle title="Mis compras" />
      {placed ? <Notice tone="ok">¡Listo! Recibimos tu compra. Cada comercio va a preparar su parte del pedido.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {orders.error ? <Notice tone="error">{orders.error}</Notice> : null}
      {orders.loading ? (
        <Loading />
      ) : checkouts.length === 0 ? (
        <Empty title="Todavía no compraste nada">
          <p>
            <Link to="/tienda">Mirá la tienda</Link>
          </p>
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: placed ? 16 : 0 }}>
          {checkouts.map((checkout) => (
            <Card key={checkout.checkoutId}>
              <div className={styles.orderHead}>
                <strong>Compra del {formatDate(checkout.createdAt)}</strong>
                <strong>{formatPrice(checkout.totalCents)}</strong>
              </div>
              {checkout.orders.map((order) => (
                <div key={order.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
                  <div className={styles.orderHead}>
                    <span>
                      <strong>{order.merchant?.name ?? 'Comercio'}</strong> · {PAYMENT_METHOD_LABEL[order.payment_method]}
                    </span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <Badge tone={order.status === 'delivered' ? 'ok' : order.status === 'cancelled' ? 'bad' : 'warn'}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                      <Badge tone={order.payment_status === 'paid' ? 'ok' : 'neutral'}>{PAYMENT_STATUS_LABEL[order.payment_status]}</Badge>
                    </span>
                  </div>
                  {(order.items ?? []).map((item) => (
                    <div key={item.id} className={styles.orderItem}>
                      <span>
                        {item.quantity} × {item.product_name} {item.variant_label ? <small style={{ color: 'var(--text-3)' }}>{item.variant_label}</small> : null}
                      </span>
                      <span>{formatPrice(item.line_total_cents)}</span>
                    </div>
                  ))}
                  {order.status === 'pending' ? (
                    <p style={{ margin: '12px 0 0' }}>
                      <Button variant="danger" small disabled={busy === order.id} onClick={() => void cancel(order.id)}>
                        Cancelar pedido
                      </Button>
                    </p>
                  ) : null}
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
