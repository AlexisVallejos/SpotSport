// El ticket de una compra en PDF (A5). Se carga sólo al tocar "Descargar": jsPDF y el QR no pesan en el resto del sitio.
import { GState, jsPDF } from 'jspdf';
import { STORES } from '../../shared/precios';
import { formatDateTime, paymentLabel, ticketUrl, type Purchase } from './compras';
import { formatPrice } from './precios';
import { qrDataUrl } from './ticketQr';

const INK = '#080808';
const ORANGE = '#ff7900';
const MUTED = '#6b6d72';
const LINE = '#e3e1da';
const PAPER = '#f6f5f1';

async function asDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    // Sin foto (la tienda no respondió): el ticket sale igual.
    return null;
  }
}

async function loadBarlow(doc: jsPDF) {
  try {
    const buffer = await (await fetch('/fonts/BarlowCondensed-ExtraBold.ttf')).arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    doc.addFileToVFS('BarlowCondensed-ExtraBold.ttf', btoa(binary));
    doc.addFont('BarlowCondensed-ExtraBold.ttf', 'Barlow', 'normal');
    return 'Barlow';
  } catch {
    return 'helvetica';
  }
}

export async function downloadTicketPdf(purchase: Purchase) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const [display, qr, photo] = await Promise.all([loadBarlow(doc), qrDataUrl(purchase), asDataUrl(`/api/compras/${purchase.id}/foto`)]);
  const W = 148;
  const M = 10;
  const store = STORES[purchase.store];
  const paid = purchase.status === 'pagado';
  const demo = purchase.payment.provider === 'demo';

  const label = (text: string, x: number, y: number) => {
    doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(MUTED);
    doc.text(text.toUpperCase(), x, y, { charSpace: 0.35 });
  };
  const body = (text: string, x: number, y: number, width: number, size = 8.5, color = INK, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(color);
    const lines = doc.splitTextToSize(text, width) as string[];
    doc.text(lines, x, y);
    return y + lines.length * size * 0.42;
  };

  doc.setProperties({ title: `Ticket ${purchase.code} — SPOT`, subject: purchase.product.name, author: 'SPOT', creator: 'SPOT' });

  // Encabezado: marca, código y estado.
  doc.setFillColor(INK).rect(0, 0, W, 30, 'F');
  doc.setFont(display, 'normal').setFontSize(30).setTextColor(ORANGE).text('SPOT', M, 17);
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor('#c9cad0').text('TODO EL DEPORTE EN UN SOLO LUGAR', M, 23, { charSpace: 0.4 });
  doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor('#8a8c94').text('TICKET DE COMPRA', W - M, 11, { align: 'right', charSpace: 0.4 });
  doc.setFont(display, 'normal').setFontSize(17).setTextColor('#ffffff').text(purchase.code, W - M, 19, { align: 'right' });
  const status = demo ? 'PAGO DE PRUEBA' : paid ? 'PAGADO' : purchase.status === 'rechazado' ? 'PAGO RECHAZADO' : 'PAGO PENDIENTE';
  doc.setFont('helvetica', 'bold').setFontSize(6.5);
  const pillW = doc.getTextWidth(status) + 7;
  doc.setFillColor(paid && !demo ? '#36c26a' : demo ? '#ffb347' : '#ff9d8a').roundedRect(W - M - pillW, 22, pillW, 5, 2.5, 2.5, 'F');
  doc.setTextColor(INK).text(status, W - M - pillW / 2, 25.4, { align: 'center' });

  // Producto.
  let y = 38;
  doc.setFillColor(PAPER).roundedRect(M, y, W - 2 * M, 34, 3, 3, 'F');
  let textX = M + 5;
  if (photo) {
    doc.setFillColor('#ffffff').roundedRect(M + 3, y + 3, 28, 28, 2, 2, 'F');
    try {
      doc.addImage(photo, M + 4, y + 4, 26, 26, undefined, 'FAST');
    } catch {
      // Formato que jsPDF no lee: queda el recuadro.
    }
    textX = M + 35;
  }
  label(`${purchase.product.brand} · ${purchase.product.type}`, textX, y + 8);
  doc.setFont(display, 'normal').setFontSize(15).setTextColor(INK);
  const nameLines = (doc.splitTextToSize(purchase.product.name.toUpperCase(), W - M - 5 - textX) as string[]).slice(0, 2);
  doc.text(nameLines, textX, y + 14.5);
  const afterName = y + 14.5 + nameLines.length * 5.6;
  body(`Talle ${purchase.product.size} (AR) · Cantidad 1 · Cód. ${purchase.product.id.toUpperCase()}`, textX, afterName, W - M - 5 - textX, 7.5, MUTED);
  doc.setFont(display, 'normal').setFontSize(18).setTextColor(INK).text(formatPrice(purchase.price), W - M - 5, y + 29.5, { align: 'right' });
  if (purchase.listPrice && purchase.listPrice > purchase.price) {
    // Precio de lista tachado, a la izquierda del precio pagado.
    const listX = W - M - 5 - doc.getTextWidth(formatPrice(purchase.price)) - 3;
    const list = formatPrice(purchase.listPrice);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(MUTED).text(list, listX, y + 29.5, { align: 'right' });
    doc.setDrawColor(MUTED).setLineWidth(0.2).line(listX - doc.getTextWidth(list), y + 28.2, listX, y + 28.2);
  }

  // Dónde se retira y quién compra.
  y = 80;
  const col = (W - 2 * M - 6) / 2;
  label('Retirás en', M, y);
  let left = body(store.name, M, y + 5, col, 10, INK, 'bold');
  left = body(purchase.branch.name, M, left + 0.5, col, 8.5);
  left = body(`${purchase.branch.address}, ${purchase.branch.city} (${purchase.branch.postalCode}), ${purchase.branch.province}`, M, left + 0.5, col, 8, MUTED);
  if (purchase.branch.hours) left = body(purchase.branch.hours.replace(/ \| /g, ' · '), M, left + 0.5, col, 7.5, MUTED);
  if (purchase.branch.phone) left = body(purchase.branch.phone, M, left + 0.5, col, 7.5, MUTED);
  left = body(store.site.replace(/^https?:\/\//, ''), M, left + 0.5, col, 7.5, MUTED);

  const rightX = M + col + 6;
  label('Comprador', rightX, y);
  let right = body(purchase.buyer.name, rightX, y + 5, col, 10, INK, 'bold');
  right = body(`DNI ${purchase.buyer.dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`, rightX, right + 0.5, col, 8.5);
  right = body(purchase.buyer.email, rightX, right + 0.5, col, 8, MUTED);
  right = body(purchase.buyer.phone, rightX, right + 0.5, col, 8, MUTED);

  // QR y pago.
  y = Math.max(left, right) + 5;
  doc.setDrawColor(LINE).setLineWidth(0.3).setLineDashPattern([1.2, 1.2], 0).line(M, y, W - M, y).setLineDashPattern([], 0);
  y += 5;
  const qrSize = 44;
  doc.addImage(qr, 'PNG', M, y, qrSize, qrSize);
  const infoX = M + qrSize + 7;
  const infoW = W - M - infoX;
  doc.setFont(display, 'normal').setFontSize(14).setTextColor(INK).text('MOSTRÁ ESTE QR EN EL LOCAL', infoX, y + 6);
  let info = body('Presentá este ticket (en el teléfono o impreso) junto con tu DNI. En la tienda escanean el QR para confirmar la compra y te entregan el producto.', infoX, y + 11, infoW, 7.5, MUTED);
  info += 2;
  const rows: [string, string][] = [
    ['Pago', paymentLabel(purchase)],
    ['Fecha', formatDateTime(purchase.paidAt ?? purchase.createdAt)],
    ['N.º de operación', purchase.payment.paymentId ?? '—'],
  ];
  for (const [key, value] of rows) {
    label(key, infoX, info + 2);
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(INK).text(value, W - M, info + 2, { align: 'right' });
    info += 5;
  }

  // Pie: datos de SPOT.
  const footY = 210 - 22;
  doc.setFillColor(PAPER).rect(0, footY, W, 22, 'F');
  doc.setFont(display, 'normal').setFontSize(11).setTextColor(INK).text('SPOT', M, footY + 7);
  body(
    `Comparador de precios y tienda de deportes. SPOT cobra el pago con Mercado Pago y ${store.name} entrega el producto en la sucursal elegida. Verificá este ticket en ${ticketUrl(purchase).replace(/^https?:\/\//, '')}`,
    M,
    footY + 11,
    W - 2 * M,
    6.5,
    MUTED,
  );
  if (demo) {
    // Marca de agua: un ticket de prueba no se confunde con uno pagado.
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.12 }));
    // Sobre los datos y no sobre el QR, para que se siga pudiendo escanear.
    doc.setFont(display, 'normal').setFontSize(64).setTextColor(ORANGE).text('PRUEBA', W / 2, 102, { align: 'center' });
    doc.restoreGraphicsState();
  }

  doc.save(`ticket-spot-${purchase.code}.pdf`);
}
