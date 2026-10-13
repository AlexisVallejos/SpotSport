import { FunctionComponent } from 'react';
import { LandingTemplate } from '../components/templates';
import {
  ApparelSection,
  BrandClosing,
  CuratedKit,
  DisciplineDeck,
  FootwearSection,
  HomeCover,
  IntroSplash,
  RunningCampaign,
  SiteFooter,
  TrainingCampaign,
} from '../components/organisms';
import ClickSpark from '../components/reactbits/ClickSpark';

// Primero la intro; al terminar, la portada de lava arranca desde el principio.
const SPOTTodoElDeporte: FunctionComponent = () => {
  return (
    <ClickSpark sparkColor={['#ff7900', '#ffb347', '#ffffff']} sparkCount={10} sparkRadius={26} sparkSize={9} duration={500} shape="streak" glow={0.6}>
      <LandingTemplate intro={<IntroSplash />} cover={<HomeCover />} footer={<SiteFooter />}>
        <DisciplineDeck />
        <FootwearSection />
        <RunningCampaign />
        <ApparelSection />
        <TrainingCampaign />
        <CuratedKit />
        <BrandClosing />
      </LandingTemplate>
    </ClickSpark>
  );
};

export default SPOTTodoElDeporte;
