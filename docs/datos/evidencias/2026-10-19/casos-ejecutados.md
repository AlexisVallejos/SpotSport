# Registro de casos ejecutados — integrante 3

Generado a partir de `vitest.json`; conserva los nombres y estados efectivos del ejecutor. Las duraciones son de esta corrida, no mediciones de rendimiento del producto.

## scripts/catalogo/csv.test.ts

| Caso automatizado | Estado | Duración (ms) |
| --- | --- | ---: |
| CSV de catálogo conserva dinero como texto y convierte solo booleanos | Aprobado | 9.66 |
| CSV de catálogo acepta comas, comillas escapadas y saltos dentro de un campo | Aprobado | 1.44 |
| CSV de catálogo rechaza encabezado cambiado, filas incompletas y booleanos ambiguos | Aprobado | 4.96 |
| CSV de catálogo rechaza CSV vacío y comillas mal cerradas | Aprobado | 1.87 |

## supabase/tests/catalogo-api.test.ts

| Caso automatizado | Estado | Duración (ms) |
| --- | --- | ---: |
| publica 40 DTO, precios decimales y orden numérico dentro de una variante/moneda | Aprobado | 329.05 |
| ni el anónimo ni un cliente pueden escribir/importar ni leer columnas privadas | Aprobado | 194.04 |
| ejecuta las tres consultas de defensa con permisos públicos | Aprobado | 356.51 |
| filtra gestión por membresía y niega escalada/carga cruzada | Aprobado | 258.26 |
| despublica una edición, conserva historial y solo un admin puede volver a aprobarla | Aprobado | 628.84 |
| oculta vencidas, no disponibles, sin permiso y comercios suspendidos, incluso en el historial | Aprobado | 769.48 |
| rechaza precio inválido y revierte el lote con log persistente sin perder la aprobación anterior | Aprobado | 83.35 |
| admin da de alta fuentes, restringe orígenes/permiso y revoca operadores | Aprobado | 43.02 |
| una oferta real exige revisión manual documentada y caducidad; una FK faltante no se acepta | Aprobado | 41.47 |

## supabase/tests/catalogo.test.ts

| Caso automatizado | Estado | Duración (ms) |
| --- | --- | ---: |
| 3.1 y 3.2: esquema y demo carga veinte artículos y cuarenta ofertas de variantes equivalentes | Aprobado | 29.57 |
| 3.1 y 3.2: esquema y demo las dos fixtures CSV reproducen el seed sin duplicar datos | Aprobado | 336.63 |
| 3.1 y 3.2: esquema y demo las FK y la unicidad protegen las relaciones | Aprobado | 23.75 |
| 3.3: importaciones controladas rechaza duplicados de un lote sin escribir datos | Aprobado | 14.58 |
| 3.3: importaciones controladas rechaza precio = -1 y conserva el estado previo | Aprobado | 14.86 |
| 3.3: importaciones controladas rechaza precio = NaN y conserva el estado previo | Aprobado | 13.42 |
| 3.3: importaciones controladas rechaza precio = 10.123 y conserva el estado previo | Aprobado | 19.06 |
| 3.3: importaciones controladas rechaza precio = 100,50 y conserva el estado previo | Aprobado | 29.67 |
| 3.3: importaciones controladas rechaza url_producto = javascript:alert(1) y conserva el estado previo | Aprobado | 15.24 |
| 3.3: importaciones controladas rechaza url_producto = https://demo-a.invalid.evil.test/producto y conserva el estado previo | Aprobado | 22.80 |
| 3.3: importaciones controladas rechaza url_producto = https://otro.invalid/producto y conserva el estado previo | Aprobado | 14.47 |
| 3.3: importaciones controladas rechaza moneda = XYZ y conserva el estado previo | Aprobado | 17.37 |
| 3.3: importaciones controladas rechaza fecha_observacion = 2026-99-99T00:00:00Z y conserva el estado previo | Aprobado | 22.38 |
| 3.3: importaciones controladas rechaza fecha_observacion = 2026-10-11 y conserva el estado previo | Aprobado | 16.71 |
| 3.3: importaciones controladas rechaza fecha_observacion = 2999-01-01T00:00:00Z y conserva el estado previo | Aprobado | 19.04 |
| 3.3: importaciones controladas rechaza es_demo = false y conserva el estado previo | Aprobado | 16.17 |
| 3.3: importaciones controladas rechaza disponible = sí y conserva el estado previo | Aprobado | 11.93 |
| 3.3: importaciones controladas rechaza nombre =  y conserva el estado previo | Aprobado | 17.91 |
| 3.3: importaciones controladas revierte la primera fila si falla la segunda, incluido el historial | Aprobado | 21.07 |
| 3.3: importaciones controladas actualiza precio e historial juntos, y no duplica al repetir | Aprobado | 37.71 |
| 3.3: importaciones controladas rechaza datos viejos, misma fecha con precio distinto y cambios de identidad | Aprobado | 45.02 |
| 3.3: importaciones controladas distingue talles diferentes como variantes diferentes | Aprobado | 11.25 |
| 3.3: importaciones controladas rechaza fuentes inexistentes/sin permiso y comercios suspendidos | Aprobado | 23.87 |
| 3.3: importaciones controladas no expone el importador ni las tablas al navegador | Aprobado | 59.65 |
| 3.3: importaciones controladas rechaza lotes vacíos o que no son listas (undefined) | Aprobado | 16.14 |
| 3.3: importaciones controladas rechaza lotes vacíos o que no son listas ({}) | Aprobado | 23.37 |
| 3.3: importaciones controladas rechaza lotes vacíos o que no son listas (null) | Aprobado | 23.27 |

