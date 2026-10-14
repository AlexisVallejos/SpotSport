# Integrante 3 — entrega 3.4 a 3.6

Implementación del 14/10/2026. Incluye 3.5, que es la verificación de seguridad del tramo. El catálogo académico está en `catalogo`; la tienda, sus pedidos y su afiliación siguen en `public`. La API del comparador de páginas existente en `server/` continúa siendo un módulo distinto.

## 3.4 — Contrato listo para I2

Importar `listarOfertas` e `historialPrecios` desde `src/services/catalogo`. Usan el cliente Supabase existente, su clave pública y las vistas `public.catalogo_ofertas` / `public.catalogo_historial`. No hace falta un servidor adicional ni una clave administrativa para consultar.

```ts
import { listarOfertas, historialPrecios } from './services/catalogo';

const ofertas = await listarOfertas({
  texto: 'ruta', categoria: 'running', talle: '42', moneda: 'ARS',
  precioMax: '100000.00', incluirDemo: true, limite: 20, desde: 0,
});
const historial = ofertas.length ? await historialPrecios(ofertas[0].ofertaId) : [];
```

`OfertaCatalogo`, definido en `shared/catalogo.ts`, devuelve `ofertaId`, `productoId`, `varianteId`, `nombre`, `marca`, `modelo`, `categoria`, `talle`, `color`, `precio`, `moneda`, `comercio`, `comercioId`, `urlOrigen`, `fuenteId`, `fechaActualizacion`, `disponible` y `esDemo`. Precio es **texto decimal en unidades monetarias**, por ejemplo `80000.00`; fecha es ISO 8601. No se confunde con `price_cents` de la tienda.

Filtros: texto sobre nombre/modelo/marca/categoría; marca, categoría y talle exactos normalizados; variante/comercio por UUID; moneda; precio mínimo/máximo; incluir demo; límite e inicio. Límite de 1 a 200, por defecto 100. Para filtrar precio hay que elegir moneda. La demo queda excluida por defecto; actualmente todos los datos del catálogo remoto son demo, por eso se necesita `incluirDemo: true` para verlos.

El orden es variante, moneda, precio **numérico**, fecha descendente e identificador. Elegir `varianteId` y `moneda` para comparar alternativas equivalentes. No se convierte ARS/USD ni se comparan talles distintos. Las columnas auxiliares `precioOrden` y `busqueda` sirven a la consulta pero no forman parte del DTO. Una falla se propaga como error; `[]` significa que la consulta válida no encontró ofertas.

Prueba independiente de la web: `npm test -- src/services/catalogo/index.test.ts supabase/tests/catalogo-api.test.ts`. El primer archivo verifica las solicitudes con el SDK real y una respuesta HTTP controlada; el segundo ejecuta SQL y RLS sobre Postgres en memoria. Las tres consultas de `supabase/queries/defensa_catalogo.sql` también funcionan en el editor SQL de Supabase.

## 3.5 — Permisos e integridad

| Actor | Lectura | Cambios |
| --- | --- | --- |
| Visitante / cliente | Ofertas publicables e historial de esas ofertas | Ninguno |
| Miembro de comercio | Lo público y la gestión de sus fuentes/ofertas | Carga/edición de sus fuentes mediante RPC; quedan pendientes |
| Administrador (`profiles.is_admin`) | Gestión de todas las fuentes/ofertas | Alta/configuración de fuentes/comercios, miembros y moderación |
| Servidor (`service_role`) | Datos e importaciones internas | Importación controlada; cambios de observación también se despublican |

Todas las tablas tienen RLS. Las vistas usan `security_invoker = true`; la vista pública mantiene su filtro incluso si la consulta la hace un administrador. Se conceden columnas concretas; los logs, evidencias privadas y datos de revisión no tienen acceso público. No se conceden escrituras directas a visitantes ni usuarios autenticados.

