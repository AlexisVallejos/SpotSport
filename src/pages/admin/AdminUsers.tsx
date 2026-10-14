import { useMemo, useState } from 'react';
import { Badge, Button, Empty, Loading, Notice, PageTitle, Table, TextField, formatDate } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { listUsers, setAdmin } from '../../lib/api/admin';
import { useAsync } from '../../lib/useAsync';

export default function AdminUsers() {
  const { profile } = useAuth();
  const users = useAsync(listUsers, []);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (users.data ?? []).filter((user) => !text || user.email.toLowerCase().includes(text) || user.full_name.toLowerCase().includes(text));
  }, [users.data, query]);

  const toggle = async (id: string, email: string, isAdmin: boolean) => {
    const message = isAdmin ? `¿Quitarle el acceso de administrador a ${email}?` : `¿Darle acceso total de administrador a ${email}?`;
    if (!window.confirm(message)) return;
    setError('');
    try {
      await setAdmin(id, isAdmin ? false : true);
      users.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar el cambio.');
    }
  };

  return (
    <>
      <PageTitle title="Usuarios" subtitle={`${users.data?.length ?? 0} cuentas`} />
      <div style={{ maxWidth: 360, marginBottom: 16 }}>
        <TextField label="Buscar" placeholder="Nombre o email" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {users.error ? <Notice tone="error">{users.error}</Notice> : null}
      {users.loading ? (
        <Loading />
      ) : shown.length === 0 ? (
        <Empty title="No hay usuarios con ese dato" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Alta</th>
              <th>Rol</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((user) => (
              <tr key={user.id}>
                <td>{user.full_name || '—'}</td>
                <td>{user.email}</td>
                <td>{user.phone || '—'}</td>
                <td>{formatDate(user.created_at)}</td>
                <td>{user.is_admin ? <Badge tone="brand">Admin</Badge> : <Badge>Usuario</Badge>}</td>
                <td>
                  <Button variant={user.is_admin ? 'danger' : 'secondary'} small disabled={user.id === profile?.id} onClick={() => void toggle(user.id, user.email, user.is_admin)}>
                    {user.is_admin ? 'Quitar admin' : 'Hacer admin'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
