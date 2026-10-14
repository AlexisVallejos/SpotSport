import { Notice } from '../ui';

/** Se muestra en lugar de las pantallas con datos cuando todavía no hay base conectada. */
export default function NotConfigured() {
  return (
    <Notice>
      <strong>La tienda todavía no está conectada a su base de datos.</strong>
      <br />
      Creá un proyecto en Supabase, aplicá las migraciones de <code>supabase/migrations</code> y cargá <code>VITE_SUPABASE_URL</code> y{' '}
      <code>VITE_SUPABASE_ANON_KEY</code> en un archivo <code>.env</code>. Los pasos están en el README.
    </Notice>
  );
}
