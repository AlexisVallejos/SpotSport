# Integrante 3: tareas 3.1 a 3.3

Trabajo preparado el 13/10/2026. El repositorio ya tiene una tienda con `public.products`, `product_variants`, pedidos y cuentas. El comparador académico requiere un producto independiente del comercio y varias ofertas de la misma variante. Por eso se agregó el esquema `catalogo`, sin cambiar los contratos ni los datos de la tienda.

**Actualización del 14/10/2026:** la base ya está aplicada y conectada al proyecto Supabase SPOT. Ver [estado de la conexión, verificaciones y notas de migraciones](conexion-supabase.md). Las instrucciones para crear/aplicar una base nueva se conservan como referencia; no repetirlas sobre la instancia existente.

## Archivos y entregables

| Tarea | Entrega |
| --- | --- |
| 3.1 | Migraciones `20261013000004_catalogo_schema.sql` y `20261013000005_catalogo_import.sql`; [DER](DER.md) y [diccionario físico](diccionario.md). |
| 3.2 | `supabase/seeds/catalogo_demo.sql` y dos CSV en `data/catalogo/`: 20 productos, 20 variantes y 40 ofertas, dos por variante. |
| 3.3 | Función SQL `public.importar_catalogo`, lector CSV y comando de importación; pruebas SQL y de formato CSV. |

Los precios, marcas, comercios y fechas de observación de la demo son ficticios. `https://demo-a.invalid` y `https://demo-b.invalid` son orígenes simulados: **no abrirlos ni presentarlos como tiendas reales**. El rótulo `es_demo` se obtiene de la fuente; ambas fuentes documentan que el equipo creó el dataset. No hay permisos, precios actuales ni acuerdos externos verificados.

## Empezar sin una cuenta de Supabase

Desde la raíz del repositorio:

```powershell
npm ci
npm test -- supabase/tests/catalogo.test.ts scripts/catalogo/csv.test.ts
npm run catalogo:importar -- --local 20000000-0000-4000-8000-000000000001 data/catalogo/demo-a.csv
```

`--local` crea un Postgres temporal en memoria con PGlite, las migraciones reales del proyecto y la demo. Importa el archivo, informa el resultado y cierra esa base. No modifica una base remota ni conserva los cambios entre comandos. Una reimportación del archivo inicial muestra `filas_aplicadas: 0`: ya estaba cargado y no se duplica el historial.

Para probar una actualización, copiar `demo-a.csv`, dejar una fila, cambiar su precio y usar una fecha ISO 8601 **posterior a la observación inicial pero no futura**. Ejecutar el comando local con esa copia: se actualiza la oferta y se agrega una observación histórica. No cambiar el modelo/talle/color del mismo código externo; para otra variante se usa otro código.

## Aplicar en Supabase cuando haya un proyecto disponible

1. Aplicar las migraciones pendientes de `supabase/migrations/` en orden. Si las tres de marketplace ya están aplicadas, ejecutar solo las nuevas `...000004...` y `...000005...`; no volver a ejecutar las anteriores. Las migraciones dependen de roles Supabase y de `public.profiles` de la primera migración.
2. Para una base de prueba, ejecutar explícitamente `supabase/seeds/catalogo_demo.sql` en el editor SQL. La demo no se carga automáticamente en las migraciones.
3. Comprobar conteos y comparar ofertas con las consultas de abajo. Repetir el seed no duplica productos, variantes, ofertas ni observaciones.
4. Para importar desde la terminal, configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el entorno de esa terminal; ejecutar:

```powershell
npm run catalogo:importar -- 20000000-0000-4000-8000-000000000001 data/catalogo/demo-a.csv
```

La clave administrativa se usa únicamente en este comando de servidor. No colocarla en variables `VITE_*`, código del navegador, CSV, capturas ni Git. El comando no carga `.env` automáticamente. Las variables públicas que ya usa la tienda no sirven para ejecutar el importador. Se mantienen restricciones de acceso básicas: el navegador no puede importar ni leer directamente este esquema en esta etapa. La API pública y los permisos de los paneles corresponden a 3.4/3.5.

