import { FunctionComponent } from 'react';
import { Icon, Text, Wordmark } from '../../atoms';
import { SearchBox } from '../../molecules';
import { bagCount, departments, searchPlaceholder } from '../../../data/navigation';
import styles from './MainNavigation.module.css';

const MainNavigation: FunctionComponent = () => {
  return (
    <div className={styles.mainNavigation}>
      <Wordmark variant="nav" />
      <div className={styles.departments}>
        {departments.map((department) => (
          <div key={department} className={styles.navigationLink}>{department}</div>
        ))}
      </div>
      <SearchBox placeholder={searchPlaceholder} />
      <div className={styles.accountAndBag}>
        <Icon />
        <div className={styles.bag}>
          <Icon />
          <Text>{bagCount}</Text>
        </div>
      </div>
    </div>
  );
};

export default MainNavigation;
