#!/usr/bin/env bash
# Regenera los videos de técnica de /entrenar (public/video/entrenar) con HyperFrames.
# La composición (index.html) dibuja el mismo maniquí 3D de src/lib/pose/demoScene.ts cuadro a cuadro.
# Requiere ffmpeg en el PATH (brew install ffmpeg, o el binario de ffmpeg-static).
set -euo pipefail
cd "$(dirname "$0")"
root="$(cd ../.. && pwd)"
work="$(mktemp -d)"
cp index.html "$work/"
"$root/node_modules/.bin/esbuild" --bundle --format=iife --global-name=SpotDemo --minify --outfile="$work/spot-demo.js" \
  --stdin <<<"export { createDemoScene } from '$root/src/lib/pose/demoScene'; export { figureAt, loop, cuesFor } from '$root/src/lib/pose/demo'; export { RULES } from '$root/src/lib/pose/rules';" --resolve-dir="$root"
curl -s -o "$work/gsap.min.js" https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js
out="$root/public/video/entrenar"
mkdir -p "$out"
for id in squat lunge pushup plank sidePlank bridge legRaise kick; do
  npx -y hyperframes render "$work" --variables "{\"id\":\"$id\"}" -o "$work/$id.mp4" -f 30 -q standard
  ffmpeg -loglevel error -y -i "$work/$id.mp4" -vf scale=960:540 -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -movflags +faststart -an "$out/$id.mp4"
  ffmpeg -loglevel error -y -ss 1.7 -i "$work/$id.mp4" -frames:v 1 -vf scale=960:540 -q:v 5 "$out/$id.jpg"
done
echo "listo: $out"
