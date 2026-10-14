import { FunctionComponent, useEffect, useState } from 'react';
import { Icon } from '../../atoms';
import { openSpotSearch, shortcutLabel } from '../../../lib/spotSearch';
import styles from './SearchBox.module.css';

export type SearchBoxProps = {
  placeholder: string;
};

// Parece un campo, pero abre la búsqueda Spotlight (también con ⌘K o "/").
const SearchBox: FunctionComponent<SearchBoxProps> = ({ placeholder }) => {
  const [shortcut, setShortcut] = useState('');
  useEffect(() => setShortcut(shortcutLabel()), []);

  return (
    <button type="button" className={styles.search} onClick={() => openSpotSearch()} aria-label={`${placeholder} Abre la búsqueda.`} aria-keyshortcuts="Meta+K Control+K /">
      <Icon name="search" size={18} />
      <span className={styles.placeholder}>{placeholder}</span>
      {shortcut ? <kbd className={styles.kbd}>{shortcut}</kbd> : null}
    </button>
  );
};

export default SearchBox;
