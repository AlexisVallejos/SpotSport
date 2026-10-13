import type { Order } from './types';

/** Lo que gastó una persona: pedidos no cancelados. */
export function spendSummary(orders: Pick<Order, 'status' | 'total_cents'>[]) {
  const counted = orders.filter((order) => order.status !== 'cancelled');
  return {
    spentCents: counted.reduce((sum, order) => sum + order.total_cents, 0),
    orders: counted.length,
    inProgress: orders.filter((order) => ['pending', 'preparing', 'shipped'].includes(order.status)).length,
  };
}

export type Checkout = { checkoutId: string; createdAt: string; orders: Order[]; totalCents: number };

/** Junta los pedidos que salieron de una misma compra (uno por comercio), del más nuevo al más viejo. */
export function groupByCheckout(orders: Order[]): Checkout[] {
  const map = new Map<string, Checkout>();
  for (const order of orders) {
    const group = map.get(order.checkout_id) ?? { checkoutId: order.checkout_id, createdAt: order.created_at, orders: [], totalCents: 0 };
    group.orders.push(order);
    if (order.status !== 'cancelled') group.totalCents += order.total_cents;
    if (order.created_at < group.createdAt) group.createdAt = order.created_at;
    map.set(order.checkout_id, group);
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
