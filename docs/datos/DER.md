# DER del catálogo SPOT (3.1–3.6)

Modelo implementado en el esquema SQL `catalogo`. Los UUID son claves primarias. La tabla `public.profiles` ya existe en la tienda y se reutiliza para la relación de operadores; no se duplican cuentas.

```mermaid
erDiagram
  COMERCIOS ||--o{ FUENTES : aporta
  FUENTES ||--o{ OFERTAS : publica
  FUENTES |o--o{ IMPORTACIONES : registra
  MARCAS ||--o{ PRODUCTOS : identifica
  CATEGORIAS ||--o{ PRODUCTOS : agrupa
  PRODUCTOS ||--o{ VARIANTES : distingue
  VARIANTES ||--o{ OFERTAS : compara
  OFERTAS ||--|{ HISTORIAL_PRECIOS : conserva
  IMPORTACIONES ||--o{ OFERTAS : ultima_carga
  IMPORTACIONES ||--o{ HISTORIAL_PRECIOS : observa
  COMERCIOS ||--o{ MEMBRESIAS : autoriza
  PERFILES ||--o{ MEMBRESIAS : participa
  PERFILES |o--o{ IMPORTACIONES : ejecuta
  PERFILES |o--o{ OFERTAS : revisa
  EJERCICIOS ||--o{ REGLAS_MOVIMIENTO : define
  COMERCIOS {
    uuid id PK
    text nombre
    text sitio_web UK
    text estado
    boolean es_demo
  }
  FUENTES {
    uuid id PK
    uuid comercio_id FK
    text tipo
    text url_base
    boolean permiso_verificado
    boolean es_demo
  }
  PRODUCTOS {
    uuid id PK
    uuid marca_id FK
    uuid categoria_id FK
    text modelo
    text nombre
  }
  VARIANTES {
    uuid id PK
    uuid producto_id FK
    text talle
    text color
  }
  OFERTAS {
    uuid id PK
    uuid fuente_id FK
    uuid variante_id FK
    uuid importacion_id FK
    text codigo_externo
    numeric precio
    text moneda
    timestamptz fecha_observacion
    boolean publicada
    timestamptz vigente_hasta
    uuid revisada_por FK
    text evidencia_revision
    timestamptz fecha_revision
  }
  HISTORIAL_PRECIOS {
    uuid id PK
    uuid oferta_id FK
    uuid importacion_id FK
    numeric precio
    text moneda
    timestamptz fecha_observacion
  }
  IMPORTACIONES {
    uuid id PK
    uuid fuente_id FK
    uuid fuente_solicitada
    uuid actor_id FK
    text estado
    text archivo
  }
  MEMBRESIAS {
    uuid comercio_id PK,FK
    uuid perfil_id PK,FK
    text rol
  }
```

En importaciones, `fuente_id` puede ser nulo si el intento pidió una fuente inexistente; `fuente_solicitada` conserva el identificador enviado. El histórico registra también URL y disponibilidad de cada observación. Una oferta conserva su identidad (fuente, código, variante y moneda); una actualización cambia precio/estado/fecha sin cambiar esa identidad.

## Normalización y decisiones

- 1FN: un talle/color por variante, un precio/moneda por oferta; no se guardan listas de talles en una celda.
- 2FN: en `membresias`, el rol depende de la relación completa comercio/perfil.
- 3FN: marcas, categorías y comercios se consultan por FK, sin copiar sus nombres en cada oferta. El comercio de una oferta se obtiene a través de su fuente, evitando dos referencias que podrían contradecirse.
- La FK compuesta `(comercio_id, es_demo)` asegura que la fuente y su comercio compartan el rótulo de datos ficticios.
- La repetición de precio/moneda/URL en el histórico representa observaciones de distinto momento, no una copia accidental del estado actual.
- Las eliminaciones no borran el histórico en cascada. Una fuente/comercio se desactiva mediante estado/permisos; el diseño de retención se completará antes de habilitar operación real.
- El registro de permisos es evidencia administrativa: un booleano por sí solo no prueba una autorización legal.

Las membresías ya autorizan la carga de fuentes del comercio; solo el admin puede asignarlas o revocarlas. `actor_id` identifica cargas con sesión; las cargas técnicas pueden tenerlo nulo. La revisión registra admin, fecha y evidencia; una nueva observación la borra y despublica. Ejercicios y reglas conservan solo su esquema, sin activar la cámara. La tienda existente conserva su propio modelo de ventas. Ver [EP-03 y operaciones](catalogo-api.md).
