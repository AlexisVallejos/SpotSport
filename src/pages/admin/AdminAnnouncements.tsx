import { FormEvent, useState } from 'react';
import { Badge, Button, Card, Checkbox, Empty, Loading, Notice, PageTitle, SelectField, Table, TextArea, TextField } from '../../components/ui';
import { deleteAnnouncement, listAllAnnouncements, saveAnnouncement, type AnnouncementInput } from '../../lib/api/admin';
import { uploadImage } from '../../lib/api/merchant';
import { fromLocalInput, toLocalInput } from '../../lib/dates';
import type { Announcement, AnnouncementPlacement } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

const PLACEMENTS: { value: AnnouncementPlacement; label: string; help: string }[] = [
  { value: 'topbar', label: 'Barra superior', help: 'Una franja naranja arriba de todo el sitio.' },
  { value: 'hero', label: 'Portada', help: 'Un bloque destacado en la portada de la tienda.' },
  { value: 'strip', label: 'Franja', help: 'Una franja con imagen entre secciones de la portada.' },
];

type Draft = {
  id?: string;
  placement: AnnouncementPlacement;
  title: string;
  body: string;
  link_url: string;
  link_label: string;
  image_url: string | null;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  sort: string;
};

const blank = (): Draft => ({ placement: 'topbar', title: '', body: '', link_url: '', link_label: '', image_url: null, is_active: true, starts_at: '', ends_at: '', sort: '0' });

const toDraft = (item: Announcement): Draft => ({
  id: item.id,
  placement: item.placement,
  title: item.title,
  body: item.body,
  link_url: item.link_url,
  link_label: item.link_label,
  image_url: item.image_url,
  is_active: item.is_active,
  starts_at: toLocalInput(item.starts_at),
  ends_at: toLocalInput(item.ends_at),
  sort: String(item.sort),
});

export default function AdminAnnouncements() {
  const list = useAsync(listAllAnnouncements, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const patch = (changes: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...changes } : current));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setError('');
    const starts = fromLocalInput(draft.starts_at);
    const ends = fromLocalInput(draft.ends_at);
    if (starts && ends && ends < starts) return setError('La fecha de fin es anterior a la de inicio.');
    if (draft.link_url && !/^(https?:\/\/|\/)/.test(draft.link_url.trim())) return setError('El enlace tiene que empezar con https:// o con /.');
    const input: AnnouncementInput = {
      id: draft.id,
      placement: draft.placement,
      title: draft.title.trim(),
      body: draft.body.trim(),
      link_url: draft.link_url.trim(),
      link_label: draft.link_label.trim(),
      image_url: draft.image_url,
      is_active: draft.is_active,
      starts_at: starts,
      ends_at: ends,
      sort: Number.parseInt(draft.sort, 10) || 0,
    };
    setBusy(true);
    try {
      await saveAnnouncement(input);
      setDraft(null);
      list.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar el anuncio.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      patch({ image_url: await uploadImage('announcements', file, 'site') });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos subir la imagen.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: Announcement) => {
    if (!window.confirm(`¿Eliminar el anuncio "${item.title}"?`)) return;
    try {
      await deleteAnnouncement(item.id);
      list.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos eliminarlo.');
    }
  };

  const now = Date.now();
  const status = (item: Announcement) => {
    if (!item.is_active) return <Badge>Pausado</Badge>;
    if (item.starts_at && new Date(item.starts_at).getTime() > now) return <Badge tone="warn">Programado</Badge>;
    if (item.ends_at && new Date(item.ends_at).getTime() < now) return <Badge tone="bad">Vencido</Badge>;
    return <Badge tone="ok">En vivo</Badge>;
  };

  return (
    <>
      <PageTitle title="Anuncios" subtitle="Controlá lo que se muestra en el sitio, sin tocar código." actions={!draft ? <Button onClick={() => setDraft(blank())}>Nuevo anuncio</Button> : null} />
      {error ? <Notice tone="error">{error}</Notice> : null}

      {draft ? (
        <Card title={draft.id ? 'Editar anuncio' : 'Nuevo anuncio'}>
          <form className={styles.form} onSubmit={save}>
            <SelectField label="Dónde se muestra" value={draft.placement} onChange={(event) => patch({ placement: event.target.value as AnnouncementPlacement })} hint={PLACEMENTS.find((p) => p.value === draft.placement)?.help}>
              {PLACEMENTS.map((placement) => (
                <option key={placement.value} value={placement.value}>
                  {placement.label}
                </option>
              ))}
            </SelectField>
            <TextField label="Título" required maxLength={140} value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="Envío gratis en compras de más de $50.000" />
            <TextArea label="Texto (opcional)" value={draft.body} onChange={(event) => patch({ body: event.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <TextField label="Enlace (opcional)" value={draft.link_url} onChange={(event) => patch({ link_url: event.target.value })} placeholder="/tienda?cat=running" hint="Dentro del sitio (/tienda) o externo (https://…)." />
              <TextField label="Texto del enlace" value={draft.link_label} onChange={(event) => patch({ link_label: event.target.value })} placeholder="Ver ofertas" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <TextField label="Desde (opcional)" type="datetime-local" value={draft.starts_at} onChange={(event) => patch({ starts_at: event.target.value })} />
              <TextField label="Hasta (opcional)" type="datetime-local" value={draft.ends_at} onChange={(event) => patch({ ends_at: event.target.value })} />
              <TextField label="Orden" type="number" value={draft.sort} onChange={(event) => patch({ sort: event.target.value })} hint="Menor número, primero." />
            </div>
            {draft.placement !== 'topbar' ? (
              <div>
                {draft.image_url ? <img src={draft.image_url} alt="" style={{ maxWidth: 320, display: 'block', marginBottom: 8 }} /> : null}
                <label style={{ cursor: 'pointer', color: 'var(--accent-text)', fontWeight: 600 }}>
                  {draft.image_url ? 'Cambiar imagen' : 'Subir imagen'}
                  <input type="file" accept="image/*" hidden onChange={(event) => void upload(event.target.files)} />
                </label>
              </div>
            ) : null}
            <Checkbox label="Activo" checked={draft.is_active} onChange={(event) => patch({ is_active: event.target.checked })} />
            <div style={{ display: 'flex', gap: 10 }}>
              <Button type="submit" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {list.loading ? (
        <Loading />
      ) : (list.data ?? []).length === 0 && !draft ? (
        <Empty title="Todavía no hay anuncios">
          <p>Creá el primero con “Nuevo anuncio”.</p>
        </Empty>
      ) : (
        <div style={{ marginTop: draft ? 20 : 0 }}>
          <Table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Lugar</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    {item.body ? (
                      <>
                        <br />
                        <small style={{ color: 'var(--text-3)' }}>{item.body}</small>
                      </>
                    ) : null}
                  </td>
                  <td>{PLACEMENTS.find((p) => p.value === item.placement)?.label}</td>
                  <td>
                    <small>
                      {item.starts_at ? new Date(item.starts_at).toLocaleString('es-AR') : 'Ya'} → {item.ends_at ? new Date(item.ends_at).toLocaleString('es-AR') : 'Sin fin'}
                    </small>
                  </td>
                  <td>{status(item)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button variant="secondary" small onClick={() => setDraft(toDraft(item))}>
                        Editar
                      </Button>
                      <Button variant="danger" small onClick={() => void remove(item)}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </>
  );
}
