# Supabase conectado a SPOT

Configurado el 14/10/2026 en el proyecto **SPOT** de **NachoTorress's Org**.

- Referencia: `qvwsyeaijnyhtmwvhzyz`.
- [Panel del proyecto](https://supabase.com/dashboard/project/qvwsyeaijnyhtmwvhzyz).
- URL de la API: `https://qvwsyeaijnyhtmwvhzyz.supabase.co`.
- Región del proyecto creado por el usuario: `us-east-2`.
- Conexión de la aplicación guardada en `.env.local`, excluido de Git. `VITE_SUPABASE_ANON_KEY` contiene la clave **publishable** moderna; se mantiene el nombre de variable que ya usa el cliente. No se incluyó ninguna clave administrativa ni contraseña de base.

## Qué quedó aplicado

Las tablas, funciones y políticas de la tienda; los buckets de imágenes; las seis categorías iniciales; las tablas/importador del esquema `catalogo`; y el seed ficticio: **20 productos, 20 variantes, 40 ofertas y 40 observaciones históricas**.

Todas las 21 tablas de la aplicación tienen RLS. El catálogo de demostración sigue reservado al servidor y al editor SQL, conforme al alcance de 3.1-3.3. No aparece automáticamente en la tienda pública: `public.products` todavía no tiene productos reales. Los registros de comercios/clientes y la carga de productos se realizan desde los flujos existentes de la tienda.

Se fijó el `search_path` de cuatro triggers y se revocó su invocación directa por clientes; se conservó su ejecución automática. La migración `20261014204116_deployed_function_permissions.sql` reproduce esos ajustes en instalaciones nuevas.

## Usarlo localmente

Reiniciar el servidor de desarrollo si ya estaba abierto: Vite lee `.env.local` al iniciar. Ejecutar `npm run dev` desde la raíz del repositorio. No hace falta modificar el cliente de Supabase ni pegar claves en el código.

Para un despliegue en Easypanel, usar la URL y la clave pública de `.env.local` como `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en los argumentos de compilación y reconstruir la imagen. La conexión local no modifica por sí sola un sitio que ya esté publicado. No se realizó un despliegue externo durante esta configuración.

El primer administrador de la aplicación se asigna según las instrucciones del README, después de registrar la cuenta correspondiente. No se inventó un usuario administrador ni se enviaron correos de prueba.

## Verificación

La misma biblioteca y clave pública de la aplicación pudieron leer por HTTPS:

- `categories`: seis filas.
- `site_settings`: una fila.
- `products` y `announcements`: consultas exitosas sin filas iniciales.
- `profiles`: rechazado con código `42501` para un visitante sin sesión.

Además se comprobaron los conteos del catálogo, el estado activo del proyecto y RLS en todas las tablas. La suite completa pasó **259 pruebas en 22 archivos**, incluyendo registro/perfiles, tienda, importación y dos pruebas nuevas del despliegue.

La compilación de producción del cliente y del servidor terminó correctamente con la conexión configurada. Se instalaron las dependencias que ya estaban declaradas en el proyecto y faltaban en el entorno local; no se cambiaron versiones del manifiesto ni del lockfile.

## Historial de migraciones

Supabase asignó versiones a las migraciones aplicadas desde la integración. La primera contiene el esquema de marketplace y sus políticas, aplicados juntos para no exponer tablas sin RLS:

| Versión remota | Nombre | Archivos locales incluidos |
| --- | --- | --- |
| 20261014203740 | marketplace_schema | 20261013000001 y 20261013000002 |
| 20261014203806 | marketplace_storage_seed | 20261013000003 |
| 20261014203812 | catalogo_schema | 20261013000004 |
| 20261014203819 | catalogo_import | 20261013000005 |
| 20261014204214 | deployed_function_permissions | 20261014204116 |

El historial remoto se conservó tal como lo registró Supabase. Antes de adoptar `supabase db push` en este proyecto, reconciliar estas versiones con el procedimiento oficial de migraciones; no ejecutar todas las migraciones locales otra vez sobre esta base existente. No se modificó manualmente la tabla interna de historial.

## Avisos del asesor pendientes de revisión contextual

Se corrigieron los avisos de contexto mutable de funciones y ejecución pública de triggers. El asesor sigue marcando las funciones `SECURITY DEFINER` que las políticas RLS y los RPC de negocio necesitan ejecutar. Esas funciones existentes incluyen comprobaciones de sesión, propietario o administrador según su finalidad; no se cambiaron a `SECURITY INVOKER` porque rompería operaciones que necesitan consultar tablas protegidas.

Antes de ampliar permisos o publicar nuevos RPC, revisar de nuevo estos avisos y las políticas de cada función: [ejecución sin sesión](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) y [ejecución con sesión](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). La revisión de rendimiento también identificó optimizaciones de índices/políticas para una etapa posterior; no son errores de conexión.
