import { FunctionComponent } from 'react';
import { LandingTemplate } from '../components/templates';
import {
  ApparelSection,
  BrandClosing,
  ChooseSportSection,
  CuratedKit,
  FootwearSection,
  HomeCover,
  RunningCampaign,
  SiteFooter,
  TrainingCampaign,
} from '../components/organisms';

const SPOTTodoElDeporte: FunctionComponent = () => {
  return (
    <LandingTemplate>
      <HomeCover />
      <ChooseSportSection />
      <FootwearSection />
      <RunningCampaign />
      <ApparelSection />
      <TrainingCampaign />
      <CuratedKit />
      <BrandClosing />
      <SiteFooter />
    </LandingTemplate>
  );
};

export default SPOTTodoElDeporte;
