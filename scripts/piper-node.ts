// Piper (es_AR-daniela-high) en Node: lo usan build-voice-pack.ts y voice-lab.ts.
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.cache', 'piper');

export const VOICE = 'es_AR-daniela-high';
const BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high';
const FILES: [string, number][] = [
  [`${VOICE}.onnx.json`, 7248],
  [`${VOICE}.onnx`, 114_199_011],
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export async function ensureModel() {
  mkdirSync(cache, { recursive: true });
  for (const [name, size] of FILES) {
    const target = join(cache, name);
    if (existsSync(target) && statSync(target).size === size) continue;
    console.log(`descargando ${name} (${(size / 1e6).toFixed(0)} MB)…`);
    const response = await fetch(`${BASE}/${name}`);
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} en ${name}`);
    const part = `${target}.part`;
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(part));
    if (statSync(part).size !== size) throw new Error(`tamaño inesperado en ${name}`);
    renameSync(part, target);
  }
}

const phonemizerDir = join(root, 'node_modules', '@diffusionstudio', 'piper-wasm', 'build');
const createPiperPhonemize = require(join(phonemizerDir, 'piper_phonemize.js'));

function phonemize(text: string, voice: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('phonemize timeout')), 30_000);
    createPiperPhonemize({
      print: (line: string) => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(line).phoneme_ids);
        } catch (error) {
          reject(error);
        }
      },
      printErr: () => {},
      locateFile: (file: string) => join(phonemizerDir, file),
    })
      .then((module: Json) => module.callMain(['-l', voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']))
      .catch((error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export type Style = { noiseScale?: number; noiseW?: number; lengthScale?: number };

export async function loadPiper() {
  await ensureModel();
  const config: Json = JSON.parse(readFileSync(join(cache, `${VOICE}.onnx.json`), 'utf8'));
  const ort: Json = require('onnxruntime-web');
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(readFileSync(join(cache, `${VOICE}.onnx`)), { executionProviders: ['wasm'] });
  const rate: number = config.audio.sample_rate;

  /** `style` overrides the model's own noise/length settings: more noise = more varied, less flat delivery. */
  async function synth(text: string, style: Style = {}): Promise<Float32Array> {
    const ids = await phonemize(text, config.espeak.voice);
    const defaults = config.inference;
    const result = await session.run({
      input: new ort.Tensor('int64', BigInt64Array.from(ids, (id) => BigInt(id)), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor('float32', Float32Array.from([style.noiseScale ?? defaults.noise_scale, style.lengthScale ?? defaults.length_scale, style.noiseW ?? defaults.noise_w]), [3]),
    });
    return new Float32Array(result.output.data);
  }

  return { synth, rate };
}

/**
 * Trims the silence at both ends relative to the clip's own loudness (so quiet word endings are kept),
 * fades the edges so nothing clicks or ends abruptly, and evens the loudness between clips.
 */
export function finish(samples: Float32Array, rate: number): Int16Array {
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const threshold = peak * 0.015;
  let start = 0;
  let end = samples.length - 1;
  while (start < end && Math.abs(samples[start]) < threshold) start += 1;
  while (end > start && Math.abs(samples[end]) < threshold) end -= 1;
  const from = Math.max(0, start - Math.round(rate * 0.05));
  const to = Math.min(samples.length, end + Math.round(rate * 0.16));
  const body = samples.slice(from, to);
  const gain = peak > 0 ? 0.9 / peak : 1;
  const fadeIn = Math.round(rate * 0.01);
  const fadeOut = Math.round(rate * 0.07);
  const pcm = new Int16Array(body.length);
  for (let i = 0; i < body.length; i += 1) {
    let level = body[i] * gain;
    if (i < fadeIn) level *= i / fadeIn;
    const left = body.length - 1 - i;
    if (left < fadeOut) level *= left / fadeOut;
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(level * 32767)));
  }
  return pcm;
}

export function wav(pcm: Int16Array, rate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]);
}
