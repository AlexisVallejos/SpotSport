import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MERCHANT_STATUS_LABEL } from '../../lib/types';
import { Badge, ButtonLink, Card, Loading, Notice } from '../ui';
import NotConfigured from './NotConfigured';

/** Exige sesión iniciada. Si no hay, lleva a /login y vuelve acá después. */
export function RequireAuth() {
  const { loading, configured, session } = useAuth();
  const location = useLocation();
  if (!configured) return <NotConfigured />;
  if (loading) return <Loading />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

/** Exige un comercio aprobado. Si está en revisión o rechazado, lo explica. */
export function RequireMerchant() {
  const { loading, merchant, isMerchant } = useAuth();
  if (loading) return <Loading />;
  if (isMerchant) return <Outlet />;
  if (!merchant) return <Navigate to="/cuenta/afiliarse" replace />;
  return (
    <Card title="Tu comercio todavía no está habilitado">
      <p>
        <Badge tone={merchant.status === 'pending' ? 'warn' : 'bad'}>{MERCHANT_STATUS_LABEL[merchant.status]}</Badge>
      </p>
      {merchant.status === 'pending' ? <Notice>Estamos revisando tu pedido de afiliación. Te avisamos apenas esté aprobado.</Notice> : null}
      {merchant.rejection_reason ? <Notice tone="error">Motivo: {merchant.rejection_reason}</Notice> : null}
      <p>
        <ButtonLink to="/cuenta/afiliarse" variant="secondary">
          Ver mi solicitud
        </ButtonLink>
      </p>
    </Card>
  );
}

export function RequireAdmin() {
  const { loading, isAdmin } = useAuth();
  if (loading) return <Loading />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
