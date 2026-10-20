import { FunctionComponent, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Download, Share2, Ticket as TicketIcon } from 'lucide-react';
import SiteHeader from '../components/organisms/SiteHeader/SiteHeader';
import { formatDateTime, loadPurchase, paymentLabel, ticketUrl, useTicketIds, type Purchase } from '../lib/compras';
import { STORES, formatPrice } from '../lib/precios';
import styles from './Compra.module.css';

const POLL_MS = 5_000;
const POLL_FOR_MS = 3 * 60_000;

const dni = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

const StatusBanner: FunctionComponent<{ purchase: Purchase }> = ({ purchase }) => {
  if (purchase.payment.provider === 'demo')
    return (
      <p className={styles.bannerDemo}>
        <AlertTriangle size={18} aria-hidden="true" /> Ticket de prueba: la API corre sin credenciales de Mercado Pago, así que el pago se aprobó solo.
      </p>
    );
  if (purchase.status === 'pagado')
    return (
      <p className={styles.bannerOk}>
        <CheckCircle2 size={18} aria-hidden="true" /> Ticket válido · pagado el {formatDateTime(purchase.paidAt ?? purchase.createdAt)}
      </p>
    );
  if (purchase.status === 'rechazado')
    return (
      <p className={styles.bannerError}>
        <AlertTriangle size={18} aria-hidden="true" /> Mercado Pago rechazó el pago. Podés intentar de nuevo con otro medio.
        {purchase.checkoutUrl ? <a href={purchase.checkoutUrl}>Volver a pagar</a> : null}
      </p>
    );
  return (
    <p className={styles.bannerWait}>
      <Clock size={18} aria-hidden="true" /> Esperando que Mercado Pago confirme el pago. Esta página se actualiza sola.
      {purchase.checkoutUrl ? <a href={purchase.checkoutUrl}>Ir a pagar</a> : null}
    </p>
  );
};

/** El ticket tal como se ve en el teléfono: es lo mismo que sale en el PDF. */
const TicketCard: FunctionComponent<{ purchase: Purchase }> = ({ purchase }) => {
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const store = STORES[purchase.store];
  const valid = purchase.status === 'pagado';

  useEffect(() => {
    let alive = true;
    void import('../lib/ticketQr').then(({ qrDataUrl }) => qrDataUrl(purchase)).then((value) => alive && setQr(value));
    return () => {
      alive = false;
    };
  }, [purchase]);

  const download = async () => {
    setBusy(true);
    try {
      const { downloadTicketPdf } = await import('../lib/ticketPdf');
      await downloadTicketPdf(purchase);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const data = { title: `Ticket SPOT ${purchase.code}`, text: `${purchase.product.name} · retiro en ${purchase.branch.name}`, url: ticketUrl(purchase) };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(data.url);
    } catch {
      // Compartir cancelado.
    }
  };

  return (
    <article className={styles.ticket} aria-labelledby="ticket-codigo">
      <header className={styles.ticketHead}>
        <div>
          <span className={styles.ticketBrand}>SPOT</span>
          <small>Ticket de compra</small>
        </div>
        <div className={styles.ticketCode}>
          <small>Código</small>
          <b id="ticket-codigo">{purchase.code}</b>
        </div>
      </header>

      <section className={styles.ticketProduct}>
        <div className={styles.well}>
          <img src={purchase.product.thumb} alt="" />
        </div>
        <div>
          <p className={styles.kicker}>
            {purchase.product.brand} · {purchase.product.type}
          </p>
          <h1 className={styles.ticketName}>{purchase.product.name}</h1>
          <p className={styles.muted}>
            Talle {purchase.product.size.replace('.', ',')} (AR) · Cantidad 1 · Cód. {purchase.product.id.toUpperCase()}
          </p>
          <p className={styles.ticketPrice}>
            {formatPrice(purchase.price)}
            {purchase.listPrice && purchase.listPrice > purchase.price ? <s>{formatPrice(purchase.listPrice)}</s> : null}
          </p>
        </div>
      </section>

      <div className={styles.ticketGrid}>
        <section>
          <h2>Retirás en</h2>
          <b>{store.name}</b>
          <span>{purchase.branch.name}</span>
          <span>
            {purchase.branch.address}, {purchase.branch.city} ({purchase.branch.postalCode}), {purchase.branch.province}
          </span>
          {purchase.branch.hours ? <span>{purchase.branch.hours.replace(/ \| /g, ' · ')}</span> : null}
          {purchase.branch.phone ? <span>{purchase.branch.phone}</span> : null}
          <a href={store.site} target="_blank" rel="noopener noreferrer">
            {store.site.replace(/^https?:\/\//, '')}
          </a>
        </section>
        <section>
          <h2>Comprador</h2>
          <b>{purchase.buyer.name}</b>
          <span>DNI {dni(purchase.buyer.dni)}</span>
          <span>{purchase.buyer.email}</span>
          <span>{purchase.buyer.phone}</span>
        </section>
      </div>

      <section className={styles.ticketQr}>
        <div className={styles.qrBox}>{qr ? <img src={qr} alt={`QR del ticket ${purchase.code}`} /> : <span aria-hidden="true" />}</div>
        <div>
          <h2>{valid ? 'Mostrá este QR en el local' : 'El QR se activa con el pago'}</h2>
          <p className={styles.muted}>Presentá este ticket (en el teléfono o impreso) junto con tu DNI. En la tienda escanean el QR para confirmar la compra y te entregan las zapatillas.</p>
          <dl className={styles.ticketRows}>
            <div>
              <dt>Pago</dt>
              <dd>{paymentLabel(purchase)}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatDateTime(purchase.paidAt ?? purchase.createdAt)}</dd>
            </div>
            <div>
              <dt>N.º de operación</dt>
              <dd>{purchase.payment.paymentId ?? '—'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <footer className={styles.ticketFoot}>
        <span>
          <b>SPOT</b> · Comparador de precios y tienda de deportes. SPOT cobra el pago con Mercado Pago y {store.name} entrega el producto en la sucursal elegida.
        </span>
      </footer>

      <div className={styles.ticketActions}>
        <button type="button" className={styles.pay} onClick={download} disabled={busy}>
          <Download size={16} aria-hidden="true" /> {busy ? 'Armando el PDF…' : 'Descargar ticket (PDF)'}
        </button>
        <button type="button" className={styles.secondary} onClick={share}>
          <Share2 size={16} aria-hidden="true" /> Compartir
        </button>
      </div>
    </article>
  );
};

export const TicketPage: FunctionComponent = () => {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState('');
  useDocumentTitle(purchase ? `Ticket ${purchase.code} — SPOT` : 'Ticket — SPOT');

  // Mercado Pago vuelve con ?payment_id=…: se confirma enseguida. Si sigue pendiente, se vuelve a preguntar un rato.
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const started = Date.now();
    const load = (paymentId?: string | null) =>
      loadPurchase(id, paymentId)
        .then((value) => {
          if (!alive) return;
          setPurchase(value);
          if (value.status === 'pendiente' && Date.now() - started < POLL_FOR_MS) timer = window.setTimeout(() => load(), POLL_MS);
        })
        .catch((reason: Error) => alive && setError(reason.message));
    void load(params.get('payment_id') ?? params.get('collection_id'));
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.mainNarrow} id="contenido">
        <Link to="/tickets" className={styles.back}>
          <TicketIcon size={15} aria-hidden="true" /> Mis tickets
        </Link>
        {error ? (
          <p className={styles.note} role="alert">
            {error}
          </p>
        ) : !purchase ? (
          <p className={styles.note} role="status">
            Cargando el ticket…
          </p>
        ) : (
          <>
            <StatusBanner purchase={purchase} />
            <TicketCard purchase={purchase} />
          </>
        )}
      </main>
    </div>
  );
};

