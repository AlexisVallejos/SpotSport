// Graba con Piper (voz neuronal argentina es_AR-daniela-high) todas las frases del coach y las deja en
// public/voice/es_AR como WAV + manifest.json. Se corre una vez (npm run voice:pack) y se commitea el resultado:
// en producción no hace falta el modelo de 114 MB ni ningún runtime, sólo audios estáticos.
//
// Es incremental: no vuelve a grabar lo que ya está en el manifest. Para regrabar todo: --force.
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { allSentences } from '../src/lib/pose/phrases';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.cache', 'piper');
const out = join(root, 'public', 'voice', 'es_AR');
const force = process.argv.includes('--force');

const VOICE = 'es_AR-daniela-high';
const BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high';
const FILES: [string, number][] = [
  [`${VOICE}.onnx.json`, 7248],
  [`${VOICE}.onnx`, 114_199_011],
];

async function ensureModel() {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

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

/** Cuts the silence at both ends (keeping a short breath) and evens the loudness between clips. */
function finish(samples: Float32Array, rate: number): Int16Array {
  const threshold = 0.012;
  let start = 0;
  let end = samples.length - 1;
  while (start < end && Math.abs(samples[start]) < threshold) start += 1;
  while (end > start && Math.abs(samples[end]) < threshold) end -= 1;
  const from = Math.max(0, start - Math.round(rate * 0.04));
  const to = Math.min(samples.length, end + Math.round(rate * 0.1));
  const body = samples.subarray(from, to);
  let peak = 0;
  for (const value of body) peak = Math.max(peak, Math.abs(value));
  const gain = peak > 0 ? 0.9 / peak : 1;
  const pcm = new Int16Array(body.length);
  for (let i = 0; i < body.length; i += 1) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(body[i] * gain * 32767)));
  return pcm;
}

function wav(pcm: Int16Array, rate: number): Buffer {
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

async function main() {
  await ensureModel();
  const config: Json = JSON.parse(readFileSync(join(cache, `${VOICE}.onnx.json`), 'utf8'));
  const rate: number = config.audio.sample_rate;
  const ort: Json = require('onnxruntime-web');
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(readFileSync(join(cache, `${VOICE}.onnx`)), { executionProviders: ['wasm'] });

  async function synth(text: string): Promise<Float32Array> {
    const ids = await phonemize(text, config.espeak.voice);
    const { noise_scale, length_scale, noise_w } = config.inference;
    const result = await session.run({
      input: new ort.Tensor('int64', BigInt64Array.from(ids, (id) => BigInt(id)), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor('float32', Float32Array.from([noise_scale, length_scale, noise_w]), [3]),
    });
    return new Float32Array(result.output.data);
  }

  mkdirSync(out, { recursive: true });
  const manifestPath = join(out, 'manifest.json');
  const previous: { clips: Record<string, string> } = !force && existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { clips: {} };
  const sentences = allSentences();
  const clips: Record<string, string> = {};
  let rendered = 0;
  const started = Date.now();

  for (const [index, sentence] of sentences.entries()) {
    const file = `${createHash('sha1').update(sentence).digest('hex').slice(0, 10)}.wav`;
    if (previous.clips[sentence] === file && existsSync(join(out, file))) {
      clips[sentence] = file;
      continue;
    }
    const samples = await synth(sentence);
    writeFileSync(join(out, file), wav(finish(samples, rate), rate));
    clips[sentence] = file;
    rendered += 1;
    const done = index + 1;
    const eta = Math.round(((Date.now() - started) / Math.max(1, rendered)) * (sentences.length - done) / 1000);
    console.log(`[${done}/${sentences.length}] ${sentence}  (~${eta}s restantes)`);
    // Se guarda seguido: si se corta, la próxima corrida sigue donde quedó.
    if (rendered % 10 === 0) writeFileSync(manifestPath, JSON.stringify({ voice: VOICE, rate, clips: { ...previous.clips, ...clips } }, null, 1));
  }

  writeFileSync(manifestPath, JSON.stringify({ voice: VOICE, rate, clips }, null, 1) + '\n');
  // Audios de frases que ya no existen.
  const used = new Set(Object.values(clips));
  for (const file of readdirSync(out)) if (file.endsWith('.wav') && !used.has(file)) rmSync(join(out, file));
  console.log(`listo: ${sentences.length} frases (${rendered} nuevas) en ${Math.round((Date.now() - started) / 1000)} s`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
