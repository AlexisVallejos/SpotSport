# Informe de pruebas — SPOT, integrante 3

**Fecha:** 19/10/2026, zona America/Buenos_Aires. **Responsable del bloque:** integrante 3, datos e integraciones. **Alcance:** tareas 3.4 a 3.6 y regresión de 3.1–3.3. La ejecución comenzó a las 20:59:27.

**Resultado registrado:** 286 pruebas aprobadas, cero fallidas y cero pendientes, en 24 archivos. De ellas, 60 pertenecen al catálogo, CSV, permisos y configuración de la base. El código probado corresponde al commit `3367e15c15cd6c7e2773f0cc6ba2c0ecef7d3e80`; las modificaciones documentales posteriores no cambian ese código. El manifiesto conserva además las huellas SHA-256 de migraciones, datos, servicios, pruebas y configuración usados.

## Evidencia conservada

| Archivo | Qué demuestra |
| --- | --- |
| [Registro completo de pruebas](evidencias/2026-10-19/pruebas.log) | Comando, casos ejecutados, resultados, duración y código de salida 0 |
| [Resultados originales de Vitest](evidencias/2026-10-19/vitest.json) | Estado individual de las 286 pruebas, marcas temporales y archivo de origen |
| [Detalle de los 60 casos del integrante 3](evidencias/2026-10-19/casos-ejecutados.md) | Nombres efectivos, estado y duración de cada caso de este bloque |
| [Manifiesto de entorno y archivos](evidencias/2026-10-19/manifest.json) | Versión de código, dependencias y huellas para identificar lo probado |
| [Registro de compilación](evidencias/2026-10-19/compilacion.log) | Salida de la compilación del cliente y servidor; consultar su código final de salida |
| [Estado de Supabase](evidencias/2026-10-19/supabase-estado.json) | Consulta remota, valores observados y cancelación del despliegue |

Los registros son de una ejecución real, no resultados previstos. El JSON completo es la fuente de los totales. La matriz siguiente agrupa verificaciones relacionadas; una fila puede corresponder a varias pruebas o aserciones y sus filas no se suman como si fueran casos individuales.

**Compilación:** aprobada, código de salida 0; cliente y servidor generados correctamente. Vite avisó que algunos paquetes del cliente superan 500 kB. Es un aviso de tamaño, no un fallo de compilación ni una medición de velocidad de la aplicación.

## Entorno, preparación y método

Windows x64, Node.js 24.14.1, npm 11.12.1, Vitest 4.1.11, PGlite 0.5.9 y supabase-js 2.117.3. Se utilizó la instalación existente del repositorio, sin cambiar las versiones del manifiesto. Las duraciones registradas no son una medición de rendimiento de la web; pruebas y compilación pudieron competir por los mismos recursos.

Las pruebas SQL crean un Postgres temporal en memoria con PGlite, ejecutan **todos los archivos de migración en orden** y cargan el seed. El arnés reproduce los roles `anon`, `authenticated` y `service_role`, `auth.uid()`, el alta de perfiles y lo mínimo de Storage requerido por las migraciones. Las consultas se ejecutan con esos roles, sin usar al propietario de la base para simular una lectura pública.

Se preparan dos comercios y fuentes ficticias, 20 productos, 20 variantes, 40 ofertas y 40 observaciones iniciales. En la suite de permisos se agregan cuentas locales de administrador, operador A, operador B y cliente. Esas cuentas y los dominios `.test`/`.invalid` son fixtures en memoria: no son cuentas creadas en Supabase ni evidencias de permisos comerciales reales.

Las pruebas del servicio usan **supabase-js real con transporte HTTP simulado**. Comprueban URL, parámetros, DTO y manejo de respuestas; no demuestran por sí solas que PostgREST remoto esté disponible. Las pruebas SQL comprueban la aplicación de filtros y permisos en el motor. La comprobación de despliegue remoto se registra por separado.

## Matriz de casos y resultados observados

