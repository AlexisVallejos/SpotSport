import QRCode from 'qrcode';
import { ticketUrl, type Purchase } from './compras';

/** QR con el link público del ticket: lo escanea la tienda para ver que la compra existe y está paga. */
export const qrDataUrl = (purchase: Pick<Purchase, 'id'>) => QRCode.toDataURL(ticketUrl(purchase), { margin: 1, width: 640, errorCorrectionLevel: 'M', color: { dark: '#080808', light: '#ffffff' } });
