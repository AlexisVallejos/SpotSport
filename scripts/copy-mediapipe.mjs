// Copia el runtime WASM de MediaPipe a public/ para que el análisis de postura funcione sin CDN.
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join(root, 'public', 'mediapipe', 'wasm');

if (!existsSync(from)) {
  console.error('Falta @mediapipe/tasks-vision: corré npm install.');
  process.exit(1);
}

cpSync(from, to, { recursive: true });
console.log('MediaPipe WASM copiado a public/mediapipe/wasm');
