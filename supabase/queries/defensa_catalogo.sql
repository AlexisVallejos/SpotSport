-- 3.6: ejecutar como visitante o en el editor SQL. Todas las consultas usan ofertas publicables.
-- 1. Menor precio de CADA variante y moneda; conserva empates y separa demo/real.
with ordenadas as (
  select "ofertaId", "varianteId", modelo, talle, color, comercio, precio, moneda, "esDemo",
    dense_rank() over (partition by "varianteId", moneda, "esDemo" order by "precioOrden") puesto
  from public.catalogo_ofertas
)
select * from ordenadas where puesto = 1 order by modelo, talle, color, moneda, "esDemo", comercio;

-- 2. Historial de una oferta de RUTA-01. Reemplazar el subquery por un ofertaId para otro caso.
select h."ofertaId", h.precio, h.moneda, h.fecha, h.disponible, h."urlOrigen"
from public.catalogo_historial h
where h."ofertaId" = (select "ofertaId" from public.catalogo_ofertas
  where modelo = 'RUTA-01' order by comercio, "ofertaId" limit 1)
order by h.fecha, h.id;

-- 3. Cantidad pública de ofertas por comercio, moneda y rótulo demo.
select "comercioId", comercio, moneda, "esDemo", count(*)::integer as cantidad_ofertas
from public.catalogo_ofertas
group by "comercioId", comercio, moneda, "esDemo"
order by comercio, moneda, "esDemo";
