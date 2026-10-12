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

  it('prefers a neural voice over any other, even from another country', () => {
    const list = [voice('es-AR', 'Local argentina'), voice('es-ES', 'Microsoft Alvaro Online (Natural) - Spanish (Spain)', false)];
    expect(pickVoice(list)?.name).toContain('Natural');
  });

  it('picks the Argentine neural voice when it exists', () => {
    const list = [
      voice('es-ES', 'Microsoft Elvira Online (Natural) - Spanish (Spain)', false),
      voice('es-AR', 'Microsoft Elena Online (Natural) - Spanish (Argentina)', false),
      voice('es-MX', 'Microsoft Dalia Online (Natural) - Spanish (Mexico)', false),
    ];
    expect(pickVoice(list)?.name).toContain('Elena');
  });

  it('prefers a cloud voice (Google) over the basic local one', () => {
    const list = [voice('es-ES', 'Microsoft Helena - Spanish (Spain)', true), voice('es-US', 'Google español de Estados Unidos', false)];
    expect(pickVoice(list)?.name).toContain('Google');
  });

  it('skips voices that already failed', () => {
    const list = [voice('es-AR', 'Microsoft Elena Online (Natural) - Spanish (Argentina)', false), voice('es-ES', 'Microsoft Helena - Spanish (Spain)', true)];
    expect(pickVoice(list, new Set(['Microsoft Elena Online (Natural) - Spanish (Argentina)']))?.name).toContain('Helena');
  });

  it('returns null when there is no Spanish voice', () => {
    expect(pickVoice([voice('en-US')])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });
});