En la columna de evidencia: **SQL** = `supabase/tests/catalogo-api.test.ts`; **Importación** = `supabase/tests/catalogo.test.ts`; **Cliente** = `src/services/catalogo/index.test.ts`; **CSV** = `scripts/catalogo/csv.test.ts`; **Configuración** = `supabase/tests/deployment.test.ts`. Todos figuran individualmente en el registro adjunto.

| ID / tarea | Preparación y acción | Resultado esperado | Resultado observado | Evidencia |
| --- | --- | --- | --- | --- |
| BD-01 / 3.5 | Reconstruir con migraciones y consultar tablas | Todas las tablas de aplicación protegidas por RLS | 21 tablas, todas con RLS; prueba aprobada | Configuración |
| BD-02 / 3.5 | Consultar privilegios y contexto de triggers públicos | Sin invocación directa desde clientes; contexto fijo | Ejecución denegada a roles de cliente y `search_path` vacío en los triggers comprobados | Configuración |
| BD-03 / regresión | Cargar el seed y comparar variantes | Catálogo mínimo comparable, identificado como ficticio | 20 productos, 20 variantes, 40 ofertas, 40 observaciones; dos fuentes por variante | Importación |
| BD-04 / regresión | Repetir los CSV y seed sin cambiar datos | No duplicar ofertas ni historial | Los conteos se conservaron; las reimportaciones idénticas aplicaron cero filas | Importación |
| API-01 / 3.4 | Consultar RUTA-01, talle 42, moneda ARS, como visitante | Solo alternativas equivalentes, precio numérico ascendente | Dos precios: `77000.00`, `80000.00`; DTO con fecha y `esDemo:true` | SQL |
| API-02 / 3.4 | Consultar una categoría inexistente | Lista vacía en una consulta válida | Cero filas, sin confundirlo con un error | SQL |
| API-03 / 3.4 | Llamar `listarOfertas()` sin opciones | Excluir demo y seleccionar solo campos del contrato | Solicitud con `esDemo=eq.false`, sin `precioOrden`/`busqueda` en el DTO solicitado | Cliente |
| API-04 / 3.4 | Enviar búsqueda, marca, categoría, talle, moneda, UUID y rango decimal | Parámetros normalizados y valores monetarios intactos | Se comprobaron nombres, valores, límite 20 e inicio 40 en la solicitud del SDK | Cliente |
| API-05 / 3.4 | Enviar texto con puntuación y caracteres de patrón | No construir una cláusula de filtros a partir del texto | El texto quedó en el parámetro de búsqueda; no se agregó un parámetro `or` | Cliente |
| API-06 / 3.4 | Enviar límites 0/201, inicio negativo/fraccional, UUID incorrecto, precio negativo/NaN/tres decimales, rango invertido o precio sin moneda | Rechazo antes de consultar | Los once casos parametrizados se rechazaron sin petición HTTP | Cliente |
| API-07 / 3.4 | Simular HTTP 403 o configuración faltante | Informar el problema, sin devolver catálogo vacío | Se propagaron errores de permiso/configuración | Cliente |
| API-08 / 3.4 | Solicitar historial de una oferta | Filtrar oferta, ordenar fecha descendente y limitar resultados | Parámetros de oferta, orden estable y límite verificados; UUID inválido rechazado | Cliente |
| SEG-01 / 3.5 | Anónimo y cliente intentan escribir, importar o leer evidencia/logs | Acceso denegado | Fallaron escritura directa, importador técnico, borrado de historial y lecturas privadas | SQL |
| SEG-02 / 3.5 | Operador A consulta gestión; cliente sin membresía consulta gestión | Operador ve solo su comercio, cliente ninguna fila | A vio una fuente y 20 ofertas; cliente vio cero ofertas de gestión | SQL |
| SEG-03 / 3.5 | A carga en B y B carga en A | Denegar carga entre comercios | Ambas operaciones se rechazaron por permisos | SQL |
| SEG-04 / 3.5 | Operador intenta aprobar, configurar fuente y asignarse otro comercio | Impedir escalada de privilegios | Se rechazaron RPC administrativos e inserción directa de membresías | SQL |
| SEG-05 / 3.5 | Admin revoca membresía de A y A vuelve a cargar | Perder acceso de gestión/carga | La carga se rechazó y la lista de fuentes de gestión quedó vacía | SQL |
| INT-01 / 3.5 | Crear relación con variante o comercio inexistente; duplicar una variante | Mantener FK y unicidad | Relaciones/duplicados rechazados; no se creó una entidad huérfana | Importación y SQL |
| INT-02 / 3.5 | Enviar precio negativo, NaN, exceso de decimales, coma decimal, moneda inválida o campos incompletos | Rechazar lote y conservar datos previos | Rechazos sin cambio en conteos; log de error con cero filas aplicadas | Importación |
| INT-03 / 3.5 | Usar origen ajeno, dominio engañoso o URL `javascript:` | Rechazar enlace no autorizado | Los lotes fueron rechazados | Importación |
| INT-04 / 3.5 | Enviar fecha inválida, sin zona, futura, anterior o misma fecha con distinto contenido | No aceptar observaciones incoherentes | Se rechazaron sin agregar observaciones inválidas | Importación |
| INT-05 / 3.5 | Primera fila válida y segunda inválida en un lote | Revertir todo el lote, manteniendo registro del intento | No aumentó el historial ni se modificó parcialmente el catálogo; se conservó log de error | Importación y SQL |
| INT-06 / 3.5 | Fuente inexistente, sin permiso o comercio suspendido | Impedir la carga | Rechazos comprobados y estado previo conservado | Importación y SQL |
| INT-07 / 3.5 | Leer CSV con cabecera, comillas, saltos y booleanos válidos/incorrectos | Interpretar el formato válido y rechazar errores | Los cuatro casos de CSV aprobaron, incluidos sus escenarios de error | CSV |
| MVP-01 / 3.6 | Operador edita precio con nueva observación | Actualizar oferta e historial juntos y pedir nueva aprobación | Una fila aplicada, actor registrado, 40→39 ofertas públicas; historial conservó precio inicial y `12345.67` al aprobar | SQL |
| MVP-02 / 3.6 | Repetir la edición idéntica pendiente; después aprobar como admin | No saltar moderación por reimportar | Cero filas nuevas y siguió oculta; aprobación administrativa restituyó 40 ofertas públicas | SQL |
| MVP-03 / 3.6 | Cargar otra observación con `service_role` | También despublicar cambios técnicos | 40→39 ofertas públicas; se exigió otra aprobación | SQL |
| EP-01 / 3.6 | Retirar aprobación o vencer una oferta | Excluirla de la lectura pública | 40→39; se rechazó aprobar una vigencia ya vencida sin dejar cambios parciales | SQL |
| EP-02 / 3.6 | Suspender comercio A o retirar su permiso | Ocultar sus ofertas e impedir publicación/carga | La consulta pública quedó en 20 ofertas; los intentos incompatibles se rechazaron | SQL |
| EP-03 / 3.6 | Publicar una oferta sin disponibilidad | Mantenerla oculta | Aprobación rechazada, 39 ofertas públicas | SQL |
| EP-04 / 3.6 | Crear oferta marcada real en entorno local e intentar aprobar sin evidencia/vigencia | Exigir revisión documentada y vencimiento | Primer intento rechazado; aprobación con evidencia y vigencia guardó al admin como revisor | SQL |
| EP-05 / 3.6 | Ocultar oferta pendiente y consultar su historial como visitante | No filtrar la oferta por su histórico | Vista pública y tabla protegida no devolvieron la oferta; historial público devolvió cero filas | SQL |
| MVP-04 / 3.6 | Alta admin de fuente; cambio de origen o permiso sin evidencia | Alta válida; rechazar configuración incompatible | Se devolvieron IDs en alta; cambio de origen y permiso sin evidencia se rechazaron | SQL |
| DEF-01 / 3.6 | Ejecutar las tres consultas de defensa con rol público | Ganadoras por variante/moneda, historial y conteos | 20 ofertas ganadoras; una observación de la oferta elegida; 20 ofertas por comercio | SQL y archivo de consultas |
| REG-01 / regresión | Ejecutar toda la suite del repositorio | No romper módulos existentes | 286/286 aprobadas, cero fallidas/pendientes en 24 archivos | Registro completo |

