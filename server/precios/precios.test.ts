import { describe, expect, it } from 'vitest';
import { buildProducts } from './match';
import { cleanName, codeFromDexterPid, codeFromMagentoImage, codeFromMagentoUrl } from './names';
import { parseMagentoReviews, validateReview } from './reviews';
import { search } from './search';
import { parseDexterPage, parseMagentoPage, type Section } from './stores';

const shoes = (genders: Section['genders']): Section => ({ path: '/zapatillas', genders, category: 'calzado', type: 'Zapatillas' });
const apparel: Section = { path: '/indumentaria', genders: ['Mujer'], category: 'indumentaria' };
const urban: Section = { path: '/indumentaria', genders: ['Hombre'], category: 'indumentaria', defaultSports: ['Urbana'] };

// Fragmentos con la misma forma que el HTML público de cada tienda (octubre 2026).
const magentoItem = (id: number, slug: string, image: string, name: string, price: number, old?: number) => `
<li class="item product product-item">
  <div class="product-item-info" id="product-item-info_${id}" data-container="product-grid">
    <a href="https://www.opensports.com.ar/${slug}.html" class="product photo product-item-photo" tabindex="-1">
      <img class="product-image-photo" srcset="https://www.opensports.com.ar/media/catalog/product/cache/13f2762f70dade795124aae2788a0d51/${image} 224w,https://www.opensports.com.ar/media/catalog/product/cache/806f05431887e312fbcc843fc73cdd01/${image} 480w" src="https://www.opensports.com.ar/media/catalog/product/cache/13f2762f70dade795124aae2788a0d51/${image}" alt="${name}">
      <img class="hover-image product-image-photo" srcset src="https://www.opensports.com.ar/media/catalog/product/cache/13f2762f70dade795124aae2788a0d51/${image.replace('_0', '_2')}" loading="lazy">
    </a>
    <strong class="product name product-item-name">
      <a class="product-item-link" href="https://www.opensports.com.ar/${slug}.html">
        ${name}                            </a>
    </strong>
    <div class="price-box price-final_price">
      <span data-price-amount="${price}" data-price-type="finalPrice" class="price-wrapper price-including-tax"><span class="price">$ x</span></span>
      <span data-price-amount="${Math.round(price / 1.21)}" data-price-type="basePrice" class="price-wrapper price-excluding-tax"></span>
      ${old ? `<span class="old-price"><span data-price-amount="${old}" data-price-type="oldPrice" class="price-wrapper"></span></span>` : ''}
    </div>
    <div class="installments-price">
      12 cuotas de <span class="price">$ 21.666,58</span>                        </div>
  </div>
</li>`;

const magentoPage = (items: string) => `<p class="toolbar-amount"><span class="toolbar-number">1</span>-<span class="toolbar-number">36</span> de <span class="toolbar-number">918</span></p>
<ol class="products list items product-items">${items}</ol><footer>out-of-stock</footer>`;

const dexterItem = (pid: string, slug: string, name: string, price: number, list?: number) => `
<div class="product" data-pid="${pid}">
  <div class="product-tile">
    <div class="image-container"><a href="/${slug}/${pid}.html"><div class="product-image-container">
      <img class="tile-image primary-image"
        src="https://www.dexter.com.ar/dw/image/v2/BDTF_PRD/on/demandware.static/-/x/products/${pid}/${pid}-1.JPG?sw=600&amp;sh=600" alt="${name}" />
      <img class="tile-image second-image" src="https://www.dexter.com.ar/dw/image/v2/BDTF_PRD/on/demandware.static/-/x/products/${pid}/${pid}-2.JPG?sw=600&amp;sh=600" />
    </div></a></div>
    <div class="tile-body">
      <div class="pdp-link">
        <a class="link" href="/${slug}/${pid}.html" title="${name}">${name}</a>
      </div>
      <a href="/${slug}/${pid}.html"><div class="prices"><div class="price"><span>
        <span class="sales"> <span class="value" content="${price}.00" data-js-marketing-price/> $x </span>
        ${list ? `<del><span class="strike-through list"> <span class="value" content="${list}.00"> $y </span></span></del>` : ''}
      </span></div></div>
      <div class="installments-container pull-left"> <div> <div> <span> 2 cuotas sin inter&eacute;s de $27.500 </span> </div> </div> </div> </a>
    </div>
  </div>
</div>`;

