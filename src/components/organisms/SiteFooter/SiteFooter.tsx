import { FunctionComponent } from 'react';
import { Icon, Text, Wordmark } from '../../atoms';
import { EmailEntry, FooterLinkGroup } from '../../molecules';
import { footerLinkGroups, legalLinks } from '../../../data/footer';
import styles from './SiteFooter.module.css';

const SiteFooter: FunctionComponent = () => {
  return (
    <footer className={styles.footerUniversoSpot}>
      <div className={styles.footerDirectory}>
        <div className={styles.brandAndSocial}>
          <Wordmark variant="footer" />
          <p className={styles.invitation}>El deporte nos mueve.<br/>SPOT nos encuentra.</p>
          <div className={styles.socialLinks}>
            <a href="#" className={styles.socialLink} aria-label="Instagram de SPOT">
              <Icon name="instagram" />
            </a>
            <a href="#" className={styles.socialLink} aria-label="YouTube de SPOT">
              <Icon name="youtube" />
            </a>
          </div>
        </div>
        {footerLinkGroups.map((group) => (
          <FooterLinkGroup key={group.title} {...group} />
        ))}
        <div className={styles.communityInvitation}>
          <h3 className={styles.communityTitle}>SEGUÍ EN MOVIMIENTO.</h3>
          <p className={styles.invitation}>Dejá tu mail para conocer el universo SPOT.</p>
          <EmailEntry placeholder="Tu correo electrónico" />
          <div className={styles.privacyNote}>Al suscribirte, aceptás la política de privacidad.</div>
        </div>
      </div>
      <div className={styles.footerDivider} />
      <div className={styles.legalAndProjectNote}>
        <Text>© SPOT 2026 · TODO EL DEPORTE EN UN SOLO LUGAR</Text>
        <Text>Propuesta conceptual · Sin precios ni promociones</Text>
        <div className={styles.legalLinks}>
          {legalLinks.map((link) => (
            <a key={link} href="#" className={styles.legalLink}>
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
