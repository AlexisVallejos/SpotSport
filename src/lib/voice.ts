// La voz del coach: speechSynthesis del navegador. Gratis, sin claves.
// Elige la voz más natural que haya instalada y, si falla (por ejemplo una voz online sin internet), pasa a la siguiente.
import { forSpeech } from './pose/script';

const PREF_KEY = 'spot:voice';
/** Rioplatense first, then the rest of Latin America, then Spain. */
const LATAM = ['es-ar', 'es-mx', 'es-us', 'es-419'];

export type VoiceInfo = { lang: string; name: string; localService?: boolean };

const norm = (lang: string) => lang.toLowerCase().replace('_', '-');

/** Microsoft "Online (Natural)" and other neural voices: the ones that do not sound robotic. */
const NEURAL = /natural|neural/i;

/**
 * The best Spanish voice available. Quality first (neural, then cloud, then the basic local one),
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

export function voiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
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

/** Name of the voice in use, for showing it on screen. Null until the first line is spoken. */
export function currentVoiceName(): string | null {
  return chosen?.name ?? null;
}

let chosen: SpeechSynthesisVoice | null = null;
let pending: string | null = null;
const failed = new Set<string>();

function voice(): SpeechSynthesisVoice | null {
  chosen ??= pickVoice(window.speechSynthesis.getVoices(), failed);
  return chosen;
}

const RETRYABLE = new Set(['network', 'synthesis-unavailable', 'synthesis-failed', 'voice-unavailable', 'language-unavailable']);

function say(text: string, attempt = 0) {
  const utterance = new SpeechSynthesisUtterance(forSpeech(text));
  const picked = voice();
  utterance.lang = picked?.lang ?? 'es-AR';
  if (picked) utterance.voice = picked;
  utterance.rate = 1;
  utterance.onerror = (event) => {
    if (!RETRYABLE.has(event.error) || attempt >= 3) return;
    // Voz online sin internet o rota: se descarta y se reintenta con la siguiente mejor.
    if (picked) failed.add(picked.name);
    chosen = null;
    say(text, attempt + 1);
  };
  utterance.onend = () => {
    if (pending === null) return;
    const next = pending;
    pending = null;
    say(next);
  };
  window.speechSynthesis.speak(utterance);
}

/**
 * Says `text`. Urgent cuts what is being said; otherwise it waits its turn
 * (only the latest waiting line is kept, so the coach never falls behind the exercise).
 */
export function speak(text: string, urgent = false) {
  if (!voiceSupported() || !text) return;
  const synth = window.speechSynthesis;
  if (urgent) {
    pending = null;
    synth.cancel();
    say(text);
    return;
  }
  if (synth.speaking || synth.pending) pending = text;
  else say(text);
}

export function stopSpeaking() {
  if (!voiceSupported()) return;
  pending = null;
  window.speechSynthesis.cancel();
}

if (voiceSupported()) {
  // Chrome carga la lista de voces tarde: se vuelve a elegir cuando está lista.
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    chosen = null;
  });
}
