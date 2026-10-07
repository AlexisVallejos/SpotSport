import { FunctionComponent } from 'react';
import { Icon, Text } from '../../atoms';
import styles from './EmailEntry.module.css';

export type EmailEntryProps = {
  placeholder: string;
};

const EmailEntry: FunctionComponent<EmailEntryProps> = ({ placeholder }) => {
  return (
    <div className={styles.emailEntry}>
      <Text>{placeholder}</Text>
      <Icon />
    </div>
  );
};

export default EmailEntry;
