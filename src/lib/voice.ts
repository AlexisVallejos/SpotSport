// La voz del coach.
// 1) Pack de audios grabados con Piper (voz neuronal argentina, public/voice/es_AR): suena natural, sin demora y sin internet.
// 2) Si falta el pack, o una frase no está grabada, la voz del navegador (speechSynthesis) como respaldo.
import { clipKey, forSpeech, splitSentences } from './pose/script';

const PREF_KEY = 'spot:voice';
const PACK_URL = `${import.meta.env.BASE_URL}voice/es_AR/`;
/** Rioplatense first, then the rest of Latin America, then Spain. */
const LATAM = ['es-ar', 'es-mx', 'es-us', 'es-419'];

// ───────────────────────── voz del navegador (respaldo) ─────────────────────────

export type VoiceInfo = { lang: string; name: string; localService?: boolean };

const norm = (lang: string) => lang.toLowerCase().replace('_', '-');

/** Microsoft "Online (Natural)" and other neural voices: the ones that do not sound robotic. */
const NEURAL = /natural|neural/i;

/**
 * The best Spanish voice the browser has. Quality first (neural, then cloud, then the basic local one),
 * and inside the same quality, the accent closest to Argentina.
 * `failed` holds names of voices that already errored out.
 */
export function pickVoice<T extends VoiceInfo>(voices: T[], failed: Set<string> = new Set()): T | null {
  const spanish = voices.filter((voice) => norm(voice.lang).startsWith('es') && !failed.has(voice.name));
  if (spanish.length === 0) return null;
  const rank = (voice: T) => {
    const quality = NEURAL.test(voice.name) ? 0 : voice.localService ? 2 : 1;
    const lang = norm(voice.lang);
    const accent = lang === 'es-ar' ? 0 : LATAM.includes(lang) ? 1 : lang === 'es-es' ? 2 : 3;
    return quality * 4 + accent;
  };
  return [...spanish].sort((a, b) => rank(a) - rank(b))[0];
}

const hasBrowserVoice = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
const hasAudio = () => typeof window !== 'undefined' && typeof AudioContext !== 'undefined';

export function voiceSupported(): boolean {
  return hasAudio() || hasBrowserVoice();
}

export function readVoicePref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeVoicePref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // Sin storage: la preferencia dura hasta recargar.
  }
}

// ───────────────────────── pack grabado ─────────────────────────

type Pack = { rate: number; clips: Record<string, string> };

let packLoad: Promise<Pack | null> | null = null;
let context: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();

/** The dev server answers a missing file with index.html, so a JSON parse error means "no pack". */
function loadPack(): Promise<Pack | null> {
  packLoad ??= fetch(`${PACK_URL}manifest.json`)
    .then(async (response) => {
      if (!response.ok) return null;
      const manifest = (await response.json()) as Pack;
      return manifest && typeof manifest.clips === 'object' ? manifest : null;
    })
    .catch(() => null);
  return packLoad;
}

