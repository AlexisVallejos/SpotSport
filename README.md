# SPOT — Todo el deporte en un solo lugar

Marketplace de deportes en React + TypeScript + Vite, con diseño atómico (`src/components/atoms → molecules → organisms → templates`).

- **Tienda y landing**: productos de comercios afiliados, carrito y compra.
- **Tres tipos de usuario**: cliente, comercio (con aprobación) y admin, cada uno con su panel.
- **Entrená con cámara**: análisis de postura en el navegador con demo 3D y voz de entrenador (`/entrenar`).

## Desarrollo

```
npm install
npm run dev      # http://localhost:5173
npm test         # lógica + base de datos (PGlite)
npm run build    # genera dist/
```

Sin base de datos conectada la landing y `/entrenar` funcionan igual; la tienda y los paneles muestran un aviso de configuración.

## Conectar la base (Supabase)

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Aplicá, en orden, los archivos de `supabase/migrations/` (en el editor SQL del panel, o con `supabase db push`).
3. Copiá `.env.example` a `.env` y completá:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...        # la clave anon / publishable
   ```
4. En **Authentication → Providers → Email** podés desactivar "Confirm email" si querés que el registro entre directo (útil para pruebas).
5. Registrate en el sitio y, desde el editor SQL, convertí tu cuenta en admin (el primero se asigna a mano):
   ```sql
   update public.profiles set is_admin = true where email = 'tu-email@ejemplo.com';
   ```
6. Entrá a `/admin`: ahí aprobás comercios, cargás anuncios y destacás productos.

### Cómo funciona

| Rol | Cómo se obtiene | Qué puede |
|---|---|---|
| **Cliente** | Cualquier cuenta | Comprar, ver carrito, pedidos y lo gastado (`/cuenta`) |
| **Comercio** | Un cliente lo pide en `/cuenta/afiliarse` y un admin lo aprueba | Productos, variantes (talle/color), precios, stock y sus pedidos (`/comercio`) |
| **Admin** | `profiles.is_admin = true` | Todo: comercios, usuarios, productos, pedidos, anuncios y categorías (`/admin`) |

Los permisos los hace cumplir la base (políticas RLS en `supabase/migrations`), no la interfaz. La compra pasa por la función `place_order`, que toma precios y stock del servidor.

### Pagos

Hoy están disponibles **pago contra entrega** y **retiro en el local**. Mercado Pago está preparado en la interfaz pero desactivado: requiere una cuenta y credenciales propias (y una Edge Function que cree la preferencia de pago y reciba el webhook).

## Deploy en Easypanel

1. Subir el repo a GitHub.
2. En Easypanel: **Create → App → Source: GitHub** (repo y rama `main`).
3. **Build: Dockerfile** (ruta `Dockerfile`, ya está en la raíz).
4. **Environment / Build Args**: cargar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Vite las incorpora al compilar).
5. **Domains & Proxy**: puerto del servicio `80`. Usá HTTPS: la cámara del entrenador lo exige.
6. Deploy.

Para comprobar que está vivo: `GET /healthz` responde `ok`.

## Catálogo del comparador (integrante 3)

Las tareas 3.1 a 3.3 agregan un esquema `catalogo` separado de la tienda, una demo ficticia de 20 artículos y 40 ofertas, y un importador CSV/manual con historial transaccional. La demo se carga explícitamente; las migraciones no publican precios ficticios en la tienda.

Ver [guía de uso, DER y diccionario](docs/datos/README.md). Para comprobarlo sin Supabase:

```
npm test -- supabase/tests/catalogo.test.ts scripts/catalogo/csv.test.ts
npm run catalogo:importar -- --local 20000000-0000-4000-8000-000000000001 data/catalogo/demo-a.csv
```

## Entrenar con cámara

- `src/lib/pose`: geometría, reglas por ejercicio, motor de repeticiones, guion de voz y demo 3D.
- `public/models/pose_landmarker_lite.task`: modelo de MediaPipe (corre en el navegador, el video no sale de la compu).
- `public/voice/es_AR`: la voz del coach, grabada con Piper (`es_AR-daniela-high`). Para regrabarla: `npm run voice:pack` (descarga un modelo de 114 MB a `.cache/`).
- `?debug` en `/entrenar` o el botón **Datos** muestran ángulos y progreso en vivo para calibrar.

## Archivos importantes

- `supabase/migrations/`: esquema, permisos y datos iniciales de la tienda.
- `supabase/tests/`: pruebas de permisos y compras sobre un Postgres real (PGlite).
- `public/video/spot-intro.mp4`: intro que se reproduce en cada carga.
- `public/images/`: fotos de hero, deportes, productos y campañas.
- `public/brand/`: logos oficiales SPOT (SVG).
- `public/fonts/`: Inter y Barlow Condensed (licencias OFL incluidas).
