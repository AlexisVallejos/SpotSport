import { FormEvent, FunctionComponent } from 'react';
import { Icon } from '../../atoms';
import styles from './EmailEntry.module.css';

export type EmailEntryProps = {
  placeholder: string;
};

const EmailEntry: FunctionComponent<EmailEntryProps> = ({ placeholder }) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  return (
    <form className={styles.emailEntry} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        type="email"
        name="email"
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="email"
        required
      />
      <button type="submit" className={styles.submit} aria-label="Suscribirme">
        <Icon name="arrowRight" />
      </button>
    </form>
  );
};

export default EmailEntry;