describe('cleanName', () => {
  it('saca "Zapatillas", el uso y el género del nombre de Dexter', () => {
    expect(cleanName('Zapatillas Running Nike Downshifter 14 Mujer')).toEqual({
      name: 'Nike Downshifter 14',
      title: 'Downshifter 14',
      brand: 'Nike',
      type: 'Zapatillas',
      category: 'calzado',
      sports: ['Running'],
      genders: ['Mujer'],
    });
  });

  it('respeta la grafía de la marca y agrupa las líneas de adidas', () => {
    expect(cleanName('Zapatillas Adidas Adizero Evo SL')).toMatchObject({ name: 'adidas Adizero Evo SL', brand: 'adidas' });
    expect(cleanName('Zapatillas adidas Originals Samba OG')).toMatchObject({ name: 'adidas Originals Samba OG', brand: 'adidas' });
  });

  it('entiende el uso al final, unisex y mayúsculas raras', () => {
    expect(cleanName('Zapatillas ON Cloud 6 Running Hombre')).toMatchObject({ name: 'On Cloud 6', title: 'Cloud 6', brand: 'On', sports: ['Running'], genders: ['Hombre'] });
    expect(cleanName('Zapatillas Topper Squat Ii Unisex')).toMatchObject({ name: 'Topper Squat II', genders: ['Hombre', 'Mujer'] });
    expect(cleanName('Zapatillas Urbana adidas Duramo Sl2 Mujer')).toMatchObject({ name: 'adidas Duramo SL2', sports: ['Urbana'] });
  });

  it('reconoce el tipo de prenda o accesorio y lo deja en el nombre', () => {
    expect(cleanName('Remera Running Fila Bio III Flow Mujer')).toMatchObject({ name: 'Remera Fila Bio III Flow', title: 'Remera Bio III Flow', brand: 'Fila', type: 'Remera', category: 'indumentaria', sports: ['Running'], genders: ['Mujer'] });
    expect(cleanName('Buzo con Cierre Entrenamiento ON Focus Tech Mujer')).toMatchObject({ name: 'Buzo con cierre On Focus Tech', type: 'Buzo', sports: ['Training'] });
    expect(cleanName('Pack de Medias Puma Invisible Hombre')).toMatchObject({ name: 'Pack de Medias Puma Invisible', type: 'Medias', category: 'accesorios' });
    expect(cleanName('Botines Adidas F50 Messi League Laceless TF')).toMatchObject({ type: 'Botines', category: 'calzado', sports: ['Fútbol'] });
  });

  it('encuentra la marca aunque el club vaya antes y descarta palabras cortadas', () => {
    expect(cleanName('Camiseta Boca Juniors adidas Suplente 26 27 Mujer')).toMatchObject({ name: 'Camiseta adidas Boca Juniors Suplente 26 27', brand: 'adidas', sports: ['Fútbol'], genders: ['Mujer'] });
    expect(cleanName('Remera San Lorenzo Atomik Retro Slim Crop 2026 Mujer poliést...')).toMatchObject({ brand: 'Atomik', genders: ['Mujer'] });
    expect(cleanName('Camiseta Fanatics NBA Boston Celtics')).toMatchObject({ brand: 'Fanatics', sports: ['Básquet'] });
  });
});

describe('códigos de modelo', () => {
  it('lee el código desde la foto de Magento', () => {
    expect(codeFromMagentoImage('https://x/media/catalog/product/cache/abc/j/r/jr1912_0.jpg')).toBe('JR1912');
    expect(codeFromMagentoImage('https://x/media/catalog/product/5/5/553558-045_0_8.jpg')).toBe('553558045');
    expect(codeFromMagentoImage('https://x/media/catalog/product/placeholder/small_image.jpg')).toBeNull();
  });

  it('usa el final de la URL como respaldo, con el sufijo de color de Nike', () => {
    expect(codeFromMagentoUrl('https://x/zapatillas-nike-air-force-1-07-ih1698-001.html')).toBe('IH1698001');
    expect(codeFromMagentoUrl('https://x/zapatillas-puma-180-pro-40447202.html')).toBe('40447202');
  });

  it('quita el prefijo de marca de Dexter', () => {
    expect(codeFromDexterPid('NIFQ1831-001')).toBe('FQ1831001');
    expect(codeFromDexterPid('ADHP6010')).toBe('HP6010');
    expect(codeFromDexterPid('PU313740-02')).toBe('31374002');
  });
});

