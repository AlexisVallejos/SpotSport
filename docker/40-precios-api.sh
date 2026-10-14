#!/bin/sh
# La imagen de nginx corre los scripts de /docker-entrypoint.d/ antes de arrancar.
# Dejamos la API de precios andando en segundo plano y la reiniciamos si se cae.
(
  while true; do
    node /app/server/main.mjs
    echo "[api] se detuvo; reinicio en 5 s" >&2
    sleep 5
  done
) &
