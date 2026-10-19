import { FunctionComponent, useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import AnnouncementBar from '../components/layout/AnnouncementBar';
import { LandingTemplate } from '../components/templates';
import {
  ApparelSection,
  CuratedKit,
  DisciplineDeck,
  FeaturedProducts,
  FootwearSection,
  HomeCover,
  IntroSplash,
  SiteFooter,
  TrainingCampaign,
} from '../components/organisms';

// Inicio liviano: portada, deportes, calzado, una campaña, indumentaria y el equipo de running.
// (RunningCampaign y BrandClosing siguen en organisms/ por si se quieren volver a sumar.)
const SPOTTodoElDeporte: FunctionComponent = () => {
  const { hash, key } = useLocation();
  const navigationType = useNavigationType();
  const mounted = useRef(false);

  // El navbar lleva a las secciones con "/#calzado"; el router no hace scroll solo, así que lo hacemos acá.
  // Los cambios de hash de los filtros de la página (POP) no mueven la vista.
  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    const id = hash.replace(/^#\/?/, '').split('/')[0];
    if (!id || (!first && navigationType === 'POP')) return;
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [hash, key, navigationType]);

  return (
    <LandingTemplate
      intro={<IntroSplash />}
      cover={
        <>
          <AnnouncementBar />
          <HomeCover />
        </>
      }
      footer={<SiteFooter />}
    >
      <DisciplineDeck />
      <FeaturedProducts />
      <FootwearSection />
      <TrainingCampaign />
      <ApparelSection />
      <CuratedKit />
    </LandingTemplate>
  );
};

export default SPOTTodoElDeporte;