describe('parseMagentoPage', () => {
  const html = magentoPage(
    magentoItem(205525, 'zapatillas-adidas-adizero-evo-sl-jr1912', 'j/r/jr1912_0.jpg', 'Zapatillas Adidas Adizero Evo SL', 259999) +
      magentoItem(211412, 'zapatillas-dc-pure-3-se-cu1251112114', 'C/U/CU1251112114_0.jpg', 'Zapatillas DC Pure 3 SE', 69999, 144999),
  );
  const { items, total } = parseMagentoPage(html, 'opensports', shoes(['Hombre']));

  it('lee total, precios, cuotas y fotos', () => {
    expect(total).toBe(918);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ code: 'JR1912', clean: { name: 'adidas Adizero Evo SL' }, category: 'calzado', type: 'Zapatillas' });
    expect(items[0].offer).toMatchObject({
      storeProductId: '205525',
      url: 'https://www.opensports.com.ar/zapatillas-adidas-adizero-evo-sl-jr1912.html',
      price: 259999,
      listPrice: null,
      installments: '12 cuotas de $21.666,58',
      thumb: 'https://www.opensports.com.ar/media/catalog/product/cache/806f05431887e312fbcc843fc73cdd01/j/r/jr1912_0.jpg',
      images: ['https://www.opensports.com.ar/media/catalog/product/j/r/jr1912_0.jpg', 'https://www.opensports.com.ar/media/catalog/product/j/r/jr1912_2.jpg'],
      genders: ['Hombre'],
    });
  });

  it('toma el precio tachado sólo si es mayor', () => {
    expect(items[1].offer).toMatchObject({ price: 69999, listPrice: 144999 });
  });

  it('usa el deporte por defecto de la sección sólo si el nombre no dice otro', () => {
    const page = magentoPage(
      magentoItem(1, 'remera-nike-club-ab1234', 'a/b/ab1234_0.jpg', 'Remera Nike Club', 50000) + magentoItem(2, 'remera-nike-miler-cd5678', 'c/d/cd5678_0.jpg', 'Remera Nike Dri-FIT Miler Running', 60000),
    );
    const [club, miler] = parseMagentoPage(page, 'trip', urban).items;
    expect(club).toMatchObject({ category: 'indumentaria', type: 'Remera', sports: ['Urbana'] });
    expect(miler.sports).toEqual(['Running']);
  });
});

describe('parseDexterPage', () => {
  it('lee precio de oferta, precio de lista, cuotas y fotos', () => {
    const [item] = parseDexterPage(dexterItem('ADHP6010', 'zapatillas-adidas-vs-pace-2.0-hombre', 'Zapatillas adidas Vs Pace 2.0 Hombre', 54999, 94999), shoes(['Hombre']));
    expect(item.code).toBe('HP6010');
    expect(item.clean.name).toBe('adidas Vs Pace 2.0');
    expect(item.offer).toMatchObject({
      store: 'dexter',
      url: 'https://www.dexter.com.ar/zapatillas-adidas-vs-pace-2.0-hombre/ADHP6010.html',
      price: 54999,
      listPrice: 94999,
      installments: '2 cuotas sin interés de $27.500',
    });
    expect(item.offer.thumb).toMatch(/ADHP6010-1\.JPG\?sw=480&sh=480$/);
    expect(item.offer.images[0]).toMatch(/ADHP6010-1\.JPG\?sw=1000&sh=1000$/);
  });
});

