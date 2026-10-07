import { FunctionComponent } from 'react';
import { Icon, Text } from '../../atoms';
import styles from './SearchBox.module.css';

export type SearchBoxProps = {
  placeholder: string;
};

const SearchBox: FunctionComponent<SearchBoxProps> = ({ placeholder }) => {
  return (
    <div className={styles.search}>
      <Text>{placeholder}</Text>
      <Icon size={18} />
    </div>
  );
};

export default SearchBox;