La instalación remota requiere un proyecto propio y sus credenciales; las pruebas locales no prueban un despliegue de Supabase ni su conectividad.

## Formato CSV y carga manual

Cabecera exacta, en este orden y separada por comas:

```csv
codigo_externo,marca,categoria,modelo,nombre,talle,color,precio,moneda,url_producto,fecha_observacion,disponible,es_demo
```

- UTF-8, con o sin BOM; admite CRLF/LF, comillas escapadas, comas y saltos dentro de campos entre comillas.
- `precio` en unidades monetarias, con punto decimal y hasta dos decimales: `80000.00`. No son centavos como `price_cents` de la tienda. Se conserva como texto hasta convertirlo a `NUMERIC(12,2)` en SQL.
- `moneda`: `ARS` o `USD`; nunca comparar distintas monedas como si fueran equivalentes.
- `fecha_observacion`: ISO 8601 con zona, por ejemplo `2026-10-11T00:00:00Z`; no puede estar en el futuro.
- `disponible` y `es_demo`: `true` o `false`, no `sí/no` ni `1/0`.
- `talle` y `color`: texto; pueden estar vacíos si no aplican. Una talla/color diferente crea otra variante.
- Identidad del producto: marca + código de modelo; identidad de variante: producto + talle + color. La equivalencia de modelos reales debe revisarse antes de cargar, no inferirse por parecido de nombres.
- El origen HTTPS de `url_producto` debe coincidir exactamente con `fuentes.url_base`, seguido por `/`. No admite otros dominios, subdominios engañosos ni enlaces `javascript:`. Esta comprobación no realiza una petición HTTP ni demuestra que la página exista.
- Un lote tiene 1 a 1000 filas. El mismo código externo no puede aparecer dos veces en el lote; en otra fuente sí puede repetirse.

Para carga manual se usa la misma función en el editor SQL:

```sql
select public.importar_catalogo(
  '20000000-0000-4000-8000-000000000001'::uuid,
  '[{"codigo_externo":"RUTA-01","marca":"SPOT Demo","categoria":"running",
     "modelo":"RUTA-01","nombre":"Zapatilla Ruta (demo)","talle":"42","color":"negro",
     "precio":"79500.00","moneda":"ARS","url_producto":"https://demo-a.invalid/productos/ruta-01",
     "fecha_observacion":"2026-10-12T00:00:00Z","disponible":true,"es_demo":true}]'::jsonb,
  'carga manual de prueba'
);
```

Este ejemplo actualiza una oferta inicial de A y deja 41 observaciones históricas; ejecutarlo solo después de verificar que su fecha sea posterior a la actual de esa oferta.

## Reglas de importación

1. Verificar que existan fuente y comercio activo, permiso documentado y rótulo demo coherente.
2. Rechazar lote vacío, duplicados, tipos incorrectos, campos faltantes, precio/formato inválido y fecha sin zona.
3. Normalizar marca/categoría/color a minúsculas y modelo/talle a mayúsculas, quitando espacios exteriores.
4. Crear o reutilizar producto y variante; rechazar un modelo existente con categoría contradictoria.
5. Crear o actualizar la oferta por `(fuente_id, codigo_externo)`. No permite mover un código a otra variante o moneda.
6. Rechazar una observación anterior al precio actual o la misma fecha con contenido distinto. Una observación idéntica es una reimportación sin cambios. Una nueva fecha conserva una nueva observación, aunque el precio no cambie.
7. Guardar el precio actual y su historial mediante un trigger dentro de la misma transacción. Si falla una fila, se revierten **todas las filas del lote**, incluidas marcas/variantes recién creadas e historial.
8. Mantener el registro del intento con resultado, archivo, fuente, fechas, filas recibidas/aplicadas y detalle del error. La función devuelve `ok: false` ante rechazo; el comando sale con código 1. No ignorar ese resultado.

