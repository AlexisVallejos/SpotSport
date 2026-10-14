import { FunctionComponent } from 'react';
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
