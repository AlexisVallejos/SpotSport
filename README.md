# SPOT — Todo el deporte en un solo lugar

Marketplace de deportes en React + TypeScript + Vite, con diseño atómico (`src/components/atoms → molecules → organisms → templates`).

- **Tienda y landing**: productos de comercios afiliados, carrito y compra.
- **Tres tipos de usuario**: cliente, comercio (con aprobación) y admin, cada uno con su panel.
- **Entrená con cámara**: análisis de postura en el navegador con demo 3D y voz de entrenador (`/entrenar`).
- **Comparador de precios**: zapatillas, botines, ropa y accesorios de Open Sports, Dexter y Trip Store, con el mejor precio de cada producto (`/precios`).

## Desarrollo

```
npm install
npm run dev      # http://localhost:5173
npm run api      # API de precios en http://127.0.0.1:8787 (Vite le pasa /api/)
npm test         # lógica + base de datos (PGlite)
npm run build    # genera dist/ (web) y dist-server/ (API de precios)
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
6. **Mounts → Volume**: montá un volumen en `/data` para no perder el historial de precios ni las reseñas del comparador en cada deploy.
7. Deploy. nginx sirve la web y le pasa `/api/` a la API de precios, que corre en el mismo contenedor.

Para comprobar que está vivo: `GET /healthz` responde `ok`. La primera vez la API tarda unos 25 minutos en leer las tres tiendas; mientras tanto el comparador muestra un aviso y va mostrando lo que ya leyó.

## Catálogo del comparador (integrante 3)

Las tareas 3.1 a 3.3 agregan un esquema `catalogo` separado de la tienda, una demo ficticia de 20 artículos y 40 ofertas, y un importador CSV/manual con historial transaccional. La demo se carga explícitamente; las migraciones no publican precios ficticios en la tienda.

Ver [guía de uso, DER y diccionario](docs/datos/README.md). Para comprobarlo sin Supabase:

```
npm test -- supabase/tests/catalogo.test.ts scripts/catalogo/csv.test.ts
npm run catalogo:importar -- --local 20000000-0000-4000-8000-000000000001 data/catalogo/demo-a.csv
```

## Comparador de precios (`/precios`)

- `server/` es una API chica en Node, sin dependencias. Cada 6 horas lee los listados públicos de Open Sports, Dexter y Trip Store (zapatillas, botines, indumentaria y accesorios), de a una página por vez y con pausa entre pedidos. Las subcategorías por deporte de cada tienda marcan si un producto es de running, training, fútbol, etc.
- El mismo producto se cruza entre tiendas por su **código de fabricante** (ej. `DR2660-008`: mismo modelo y color en todas). Los nombres se limpian ("Zapatillas Running Nike Downshifter 14 Mujer" → "Nike Downshifter 14 · Running · Mujer").
- Endpoints: `GET /api/precios` (estado y totales), `GET /api/precios/buscar?q=&categoria=&tipo=&deporte=&genero=&marca=&tienda=&orden=&desde=&limite=` (los mismos filtros que la URL de `/precios`), `GET /api/precios/<id>` (fotos e historial), `GET` y `POST /api/precios/<id>/resenas`.
- Reseñas: Open Sports y Trip tienen las reseñas desactivadas y Dexter no publica propias, así que se muestran las que dejan los usuarios en SPOT (máximo 5 por hora por conexión, sin enlaces). Si alguna tienda las activa, se suman solas.
- Guarda todo en `DATA_DIR` (por defecto `data/`, fuera de git): `tiendas-v2.json`, `historial.json` y `resenas.json`. Variables opcionales en `.env.example`.
- Si una tienda cambia su HTML y deja de leerse, la API sigue mostrando sus últimos precios y lo informa al pie de `/precios`.
- Newsletter del pie: `POST /api/suscripciones` y `POST /api/suscripciones/baja` guardan o borran el mail en `DATA_DIR/suscriptores.json` (fuera de git, máximo 10 envíos por hora por conexión).
- `/legal` explica qué datos se guardan (favoritos sólo en el navegador, reseñas, mails del newsletter) y cómo funcionan los precios.
- En la landing, Calzado, Indumentaria, "El estudio SPOT", Training y el buscador del menú usan estos productos reales. Este comparador es independiente del esquema `catalogo` de Supabase (que carga fuentes con permiso documentado).

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
