import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Checkbox, Loading, Notice, PageTitle, SelectField, TextArea, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { getMyProduct, saveProduct, uploadImage } from '../../lib/api/merchant';
import { listCategories } from '../../lib/api/shop';
import { emptyProduct, emptyVariant, validateProduct, type ProductDraft } from '../../lib/catalog';
import { toInputPrice } from '../../lib/money';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

const MAX_IMAGES = 6;

/** Alta y edición de un producto con sus variantes (talle, color, precio y stock) e imágenes. */
export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id && id !== 'nuevo');
  const { merchant } = useAuth();
  const navigate = useNavigate();
  const categories = useAsync(listCategories, []);
  const existing = useAsync(() => (editing ? getMyProduct(id!) : Promise.resolve(null)), [id]);
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct());
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const product = existing.data;
    if (!product) return;
    setDraft({
      id: product.id,
      name: product.name,
      description: product.description,
      brand: product.brand,
      category_id: product.category_id ?? '',
      images: product.images,
      is_active: product.is_active,
      variants: (product.variants ?? []).map((variant) => ({
        id: variant.id,
        size: variant.size,
        color: variant.color,
        sku: variant.sku,
        price: toInputPrice(variant.price_cents),
        stock: String(variant.stock),
        is_active: variant.is_active,
      })),
    });
  }, [existing.data]);

  if (!merchant) return null;
  if (editing && existing.loading) return <Loading />;
  if (editing && !existing.data) return <Notice tone="error">No encontramos ese producto.</Notice>;

  const patch = (changes: Partial<ProductDraft>) => setDraft((current) => ({ ...current, ...changes }));
  const patchVariant = (index: number, changes: Partial<ProductDraft['variants'][number]>) =>
    patch({ variants: draft.variants.map((variant, position) => (position === index ? { ...variant, ...changes } : variant)) });

  const addImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrors([]);
    setUploading(true);
    try {
      const room = MAX_IMAGES - draft.images.length;
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, room)) urls.push(await uploadImage(merchant.id, file));
      patch({ images: [...draft.images, ...urls] });
    } catch (failure) {
      setErrors([failure instanceof Error ? failure.message : 'No pudimos subir la imagen.']);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validateProduct(draft);
    if (!result.ok) return setErrors(result.errors);
    setErrors([]);
    setBusy(true);
    try {
      await saveProduct(merchant.id, result.input);
      navigate('/comercio/productos');
    } catch (failure) {
      setErrors([failure instanceof Error ? failure.message : 'No pudimos guardar el producto.']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title={editing ? 'Editar producto' : 'Publicar producto'} />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
        {errors.length > 0 ? (
          <Notice tone="error">
            {errors.map((message) => (
              <div key={message}>{message}</div>
            ))}
          </Notice>
        ) : null}

        <Card title="Datos">
          <div className={styles.form}>
            <TextField label="Nombre" required value={draft.name} onChange={(event) => patch({ name: event.target.value })} maxLength={120} />
            <TextArea label="Descripción" value={draft.description} onChange={(event) => patch({ description: event.target.value })} placeholder="Materiales, uso, cuidados…" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <SelectField label="Categoría" value={draft.category_id} onChange={(event) => patch({ category_id: event.target.value })}>
                <option value="">Sin categoría</option>
                {(categories.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </SelectField>
              <TextField label="Marca" value={draft.brand} onChange={(event) => patch({ brand: event.target.value })} />
            </div>
            <Checkbox label="Publicado (visible en la tienda)" checked={draft.is_active} onChange={(event) => patch({ is_active: event.target.checked })} />
          </div>
        </Card>

        <Card title="Imágenes">
          <div className={styles.imageRow}>
            {draft.images.map((url, index) => (
              <div key={url} className={styles.imageBox}>
                <img src={url} alt="" />
                <button type="button" className={styles.imageRemove} aria-label="Quitar imagen" onClick={() => patch({ images: draft.images.filter((_, position) => position !== index) })}>
                  ×
                </button>
              </div>
            ))}
          </div>
          {draft.images.length < MAX_IMAGES ? (
            <p>
              <label style={{ cursor: 'pointer', color: '#ff7900', fontWeight: 600 }}>
                {uploading ? 'Subiendo…' : 'Agregar imágenes'}
                <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(event) => void addImages(event.target.files)} />
              </label>{' '}
              <span style={{ color: '#8a8c94', fontSize: 13 }}>
                Hasta {MAX_IMAGES}, de 5 MB cada una. La primera es la principal.
              </span>
            </p>
          ) : null}
        </Card>

        <Card title="Variantes, precios y stock">
          <p style={{ color: '#a7a9b2', fontSize: 13, marginTop: 0 }}>Cada combinación de talle y color tiene su precio y su stock. Si el producto es de talle único, dejá talle y color vacíos.</p>
          {draft.variants.map((variant, index) => (
            <div key={variant.id ?? `new-${index}`} className={styles.variantRow}>
              <TextField label="Talle" value={variant.size} onChange={(event) => patchVariant(index, { size: event.target.value })} placeholder="42, M…" />
              <TextField label="Color" value={variant.color} onChange={(event) => patchVariant(index, { color: event.target.value })} placeholder="Negro" />
              <TextField label="Precio ($)" inputMode="decimal" value={variant.price} onChange={(event) => patchVariant(index, { price: event.target.value })} placeholder="12500" />
              <TextField label="Stock" type="number" min={0} value={variant.stock} onChange={(event) => patchVariant(index, { stock: event.target.value })} />
              <TextField label="SKU (opcional)" value={variant.sku} onChange={(event) => patchVariant(index, { sku: event.target.value })} />
              <Button variant="danger" small onClick={() => patch({ variants: draft.variants.filter((_, position) => position !== index) })} disabled={draft.variants.length === 1}>
                Quitar
              </Button>
            </div>
          ))}
          <p>
            <Button variant="secondary" small onClick={() => patch({ variants: [...draft.variants, emptyVariant()] })}>
              + Agregar variante
            </Button>
          </p>
        </Card>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button type="submit" disabled={busy || uploading}>
            {busy ? 'Guardando…' : 'Guardar producto'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/comercio/productos')}>
            Cancelar
          </Button>
        </div>
      </form>
    </>
  );
}
