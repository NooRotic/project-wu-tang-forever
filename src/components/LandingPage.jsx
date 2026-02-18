import { useEffect, useState } from 'react';
import DevToolbar from './DevToolbar';

function LandingPage({ onSelectArtist }) {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchArtists = () => {
    fetch('/data/manifest.json')
      .then(r => r.json())
      .then(m => { setArtists(m.artists || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchArtists(); }, []);

  return (
    <div className="landing-page">
      <h1>Lyrics Explorer</h1>
      <p style={{ color: '#aaa', marginBottom: '2em' }}>Select an artist to explore their lyrics and vocabulary.</p>
      {loading && <div>Loading artists...</div>}
      <div className="artist-grid">
        {artists.map(a => (
          <div
            key={a.slug}
            className="artist-card"
            style={{ borderColor: a.primaryColor }}
            onClick={() => onSelectArtist(a.slug)}
          >
            {a.logo && <img src={a.logo} alt={a.name} className="artist-card-logo" style={{ filter: `drop-shadow(0 0 8px ${a.primaryColor}88)` }} />}
            <div className="artist-card-name" style={{ color: a.primaryColor }}>{a.name}</div>
            <div className="artist-card-stats">
              {a.albumCount} albums &middot; {a.songCount} songs
            </div>
          </div>
        ))}
      </div>
      {import.meta.env.DEV && <DevToolbar onArtistAdded={fetchArtists} />}
    </div>
  );
}

export default LandingPage;
