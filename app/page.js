import HomeClient from './HomeClient';
import RecentPosts from './RecentPosts';
import AboutMeSection from './AboutMeSection';

export default function Home() {
  return (
    <HomeClient>
      <AboutMeSection />
      <RecentPosts />
    </HomeClient>
  );
}