Los rechazos previstos cuentan como pruebas aprobadas cuando el sistema impide la operación y cumple las aserciones. La oferta marcada real en EP-04 también es ficticia y se crea solo en memoria; esa prueba verifica la regla de revisión, no una visita real a un comercio.

## Estado del despliegue remoto

La comprobación de solo lectura del 19/10/2026 en el proyecto SPOT (`qvwsyeaijnyhtmwvhzyz`) encontró 40 ofertas y 40 observaciones, pero `public.catalogo_ofertas` aún no existía y la columna `catalogo.ofertas.publicada` tampoco. La migración de 3.4–3.6 no figura entre las cinco migraciones remotas registradas. El nuevo intento de aplicación también devolvió `Migration was cancelled.`; no se obtuvo una aplicación exitosa ni se intentó eludir esa cancelación. Se conservan consulta, valores y respuesta en `supabase-estado.json`.

Por lo tanto, **las pruebas anteriores acreditan la implementación local reproducible, no un despliegue remoto de esta ampliación**. La confirmación de RLS y RPC sobre PostgREST con la clave pública, y sobre una sesión real autorizada, queda pendiente hasta aplicar la migración. No se crearon usuarios de prueba remotos ni se copiaron credenciales en este informe.

Después de la cancelación se repitió la consulta de solo lectura: siguieron ausentes la vista y la columna de publicación, y se conservaron 40 ofertas/40 observaciones. No se observó una aplicación parcial en los elementos comprobados.

