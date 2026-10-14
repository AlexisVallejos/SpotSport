# Marketplace SPOT — diseño

Fecha: 2026-10-13 · Estado: aprobado por el usuario ("hacer todo esto")

## Objetivo

Convertir SpotSport (landing estática) en un marketplace de deportes tipo Mercado Libre, con tres tipos de usuario y un panel para cada uno:

- **Admin** (el equipo de SPOT): controla todo, incluida la landing (anuncios, destacados).
- **Cliente**: compra, ve su carrito, sus pedidos y lo gastado.
- **Comercio** (proveedor): un cliente que pide afiliarse y, tras aprobación del admin, publica productos, precios y stock, y ve sus ventas.

## Decisiones

| Tema | Decisión |
|---|---|
| Backend | Supabase (Auth + Postgres con RLS + Storage). Sin servidor propio. |
| Cuentas | Una sola cuenta por persona. "Comercio" es un perfil opcional (`merchants`) aprobado por un admin; un comercio sigue siendo cliente. |
| Admin | Marcador `profiles.is_admin`. No hay registro público de admin. Un trigger impide que alguien se lo auto-asigne. |
| Productos de SPOT | No hay productos propios: el catálogo es solo de comercios de terceros. |
| Seguridad | Los permisos viven en la base (RLS). El cliente nunca fija precios ni stock: el pedido se crea con la función `place_order`, que lee precios y descuenta stock en la base. |
| Pedidos | Un checkout genera **un pedido por comercio** (mismo `checkout_id`). Cada comercio gestiona el estado de los suyos. |
| Pagos | Pago contra entrega y retiro en el local ya funcionan. Mercado Pago queda como Edge Function de arranque, **desactivada** hasta tener credenciales. |
| Carrito | En el navegador (`localStorage`); se valida en el servidor al confirmar. |
| Rutas | `react-router-dom` con History API (nginx ya tiene el fallback a `index.html`). `#entrenar` se conserva. |
| Plan Supabase | El plan free permite 2 proyectos activos y ya hay 2: el proyecto no se crea hasta que el usuario libere un lugar o suba de plan. El código funciona con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; sin ellas la app muestra un aviso de configuración. |

## Modelo de datos

`profiles`, `merchants`, `categories`, `products`, `product_variants` (talle, color, precio, stock), `orders`, `order_items`, `announcements` (anuncios/banners), `site_settings`.

Funciones: `is_admin()`, `my_merchant_id()`, `place_order()`, `set_order_status()`, `mark_order_paid()`, `review_merchant()`, `admin_stats()`, `merchant_stats()`.

## Permisos (RLS)

| Quién | Puede |
|---|---|
| Público | Leer productos activos de comercios aprobados, categorías, anuncios vigentes y ajustes del sitio. |
| Cliente | Su perfil, sus pedidos; pedir afiliación (una por cuenta). |
| Comercio aprobado | CRUD solo de sus productos y variantes; ver y gestionar los pedidos de su comercio; subir imágenes a su carpeta. |
| Admin | Todo, incluidos usuarios, aprobaciones, anuncios y métricas. |

## Pantallas

- **Público:** `/` landing, `/tienda`, `/producto/:id`, `/carrito`, `/checkout`, `/login`, `/registro`, `/entrenar`.
- **Cliente:** `/cuenta` (resumen y gasto), `/cuenta/pedidos`, `/cuenta/perfil`, `/cuenta/afiliarse`.
- **Comercio:** `/comercio` (ventas), `/comercio/productos` (+ alta/edición con variantes e imágenes), `/comercio/pedidos`, `/comercio/perfil`.
- **Admin:** `/admin` (métricas), `/admin/comercios` (aprobar), `/admin/usuarios`, `/admin/productos`, `/admin/pedidos`, `/admin/anuncios`, `/admin/categorias`.

## Landing

Barra de anuncios y bloque de anuncios desde `announcements`; productos destacados reales cuando existan. Mientras no haya destacados se conservan las secciones conceptuales actuales.

## Fuera de alcance (por ahora)

Cobro real y reparto de dinero entre comercios (Mercado Pago Marketplace), envíos con operador logístico, facturación, reseñas, chat comprador-comercio.

## Pruebas

- Lógica pura (carrito, dinero, validaciones): Vitest.
- SQL y permisos: Vitest + PGlite (Postgres en WASM) con un esquema `auth`/`storage` simulado.
- UI: navegación y guardas en el navegador; el flujo completo contra Supabase se prueba al conectar un proyecto real.
