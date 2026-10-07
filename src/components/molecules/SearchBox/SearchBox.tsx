import { FormEvent, FunctionComponent } from 'react';
import { Icon } from '../../atoms';
import styles from './SearchBox.module.css';

export type SearchBoxProps = {
  placeholder: string;
};

const SearchBox: FunctionComponent<SearchBoxProps> = ({ placeholder }) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  return (
    <form className={styles.search} role="search" onSubmit={handleSubmit}>
      <input
        className={styles.input}
        type="search"
        name="q"
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
      />
      <button type="submit" className={styles.submit} aria-label="Buscar">
        <Icon name="search" size={18} />
      </button>
    </form>
  );
};

export default SearchBox;
