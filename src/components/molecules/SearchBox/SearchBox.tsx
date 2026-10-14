import { FormEvent, FunctionComponent, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../atoms';
import { STORES, formatPrice, preciosLink, searchProducts, type Product } from '../../../lib/precios';
import styles from './SearchBox.module.css';

export type SearchBoxProps = {
  placeholder: string;
};

const SUGGESTIONS = 5;

// Busca en el comparador: mientras escribís sugiere productos; Enter abre todos los resultados.
const SearchBox: FunctionComponent<SearchBoxProps> = ({ placeholder }) => {
  const navigate = useNavigate();
  const listId = useId();
  const boxRef = useRef<HTMLFormElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ total: number; items: Product[] } | null>(null);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchProducts({ q, limit: SUGGESTIONS }, controller.signal)
        .then((value) => setResults({ total: value.total, items: value.items }))
        .catch(() => {
          if (!controller.signal.aborted) setResults(null);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  // Se cierra al tocar afuera.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOpen(false);
    navigate(preciosLink({ q: text.trim() }));
  };

  const showList = open && results !== null && text.trim().length >= 2;

  return (
    <form ref={boxRef} className={styles.search} role="search" onSubmit={handleSubmit} onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
      <input
        className={styles.input}
        type="search"
        name="q"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-controls={listId}
        aria-expanded={showList}
        autoComplete="off"
      />
      <button type="submit" className={styles.submit} aria-label="Buscar">
        <Icon name="search" size={18} />
      </button>
      {showList ? (
        <div id={listId} className={styles.results}>
          {results.items.length === 0 ? (
            <p className={styles.empty}>No encontramos «{text.trim()}» en Open Sports, Dexter ni Trip Store.</p>
          ) : (
            <ul>
              {results.items.map((product) => (
                <li key={product.id}>
                  <Link to={`/precios/${encodeURIComponent(product.id)}?${new URLSearchParams({ q: text.trim() })}`} className={styles.result} onClick={() => setOpen(false)}>
                    <img src={product.thumb} alt="" loading="lazy" />
                    <span className={styles.resultText}>
                      <b>{product.name}</b>
                      <span>
                        {formatPrice(product.best)} en {STORES[product.offers[0].store].name}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {results.total > results.items.length ? (
            <button type="submit" className={styles.all}>
              Ver los {results.total.toLocaleString('es-AR')} resultados
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
};

export default SearchBox;