export const MyTickets: FunctionComponent = () => {
  const ids = useTicketIds();
  const [items, setItems] = useState<Purchase[] | null>(null);
  useDocumentTitle('Mis tickets — SPOT');

  useEffect(() => {
    let alive = true;
    Promise.allSettled(ids.map((id) => loadPurchase(id))).then((results) => {
      if (alive) setItems(results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])));
    });
    return () => {
      alive = false;
    };
  }, [ids]);

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.mainNarrow} id="contenido">
        <p className={styles.kicker}>TUS COMPRAS CON SPOT</p>
        <h1 className={styles.title}>Mis tickets</h1>
        <p className={styles.muted}>Los tickets de las compras hechas desde este navegador. Tocá uno para ver el QR o descargarlo en PDF.</p>
        {!items ? (
          <p className={styles.note} role="status">
            Cargando…
          </p>
        ) : items.length === 0 ? (
          <p className={styles.note}>
            Todavía no compraste nada con SPOT. <Link to="/tienda">Mirá la tienda de zapatillas</Link>.
          </p>
        ) : (
          <ul className={styles.ticketList}>
            {items.map((item) => (
              <li key={item.id}>
                <Link to={`/ticket/${item.id}`} className={styles.ticketRow}>
                  <span className={styles.wellSmall}>
                    <img src={item.product.thumb} alt="" loading="lazy" />
                  </span>
                  <span className={styles.ticketRowMain}>
                    <b>{item.product.name}</b>
                    <small>
                      {item.code} · Talle {item.product.size.replace('.', ',')} · {item.branch.name}
                    </small>
                  </span>
                  <span className={styles.ticketRowSide}>
                    <b>{formatPrice(item.price)}</b>
                    <small className={item.status === 'pagado' ? styles.okText : styles.waitText}>{item.payment.provider === 'demo' ? 'Prueba' : item.status === 'pagado' ? 'Pagado' : item.status === 'rechazado' ? 'Rechazado' : 'Pendiente'}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};
