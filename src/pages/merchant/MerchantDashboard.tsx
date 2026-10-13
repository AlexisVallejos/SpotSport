import { ButtonLink, Card, Loading, Notice, PageTitle, Row, Stats } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { merchantStats } from '../../lib/api/merchant';
import { formatPrice } from '../../lib/money';
import { useAsync } from '../../lib/useAsync';

export default function MerchantDashboard() {
  const { merchant } = useAuth();
  const stats = useAsync(merchantStats, []);
  const data = stats.data;

  return (
    <>
      <PageTitle title={merchant?.name ?? 'Mi comercio'} subtitle="Resumen de tu actividad" actions={<ButtonLink to="/comercio/productos/nuevo">Publicar producto</ButtonLink>} />
      {stats.error ? <Notice tone="error">{stats.error}</Notice> : null}
      {stats.loading || !data ? (
        <Loading />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Stats
            items={[
              { label: 'Ventas (30 días)', value: formatPrice(data.sales_30d_cents) },
              { label: 'Pedidos (30 días)', value: data.orders_30d },
              { label: 'Pedidos por atender', value: data.orders_pending },
              { label: 'Ventas totales', value: formatPrice(data.sales_total_cents) },
              { label: 'Productos', value: data.products },
              { label: 'Stock bajo', value: data.low_stock },
            ]}
          />
          {data.orders_pending > 0 ? (
            <Notice>
              Tenés {data.orders_pending} {data.orders_pending === 1 ? 'pedido nuevo' : 'pedidos nuevos'} esperando que los prepares.
            </Notice>
          ) : null}
          {data.low_stock > 0 ? <Notice>Hay {data.low_stock} variantes con 3 unidades o menos. Revisá tu stock.</Notice> : null}
          <Card title="Atajos">
            <Row>
              <ButtonLink to="/comercio/pedidos" variant="secondary">
                Ver pedidos
              </ButtonLink>
              <ButtonLink to="/comercio/productos" variant="secondary">
                Mis productos
              </ButtonLink>
              <ButtonLink to="/comercio/perfil" variant="secondary">
                Datos del comercio
              </ButtonLink>
            </Row>
          </Card>
        </div>
      )}
    </>
  );
}
