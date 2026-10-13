import { Link } from 'react-router-dom';
import { Badge, ButtonLink, Card, Empty, Loading, Notice, PageTitle, Stats, Table, formatDate } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { listMyOrders } from '../../lib/api/account';
import { formatPrice } from '../../lib/money';
import { spendSummary } from '../../lib/orders';
import { ORDER_STATUS_LABEL } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';

export default function AccountHome() {
  const { profile, merchant, isMerchant, isAdmin } = useAuth();
  const orders = useAsync(listMyOrders, []);
  const summary = spendSummary(orders.data ?? []);

  return (
    <>
      <PageTitle title={`Hola, ${profile?.full_name?.split(' ')[0] || 'bienvenido'}`} subtitle={profile?.email} />
      {orders.error ? <Notice tone="error">{orders.error}</Notice> : null}
      {orders.loading ? (
        <Loading />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Stats
            items={[
              { label: 'Total gastado', value: formatPrice(summary.spentCents) },
              { label: 'Compras', value: summary.orders },
              { label: 'En camino', value: summary.inProgress },
            ]}
          />

          <Card title="Últimas compras">
            {(orders.data ?? []).length === 0 ? (
              <Empty title="Todavía no compraste nada">
                <p>
                  <Link to="/tienda">Mirá la tienda</Link>
                </p>
              </Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Comercio</th>
                    <th>Estado</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders.data ?? []).slice(0, 5).map((order) => (
                    <tr key={order.id}>
                      <td>{formatDate(order.created_at)}</td>
                      <td>{order.merchant?.name}</td>
                      <td>
                        <Badge tone={order.status === 'delivered' ? 'ok' : order.status === 'cancelled' ? 'bad' : 'warn'}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                      </td>
                      <td>{formatPrice(order.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {(orders.data ?? []).length > 0 ? (
              <p>
                <ButtonLink to="/cuenta/pedidos" variant="secondary" small>
                  Ver todas mis compras
                </ButtonLink>
              </p>
            ) : null}
          </Card>

          {isAdmin ? (
            <Notice>
              Sos administrador. <Link to="/admin">Ir al panel de administración</Link>
            </Notice>
          ) : null}
          {isMerchant ? (
            <Notice tone="ok">
              Tu comercio <strong>{merchant?.name}</strong> está activo. <Link to="/comercio">Ir al panel de comercio</Link>
            </Notice>
          ) : (
            <Card title="¿Querés vender en SPOT?">
              <p style={{ color: '#a7a9b2' }}>Sumá tu comercio, publicá tus productos y vendé a todo el país. Revisamos cada pedido de afiliación.</p>
              <ButtonLink to="/cuenta/afiliarse" variant="secondary">
                {merchant ? 'Ver mi solicitud' : 'Quiero vender'}
              </ButtonLink>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
