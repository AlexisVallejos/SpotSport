import { FormEvent, useState } from 'react';
import { Button, Card, Empty, Loading, Notice, PageTitle, Table, TextField } from '../../components/ui';
import { deleteCategory, saveCategory } from '../../lib/api/admin';
import { listCategories } from '../../lib/api/shop';
import { slugify } from '../../lib/catalog';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

export default function AdminCategories() {
  const categories = useAsync(listCategories, []);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const run = async (action: () => Promise<void>) => {
    setError('');
    try {
      await action();
      categories.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar el cambio.');
    }
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const slug = slugify(name);
    if (!slug) return setError('Escribí un nombre.');
    await run(async () => {
      const next = Math.max(0, ...(categories.data ?? []).map((category) => category.sort)) + 1;
      await saveCategory({ slug, name: name.trim(), sort: next });
      setName('');
    });
  };

  return (
    <>
      <PageTitle title="Categorías" subtitle="Las que se usan para filtrar la tienda y clasificar productos." />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Card title="Nueva categoría">
        <form className={styles.form} onSubmit={add} style={{ maxWidth: 420 }}>
          <TextField label="Nombre" value={name} onChange={(event) => setName(event.target.value)} placeholder="Natación" required />
          <div>
            <Button type="submit">Agregar</Button>
          </div>
        </form>
      </Card>
      <div style={{ marginTop: 20 }}>
        {categories.loading ? (
          <Loading />
        ) : (categories.data ?? []).length === 0 ? (
          <Empty title="No hay categorías" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Orden</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(categories.data ?? []).map((category) => (
                <tr key={category.id}>
                  <td>
                    <input
                      className={styles.inlineStock}
                      style={{ width: 200 }}
                      defaultValue={category.name}
                      aria-label={`Nombre de ${category.name}`}
                      onBlur={(event) => {
                        const value = event.target.value.trim();
                        if (value && value !== category.name) void run(() => saveCategory({ id: category.id, slug: category.slug, name: value, sort: category.sort }));
                      }}
                    />
                  </td>
                  <td>
                    <code>{category.slug}</code>
                  </td>
                  <td>
                    <input
                      className={styles.inlineStock}
                      type="number"
                      defaultValue={category.sort}
                      aria-label={`Orden de ${category.name}`}
                      onBlur={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        if (Number.isInteger(value) && value !== category.sort) void run(() => saveCategory({ id: category.id, slug: category.slug, name: category.name, sort: value }));
                      }}
                    />
                  </td>
                  <td>
                    <Button
                      variant="danger"
                      small
                      onClick={() => {
                        if (window.confirm(`¿Eliminar "${category.name}"? Los productos quedan sin categoría.`)) void run(() => deleteCategory(category.id));
                      }}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
