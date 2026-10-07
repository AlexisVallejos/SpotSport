import { FunctionComponent } from 'react';
import { Icon, Text, Wordmark } from '../../atoms';
import { EmailEntry, FooterLinkGroup } from '../../molecules';
import { footerLinkGroups, legalLinks } from '../../../data/footer';
import styles from './SiteFooter.module.css';

const SiteFooter: FunctionComponent = () => {
  return (
    <div className={styles.footerUniversoSpot}>
      <div className={styles.footerDirectory}>
        <div className={styles.brandAndSocial}>
          <Wordmark variant="footer" />
          <div className={styles.invitation}>El deporte nos mueve.<br/>SPOT nos encuentra.</div>
          <div className={styles.socialLinks}>
            <Icon />
            <Icon />
          </div>
        </div>
        {footerLinkGroups.map((group) => (
          <FooterLinkGroup key={group.title} {...group} />
        ))}
        <div className={styles.communityInvitation}>
          <div className={styles.communityTitle}>SEGUÍ EN MOVIMIENTO.</div>
          <div className={styles.invitation}>Dejá tu mail para conocer el universo SPOT.</div>
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
            <Text key={link}>{link}</Text>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SiteFooter;
