import { FeaturedMentors } from "@/components/public/FeaturedMentors";
import { Hero } from "@/components/public/Hero";
import {
  AdSlot,
  FeatureStrip,
  HowItWorks,
  LatestAssignments,
  LatestBlog,
  NeedHelp,
  PlatformStats,
  PopularCategories,
  ReferralCard,
  StatsBand,
  Testimonials,
  TopMentors,
  TopStudents,
  WhyChoose,
} from "@/components/public/home";
import { getT } from "@/lib/i18n/server";

export default async function HomePage() {
  const { t, lang } = await getT();
  return (
    <>
      <div className="container-x grid gap-5 py-5 xl:grid-cols-[230px_minmax(0,1fr)_250px]">
        <aside className="order-2 hidden space-y-4 xl:order-1 xl:block">
          <TopStudents t={t} lang={lang} />
          <ReferralCard t={t} />
          <PlatformStats t={t} lang={lang} />
        </aside>
        <div className="order-1 min-w-0 space-y-6 xl:order-2">
          <Hero />
          <FeatureStrip t={t} />
          <PopularCategories t={t} lang={lang} />
          <FeaturedMentors />
          <HowItWorks t={t} />
          <AdSlot t={t} placement="home-native" />
          <LatestAssignments t={t} lang={lang} />
          <Testimonials t={t} />
          <LatestBlog t={t} lang={lang} />
        </div>
        <aside className="order-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <TopMentors t={t} lang={lang} />
            <div className="space-y-4">
              <WhyChoose t={t} />
              <NeedHelp t={t} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:hidden">
            <TopStudents t={t} lang={lang} />
            <div className="space-y-4">
              <ReferralCard t={t} />
              <PlatformStats t={t} lang={lang} />
            </div>
          </div>
        </aside>
      </div>
      <StatsBand t={t} lang={lang} />
    </>
  );
}
