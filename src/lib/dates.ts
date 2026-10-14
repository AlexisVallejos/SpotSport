const pad = (value: number) => String(value).padStart(2, '0');

/** ISO (UTC) → valor de un <input type="datetime-local"> en hora local. Vacío si no hay fecha. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Valor de un <input type="datetime-local"> (hora local) → ISO. Null si está vacío o no es válido. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
