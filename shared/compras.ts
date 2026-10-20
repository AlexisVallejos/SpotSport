// Compras hechas con SPOT y sus tickets. Tipos compartidos entre la API (server/) y la web (src/).
import type { StoreId } from './precios';
import type { Branch } from './sucursales';

export type PurchaseStatus = 'pendiente' | 'pagado' | 'rechazado';

/** Talles argentinos que se pueden elegir al comprar zapatillas. */
export const SIZES = ['34', '35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40', '40.5', '41', '41.5', '42', '42.5', '43', '44', '45', '46'];

export type Buyer = {
  name: string;
  dni: string;
  email: string;
  phone: string;
};

export type Purchase = {
  /** Id largo y al azar: es lo que va en el link y en el QR del ticket. */
  id: string;
  /** Código corto y legible para decir en el mostrador: "SPOT-7K3Q-9XA2". */
  code: string;
  createdAt: string;
  paidAt: string | null;
  status: PurchaseStatus;
  payment: {
    /** "demo" cuando la API corre sin credenciales de Mercado Pago. */
    provider: 'mercadopago' | 'demo';
    paymentId: string | null;
    /** "visa", "account_money"… tal como lo informa Mercado Pago. */
    method: string | null;
    installments: number | null;
  };
  product: {
    id: string;
    name: string;
    brand: string;
    type: string;
    thumb: string;
    size: string;
    /** Página del producto en la tienda. */
    url: string;
  };
  store: StoreId;
  branch: Branch;
  price: number;
  listPrice: number | null;
  buyer: Buyer;
  /** Checkout de Mercado Pago de esta compra, para volver a intentar si el pago no salió. */
  checkoutUrl: string | null;
};

export type PurchaseRequest = {
  productId: string;
  store: StoreId;
  branchId: string;
  size: string;
  buyer: Buyer;
};

export type PurchaseStart = {
  id: string;
  /** A dónde mandar al comprador: el checkout de Mercado Pago o, en modo prueba, directo al ticket. */
  checkoutUrl: string;
};