Las funciones públicas nuevas son `SECURITY INVOKER`. Delegan en funciones privadas del esquema no expuesto `catalogo`, con `search_path` vacío y comprobación explícita de sesión, administrador o membresía. Los helpers privados de RLS evitan consultas recursivas. Las funciones de carga comprueban el comercio a partir de la fuente almacenada: el cliente no decide de quién es la fuente.

No alcanza con registrar una cuenta o pedir afiliación: para operar el catálogo el administrador debe asignar una membresía. Aprobar `public.merchants` habilita el panel de la tienda existente; no vincula automáticamente un perfil con un comercio de `catalogo`. Ambos modelos reutilizan la misma cuenta de `public.profiles`.

Pruebas cubiertas: lectura pública y orden; escrituras/lecturas privadas denegadas; carga cruzada entre comercios; escalada de rol; revocación de operador; FK faltantes; unicidad y duplicados; precios, monedas y fechas inválidas; enlaces ajenos; fuentes sin permiso; comercio suspendido; rollback total con log; historial atómico; despublicación al editar y reimportación idempotente. Ejecutar la suite completa con `npm test` y compilar con `npm run build`.

## 3.6 — Operaciones para el panel de I2

Importar desde `src/services/catalogo/gestion`:

| Función | Uso |
| --- | --- |
| `listarFuentesGestion()` | Fuentes del operador; todas para admin |
| `listarOfertasGestion(fuenteId, desde?)` | Hasta 100 ofertas por página, incluidas pendientes |
| `cargarOfertas(fuenteId, filas, archivo?)` | Manual o CSV parseado; devuelve id del intento y cantidad aplicada; lanza error si `ok:false` |
| `asignarOperador(comercioId, perfilId, rol)` | Solo admin; rol `titular`, `operador` o `null` para revocar |
| `configurarFuente(config)` | Solo admin; crea IDs si se omiten, devuelve comercio/fuente; cambia estado y permiso |
| `moderarOferta(ofertaId, publicada, vigenteHasta?, evidencia?)` | Solo admin; aprobar o retirar |

Para editar precio/URL/disponibilidad, reenviar el mismo código externo con observación posterior y datos completos. Se conserva el UUID de la oferta y se agrega historial; el cambio vuelve a quedar pendiente. Para retirar una oferta como operador, cargar `disponible:false` con fecha posterior. Un cambio de talle/color/moneda necesita otro código. Una reimportación idéntica no altera la aprobación.

Ejemplo de alta administrativa (con sesión admin):

```ts
const ids = await configurarFuente({
  nombreComercio: 'Comercio con autorización', sitioWeb: 'https://ejemplo.test',
  estado: 'pendiente', nombreFuente: 'CSV autorizado', tipo: 'csv',
  urlBase: 'https://ejemplo.test', permisoVerificado: false, evidenciaPermiso: '', esDemo: false,
});
await asignarOperador(ids.comercio_id, perfilIdRegistrado, 'operador');
```

El dominio del ejemplo es ilustrativo. Antes de cargar, el admin activa el comercio y registra permiso/evidencia. Para una fuente existente, pasar ambos IDs devueltos; no puede transferirse a otro comercio ni cambiar de origen/rótulo demo. Para esos cambios se crea otra fuente, preservando el historial. `titular` y `operador` comparten permisos de carga; ninguno puede conceder acceso a terceros.

## EP-03 — decisión de publicación

Una importación válida **no publica automáticamente**. Precio negativo, observación futura, identidad inconsistente u origen ajeno se rechazan antes de crear/actualizar la oferta. Cada nueva observación borra la revisión previa y despublica, incluso si viene del servidor. La moderación no agrega observaciones históricas de precio.

| Condición / acción | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Comercio activo y fuente con permiso documentado | Sí | No | Sí | Sí | Varios fallan |
| Precio válido, disponible y observación no futura/no vencida | Sí | Sí | No | Sí | — |
| Enlace del origen autorizado y revisión documentada | Sí | Sí | Sí | No | — |
| Admin aprobó la observación actual | Sí | Cualquiera | Cualquiera | Cualquiera | Cualquiera |
| Publicar | Sí | No | No | No | No |
| Informar causa y corregir/revisar | No | Sí | Sí | Sí | Sí |

