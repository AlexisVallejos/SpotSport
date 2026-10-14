import { FunctionComponent, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../components/atoms';
import styles from './Legal.module.css';

// Privacidad y términos: lo que la web hace de verdad con los datos y con los precios.
const Legal: FunctionComponent = () => {
  const { hash } = useLocation();

  useEffect(() => {
    const previous = document.title;
    document.title = 'Privacidad y términos — SPOT';
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash]);

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link to="/" className={styles.back}>
          <Icon name="arrowLeft" size={18} /> SPOT
        </Link>
        <nav className={styles.links} aria-label="Secciones">
          <a href="#privacidad">Privacidad</a>
          <a href="#terminos">Términos</a>
        </nav>
      </header>

      <main className={styles.main} id="contenido">
        <h1 className={styles.title}>
          PRIVACIDAD
          <br />Y TÉRMINOS.
        </h1>
        <p className={styles.lead}>Qué datos guarda SPOT, para qué, y cómo funcionan los precios que mostramos. Sin letra chica.</p>

        <section id="privacidad" className={styles.section} aria-labelledby="privacidad-titulo">
          <h2 id="privacidad-titulo">Privacidad</h2>
          <h3>Favoritos del comparador</h3>
          <p>Se guardan sólo en tu navegador (almacenamiento local). No viajan a ningún servidor: si borrás los datos del sitio o cambiás de dispositivo, se pierden.</p>
          <h3>Reseñas</h3>
          <p>Cuando dejás una reseña guardamos el nombre que escribas, las estrellas, el texto y la fecha, y se muestran públicamente en el producto. No te pedimos mail ni cuenta. Usá un nombre de pila o un apodo.</p>
          <h3>Newsletter</h3>
          <p>Si dejás tu mail en «Seguí en movimiento» guardamos el mail y la fecha, sólo para contarte novedades de SPOT. No lo compartimos. Para darte de baja, escribí el mismo mail en el formulario y elegí «Darme de baja»: se borra de la lista.</p>
          <h3>Límites anti-spam</h3>
          <p>Para frenar abusos contamos cuántas reseñas y suscripciones llegan desde una misma conexión en la última hora. Ese conteo vive en la memoria del servidor y no se guarda.</p>
          <h3>Tienda y cuentas</h3>
          <p>Si creás una cuenta en la Tienda SPOT, tus datos de registro y tus compras se guardan en la base de datos de la tienda para poder gestionar pedidos.</p>
          <h3>Fotos de productos</h3>
          <p>Las fotos del comparador se cargan directamente desde las webs de cada tienda, así que tu navegador se conecta a esas webs al verlas.</p>
        </section>

        <section id="terminos" className={styles.section} aria-labelledby="terminos-titulo">
          <h2 id="terminos-titulo">Términos</h2>
          <h3>Los precios son informativos</h3>
          <p>El comparador muestra los precios publicados en las webs de Open Sports, Dexter y Trip Store, y se actualiza cada 6 horas. Entre una actualización y otra el precio, el stock o las cuotas pueden cambiar: el precio final es el que figura en la tienda al comprar.</p>
          <h3>La compra la hacés en la tienda</h3>
          <p>Desde el comparador no se vende nada: el botón «Ver» te lleva a la página del producto en cada tienda, y la compra, el envío y los cambios son con esa tienda.</p>
          <h3>Mismo producto, mismo código</h3>
          <p>Cruzamos los productos por el código del fabricante, que identifica el modelo y el color. Si una tienda publica un código o un precio equivocado, también se va a ver equivocado acá.</p>
          <h3>Reseñas</h3>
          <p>Las reseñas tienen que hablar del producto. No se aceptan enlaces, y podemos borrar las que sean ofensivas, publicidad o no tengan que ver con el producto.</p>
          <h3>Marcas</h3>
          <p>SPOT no pertenece a Open Sports, Dexter ni Trip Store. Los nombres, marcas y fotos de productos son de sus respectivos dueños y se muestran sólo para identificar cada producto.</p>
        </section>
      </main>
    </div>
  );
};

export default Legal;
