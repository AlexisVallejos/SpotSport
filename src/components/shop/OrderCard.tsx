import type { ReactNode } from 'react';
import { formatPrice } from '../../lib/money';
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type Order } from '../../lib/types';
import { Badge, Card, formatDate } from '../ui';
import styles from '../../pages/pages.module.css';

/** Un pedido con su detalle y datos de entrega. Los paneles de comercio y admin le agregan sus acciones. */
export default function OrderCard({ order, actions, showCustomer }: { order: Order; actions?: ReactNode; showCustomer?: boolean }) {
  return (
    <Card>
      <div className={styles.orderHead}>
        <span>
          <strong>Pedido del {formatDate(order.created_at)}</strong>
          {order.merchant ? <span style={{ color: 'var(--text-3)' }}> · {order.merchant.name}</span> : null}
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

      <div className={styles.orderItem} style={{ fontWeight: 700 }}>
        <span>Total</span>
        <span>{formatPrice(order.total_cents)}</span>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-3)', display: 'grid', gap: 2, marginTop: 6 }}>
        <span>{PAYMENT_METHOD_LABEL[order.payment_method]}</span>
        <span>
          Entrega: {order.shipping_name} · {order.shipping_phone}
          {order.shipping_address ? ` · ${order.shipping_address}, ${order.shipping_city}` : ''}
        </span>
        {order.notes ? <span>Indicaciones: {order.notes}</span> : null}
        {showCustomer && order.customer ? (
          <span>
            Cuenta: {order.customer.full_name || 'Sin nombre'} ({order.customer.email})
          </span>
        ) : null}
      </div>

      {actions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>{actions}</div> : null}
    </Card>
  );
}
