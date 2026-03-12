import { useEffect, useState } from 'react';
import DevToolbar from './DevToolbar';

function AboutModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2 style={{ marginTop: 0 }}>What is this?</h2>
        <p>
          <strong>Lyrics Explorer</strong> is a fan-built tool for browsing and analysing rap lyrics.
          It scrapes lyrics and metadata from <a href="https://genius.com" target="_blank" rel="noopener noreferrer">Genius.com</a> and
          presents them in a searchable, stats-driven interface.
        </p>
        <h3>What can I do here?</h3>
        <ul className="modal-list">
          <li>
            <strong>Browse albums &amp; songs</strong> — flip through an artist's full discography with cover art, view counts, release dates, and writing credits.
          </li>
          <li>
            <strong>Read lyrics</strong> — every verse is labelled by type (verse, chorus, hook, etc.) and attributed to the artist who performed it.
          </li>
          <li>
            <strong>Dashboard</strong> — for group artists, see per-member stats: songs, albums, total bars, max bars in a single verse, average bars per song, unique vocabulary, and solo verse count.
          </li>
          <li>
            <strong>Word search</strong> — type any word in the dashboard to see how many times each member has said it across their entire catalogue.
          </li>
          <li>
            <strong>Member appearances</strong> — click any member's name to see every song they appear on, grouped by album, with their verses expanded on demand.
          </li>
        </ul>
        <h3>A note on the data</h3>
        <p style={{ color: '#aaa', fontSize: '0.9em' }}>
          All lyrics are sourced from Genius.com. This is a tribute/fan project and is not affiliated with any artist or label.
          Verse attribution is based on credits listed on Genius and may occasionally be incomplete or incorrect.
        </p>
      </div>
    </div>
  );
}

function LandingPage({ onSelectArtist }) {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAbout, setShowAbout] = useState(false);

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
      <p style={{ color: '#aaa', marginBottom: '0.6em' }}>Select an artist to explore their lyrics and vocabulary.</p>
      <button className="about-link" onClick={() => setShowAbout(true)}>What is this?</button>
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {loading && <div style={{ marginTop: '2em' }}>Loading artists...</div>}
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
