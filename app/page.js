import HomeClient from './components/home/HomeClient';
import RagLanding from './components/home/RagLanding';

export default function Home() {
  return (
    <HomeClient>
      <RagLanding />
      {/*
      import RecentPosts from './components/home/RecentPosts';
      <RecentPosts />
      */}
    </HomeClient>
  );
}
