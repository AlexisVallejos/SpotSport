import { Link } from 'react-router-dom';
import { Button, ButtonLink, Card, Empty, PageTitle } from '../../components/ui';
import { useCart } from '../../context/CartContext';
import { MAX_PER_LINE } from '../../lib/cart';
import { formatPrice } from '../../lib/money';
import styles from '../pages.module.css';

export default function CartPage() {
  const cart = useCart();

  if (cart.lines.length === 0) {
    return (
      <>
        <PageTitle title="Carrito" />
        <Empty title="Tu carrito está vacío">
          <p>
            <Link to="/tienda">Mirá lo que hay en la tienda</Link>
          </p>
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Carrito" subtitle={`${cart.itemCount} ${cart.itemCount === 1 ? 'producto' : 'productos'}`} actions={<Button variant="ghost" onClick={cart.clear}>Vaciar carrito</Button>} />
      <div className={styles.cartLayout}>
        <div>
          {cart.groups.map((group) => (
            <Card key={group.merchantId} title={group.merchantName} className={styles.group}>
              {group.lines.map((line) => (
                <div key={line.variantId} className={styles.line}>
                  <Link to={`/producto/${line.productId}`} className={styles.lineImage}>
                    {line.image ? <img src={line.image} alt="" /> : line.name.charAt(0)}
                  </Link>
                  <div>
                    <div className={styles.lineName}>{line.name}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{line.variantLabel}</div>
                    <div className={styles.qty} style={{ marginTop: 8 }}>
                      <button type="button" onClick={() => cart.setQuantity(line.variantId, line.quantity - 1)} aria-label="Menos">
                        −
                      </button>
                      <span>{line.quantity}</span>
                      <button type="button" onClick={() => cart.setQuantity(line.variantId, line.quantity + 1)} disabled={line.quantity >= Math.min(line.maxStock, MAX_PER_LINE)} aria-label="Más">
                        +
                      </button>
                    </div>
                  </div>
                  <div className={styles.lineRight}>
                    <span>{formatPrice(line.priceCents * line.quantity)}</span>
                    <Button variant="ghost" small onClick={() => cart.remove(line.variantId)}>
                      Quitar
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          ))}
          {cart.groups.length > 1 ? <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Tu compra se divide en un pedido por comercio: cada uno lo prepara y lo envía por separado.</p> : null}
        </div>

        <Card title="Resumen" className={styles.summary}>
          <div className={styles.sumRow}>
            <span>Productos ({cart.itemCount})</span>
            <span>{formatPrice(cart.subtotalCents)}</span>
          </div>
          <div className={`${styles.sumRow} ${styles.sumTotal}`}>
            <span>Total</span>
            <span>{formatPrice(cart.subtotalCents)}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>El precio y el stock se confirman al comprar.</p>
          <ButtonLink to="/checkout" block>
            Continuar compra
          </ButtonLink>
        </Card>
      </div>
    </>
  );
}
