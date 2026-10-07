import { FunctionComponent } from 'react';
import { LandingTemplate } from '../components/templates';
import {
  ApparelSection,
  BrandClosing,
  ChooseSportSection,
  CuratedKit,
  FootwearSection,
  HomeCover,
  IntroSplash,
  RunningCampaign,
  SiteFooter,
  TrainingCampaign,
} from '../components/organisms';

const SPOTTodoElDeporte: FunctionComponent = () => {
  return (
    <LandingTemplate intro={<IntroSplash />} cover={<HomeCover />} footer={<SiteFooter />}>
      <ChooseSportSection />
      <FootwearSection />
      <RunningCampaign />
      <ApparelSection />
      <TrainingCampaign />
      <CuratedKit />
      <BrandClosing />
    </LandingTemplate>
  );
};

export default SPOTTodoElDeporte;