## supabase/tests/deployment.test.ts

| Caso automatizado | Estado | Duración (ms) |
| --- | --- | ---: |
| mantiene RLS en todas las tablas de la aplicación desplegada | Aprobado | 56.38 |
| no expone triggers por RPC y fija su contexto de resolución | Aprobado | 45.45 |

## src/services/catalogo/index.test.ts

| Caso automatizado | Estado | Duración (ms) |
| --- | --- | ---: |
| usa la clave pública y excluye demo por defecto, sin campos auxiliares en el DTO | Aprobado | 26.22 |
| construye filtros y paginación con el SDK real, conservando precisión decimal | Aprobado | 6.70 |
| no interpreta comodines ingresados como filtros adicionales | Aprobado | 1.90 |
| rechaza filtros inválidos sin hacer peticiones: {"limite":0} | Aprobado | 4.90 |
| rechaza filtros inválidos sin hacer peticiones: {"limite":201} | Aprobado | 0.99 |
| rechaza filtros inválidos sin hacer peticiones: {"desde":-1} | Aprobado | 1.15 |
| rechaza filtros inválidos sin hacer peticiones: {"desde":1.5} | Aprobado | 0.92 |
| rechaza filtros inválidos sin hacer peticiones: {"varianteId":"x"} | Aprobado | 1.02 |
| rechaza filtros inválidos sin hacer peticiones: {"precioMin":"-1","moneda":"ARS"} | Aprobado | 1.51 |
| rechaza filtros inválidos sin hacer peticiones: {"precioMax":"NaN","moneda":"ARS"} | Aprobado | 1.24 |
| rechaza filtros inválidos sin hacer peticiones: {"precioMin":"1.234","moneda":"ARS"} | Aprobado | 0.81 |
| rechaza filtros inválidos sin hacer peticiones: {"precioMin":"1"} | Aprobado | 0.89 |
| rechaza filtros inválidos sin hacer peticiones: {"precioMin":"100","precioMax":"20","moneda":"ARS"} | Aprobado | 2.20 |
| rechaza filtros inválidos sin hacer peticiones: {"texto":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"} | Aprobado | 1.15 |
| propaga problemas de conexión/permisos en lugar de ocultarlos como catálogo vacío | Aprobado | 220.44 |
| consulta historial de una oferta con un orden estable y límite | Aprobado | 124.80 |
| mantiene los límites de gestión y solo expone las operaciones RPC autorizadas | Aprobado | 24.45 |
| rechaza lotes inválidos aunque el RPC responda HTTP 200, y devuelve el id del lote exitoso | Aprobado | 8.87 |

