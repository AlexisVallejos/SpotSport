import { FormEvent, FunctionComponent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, MapPin, ShieldCheck } from 'lucide-react';
import SiteHeader from '../components/organisms/SiteHeader/SiteHeader';
import { useAuth } from '../context/AuthContext';
import { BRANCHES, SIZES, rememberTicket, startPurchase, type Branch, type Buyer } from '../lib/compras';
import { STORES, formatPrice, loadDetail, type ProductDetail, type StoreId } from '../lib/precios';
import styles from './Compra.module.css';

const BUYER_KEY = 'spot:comprador';

function savedBuyer(): Partial<Buyer> {
  try {
    return JSON.parse(localStorage.getItem(BUYER_KEY) ?? '{}') as Partial<Buyer>;
  } catch {
    return {};
  }
}

/** Sucursales agrupadas por provincia, para el desplegable. */
function byProvince(branches: Branch[]) {
  const groups = new Map<string, Branch[]>();
  for (const branch of branches) groups.set(branch.province, [...(groups.get(branch.province) ?? []), branch]);
  return [...groups];
}

const Comprar: FunctionComponent = () => {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [store, setStore] = useState<StoreId | null>((params.get('tienda') as StoreId) || null);
  const [branchId, setBranchId] = useState('');
  const [size, setSize] = useState('');
  const [buyer, setBuyer] = useState<Buyer>(() => ({ name: '', dni: '', email: '', phone: '', ...savedBuyer() }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Comprar con SPOT';
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    loadDetail(id)
      .then((value) => alive && setDetail(value))
      .catch((reason: Error) => alive && setLoadError(reason.message));
    return () => {
      alive = false;
    };
  }, [id]);

  // Con sesión iniciada, lo que falte se completa con el perfil.
  useEffect(() => {
    if (!profile) return;
    setBuyer((current) => ({ ...current, name: current.name || profile.full_name, email: current.email || profile.email, phone: current.phone || profile.phone }));
  }, [profile]);

  const product = detail?.product ?? null;
  const offers = product?.offers ?? [];
  const offer = offers.find((item) => item.store === store) ?? offers[0] ?? null;
  const branches = useMemo(() => (offer ? BRANCHES[offer.store] : []), [offer]);
  const branch = branches.find((item) => item.id === branchId) ?? null;

  // Si la tienda del link no lo vende (o no vino ninguna), queda la más barata.
  useEffect(() => {
    if (offer && offer.store !== store) setStore(offer.store);
  }, [offer, store]);

  const patch = (field: keyof Buyer) => (event: { target: { value: string } }) => setBuyer((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!offer) return;
    if (!size) return setError('Elegí tu talle.');
    if (!branch) return setError('Elegí la sucursal donde las vas a retirar.');
    setError('');
    setBusy(true);
    try {
      try {
        localStorage.setItem(BUYER_KEY, JSON.stringify(buyer));
      } catch {
        // Sin almacenamiento se vuelven a escribir la próxima vez.
      }
      const started = await startPurchase({ productId: id, store: offer.store, branchId: branch.id, size, buyer });
      rememberTicket(started.id);
      if (/^https?:\/\//.test(started.checkoutUrl)) window.location.assign(started.checkoutUrl);
      else navigate(started.checkoutUrl, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos iniciar el pago.');
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main} id="contenido">
        <Link to="/tienda" className={styles.back}>
          <ArrowLeft size={15} aria-hidden="true" /> Volver a la tienda
        </Link>

        {loadError ? (
          <p className={styles.note} role="alert">
            {loadError}
          </p>
        ) : !product ? (
          <p className={styles.note} role="status">
            Cargando el producto…
          </p>
        ) : product.type !== 'Zapatillas' ? (
          <p className={styles.note}>Por ahora con SPOT se compran sólo zapatillas.</p>
        ) : (
          <form className={styles.checkout} onSubmit={submit} noValidate>
            <div className={styles.steps}>
              <header className={styles.productHead}>
                <div className={styles.well}>
                  <img src={detail?.images[0] ?? product.thumb} alt="" />
                </div>
                <div>
                  <p className={styles.kicker}>
                    {product.brand} · {product.type}
                  </p>
                  <h1 className={styles.title}>{product.name}</h1>
                  <p className={styles.muted}>Pagás en SPOT con Mercado Pago y las retirás en la sucursal que elijas, con tu ticket.</p>
                </div>
              </header>

              <fieldset className={styles.block}>
                <legend>
                  <span className={styles.number}>1</span> ¿En qué tienda?
                </legend>
                <div className={styles.options}>
                  {offers.map((item, index) => (
                    <label key={item.store} className={item.store === offer?.store ? styles.optionOn : styles.option}>
                      <input
                        type="radio"
                        name="tienda"
                        checked={item.store === offer?.store}
                        onChange={() => {
                          setStore(item.store);
                          setBranchId('');
                        }}
                      />
                      <span className={styles.optionMain}>
                        <b>{STORES[item.store].name}</b>
                        <small>{item.installments ?? 'Consultá cuotas en Mercado Pago'}</small>
                      </span>
                      <span className={styles.optionPrice}>
                        {index === 0 && offers.length > 1 ? <em>Mejor precio</em> : null}
                        <b>{formatPrice(item.price)}</b>
                        {item.listPrice ? <s>{formatPrice(item.listPrice)}</s> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className={styles.block}>
                <legend>
                  <span className={styles.number}>2</span> Tu talle <small>(AR)</small>
                </legend>
                <div className={styles.sizes} role="radiogroup" aria-label="Talle">
                  {SIZES.map((value) => (
                    <label key={value} className={value === size ? styles.sizeOn : styles.size}>
                      <input type="radio" name="talle" value={value} checked={value === size} onChange={() => setSize(value)} />
                      {value.replace('.', ',')}
                    </label>
                  ))}
                </div>
                <p className={styles.hint}>La tienda confirma el stock del talle al preparar tu pedido.</p>
              </fieldset>

              <fieldset className={styles.block}>
                <legend>
                  <span className={styles.number}>3</span> ¿Dónde las retirás?
                </legend>
                <label className={styles.field}>
                  <span>Sucursal de {offer ? STORES[offer.store].name : ''}</span>
                  <select value={branchId} onChange={(event) => setBranchId(event.target.value)} required>
                    <option value="">Elegí una sucursal ({branches.length})</option>
                    {byProvince(branches).map(([province, items]) => (
                      <optgroup key={province} label={province}>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.city} · {item.name} — {item.address}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                {branch ? (
                  <div className={styles.branch}>
                    <MapPin size={18} aria-hidden="true" />
                    <div>
                      <b>{branch.name}</b>
                      <span>
                        {branch.address}, {branch.city} ({branch.postalCode}), {branch.province}
                      </span>
                      {branch.hours ? <span>{branch.hours.replace(/ \| /g, ' · ')}</span> : null}
                      {branch.phone ? <span>{branch.phone}</span> : null}
                    </div>
                  </div>
                ) : null}
              </fieldset>

              <fieldset className={styles.block}>
                <legend>
                  <span className={styles.number}>4</span> Tus datos
                </legend>
                <p className={styles.hint}>Van en el ticket: en el local te piden el DNI para entregarte las zapatillas.</p>
                <div className={styles.fields}>
                  <label className={styles.field}>
                    <span>Nombre y apellido</span>
                    <input value={buyer.name} onChange={patch('name')} autoComplete="name" required />
                  </label>
                  <label className={styles.field}>
                    <span>DNI</span>
                    <input value={buyer.dni} onChange={patch('dni')} inputMode="numeric" autoComplete="off" placeholder="Sólo números" required />
                  </label>
                  <label className={styles.field}>
                    <span>Mail</span>
                    <input type="email" value={buyer.email} onChange={patch('email')} autoComplete="email" required />
                  </label>
                  <label className={styles.field}>
                    <span>Teléfono</span>
                    <input type="tel" value={buyer.phone} onChange={patch('phone')} autoComplete="tel" required />
                  </label>
                </div>
              </fieldset>
            </div>

            <aside className={styles.summary} aria-label="Resumen de la compra">
              <h2>Tu compra</h2>
              <dl>
                <div>
                  <dt>Producto</dt>
                  <dd>{product.name}</dd>
                </div>
                <div>
                  <dt>Talle</dt>
                  <dd>{size ? size.replace('.', ',') : '—'}</dd>
                </div>
                <div>
                  <dt>Tienda</dt>
                  <dd>{offer ? STORES[offer.store].name : '—'}</dd>
                </div>
                <div>
                  <dt>Retiro</dt>
                  <dd>{branch ? `${branch.city} · ${branch.address}` : '—'}</dd>
                </div>
              </dl>
              <div className={styles.total}>
                <span>Total</span>
                <b>{offer ? formatPrice(offer.price) : '—'}</b>
              </div>
              {error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className={styles.pay} disabled={busy || !offer}>
                <Lock size={16} aria-hidden="true" /> {busy ? 'Abriendo Mercado Pago…' : 'Pagar con Mercado Pago'}
              </button>
              <p className={styles.secure}>
                <ShieldCheck size={15} aria-hidden="true" /> Pagás en Mercado Pago. Al volver, tu ticket con QR queda listo para descargar.
              </p>
            </aside>
          </form>
        )}
      </main>
    </div>
  );
};

export default Comprar;
