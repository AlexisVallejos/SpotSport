import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Mails del newsletter del pie de página ("Seguí en movimiento"). Sólo mail y fecha.

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@.]{2,}$/;

/** El mail normalizado, o null si no parece un mail. */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export class Subscriptions {
  private emails = new Map<string, string>();
  private ready: Promise<void>;

  constructor(private file: string) {
    this.ready = this.load();
  }

  private async load() {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8')) as Record<string, string>;
      this.emails = new Map(Object.entries(saved));
    } catch {
      // Primera vez: todavía no hay archivo.
    }
  }

  private async save() {
    await mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify(Object.fromEntries(this.emails)));
    await rename(temporary, this.file);
  }

  async add(email: string): Promise<'nuevo' | 'ya-estaba'> {
    await this.ready;
    if (this.emails.has(email)) return 'ya-estaba';
    this.emails.set(email, new Date().toISOString());
    await this.save();
    return 'nuevo';
  }

  async remove(email: string): Promise<'baja' | 'no-estaba'> {
    await this.ready;
    if (!this.emails.delete(email)) return 'no-estaba';
    await this.save();
    return 'baja';
  }
}
