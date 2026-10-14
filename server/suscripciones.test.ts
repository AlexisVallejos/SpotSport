import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Subscriptions, normalizeEmail } from './suscripciones';

describe('newsletter', () => {
  it('normaliza mails y rechaza lo que no parece un mail', () => {
    expect(normalizeEmail('  Ana.Perez@Mail.com ')).toBe('ana.perez@mail.com');
    expect(normalizeEmail('ana@mail')).toBeNull();
    expect(normalizeEmail('ana mail.com')).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });

  it('suscribe una sola vez, da de baja y guarda en disco', async () => {
    const file = path.join(await mkdtemp(path.join(tmpdir(), 'spot-news-')), 'suscriptores.json');
    const list = new Subscriptions(file);
    expect(await list.add('ana@mail.com')).toBe('nuevo');
    expect(await list.add('ana@mail.com')).toBe('ya-estaba');
    expect(Object.keys(JSON.parse(await readFile(file, 'utf8')))).toEqual(['ana@mail.com']);

    // Otra instancia (como después de reiniciar) lee lo guardado.
    const again = new Subscriptions(file);
    expect(await again.remove('ana@mail.com')).toBe('baja');
    expect(await again.remove('ana@mail.com')).toBe('no-estaba');
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({});
  });
});
