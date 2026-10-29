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
import { getHome } from "@/lib/home";
import { getT } from "@/lib/i18n/server";

export default async function HomePage() {
  const { t, lang } = await getT();
  // With the backend: real figures, rankings, reviews and banners (no sample data).
  const live = await getHome();
  return (
    <>
      <div className="container-x grid gap-5 py-5 xl:grid-cols-[230px_minmax(0,1fr)_250px]">
        <aside className="order-2 hidden space-y-4 xl:order-1 xl:block">
          <TopStudents t={t} lang={lang} live={live?.topStudents} />
          <ReferralCard t={t} live={!!live} />
          <PlatformStats t={t} lang={lang} live={live?.stats} />
        </aside>
        <div className="order-1 min-w-0 space-y-6 xl:order-2">
          <Hero banners={live?.banners} />
          <FeatureStrip t={t} />
          <PopularCategories t={t} lang={lang} />
          {!live && <FeaturedMentors />}
          <HowItWorks t={t} />
          <AdSlot t={t} placement="home-native" />
          {/* Orders are private to their students: sample ones only, in the demo. */}
          {!live && <LatestAssignments t={t} lang={lang} />}
          <Testimonials t={t} live={live?.testimonials} />
          <LatestBlog t={t} lang={lang} live={live?.posts} />
        </div>
        <aside className="order-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <TopMentors t={t} lang={lang} live={live?.topMentors} />
            <div className="space-y-4">
              <WhyChoose t={t} />
              <NeedHelp t={t} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:hidden">
            <TopStudents t={t} lang={lang} live={live?.topStudents} />
            <div className="space-y-4">
              <ReferralCard t={t} live={!!live} />
              <PlatformStats t={t} lang={lang} live={live?.stats} />
            </div>
          </div>
        </aside>
      </div>
      <StatsBand t={t} lang={lang} live={live?.stats} />
    </>
  );
}
