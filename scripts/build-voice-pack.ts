// Graba con Piper (voz neuronal argentina es_AR-daniela-high) todas las frases del coach y las deja en
// public/voice/es_AR como WAV + manifest.json. Se corre una vez (npm run voice:pack) y se commitea el resultado:
// en producción no hace falta el modelo de 114 MB ni ningún runtime, sólo audios estáticos.
//
// Es incremental: no vuelve a grabar lo que ya está en el manifest con el mismo estilo. Para regrabar todo: --force.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSentences } from '../src/lib/pose/phrases';
import { finish, loadPiper, root, type Style, VOICE, wav } from './piper-node';

const out = join(root, 'public', 'voice', 'es_AR');
const force = process.argv.includes('--force');

/** Slower and with a little more variation than the model default: a calm coach, not a reader. */
const STYLE: Required<Style> = { noiseScale: 0.75, noiseW: 0.9, lengthScale: 1.15 };
const styleId = `${STYLE.noiseScale}/${STYLE.noiseW}/${STYLE.lengthScale}`;

type Manifest = { voice: string; style: string; rate: number; clips: Record<string, string> };

async function main() {
  const { synth, rate } = await loadPiper();

  mkdirSync(out, { recursive: true });
  const manifestPath = join(out, 'manifest.json');
  const previous: Manifest | null = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const reusable = !force && previous?.style === styleId ? previous.clips : {};
  const sentences = allSentences();
  const clips: Record<string, string> = {};
  let rendered = 0;
  const started = Date.now();
  const save = (known: Record<string, string>) => writeFileSync(manifestPath, JSON.stringify({ voice: VOICE, style: styleId, rate, clips: known } satisfies Manifest, null, 1) + '\n');

  for (const [index, sentence] of sentences.entries()) {
    const file = `${createHash('sha1').update(`${styleId}|${sentence}`).digest('hex').slice(0, 10)}.wav`;
    if (reusable[sentence] === file && existsSync(join(out, file))) {
      clips[sentence] = file;
      continue;
    }
    const samples = await synth(sentence, STYLE);
    writeFileSync(join(out, file), wav(finish(samples, rate), rate));
    clips[sentence] = file;
    rendered += 1;
    const done = index + 1;
    const eta = Math.round((((Date.now() - started) / Math.max(1, rendered)) * (sentences.length - done)) / 1000);
    console.log(`[${done}/${sentences.length}] ${sentence}  (~${eta}s restantes)`);
    // Se guarda seguido: si se corta, la próxima corrida sigue donde quedó.
    if (rendered % 10 === 0) save({ ...reusable, ...clips });
  }

  save(clips);
  // Audios de frases que ya no existen o de otro estilo.
  const used = new Set(Object.values(clips));
  for (const file of readdirSync(out)) if (file.endsWith('.wav') && !used.has(file)) rmSync(join(out, file));
  console.log(`listo: ${sentences.length} frases (${rendered} nuevas) en ${Math.round((Date.now() - started) / 1000)} s`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
