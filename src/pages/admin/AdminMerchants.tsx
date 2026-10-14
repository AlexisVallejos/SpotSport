import { useState } from 'react';
import { Badge, Button, Empty, Loading, Notice, PageTitle, Table, formatDate } from '../../components/ui';
import { listMerchants, reviewMerchant } from '../../lib/api/admin';
import { MERCHANT_STATUS_LABEL, type MerchantStatus } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

const TABS: { value: MerchantStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Por aprobar' },
  { value: 'approved', label: 'Activos' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'suspended', label: 'Suspendidos' },
  { value: 'all', label: 'Todos' },
];

export default function AdminMerchants() {
  const [tab, setTab] = useState<MerchantStatus | 'all'>('pending');
  const merchants = useAsync(() => listMerchants(tab === 'all' ? undefined : tab), [tab]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const review = async (id: string, status: MerchantStatus, askReason: boolean) => {
    let reason = '';
    if (askReason) {
      const answer = window.prompt('Motivo (se le muestra al comercio):', '');
      if (answer === null) return;
      reason = answer.trim();
    }
    setError('');
    setBusy(id);
    try {
      await reviewMerchant(id, status, reason);
      merchants.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar el cambio.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle title="Comercios" subtitle="Aprobá, rechazá o suspendé comercios afiliados." />
      <div className={styles.filters}>
        {TABS.map((item) => (
          <button key={item.value} type="button" className={`${styles.chip} ${tab === item.value ? styles.chipOn : ''}`} onClick={() => setTab(item.value)}>
            {item.label}
          </button>
        ))}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {merchants.error ? <Notice tone="error">{merchants.error}</Notice> : null}
      {merchants.loading ? (
        <Loading />
      ) : (merchants.data ?? []).length === 0 ? (
        <Empty title="No hay comercios en esta lista" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Comercio</th>
              <th>Responsable</th>
              <th>Contacto</th>
              <th>Pidió</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(merchants.data ?? []).map((merchant) => (
              <tr key={merchant.id}>
                <td>
                  <strong>{merchant.name}</strong>
                  <br />
                  <small style={{ color: '#8a8c94' }}>{[merchant.city, merchant.description].filter(Boolean).join(' · ') || '—'}</small>
                </td>
                <td>
                  {merchant.owner?.full_name || '—'}
                  <br />
                  <small style={{ color: '#8a8c94' }}>{merchant.owner?.email}</small>
                </td>
                <td>
                  <small>
                    {merchant.contact_email || '—'}
                    <br />
                    {merchant.contact_phone}
                  </small>
                </td>
                <td>{formatDate(merchant.created_at)}</td>
                <td>
                  <Badge tone={merchant.status === 'approved' ? 'ok' : merchant.status === 'pending' ? 'warn' : 'bad'}>{MERCHANT_STATUS_LABEL[merchant.status]}</Badge>
                  {merchant.rejection_reason ? (
                    <>
                      <br />
                      <small style={{ color: '#8a8c94' }}>{merchant.rejection_reason}</small>
                    </>
                  ) : null}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {merchant.status !== 'approved' ? (
                      <Button small disabled={busy === merchant.id} onClick={() => void review(merchant.id, 'approved', false)}>
                        Aprobar
                      </Button>
                    ) : null}
                    {merchant.status === 'pending' ? (
                      <Button variant="danger" small disabled={busy === merchant.id} onClick={() => void review(merchant.id, 'rejected', true)}>
                        Rechazar
                      </Button>
                    ) : null}
                    {merchant.status === 'approved' ? (
                      <Button variant="danger" small disabled={busy === merchant.id} onClick={() => void review(merchant.id, 'suspended', true)}>
                        Suspender
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
