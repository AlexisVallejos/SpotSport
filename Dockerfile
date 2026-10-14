# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Vite incorpora estas variables al compilar: en Easypanel se cargan como variables de la app (Build Args).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# --- serve ---
# nginx sirve la web y le pasa /api/ a la API de precios (Node), que corre en el mismo contenedor.
FROM nginx:1.27-alpine
RUN apk add --no-cache nodejs
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/dist-server /app/server
COPY docker/40-precios-api.sh /docker-entrypoint.d/40-precios-api.sh
RUN chmod +x /docker-entrypoint.d/40-precios-api.sh
# Montá un volumen en /data para no perder el historial de precios ni las reseñas entre deploys.
ENV DATA_DIR=/data PORT=8787 HOST=127.0.0.1
VOLUME /data
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