Los errores de sintaxis CSV se informan en la terminal antes de llamar a la base; los rechazos de datos de un lote recibido se guardan en `catalogo.importaciones`. Una falla de red no garantiza que no se haya aplicado el lote: revisar el registro y reintentar con las mismas fechas/datos.

## Comprobar el resultado en SQL

```sql
select
  (select count(*) from catalogo.productos) productos,
  (select count(*) from catalogo.variantes) variantes,
  (select count(*) from catalogo.ofertas) ofertas,
  (select count(*) from catalogo.historial_precios) observaciones;
-- Demo inicial: 20, 20, 40, 40.

select p.modelo, v.talle, v.color, c.nombre comercio, o.precio, o.moneda,
       o.fecha_observacion, f.es_demo, o.url_producto
from catalogo.ofertas o
join catalogo.variantes v on v.id = o.variante_id
join catalogo.productos p on p.id = v.producto_id
join catalogo.fuentes f on f.id = o.fuente_id
join catalogo.comercios c on c.id = f.comercio_id
where p.modelo = 'RUTA-01' and o.disponible
  and c.estado = 'activo' and f.permiso_verificado
order by v.id, o.moneda, o.precio;
-- Dos ofertas de la misma variante (precio ficticio).

select archivo, estado, filas_recibidas, filas_aplicadas, detalle, inicio, fin
from catalogo.importaciones order by inicio desc;
```

## Qué podés explicar en la entrega

Un producto no pertenece a una única tienda; una variante fija su talle/color, mientras cada fuente publica una oferta. La fuente pertenece a un comercio y documenta origen y autorización. El histórico registra las observaciones anteriores. Las FK impiden referencias inexistentes, las claves únicas evitan duplicados y la transacción impide guardar medio lote. El DER y el diccionario reflejan esas tablas ejecutables.

## Lo que sigue fuera de estas tres tareas

`listarOfertas`, conexión al comparador visual, autorizaciones de operadores/membresías, moderación, política pública de caducidad, copias de seguridad, verificación HTTP y fuentes/API reales. No se añadieron cobros, cambios en la cámara ni cambios al checkout existente. Las tablas de ejercicios/reglas/membresías quedan definidas sin activar funciones nuevas.

## Verificación realizada (13/10/2026)

- Suite completa: **216 pruebas aprobadas en 15 archivos**, incluidas 31 pruebas nuevas de SQL/catálogo y CSV. Se ejecutaron también las pruebas existentes de tienda y cámara.
- Compilación de producción: `npm run build` terminó correctamente.
- Comando local de importación de `demo-a.csv`: salida exitosa, 40 ofertas y cero filas nuevas al reimportar los datos iniciales.
- Casos comprobados: equivalencia de variantes, seed repetible, FK/unicidad, actualización/historial, rollback de un lote con una segunda fila inválida, precios mal formados, enlaces ajenos, fechas inválidas/futuras, duplicados, fuente inexistente/sin permiso, comercio suspendido y acceso reservado al servidor.
- Estado remoto deducible del repositorio: `.env.example` tiene valores vacíos y no hay un archivo local de conexión ni configuración de proyecto Supabase. La especificación de marketplace registraba la creación del proyecto como pendiente. No se consultó la cuenta de Supabase y no se aplicaron migraciones remotamente.

## Referencias técnicas

- [PostgreSQL: comportamiento de triggers](https://www.postgresql.org/docs/18/trigger-definition.html): un trigger participa de la transacción del cambio.
- [PostgreSQL: manejo de errores PL/pgSQL](https://www.postgresql.org/docs/current/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING): el bloque con excepción permite revertir las filas del lote y conservar el registro exterior.
- [Supabase: funciones de base de datos](https://supabase.com/docs/guides/database/functions): privilegios de ejecución y diferencia entre `invoker` y `definer`.