describe('buildProducts', () => {
  const open = parseMagentoPage(magentoPage(magentoItem(1, 'zapatillas-nike-invincible-3-dr2660-008', 'd/r/dr2660-008_0.jpg', 'Zapatillas Nike Invincible 3', 179999, 349999)), 'opensports', shoes(['Mujer'])).items;
  const dexter = parseDexterPage(dexterItem('NIDR2660-008', 'zapatillas-nike-invincible-3-mujer', 'Zapatillas Nike Invincible 3 Mujer', 384999), shoes(['Mujer']));
  const unisex = parseDexterPage(dexterItem('TO25869', 'zapatillas-running-topper-vigo', 'Zapatillas Running Topper Vigo', 74999), shoes(['Hombre']));
  const unisexAgain = parseDexterPage(dexterItem('TO25869', 'zapatillas-running-topper-vigo', 'Zapatillas Running Topper Vigo', 74999), shoes(['Mujer']));
  const shirt = parseDexterPage(dexterItem('FIF12R00236160', 'remera-running-fila-bio-iii-flow-mujer', 'Remera Running Fila Bio III Flow Mujer', 39999, 59999), apparel);
  const products = buildProducts([...dexter, ...open, ...unisex, ...unisexAgain, ...shirt], (id) => (id === 'dr2660008' ? '2026-10-01' : '2026-10-13'));

  it('cruza el mismo código en dos tiendas y ordena de más barata a más cara', () => {
    const invincible = products.find((product) => product.id === 'dr2660008')!;
    expect(invincible.offers.map((offer) => offer.store)).toEqual(['opensports', 'dexter']);
    expect(invincible).toMatchObject({ name: 'Nike Invincible 3', title: 'Invincible 3', category: 'calzado', type: 'Zapatillas', best: 179999, worst: 384999, savings: 205000, discount: 49, genders: ['Mujer'], firstSeen: '2026-10-01' });
  });

  it('junta en una sola oferta el mismo producto listado en Hombre y en Mujer', () => {
    const vigo = products.find((product) => product.id === '25869')!;
    expect(vigo.offers).toHaveLength(1);
    expect(vigo.genders).toEqual(['Hombre', 'Mujer']);
    expect(vigo.savings).toBe(0);
    expect(vigo.sports).toEqual(['Running']);
  });

  describe('search', () => {
    it('filtra por categoría, deporte, tipo y búsqueda, y cuenta marcas y tipos', () => {
      const all = search(products, {});
      expect(all.total).toBe(3);
      expect(all.items[0].id).toBe('dr2660008'); // la única comparable va primero
      expect(all.items[0]).not.toHaveProperty('images');
      expect(search(products, { category: 'indumentaria' }).items.map((item) => item.type)).toEqual(['Remera']);
      expect(search(products, { sport: 'Running' }).items.map((item) => item.id).sort()).toEqual(['25869', 'f12r00236160']);
      expect(search(products, { q: 'remera fila' }).total).toBe(1);
      expect(search(products, { category: 'calzado' }).brands).toEqual([
        { value: 'Nike', count: 1 },
        { value: 'Topper', count: 1 },
      ]);
    });

    it('ordena, pagina y trae favoritos por id', () => {
      expect(search(products, { sort: 'menor' }).items.map((item) => item.best)).toEqual([39999, 74999, 179999]);
      expect(search(products, { sort: 'nuevos' }).items.at(-1)?.id).toBe('dr2660008');
      expect(search(products, { offset: 1, limit: 1 }).items).toHaveLength(1);
      expect(search(products, { ids: ['25869'] }).items.map((item) => item.id)).toEqual(['25869']);
      expect(search(products, { compared: true }).total).toBe(1);
    });

    it('en "ofertas" deja sólo lo rebajado', () => {
      const onSale = search(products, { onSale: true }).items;
      expect(onSale.length).toBeGreaterThan(0);
      expect(onSale.every((item) => item.discount >= 5)).toBe(true);
      expect(search(products, { onSale: true }).total).toBe(products.filter((item) => item.discount >= 5).length);
    });
  });
});

describe('reseñas', () => {
  it('lee la lista pública de Magento', () => {
    const html = `<ol class="items review-items"><li class="item review-item" itemscope itemprop="review">
      <div class="review-title" itemprop="name">Muy cómodas</div>
      <div class="rating-result" title="80%"><span><span itemprop="ratingValue">80%</span></span></div>
      <div class="review-content" itemprop="description">Las uso para correr 10&nbsp;km.</div>
      <p class="review-author"><strong class="review-details-value" itemprop="author">Caro</strong></p>
      <time class="review-details-value" itemprop="datePublished" datetime="2026-09-02">2/9/26</time>
    </li></ol>`;
    expect(parseMagentoReviews(html, 'trip')).toEqual([{ source: 'trip', author: 'Caro', title: 'Muy cómodas', text: 'Las uso para correr 10 km.', rating: 4, date: '2026-09-02' }]);
    expect(parseMagentoReviews('', 'trip')).toEqual([]);
  });

  it('valida las reseñas de SPOT', () => {
    expect(validateReview({ author: ' Ana ', rating: 5, text: 'Excelentes para caminar todo el día.' })).toEqual({ author: 'Ana', rating: 5, text: 'Excelentes para caminar todo el día.' });
    expect(validateReview({ author: 'Ana', rating: 6, text: 'Excelentes para caminar.' })).toMatch(/estrellas/);
    expect(validateReview({ author: 'Ana', rating: 4, text: 'corto' })).toMatch(/entre 10 y 600/);
    expect(validateReview({ author: 'Ana', rating: 4, text: 'Mirá www.ofertas.com ya mismo' })).toMatch(/enlaces/);
    expect(validateReview({ author: 'Bot', rating: 4, text: 'Texto suficientemente largo', website: 'x' })).toBe('No se pudo publicar.');
  });
});
