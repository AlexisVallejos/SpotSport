import { describe, expect, it } from 'vitest';
import { groupByCheckout, spendSummary } from './orders';
import type { Order } from './types';

const order = (patch: Partial<Order>): Order => ({
  id: 'o',
  checkout_id: 'c1',
  customer_id: 'u',
  merchant_id: 'm',
  status: 'pending',
  payment_method: 'pickup',
  payment_status: 'unpaid',
  total_cents: 1000,
  shipping_name: '',
  shipping_address: '',
  shipping_city: '',
  shipping_phone: '',
  notes: '',
  created_at: '2026-10-10T10:00:00Z',
  ...patch,
});

describe('pedidos', () => {
  it('no cuenta los cancelados en lo gastado', () => {
    const summary = spendSummary([order({ total_cents: 5000 }), order({ status: 'delivered', total_cents: 3000 }), order({ status: 'cancelled', total_cents: 9000 })]);
    expect(summary).toEqual({ spentCents: 8000, orders: 2, inProgress: 1 });
  });

  it('agrupa por compra y ordena de más nueva a más vieja', () => {
    const groups = groupByCheckout([
      order({ id: 'a', checkout_id: 'c1', total_cents: 1000, created_at: '2026-10-01T10:00:00Z' }),
      order({ id: 'b', checkout_id: 'c2', total_cents: 4000, created_at: '2026-10-05T10:00:00Z' }),
      order({ id: 'c', checkout_id: 'c1', total_cents: 2000, status: 'cancelled', created_at: '2026-10-01T10:00:01Z' }),
      order({ id: 'd', checkout_id: 'c2', total_cents: 500, created_at: '2026-10-05T10:00:02Z' }),
    ]);
    expect(groups.map((group) => group.checkoutId)).toEqual(['c2', 'c1']);
    expect(groups[0].totalCents).toBe(4500);
    expect(groups[1].totalCents).toBe(1000);
    expect(groups[1].orders).toHaveLength(2);
  });
});