## Reproducción y criterio de aceptación

Desde la raíz del repositorio, con dependencias instaladas:

```powershell
npm test -- supabase/tests/catalogo.test.ts supabase/tests/catalogo-api.test.ts supabase/tests/deployment.test.ts scripts/catalogo/csv.test.ts src/services/catalogo/index.test.ts
npm test
npm run build
```

Para repetir la captura en una carpeta **nueva** y conservar la evidencia del 19/10, crear `docs/datos/evidencias/AAAA-MM-DD/` y ejecutar:

```powershell
npm test -- --reporter=verbose --reporter=json --outputFile.json=docs/datos/evidencias/AAAA-MM-DD/vitest.json
```

Registrar fecha, commit, salida, códigos de terminación y cambios del entorno. No sustituir un resultado fallido por el esperado. Los archivos SQL de defensa están en `supabase/queries/defensa_catalogo.sql` y sus resultados iniciales se verifican dentro de la suite, antes de que otros casos modifiquen el escenario.

Criterio local: todas las pruebas pasan, la compilación termina con código 0 y los casos de permisos/integridad cumplen los resultados indicados. Criterio remoto adicional: migración aplicada y verificación HTTP de lectura, denegación de cambios sin autorización y operación autorizada sin exponer secretos. Un resultado local aprobado no reemplaza ese criterio remoto.

## Límites de la evidencia

No se realizaron pruebas de pantallas nuevas de I2, navegación de usuario final, carga concurrente, memoria ni tiempos de búsqueda de la web. Los mocks de Auth/Storage no sustituyen pruebas completas de esos servicios. No se midió cobertura de código y no se afirma un porcentaje.

La validación de URL comprueba formato y origen; no demuestra accesibilidad HTTP, permisos comerciales reales ni veracidad de una revisión humana. El procedimiento de backup/restauración está documentado en [la entrega técnica](catalogo-api.md), pero no se ejecutó una restauración remota ni se extrajeron datos personales como parte de estas pruebas.
