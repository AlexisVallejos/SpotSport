# SPOT — Todo el deporte en un solo lugar

Landing en React + TypeScript + Vite, con diseño atómico (`src/components/atoms → molecules → organisms → templates`).

## Desarrollo

```
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
```

## Deploy en Easypanel

1. Subir el repo a GitHub.
2. En Easypanel: **Create → App → Source: GitHub** (repo y rama `main`).
3. **Build: Dockerfile** (ruta `Dockerfile`, ya está en la raíz).
4. **Domains & Proxy**: puerto del servicio `80`.
5. Deploy. Sin variables de entorno: es un sitio estático servido con nginx.

Para comprobar que está vivo: `GET /healthz` responde `ok`.

## Archivos importantes

- `public/video/spot-intro.mp4`: intro que se reproduce en cada carga.
- `public/images/`: fotos de hero, deportes, productos y campañas.
- `public/brand/`: logos oficiales SPOT (SVG).
- `public/fonts/`: Inter y Barlow Condensed (licencias OFL incluidas).
