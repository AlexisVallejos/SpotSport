# Diccionario físico del catálogo (3.1)

Todos los nombres de tabla pertenecen a `catalogo`, salvo `public.profiles`. `UUID PK` se genera con `gen_random_uuid()`; las FK son obligatorias excepto donde se indica. `timestamptz` conserva instantes con zona; la entrada requiere ISO 8601. No se usan flotantes para dinero.

| Tabla | Campos | Claves y restricciones |
| --- | --- | --- |
| comercios | `id UUID`; `nombre TEXT`; `sitio_web TEXT`; `estado TEXT` (pendiente por defecto); `es_demo BOOLEAN` (false por defecto) | PK id; sitio_web único y origen HTTPS sin ruta; nombre 2-100 caracteres; estado pendiente/activo/suspendido; UNIQUE(id, es_demo) para FK compuesta. |
| fuentes | `id UUID`; `comercio_id UUID`; `nombre TEXT`; `tipo TEXT`; `url_base TEXT`; `permiso_verificado BOOLEAN` (false); `evidencia_permiso TEXT` (vacía); `es_demo BOOLEAN` (false); `ultima_sincronizacion TIMESTAMPTZ` nullable | PK id; FK(comercio_id, es_demo) a comercios; UNIQUE(comercio_id, nombre); tipo manual/csv/api; origen HTTPS sin ruta; un permiso verificado exige evidencia no vacía. |
| marcas | `id UUID`; `nombre TEXT` | PK id; nombre único, no vacío, normalizado a minúsculas sin espacios externos. |
| categorias | `id UUID`; `nombre TEXT` | Igual que marcas. Independiente de categorías de la tienda para no alterar sus contratos. |
| productos | `id UUID`; `marca_id UUID`; `categoria_id UUID`; `nombre TEXT`; `modelo TEXT` | FK a marcas/categorias; UNIQUE(marca_id, modelo); modelo en mayúsculas, no vacío; nombre 2-120 caracteres. El producto no depende de un comercio. |
| variantes | `id UUID`; `producto_id UUID`; `talle TEXT` (vacío); `color TEXT` (vacío) | FK a productos; UNIQUE(producto_id, talle, color); talle en mayúsculas/color en minúsculas. El vacío expresa que el atributo no aplica, sin permitir duplicados por NULL. |
| importaciones | `id UUID`; `fuente_id UUID` nullable; `fuente_solicitada UUID`; `archivo TEXT`; `inicio TIMESTAMPTZ` (reloj actual); `fin TIMESTAMPTZ` nullable; `estado TEXT` (procesando); `filas_recibidas INTEGER` (0); `filas_aplicadas INTEGER` (0); `detalle TEXT` nullable | FK nullable a fuentes; estado procesando/exito/error; conteos no negativos. Conserva intentos fallidos y la fuente solicitada aunque no exista. El cierre del lote llena fin/estado/conteos/detalle. |
| ofertas | `id UUID`; `fuente_id UUID`; `variante_id UUID`; `codigo_externo TEXT`; `precio NUMERIC(12,2)`; `moneda TEXT`; `url_producto TEXT`; `disponible BOOLEAN`; `fecha_observacion TIMESTAMPTZ`; `vigente_hasta TIMESTAMPTZ` nullable; `importacion_id UUID` | FK a fuentes/variantes/importaciones; UNIQUE(fuente_id, codigo_externo); código 1-100 caracteres sin espacios externos; precio finito no negativo; moneda ARS/USD; vigencia no anterior a observación. Trigger valida permiso, comercio, origen, fecha e identidad. |
| historial_precios | `id UUID`; `oferta_id UUID`; `importacion_id UUID`; `precio NUMERIC(12,2)`; `moneda TEXT`; `fecha_observacion TIMESTAMPTZ`; `disponible BOOLEAN`; `url_producto TEXT` | FK a ofertas/importaciones; UNIQUE(oferta_id, fecha_observacion); precio finito no negativo; moneda ARS/USD. El trigger agrega la observación al cargar/actualizar; no se concede UPDATE al rol de servidor. |
| ejercicios | `id UUID`; `nombre TEXT`; `activo BOOLEAN` (false); `instrucciones TEXT` (vacías) | PK id; nombre único. Solo esquema preparado; ningún ejercicio se activa automáticamente. |
| reglas_movimiento | `id UUID`; `ejercicio_id UUID`; `metrica TEXT`; `minimo NUMERIC(8,3)` nullable; `maximo NUMERIC(8,3)` nullable; `mensaje TEXT`; `validada BOOLEAN` (false) | FK a ejercicios; UNIQUE(ejercicio_id, metrica); si ambos límites existen, mínimo <= máximo. Solo esquema; validar referencias antes de uso. |
| membresias | `comercio_id UUID`; `perfil_id UUID`; `rol TEXT` | PK compuesta(comercio_id, perfil_id); FK a comercios y public.profiles; rol titular/operador. No concede acceso por sí sola: políticas por operador pendientes de 3.5. |

## Índices y trazabilidad

Los PK y UNIQUE crean índices de integridad. Además: fuentes por comercio; productos por categoría; importaciones por fuente/inicio descendente; ofertas por variante/moneda/precio y fecha de observación descendente. UNIQUE(producto_id,talle,color) cubre el acceso a variantes por producto; UNIQUE(oferta_id,fecha_observacion) cubre el historial de una oferta.

La oferta refiere a la última importación que aplicó un cambio. Cada observación refiere a la importación que la creó. Una reimportación idéntica genera registro del intento exitoso con cero filas aplicadas, sin cambiar el histórico ni la última importación de la oferta. `ultima_sincronizacion` es la hora de un lote exitoso; `fecha_observacion` es la fecha del dato, no la hora de ejecución del importador.

## Acceso y tipos de datos de entrada

El esquema tiene RLS activado y no concede acceso a anon/authenticated. Por ahora el servidor (`service_role`) puede leer/cargar/actualizar mediante privilegios explícitos; el SQL administrativo puede preparar fuentes y ejecutar la demo. La función expuesta `public.importar_catalogo` es `SECURITY INVOKER`: no eleva al usuario que la llama y no está habilitada para visitantes o cuentas comunes. La autorización comercial pública completa queda fuera de 3.1-3.3.

Cada fila JSON usa texto para los campos del CSV, incluido precio y fecha; usa booleanos JSON para disponible/es_demo. La tabla convierte el decimal a NUMERIC. `es_demo` no se repite en ofertas: se obtiene de fuentes para mantener la coherencia. El tipo `api` está permitido en el modelo; no hay un conector API implementado.