La publicación es la conjunción de todas las condiciones; cubre también fallas simultáneas. La vista y la moderación aplican la misma regla de elegibilidad. Una oferta vencida, sin disponibilidad, con permiso retirado o de comercio suspendido desaparece de la consulta pública y de su historial público. Al retirar manualmente la aprobación, no vuelve a aparecer por repetir el mismo archivo.

**Datos reales:** al aprobar se exigen una evidencia de al menos diez caracteres sobre la revisión humana del enlace/precio y una vigencia futura explícita. El admin debe abrir el enlace y comprobar el dato antes de declararlo revisado. Se guardan `evidencia_revision`, `revisada_por` y `fecha_revision`; no se publican estos campos. El sistema valida sintaxis/origen pero **no hace una comprobación HTTP automática**, ni puede garantizar que la declaración humana sea verdadera. El vencimiento elegido define cuándo deja de considerarse actual; no se inventa un plazo comercial universal.

**Demo:** el seed publica exclusivamente las fuentes ficticias identificadas y registra esa excepción. Los enlaces `.invalid` no están verificados por HTTP ni representan tiendas reales. Puede aprobarse la demo sin vencimiento para la defensa académica; siempre conservar `esDemo:true` en la pantalla que la consuma.

## Consultas y defensa de Base de Datos

Ejecutar `supabase/queries/defensa_catalogo.sql`: (1) menor precio por variante/moneda con empates y demo separada; (2) historial cronológico de una oferta; (3) cantidad de ofertas públicas por comercio y moneda. Con el seed inicial, devuelve 20 ganadoras, una observación para la oferta elegida y 20 ofertas en cada comercio.

El [DER](DER.md) representa las cardinalidades y el [diccionario](diccionario.md) las restricciones reales. Para explicar: producto 1:N variantes; variante 1:N ofertas; comercio 1:N fuentes; fuente 1:N ofertas/importaciones; oferta 1:N observaciones; comercio N:M perfiles mediante membresías. `importaciones.fuente_id` admite NULL solo para registrar una solicitud de fuente inexistente; `actor_id` admite NULL para cargas técnicas sin sesión.

1FN: cada celda conserva un dato atómico; no hay listas de talles o precios. 2FN: el rol de una membresía depende de la clave completa comercio/perfil. 3FN: marca/categoría se referencian desde producto; el comercio se obtiene por fuente, evitando duplicaciones contradictorias. El historial representa eventos, no copias accidentales. El precio actual es una proyección materializada del último evento para consultar rápido, mantenida transaccionalmente por el importador/trigger; no se afirma que esa duplicación sea necesaria para la normalización.

Las FK impiden ofertas huérfanas; las UNIQUE separan identidad de producto, variante y oferta por fuente/código; CHECK restringe precios/monedas/fechas/estados; triggers y RPC validan reglas entre tablas y autorización. UUID identifica una fila, pero no reemplaza las claves de negocio ni otorga permisos.

## Migración, seed y variables

Base nueva: ejecutar **todas** las migraciones locales en orden sobre Supabase vacío. Luego cargar `supabase/seeds/catalogo_demo.sql` únicamente en un entorno demo. En el proyecto existente aplicar solo las pendientes; consultar [el mapa de versiones remotas](conexion-supabase.md) antes de usar herramientas que comparen historial. Esta entrega agrega `20261014212300_catalogo_api_permisos.sql`; no modifica migraciones anteriores ni repara el historial interno.

| Variable | Dónde | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Compilación del cliente | URL pública |
| `VITE_SUPABASE_ANON_KEY` | Compilación del cliente | Clave publishable pública, nombre compatible existente |
| `SUPABASE_URL` | Terminal/servidor del importador | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo terminal/servidor del importador | Secreto; jamás en `VITE_*` o Git |
| `SPOT_BACKUP_DB_URL`, `SPOT_RESTORE_DB_URL` | Sesión privada de mantenimiento | Conexiones PostgreSQL con contraseña, nunca frontend/Git |

