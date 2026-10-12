// La voz del coach: speechSynthesis del navegador. Gratis, sin claves y sin conexión.
import { forSpeech } from './pose/script';

const PREF_KEY = 'spot:voice';
/** Rioplatense first, then the rest of Latin America, then Spain. */
const LANGS = ['es-ar', 'es-mx', 'es-us', 'es-419', 'es-es'];

export type VoiceInfo = { lang: string; name: string; localService?: boolean };

const norm = (lang: string) => lang.toLowerCase().replace('_', '-');

/** The best Spanish voice available; inside the same language an offline one wins (works without internet). */
export function pickVoice<T extends VoiceInfo>(voices: T[]): T | null {
  const spanish = voices.filter((voice) => norm(voice.lang).startsWith('es'));
  if (spanish.length === 0) return null;
  const rank = (voice: T) => {
    const index = LANGS.indexOf(norm(voice.lang));
    return (index === -1 ? LANGS.length : index) * 2 + (voice.localService ? 0 : 1);
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

let chosen: SpeechSynthesisVoice | null = null;
let pending: string | null = null;

function voice(): SpeechSynthesisVoice | null {
  if (chosen) return chosen;
  chosen = pickVoice(window.speechSynthesis.getVoices());
  return chosen;
}

function say(text: string) {
  const utterance = new SpeechSynthesisUtterance(forSpeech(text));
  const picked = voice();
  utterance.lang = picked?.lang ?? 'es-AR';
  if (picked) utterance.voice = picked;
  utterance.rate = 1.02;
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
  // Chrome loads the voice list late: pick again once it is ready.
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    chosen = null;
  });
}
