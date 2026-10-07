import { FunctionComponent } from 'react';
import { FilterTab, FilterTabProps } from '../../molecules';
import styles from './CollectionFilters.module.css';

export type CollectionFiltersProps = {
  filters: FilterTabProps[];
  disclosure: string;
};

const CollectionFilters: FunctionComponent<CollectionFiltersProps> = ({ filters, disclosure }) => {
  return (
    <div className={styles.collectionFilters}>
      <div className={styles.sportFilters}>
        {filters.map((filter) => (
          <FilterTab key={filter.label} {...filter} />
        ))}
      </div>
      <div className={styles.collectionDisclosure}>{disclosure}</div>
    </div>
  );
};

export default CollectionFilters;