function audio(): AudioContext | null {
  if (!hasAudio()) return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function clip(key: string, pack: Pack): Promise<AudioBuffer> {
  const hit = buffers.get(key);
  if (hit) return hit;
  const loaded = (async () => {
    const ctx = audio();
    if (!ctx) throw new Error('no audio');
    const response = await fetch(`${PACK_URL}${pack.clips[key]}`);
    if (!response.ok) throw new Error(`clip ${response.status}`);
    return await ctx.decodeAudioData(await response.arrayBuffer());
  })();
  loaded.catch(() => buffers.delete(key));
  buffers.set(key, loaded);
  return loaded;
}

/** Loads clips ahead of time so counting and corrections start without a network round trip. */
export function warmVoice(texts: string[]) {
  void loadPack().then((pack) => {
    if (!pack) return;
    for (const text of texts) {
      for (const key of splitSentences(text).map(clipKey)) if (pack.clips[key]) clip(key, pack).catch(() => {});
    }
  });
}

// ───────────────────────── reproducción ─────────────────────────

/** One thing to say. It reports when it ends and registers how to cut it. */
type Job = (isCurrent: () => boolean, register: (stop: () => void) => void) => Promise<void>;

let ticket = 0;
let busy = false;
let stopCurrent: (() => void) | null = null;
let waiting: Job | null = null;
/** Bumped by stopSpeaking so lines asked for before it, still waiting on the pack, are dropped. */
let epoch = 0;

function start(job: Job) {
  const mine = ++ticket;
  busy = true;
  const isCurrent = () => ticket === mine;
  job(isCurrent, (stop) => {
    if (isCurrent()) stopCurrent = stop;
  })
    .catch(() => {})
    .finally(() => {
      if (!isCurrent()) return;
      busy = false;
      stopCurrent = null;
      const next = waiting;
      waiting = null;
      if (next) start(next);
    });
}

/** Urgent cuts what is being said; otherwise it waits its turn (only the latest waiting line is kept). */
function enqueue(job: Job, urgent: boolean) {
  if (urgent) {
    waiting = null;
    stopCurrent?.();
    start(job);
    return;
  }
  if (busy) waiting = job;
  else start(job);
}

function packJob(keys: string[], pack: Pack): Job {
  return async (isCurrent, register) => {
    const ctx = audio();
    if (!ctx) return;
    const loading = keys.map((key) => clip(key, pack));
    let stopped = false;
    let playing: AudioBufferSourceNode | null = null;
    register(() => {
      stopped = true;
      try {
        playing?.stop();
      } catch {
        // Ya había terminado.
      }
    });
    for (const pending of loading) {
      const buffer = await pending;
      if (stopped || !isCurrent()) return;
      await new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        playing = source;
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start();
      });
    }
  };
}

const RETRYABLE = new Set(['network', 'synthesis-unavailable', 'synthesis-failed', 'voice-unavailable', 'language-unavailable']);
const failedVoices = new Set<string>();
let browserVoice: SpeechSynthesisVoice | null = null;

function browserJob(text: string): Job {
  return (_isCurrent, register) =>
    new Promise<void>((resolve) => {
      if (!hasBrowserVoice()) {
        resolve();
        return;
      }
      const synth = window.speechSynthesis;
      register(() => {
        synth.cancel();
        resolve();
      });
      const say = (attempt: number) => {
        browserVoice ??= pickVoice(synth.getVoices(), failedVoices);
        const picked = browserVoice;
        const utterance = new SpeechSynthesisUtterance(forSpeech(text));
        utterance.lang = picked?.lang ?? 'es-AR';
        if (picked) utterance.voice = picked;
        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
          if (!RETRYABLE.has(event.error) || attempt >= 3) {
            resolve();
            return;
          }
          // Voz online sin internet o rota: se descarta y se reintenta con la siguiente mejor.
          if (picked) failedVoices.add(picked.name);
          browserVoice = null;
          say(attempt + 1);
        };
        synth.speak(utterance);
      };
      say(0);
    });
}

/** Says `text` in the coach's voice. */
export function speak(text: string, urgent = false) {
  if (!text || !voiceSupported()) return;
  const asked = epoch;
  void loadPack().then((pack) => {
    if (asked !== epoch) return;
    const keys = splitSentences(text).map(clipKey);
    // Whole line from the pack, or whole line from the browser: never two voices in one sentence.
    const recorded = pack !== null && hasAudio() && keys.length > 0 && keys.every((key) => pack.clips[key]);
    enqueue(recorded ? packJob(keys, pack) : browserJob(text), urgent);
  });
}

export function stopSpeaking() {
  epoch += 1;
  ticket += 1;
  busy = false;
  waiting = null;
  stopCurrent?.();
  stopCurrent = null;
  if (hasBrowserVoice()) window.speechSynthesis.cancel();
}

if (hasBrowserVoice()) {
  // Chrome carga la lista de voces tarde: se vuelve a elegir cuando está lista.
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    browserVoice = null;
  });
}