La aplicación ya usa `.env.local`, ignorado por Git. El importador técnico no lo carga automáticamente. El panel usa la sesión de la persona, sin clave administrativa.

## Respaldo y restauración

Procedimiento basado en la [guía oficial de Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), con la ayuda del CLI 2.121.0 verificada. Requiere Docker y `psql` compatible. Copiar la conexión desde **Connect** del proyecto (session pooler o directa), sin inventar host/contraseña ni resetearla si ya se conoce. Guardarla temporalmente en `SPOT_BACKUP_DB_URL`, con SSL, sin imprimirla. Antes de cambios importantes detener cargas y anotar fecha/commit/conteos.

```powershell
New-Item -ItemType Directory -Force backups
npx supabase@2.121.0 db dump --db-url $env:SPOT_BACKUP_DB_URL --role-only -f backups/roles.sql
npx supabase@2.121.0 db dump --db-url $env:SPOT_BACKUP_DB_URL -f backups/schema.sql
npx supabase@2.121.0 db dump --db-url $env:SPOT_BACKUP_DB_URL --data-only --use-copy -f backups/data.sql
```

Comprobar los códigos de salida y que los tres archivos contengan lo esperado. `backups/` está excluido de Git; copiarlo cifrado a una ubicación privada con fecha. El dump puede contener datos personales/de autenticación: no adjuntarlo a la entrega académica. Verificar que incluya esquema `catalogo`, perfiles y usuarios necesarios para sus FK. Las imágenes físicas de Storage, configuración Auth/SMTP y secretos se respaldan/configuran aparte: un dump SQL no constituye por sí solo una copia completa del producto.

Para un simulacro usar **otro proyecto Supabase nuevo**, con las extensiones requeridas habilitadas y sin aplicar además las migraciones si se restaura `schema.sql`. Definir `SPOT_RESTORE_DB_URL` con su conexión. Revisar compatibilidad de versiones y roles antes de ejecutar:

```powershell
psql --dbname $env:SPOT_RESTORE_DB_URL --single-transaction --variable ON_ERROR_STOP=1 --file backups/roles.sql --file backups/schema.sql --command 'SET session_replication_role = replica' --file backups/data.sql
```

El modo `replica` solo durante la sesión de restauración evita disparar otra vez triggers de perfil/historial/despublicación sobre un backup ya consistente. Se requiere el privilegio apropiado; si falla, la transacción se revierte. No ejecutar esta restauración sobre el proyecto SPOT existente. No mezclarla con un reset ni modificar la tabla interna de migraciones.

Validar después: conteos por tabla, FK sin referencias faltantes, últimas observaciones y precios, RLS, lectura anónima y carga de un operador autorizado en la copia. Reconfigurar las claves públicas apuntando a la copia y probar Auth/Storage por separado. Guardar el resultado del simulacro antes de considerar recuperable una copia. **En esta entrega se comprobó la reconstrucción desde migraciones y seed en Postgres de prueba; no se exportó información privada ni se ejecutó una restauración remota real.**

Retención propuesta para el piloto: siete respaldos diarios y cuatro semanales cifrados, más uno antes de cada migración; revisar espacio y responsabilidad con el equipo antes de habilitar producción. El historial no se elimina desde los paneles. No se configuró una automatización de backups ni un plazo legal de conservación de datos personales.

## Alcance que queda para otros integrantes

I2 puede conectar sus pantallas a estos servicios y mostrar estado pendiente/errores/demo. No se sustituyó su comparador visual ni se agregaron pantallas nuevas. Siguen pendientes de acuerdos reales los catálogos externos y sus permisos; el conector de scraping existente no se presenta como fuente autorizada ni se importa automáticamente. Las tablas de ejercicios no habilitan por sí solas cambios en la cámara.
