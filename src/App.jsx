


import { useEffect, useState } from 'react';
import './App.css';
import WuBio from './WuBio';

function App() {

  const [data, setData] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [wordQuery, setWordQuery] = useState('');
  const [wordStats, setWordStats] = useState({});
  const [selectedMember, setSelectedMember] = useState(null);
  const [expandedSongs, setExpandedSongs] = useState({});
  const [showBio, setShowBio] = useState(false);

  useEffect(() => {
    fetch('/data/band/wu-tang-clan/wu-tang-clan-lyrics.json')
      .then(res => res.json())
      .then(setData);
  }, []);

  const handleAlbumClick = (album) => {
    setSelectedAlbum(album);
    setSelectedSong(null);
  };

  const handleSongClick = (song) => {
    setSelectedSong(song);
  };

  const handleBackToAlbums = () => {
    setSelectedAlbum(null);
    setSelectedSong(null);
  };

  const handleBackToSongs = () => {
    setSelectedSong(null);
  };


  // Navigation bar links
  const navLinks = [
    { label: 'Dashboard', onClick: () => { setShowDashboard(true); setShowBio(false); setSelectedAlbum(null); setSelectedSong(null); setSelectedMember(null); }, show: true },
    { label: 'Albums', onClick: () => { setShowDashboard(false); setShowBio(false); handleBackToAlbums(); setSelectedMember(null); }, show: !selectedAlbum || (selectedAlbum && selectedSong) },
    { label: 'Clan Bios', onClick: () => { setShowBio(true); setShowDashboard(false); setSelectedAlbum(null); setSelectedSong(null); setSelectedMember(null); }, show: true },
    selectedMember ? { label: selectedMember, onClick: () => {}, show: true } : null,
    selectedAlbum && !selectedSong ? { label: selectedAlbum.title, onClick: () => {}, show: true } : null,
    selectedSong ? { label: selectedSong.title, onClick: () => {}, show: true } : null,
  ].filter(Boolean);
  // Wu-Tang members
  const members = [
    'RZA', 'GZA', 'Masta Killa', "Ol' Dirty Bastard", 'Raekwon', 'Ghostface Killah', 'Inspectah Deck', 'Method Man', 'U-God', 'Cappadonna'
  ];

  // Dashboard data aggregation
  const getDashboardStats = () => {
    if (!data) return [];
    // Map: member -> { songs: Set, charCount, maxBars, wordCount }
    const stats = {};
    members.forEach(m => {
      stats[m] = { songs: new Set(), charCount: 0, maxBars: 0, wordCount: 0 };
    });
    data.albums.forEach(album => {
      if (!album.songs) return;
      album.songs.forEach(song => {
        if (!song.verses) return;
        song.verses.forEach(verse => {
          if (!verse.artists || !verse.lyrics) return;
          verse.artists.forEach(artist => {
            // Normalize artist name for matching
            let member = members.find(m => m.toLowerCase() === artist.toLowerCase() || (m === "Ol' Dirty Bastard" && ["ODB", "Ol' Dirty Bastard", "Ol Dirty Bastard"].includes(artist.toUpperCase())));
            if (member) {
              stats[member].songs.add(song.title);
              stats[member].charCount += verse.lyrics.length;
              // Count bars (split by \n)
              const bars = verse.lyrics.split('\n').filter(Boolean).length;
              if (bars > stats[member].maxBars) stats[member].maxBars = bars;
              // Word count for query
              if (wordQuery) {
                const regex = new RegExp(`\\b${wordQuery}\\b`, 'gi');
                stats[member].wordCount += (verse.lyrics.match(regex) || []).length;
              }
            }
          });
        });
      });
    });
    // Convert sets to counts
    return members.map(m => ({
      name: m,
      songs: stats[m].songs.size,
      charCount: stats[m].charCount,
      maxBars: stats[m].maxBars,
      wordCount: stats[m].wordCount
    }));
  };

  // Get all appearances for a member: [{ album, song, verses }]
  const getMemberAppearances = (member) => {
    if (!data) return [];
    const appearances = [];
    data.albums.forEach(album => {
      if (!album.songs) return;
      album.songs.forEach(song => {
        if (!song.verses) return;
        const verses = song.verses.filter(verse =>
          verse.artists && verse.artists.some(a => a.toLowerCase() === member.toLowerCase() || (member === "Ol' Dirty Bastard" && ["ODB", "Ol' Dirty Bastard", "Ol Dirty Bastard"].includes(a.toUpperCase())))
        );
        if (verses.length > 0) {
          appearances.push({
            albumTitle: album.title,
            albumArt: album.coverArtUrl,
            songTitle: song.title,
            songUrl: song.url,
            verses
          });
        }
      });
    });
    // Group by album
    const byAlbum = {};
    appearances.forEach(app => {
      if (!byAlbum[app.albumTitle]) byAlbum[app.albumTitle] = { albumArt: app.albumArt, songs: [] };
      byAlbum[app.albumTitle].songs.push({ songTitle: app.songTitle, songUrl: app.songUrl, verses: app.verses });
    });
    return byAlbum;
  };

  // Update wordStats when wordQuery changes
  useEffect(() => {
    if (!data) return;
    setWordStats(getDashboardStats());
    // eslint-disable-next-line
  }, [data, wordQuery]);

  // Helper to get album art by album title
  const getAlbumArt = (albumTitle) => {
    if (!data || !albumTitle) return null;
    const found = data.albums.find(a => a.title === albumTitle);
    return found && found.coverArtUrl ? found.coverArtUrl : null;
  };

  return (
    <>
      <nav className="nav-bar">
        <img src="/wutang_fullyellow.png" className="wutang-logo" alt="Wu-Tang Clan Logo" style={{ height: 40, marginBottom: 0, marginRight: 16 }} />
        {navLinks.map((link, idx) => (
          <span key={idx} className="nav-link" style={{ opacity: link.onClick ? 1 : 0.7, cursor: link.onClick ? 'pointer' : 'default' }} onClick={link.onClick}>{link.label}</span>
        ))}
      </nav>
      {showBio ? (
        <WuBio />
      ) : showDashboard ? (
        <div className="card">
          <h2>Wu-Tang Dashboard</h2>
          <div style={{ margin: '1em 0', textAlign: 'left' }}>
            <label htmlFor="wordQuery" style={{ color: '#F8D000', fontWeight: 'bold' }}>Word Frequency:</label>
            <input
              id="wordQuery"
              type="text"
              value={wordQuery}
              onChange={e => setWordQuery(e.target.value)}
              placeholder="Enter word (e.g. cream, sword)"
              style={{ marginLeft: 8, padding: '0.3em 0.8em', borderRadius: 8, border: '1px solid #F8D000', background: '#222', color: '#fff', fontSize: '1em' }}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1em' }}>
              <thead>
                <tr style={{ background: '#222', color: '#F8D000' }}>
                  <th style={{ padding: '0.5em', borderBottom: '2px solid #F8D000' }}>Member</th>
                  <th style={{ padding: '0.5em', borderBottom: '2px solid #F8D000' }}>Songs Appeared</th>
                  <th style={{ padding: '0.5em', borderBottom: '2px solid #F8D000' }}>Total Characters</th>
                  <th style={{ padding: '0.5em', borderBottom: '2px solid #F8D000' }}>Max Bars in Song</th>
                  {wordQuery && <th style={{ padding: '0.5em', borderBottom: '2px solid #F8D000' }}>"{wordQuery}" Count</th>}
                </tr>
              </thead>
              <tbody>
                {wordStats && wordStats.map((stat, idx) => (
                  <tr key={stat.name} style={{ background: idx % 2 === 0 ? '#181818' : '#222' }}>
                    <td style={{ color: '#F8D000', fontWeight: 'bold', padding: '0.5em', textShadow: '2px 2px 0 #000, 4px 4px 8px #000a', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => { setSelectedMember(stat.name); setShowDashboard(false); setExpandedSongs({}); }}
                    >{stat.name}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.songs}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.charCount}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.maxBars}</td>
                    {wordQuery && <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.wordCount}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedMember ? (
        <div className="card">
          <h2>{selectedMember}</h2>
          {Object.entries(getMemberAppearances(selectedMember)).map(([album, albumData]) => (
            <div key={album} style={{ marginBottom: '2em' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                {albumData.albumArt && (
                  <img src={albumData.albumArt} alt={album} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '2px solid #F8D000' }} />
                )}
                <span style={{ color: '#F8D000', fontWeight: 'bold', fontSize: '1.1em', textShadow: '2px 2px 0 #000, 4px 4px 8px #000a' }}>{album}</span>
              </div>
              <div style={{ marginLeft: albumData.albumArt ? 76 : 0 }}>
                {albumData.songs.map((song, idx) => (
                  <div key={song.songTitle} style={{ marginBottom: '1em', borderBottom: '1px solid #333', paddingBottom: 8 }}>
                    <div
                      style={{ cursor: 'pointer', color: '#F8D000', fontWeight: 'bold', fontSize: '1.05em', textShadow: '2px 2px 0 #000, 4px 4px 8px #000a' }}
                      onClick={() => setExpandedSongs(prev => ({ ...prev, [album + song.songTitle]: !prev[album + song.songTitle] }))}
                    >
                      {song.songTitle}
                      <span style={{ marginLeft: 8, color: '#fff', fontWeight: 'normal', fontSize: '0.9em' }}>
                        {expandedSongs[album + song.songTitle] ? '▲' : '▼'}
                      </span>
                    </div>
                    {expandedSongs[album + song.songTitle] && (
                      <div style={{ marginTop: 8, background: '#181818', borderRadius: 8, padding: 12 }}>
                        {song.verses.map((verse, vIdx) => (
                          <div key={vIdx} style={{ marginBottom: '1.2em' }}>
                            {verse.type && (
                              <span className="verse-type">
                                {verse.type}
                                {verse.artists && verse.artists.length > 0 && (
                                  <span className="verse-artists">: {verse.artists.join(', ')}</span>
                                )}
                              </span>
                            )}
                            <pre style={{ color: '#fff', background: 'none', fontFamily: 'inherit', fontSize: '1.05em', whiteSpace: 'pre-wrap', margin: 0 }}>{verse.lyrics}</pre>
                          </div>
                        ))}
                        <a href={song.songUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#F8D000', fontWeight: 'bold' }}>View on Genius.com</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="card">
            {!data && <div>Loading albums...</div>}

            {data && !selectedAlbum && (
              <>
                <h2>Albums</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2em' }}>
                  {data.albums.filter((album, idx) => {
                    if (!album.songs || album.songs.length === 0) {
                      console.warn('Album with 0 songs:', album.title || `Album ${idx+1}`);
                      return false;
                    }
                    return true;
                  }).map((album, idx) => (
                    <div key={idx} style={{ minWidth: 200, cursor: 'pointer' }} onClick={() => handleAlbumClick(album)}>
                      {album.coverArtUrl && (
                        <img src={album.coverArtUrl} alt={album.title} style={{ width: '100%', maxWidth: 180, borderRadius: 12, marginBottom: 8, border: '2px solid #F8D000' }} />
                      )}
                      <div style={{ color: '#F8D000', fontWeight: 'bold', fontSize: '1.2em', marginBottom: 4, textShadow: '2px 2px 0 #000, 4px 4px 8px #000a' }}>{album.title || `Album ${idx+1}`}</div>
                      <div style={{ color: '#fff', opacity: 0.7 }}>{album.songs?.length || 0} songs</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {data && selectedAlbum && !selectedSong && (
              <>
                <button onClick={handleBackToAlbums}>&larr; Back to Albums</button>
                {selectedAlbum.coverArtUrl && (
                  <img src={selectedAlbum.coverArtUrl} alt={selectedAlbum.title} style={{ width: '100%', maxWidth: 220, borderRadius: 14, margin: '1em auto 1em auto', border: '2px solid #F8D000', display: 'block' }} />
                )}
                <h2>{selectedAlbum.title || 'Album'}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1em', marginTop: '2em' }}>
                  {selectedAlbum.songs?.map((song, idx) => (
                    <div key={idx} className="song-title" onClick={() => handleSongClick(song)}>
                      {song.title}
                    </div>
                  ))}
                </div>
              </>
            )}

            {data && selectedSong && (
              <>
                <button onClick={handleBackToSongs}>&larr; Back to Songs</button>
                {/* Show album art if available for this song's album */}
                {selectedAlbum && selectedAlbum.coverArtUrl && (
                  <img src={selectedAlbum.coverArtUrl} alt={selectedAlbum.title} style={{ width: '100%', maxWidth: 180, borderRadius: 12, margin: '1em auto 1em auto', border: '2px solid #F8D000', display: 'block' }} />
                )}
                <h2 className="song-title" style={{ marginTop: '1em' }}>{selectedSong.title}</h2>
                {/* If song.albumTitle exists and has art, show it */}
                {selectedSong.albumTitle && getAlbumArt(selectedSong.albumTitle) && (
                  <img src={getAlbumArt(selectedSong.albumTitle)} alt={selectedSong.albumTitle} style={{ width: '100%', maxWidth: 180, borderRadius: 12, margin: '1em auto 1em auto', border: '2px solid #F8D000', display: 'block' }} />
                )}
                <div style={{ margin: '2em 0', textAlign: 'left' }}>
                  {selectedSong.verses?.map((verse, idx) => (
                    <div key={idx} style={{ marginBottom: '1.5em' }}>
                      {verse.type && (
                        <span className="verse-type">
                          {verse.type}
                          {verse.artists && verse.artists.length > 0 && (
                            <span className="verse-artists">: {verse.artists.join(', ')}</span>
                          )}
                        </span>
                      )}
                      {/* If verse.albumTitle exists and has art, show it */}
                      {verse.albumTitle && getAlbumArt(verse.albumTitle) && (
                        <img src={getAlbumArt(verse.albumTitle)} alt={verse.albumTitle} style={{ width: '100%', maxWidth: 120, borderRadius: 10, margin: '0.5em 0', border: '2px solid #F8D000', display: 'block' }} />
                      )}
                      <pre style={{ color: '#fff', background: 'none', fontFamily: 'inherit', fontSize: '1.05em', whiteSpace: 'pre-wrap', margin: 0 }}>{verse.lyrics}</pre>
                    </div>
                  ))}
                </div>
                <a href={selectedSong.url} target="_blank" rel="noopener noreferrer">View on Genius.com</a>
              </>
            )}
          </div>
          <p className="read-the-docs">
            Tribute project &mdash; Not affiliated with Wu-Tang Clan or Genius.com
          </p>
        </>
      )}
    </>
  );
}

export default App;
