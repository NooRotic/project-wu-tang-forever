import './App.css';
import { resetTheme } from './hooks/useTheme';
import { useHashRouter } from './hooks/useHashRouter';
import LandingPage from './components/LandingPage';
import ArtistView from './components/ArtistView';

function App() {
  const { segments, navigate } = useHashRouter();
  const artistSlug = segments[0] || null;

  const handleSelectArtist = (slug) => navigate(slug);
  const handleBack = () => { resetTheme(); navigate(''); };

  if (artistSlug) {
    return <ArtistView slug={artistSlug} segments={segments} navigate={navigate} onBack={handleBack} />;
  }
  return <LandingPage onSelectArtist={handleSelectArtist} />;
}

export default App;
