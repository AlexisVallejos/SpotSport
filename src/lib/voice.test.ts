import { describe, expect, it } from 'vitest';
import { pickVoice } from './voice';

const voice = (lang: string, name = lang, localService = true) => ({ lang, name, localService });

describe('pickVoice', () => {
  it('prefers Rioplatense, then other Latin American, then Spain', () => {
    const list = [voice('en-US'), voice('es-ES'), voice('es-MX'), voice('es-AR')];
    expect(pickVoice(list)?.lang).toBe('es-AR');
    expect(pickVoice(list.filter((item) => item.lang !== 'es-AR'))?.lang).toBe('es-MX');
    expect(pickVoice([voice('en-US'), voice('es-ES')])?.lang).toBe('es-ES');
  });

  it('accepts underscores and any Spanish variant', () => {
    expect(pickVoice([voice('en_US'), voice('es_CL')])?.lang).toBe('es_CL');
  });

  it('prefers an offline voice inside the same language', () => {
    const list = [voice('es-ES', 'Google español', false), voice('es-ES', 'Microsoft Helena', true)];
    expect(pickVoice(list)?.name).toBe('Microsoft Helena');
  });

  it('returns null when there is no Spanish voice', () => {
    expect(pickVoice([voice('en-US')])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });
});
