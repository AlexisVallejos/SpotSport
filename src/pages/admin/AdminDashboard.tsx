import { ButtonLink, Card, Loading, Notice, PageTitle, Row, Stats } from '../../components/ui';
import { adminStats } from '../../lib/api/admin';
import { formatPrice } from '../../lib/money';
import { useAsync } from '../../lib/useAsync';

export default function AdminDashboard() {
  const stats = useAsync(adminStats, []);
  const data = stats.data;
  return (
    <>
      <PageTitle title="Administración" subtitle="Estado general de SPOT" />
      {stats.error ? <Notice tone="error">{stats.error}</Notice> : null}
      {stats.loading || !data ? (
        <Loading />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {data.merchants_pending > 0 ? (
            <Notice>
              Hay {data.merchants_pending} {data.merchants_pending === 1 ? 'comercio esperando' : 'comercios esperando'} aprobación.
            </Notice>
          ) : null}
          <Stats
            items={[
              { label: 'Ventas (30 días)', value: formatPrice(data.sales_30d_cents) },
              { label: 'Pedidos (30 días)', value: data.orders_30d },
              { label: 'Ventas totales', value: formatPrice(data.sales_total_cents) },
              { label: 'Usuarios', value: data.users },
              { label: 'Comercios activos', value: data.merchants_approved },
              { label: 'Por aprobar', value: data.merchants_pending },
              { label: 'Suspendidos', value: data.merchants_suspended },
              { label: 'Productos', value: data.products },
            ]}
          />
          <Card title="Atajos">
            <Row>
              <ButtonLink to="/admin/comercios" variant="secondary">
                Aprobar comercios
              </ButtonLink>
              <ButtonLink to="/admin/anuncios" variant="secondary">
                Anuncios de la tienda
              </ButtonLink>
              <ButtonLink to="/admin/productos" variant="secondary">
                Destacar productos
              </ButtonLink>
            </Row>
          </Card>
        </div>
      )}
    </>
  );
}
