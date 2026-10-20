export type MerchantStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type OrderStatus = 'pending' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash_on_delivery' | 'pickup' | 'mercado_pago';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type AnnouncementPlacement = 'topbar' | 'hero' | 'strip';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  is_admin: boolean;
  created_at: string;
};

export type Merchant = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  contact_email: string;
  contact_phone: string;
  city: string;
  status: MerchantStatus;
  rejection_reason: string;
  reviewed_at: string | null;
  created_at: string;
};

export type Category = { id: string; slug: string; name: string; image_url: string | null; sort: number };

export type Variant = {
  id: string;
  product_id: string;
  size: string;
  color: string;
  sku: string;
  price_cents: number;
  stock: number;
  is_active: boolean;
};

export type Product = {
  id: string;
  merchant_id: string;
  category_id: string | null;
  name: string;
  description: string;
  brand: string;
  images: string[];
  is_active: boolean;
  featured: boolean;
  created_at: string;
  merchant?: Pick<Merchant, 'id' | 'name' | 'slug' | 'logo_url' | 'city'> | null;
  category?: Pick<Category, 'id' | 'slug' | 'name'> | null;
  variants?: Variant[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_label: string;
  image_url: string | null;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
};

export type Order = {
  id: string;
  checkout_id: string;
  customer_id: string;
  merchant_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  total_cents: number;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_phone: string;
  notes: string;
  created_at: string;
  items?: OrderItem[];
  merchant?: Pick<Merchant, 'name' | 'slug'> | null;
  customer?: Pick<Profile, 'full_name' | 'email'> | null;
};

export type Announcement = {
  id: string;
  placement: AnnouncementPlacement;
  title: string;
  body: string;
  link_url: string;
  link_label: string;
  image_url: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort: number;
  created_at: string;
};

export type Shipping = { name: string; phone: string; address: string; city: string; notes: string };

export type AdminStats = {
  users: number;
  merchants_pending: number;
  merchants_approved: number;
  merchants_suspended: number;
  products: number;
  orders_total: number;
  orders_30d: number;
  sales_30d_cents: number;
  sales_total_cents: number;
};

export type MerchantStats = {
  products: number;
  low_stock: number;
  orders_pending: number;
  orders_30d: number;
  sales_30d_cents: number;
  sales_total_cents: number;
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const MERCHANT_STATUS_LABEL: Record<MerchantStatus, string> = {
  pending: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  suspended: 'Suspendido',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash_on_delivery: 'Pago contra entrega',
  pickup: 'Retiro y pago en el local',
  mercado_pago: 'Mercado Pago',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Sin pagar',
  paid: 'Pagado',
  refunded: 'Reintegrado',
};

/** Siguiente paso que puede dar un comercio sobre un pedido. */
export const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  pending: { status: 'preparing', label: 'Empezar a preparar' },
  preparing: { status: 'shipped', label: 'Marcar como enviado' },
  shipped: { status: 'delivered', label: 'Marcar como entregado' },
};

export type Coupon = {
  id: string;
  merchant_id: string;
  title: string;
  description: string;
  discount_label: string;
  code_prefix: string;
  /** Web del comercio; {codigo} se reemplaza por el código del voucher. */
  destination_url: string;
  valid_hours: number;
  starts_at: string;
  ends_at: string | null;
  max_claims: number | null;
  claims_count: number;
  is_active: boolean;
  created_at: string;
  merchant?: { name: string; slug: string; logo_url: string | null } | null;
};

export type Voucher = {
  id: string;
  coupon_id: string;
  user_id: string;
  code: string;
  expires_at: string;
  clicks: number;
  last_clicked_at: string | null;
  created_at: string;
  coupon?: Coupon | null;
};
