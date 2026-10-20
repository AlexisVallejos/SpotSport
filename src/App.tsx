import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PanelLayout, { type PanelLink } from './components/layout/PanelLayout';
import { RequireAdmin, RequireAuth, RequireMerchant } from './components/layout/guards';
import ShopLayout from './components/layout/ShopLayout';
import { Empty } from './components/ui';
import SPOTTodoElDeporte from './pages/SPOTTodoElDeporte';
import SpotSearch from './components/organisms/SpotSearch/SpotSearch';

// Cada sección se descarga solo cuando se entra: la landing queda liviana.
const Entrenar = lazy(() => import('./pages/Entrenar'));
const Precios = lazy(() => import('./pages/Precios'));
const Legal = lazy(() => import('./pages/Legal'));
const Comprar = lazy(() => import('./pages/Comprar'));
const TicketPage = lazy(() => import('./pages/Ticket').then((module) => ({ default: module.TicketPage })));
const MyTickets = lazy(() => import('./pages/Ticket').then((module) => ({ default: module.MyTickets })));
const ProductPage = lazy(() => import('./pages/shop/ProductPage'));
const CartPage = lazy(() => import('./pages/shop/CartPage'));
const Checkout = lazy(() => import('./pages/shop/Checkout'));
const Coupons = lazy(() => import('./pages/shop/Coupons'));
const Login = lazy(() => import('./pages/shop/Login'));
const Register = lazy(() => import('./pages/shop/Register'));
const AccountHome = lazy(() => import('./pages/account/AccountHome'));
const Orders = lazy(() => import('./pages/account/Orders'));
const Profile = lazy(() => import('./pages/account/Profile'));
const Vouchers = lazy(() => import('./pages/account/Vouchers'));
const BecomeMerchant = lazy(() => import('./pages/account/BecomeMerchant'));
const MerchantDashboard = lazy(() => import('./pages/merchant/MerchantDashboard'));
const MerchantProducts = lazy(() => import('./pages/merchant/MerchantProducts'));
const ProductForm = lazy(() => import('./pages/merchant/ProductForm'));
const MerchantOrders = lazy(() => import('./pages/merchant/MerchantOrders'));
const MerchantProfile = lazy(() => import('./pages/merchant/MerchantProfile'));
const MerchantCoupons = lazy(() => import('./pages/merchant/MerchantCoupons'));
const MerchantStats = lazy(() => import('./pages/merchant/MerchantStats'));
const MerchantSales = lazy(() => import('./pages/merchant/MerchantSales'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminMerchants = lazy(() => import('./pages/admin/AdminMerchants'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'));

const ACCOUNT_LINKS: PanelLink[] = [
  { to: '/cuenta', label: 'Resumen', end: true },
  { to: '/cuenta/pedidos', label: 'Mis compras' },
  { to: '/cuenta/cupones', label: 'Mis cupones' },
  { to: '/cuenta/perfil', label: 'Mis datos' },
  { to: '/cuenta/afiliarse', label: 'Vender en SPOT' },
];

const MERCHANT_LINKS: PanelLink[] = [
  { to: '/comercio', label: 'Resumen', end: true },
  { to: '/comercio/productos', label: 'Productos' },
  { to: '/comercio/pedidos', label: 'Pedidos' },
  { to: '/comercio/cupones', label: 'Cupones' },
  { to: '/comercio/estadisticas', label: 'Estadísticas' },
  { to: '/comercio/ventas', label: 'Ventas con cupón' },
  { to: '/comercio/perfil', label: 'Mi comercio' },
];

const ADMIN_LINKS: PanelLink[] = [
  { to: '/admin', label: 'Resumen', end: true },
  { to: '/admin/comercios', label: 'Comercios' },
  { to: '/admin/usuarios', label: 'Usuarios' },
  { to: '/admin/productos', label: 'Productos' },
  { to: '/admin/pedidos', label: 'Pedidos' },
  { to: '/admin/cupones', label: 'Cupones y comisiones' },
  { to: '/admin/anuncios', label: 'Anuncios' },
  { to: '/admin/categorias', label: 'Categorías' },
];

const Fallback = () => (
  <div className="route-loading" role="status">
    Cargando…
  </div>
);

function NotFound() {
  return (
    <Empty title="No encontramos esa página">
      <p>
        <Link to="/">Volver al inicio</Link>
      </p>
    </Empty>
  );
}

export default function App() {
  const { pathname, hash } = useLocation();
  // Compatibilidad con los enlaces anteriores (#entrenar, #precios).
  if (pathname === '/' && hash === '#entrenar') return <Navigate to="/entrenar" replace />;
  if (pathname === '/' && hash.startsWith('#precios')) return <Navigate to={hash.slice(1).replace(/^precios/, '/precios')} replace />;

  return (
    <Suspense fallback={<Fallback />}>
      <SpotSearch />
      <Routes>
        <Route path="/" element={<SPOTTodoElDeporte />} />
        <Route path="/entrenar" element={<Entrenar />} />
        <Route path="/precios" element={<Precios />} />
        <Route path="/precios/:id" element={<Precios />} />
        <Route path="/legal" element={<Legal />} />
        {/* Tienda y Ofertas: el mismo catálogo que el comparador, sólo zapatillas y con compra por SPOT. */}
        <Route path="/tienda" element={<Precios mode="tienda" />} />
        <Route path="/tienda/:id" element={<Precios mode="tienda" />} />
        <Route path="/ofertas" element={<Precios mode="ofertas" />} />
        <Route path="/ofertas/:id" element={<Precios mode="ofertas" />} />
        <Route path="/comprar/:id" element={<Comprar />} />
        <Route path="/ticket/:id" element={<TicketPage />} />
        <Route path="/tickets" element={<MyTickets />} />

        <Route element={<ShopLayout />}>
          <Route path="producto/:id" element={<ProductPage />} />
          <Route path="carrito" element={<CartPage />} />
          <Route path="cupones" element={<Coupons />} />
          <Route path="login" element={<Login />} />
          <Route path="registro" element={<Register />} />

          <Route element={<RequireAuth />}>
            <Route path="checkout" element={<Checkout />} />

            <Route path="cuenta" element={<PanelLayout title="Mi cuenta" links={ACCOUNT_LINKS} />}>
              <Route index element={<AccountHome />} />
              <Route path="pedidos" element={<Orders />} />
              <Route path="cupones" element={<Vouchers />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="afiliarse" element={<BecomeMerchant />} />
            </Route>

            <Route path="comercio" element={<PanelLayout title="Mi comercio" links={MERCHANT_LINKS} />}>
              <Route element={<RequireMerchant />}>
                <Route index element={<MerchantDashboard />} />
                <Route path="productos" element={<MerchantProducts />} />
                <Route path="productos/:id" element={<ProductForm />} />
                <Route path="pedidos" element={<MerchantOrders />} />
                <Route path="cupones" element={<MerchantCoupons />} />
                <Route path="estadisticas" element={<MerchantStats />} />
                <Route path="ventas" element={<MerchantSales />} />
                <Route path="perfil" element={<MerchantProfile />} />
              </Route>
            </Route>

            <Route path="admin" element={<PanelLayout title="Administración" links={ADMIN_LINKS} />}>
              <Route element={<RequireAdmin />}>
                <Route index element={<AdminDashboard />} />
                <Route path="comercios" element={<AdminMerchants />} />
                <Route path="usuarios" element={<AdminUsers />} />
                <Route path="productos" element={<AdminProducts />} />
                <Route path="pedidos" element={<AdminOrders />} />
                <Route path="cupones" element={<AdminCoupons />} />
                <Route path="anuncios" element={<AdminAnnouncements />} />
                <Route path="categorias" element={<AdminCategories />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
