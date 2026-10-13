import { FunctionComponent } from 'react';
import AnnouncementBar from '../components/layout/AnnouncementBar';
import { LandingTemplate } from '../components/templates';
import {
  ApparelSection,
  BrandClosing,
  ChooseSportSection,
  CuratedKit,
  FeaturedProducts,
  FootwearSection,
  HomeCover,
  IntroSplash,
  RunningCampaign,
  SiteFooter,
  TrainingCampaign,
} from '../components/organisms';

const SPOTTodoElDeporte: FunctionComponent = () => {
  return (
    <LandingTemplate intro={<IntroSplash />} cover={
        <>
          <AnnouncementBar />
          <HomeCover />
        </>
      } footer={<SiteFooter />}>
      <ChooseSportSection />
      <FeaturedProducts />
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
