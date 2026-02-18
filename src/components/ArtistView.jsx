import { useEffect, useState, useMemo } from 'react';
import { useArtistData } from '../hooks/useArtistData';
import { applyTheme } from '../hooks/useTheme';
import { matchMember, formatViews, getDashboardStats } from '../utils/artistUtils';
import ArtistBio from './ArtistBio';

function ArtistView({ slug, segments, navigate, onBack }) {
  const { config, data, loading, error } = useArtistData(slug);

  const [wordQuery, setWordQuery] = useState('');
  const [wordStats, setWordStats] = useState({});
  const [expandedSongs, setExpandedSongs] = useState({});
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  const members = config?.members || [];
  const isGroup = config?.type === 'group' && members.length > 0;

  // Derive view state from URL segments: [slug, viewOrAlbum, subView]
  // Routes:
  //   /{slug}                         → albums grid
  //   /{slug}/dashboard               → dashboard
  //   /{slug}/bio                     → bios
  //   /{slug}/member/{name}           → member appearances
  //   /{slug}/album/{title}           → album songs
  //   /{slug}/album/{title}/{song}    → song lyrics
  const viewSegment = segments[1] || null;
  const subSegment = segments[2] || null;
  const songSegment = segments[3] || null;

  const showDashboard = viewSegment === 'dashboard';
  const showBio = viewSegment === 'bio';
  const selectedMemberName = viewSegment === 'member' ? subSegment : null;
  const selectedAlbumTitle = viewSegment === 'album' ? subSegment : null;
  const selectedSongTitle = viewSegment === 'album' ? songSegment : null;

  // Look up actual album/song objects from data
  const selectedAlbum = useMemo(() => {
    if (!data || !selectedAlbumTitle) return null;
    return data.albums.find(a => a.title === selectedAlbumTitle) || null;
  }, [data, selectedAlbumTitle]);

  const selectedSong = useMemo(() => {
    if (!selectedAlbum || !selectedSongTitle) return null;
    return selectedAlbum.songs?.find(s => s.title === selectedSongTitle) || null;
  }, [selectedAlbum, selectedSongTitle]);

  useEffect(() => {
    if (config) applyTheme(config);
  }, [config]);

  // Navigation helpers
  const nav = {
    albums: () => navigate(slug),
    dashboard: () => navigate(`${slug}/dashboard`),
    bio: () => navigate(`${slug}/bio`),
    member: (name) => navigate(`${slug}/member/${name}`),
    album: (title) => navigate(`${slug}/album/${title}`),
    song: (albumTitle, songTitle) => navigate(`${slug}/album/${albumTitle}/${songTitle}`),
  };

  // Navigation bar links
  const navLinks = [
    ...(isGroup ? [{ label: 'Dashboard', onClick: nav.dashboard }] : []),
    { label: 'Albums', onClick: nav.albums },
    ...(isGroup ? [{ label: 'Bios', onClick: nav.bio }] : []),
    selectedMemberName ? { label: selectedMemberName } : null,
    selectedAlbum && !selectedSong ? { label: selectedAlbum.title } : null,
    selectedSong ? { label: selectedSong.title } : null,
  ].filter(Boolean);

  // Dashboard data aggregation (delegated to pure utility function)

  // Get all appearances for a member
  const getMemberAppearances = (member) => {
    if (!data) return {};
    const appearances = [];
    data.albums.forEach(album => {
      if (!album.songs) return;
      album.songs.forEach(song => {
        if (!song.verses) return;
        const verses = song.verses.filter(verse =>
          verse.artists && verse.artists.some(a => {
            const matched = matchMember(a, members);
            return matched && matched.name === member;
          })
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
    const byAlbum = {};
    appearances.forEach(app => {
      if (!byAlbum[app.albumTitle]) byAlbum[app.albumTitle] = { albumArt: app.albumArt, songs: [] };
      byAlbum[app.albumTitle].songs.push({ songTitle: app.songTitle, songUrl: app.songUrl, verses: app.verses });
    });
    return byAlbum;
  };

  // Update wordStats when wordQuery changes
  useEffect(() => {
    if (!data || !isGroup) return;
    setWordStats(getDashboardStats(data.albums, members, wordQuery));
    // eslint-disable-next-line
  }, [data, wordQuery]);

  if (loading) return <div style={{ textAlign: 'center', padding: '4em', color: '#aaa' }}>Loading...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '4em', color: '#f44' }}>Error: {error}</div>;

  return (
    <>
      <nav className="nav-bar">
        <span className="nav-link" onClick={onBack} style={{ cursor: 'pointer', marginRight: 8 }}>&larr;</span>
        {config?.theme?.logo && <img src={config.theme.logo} className="artist-logo" alt={config.name} onClick={onBack} style={{ height: 40, marginBottom: 0, marginRight: 16, cursor: 'pointer' }} />}
        {navLinks.map((link, idx) => (
          <span key={idx} className="nav-link" style={{ opacity: link.onClick ? 1 : 0.7, cursor: link.onClick ? 'pointer' : 'default' }} onClick={link.onClick}>{link.label}</span>
        ))}
      </nav>
      {showBio ? (
        <ArtistBio config={config} slug={slug} />
      ) : showDashboard && isGroup ? (
        <div className="card">
          <h2>{config?.dashboardTitle || 'Dashboard'}</h2>
          <div style={{ margin: '1em 0', textAlign: 'left' }}>
            <label htmlFor="wordQuery" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>Word Frequency:</label>
            <input
              id="wordQuery"
              type="text"
              value={wordQuery}
              onChange={e => setWordQuery(e.target.value)}
              placeholder="Enter word (e.g. cream, sword)"
              style={{ marginLeft: 8, padding: '0.3em 0.8em', borderRadius: 8, border: '1px solid var(--color-primary)', background: '#222', color: '#fff', fontSize: '1em' }}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            {(() => {
              const thStyle = { padding: '0.5em', borderBottom: '2px solid var(--color-primary)', cursor: 'pointer', userSelect: 'none' };
              const handleSort = (col) => {
                if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
                else { setSortCol(col); setSortDir('desc'); }
              };
              const arrow = (col) => sortCol === col ? (sortDir === 'desc' ? ' \u25BC' : ' \u25B2') : '';
              const sorted = wordStats && wordStats.slice ? [...wordStats].sort((a, b) => {
                if (!sortCol) return 0;
                const av = a[sortCol], bv = b[sortCol];
                if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                return sortDir === 'asc' ? av - bv : bv - av;
              }) : wordStats;
              return (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1em' }}>
              <thead>
                <tr style={{ background: '#222', color: 'var(--color-primary)' }}>
                  <th style={thStyle} onClick={() => handleSort('name')}>Member{arrow('name')}</th>
                  <th style={thStyle} onClick={() => handleSort('albums')}>Albums{arrow('albums')}</th>
                  <th style={thStyle} onClick={() => handleSort('songs')}>Songs{arrow('songs')}</th>
                  <th style={thStyle} onClick={() => handleSort('totalBars')}>Total Bars{arrow('totalBars')}</th>
                  <th style={thStyle} onClick={() => handleSort('maxBars')}>Max Bars{arrow('maxBars')}</th>
                  <th style={thStyle} onClick={() => handleSort('avgBars')}>Avg Bars/Song{arrow('avgBars')}</th>
                  <th style={thStyle} onClick={() => handleSort('uniqueWords')}>Unique Words{arrow('uniqueWords')}</th>
                  <th style={thStyle} onClick={() => handleSort('soloVerses')}>Solo Verses{arrow('soloVerses')}</th>
                  <th style={thStyle} onClick={() => handleSort('totalViews')}>Total Views{arrow('totalViews')}</th>
                  <th style={thStyle} onClick={() => handleSort('charCount')}>Characters{arrow('charCount')}</th>
                  {wordQuery && <th style={thStyle} onClick={() => handleSort('wordCount')}>"{wordQuery}" Count{arrow('wordCount')}</th>}
                </tr>
              </thead>
              <tbody>
                {sorted && sorted.map && sorted.map((stat, idx) => (
                  <tr key={stat.name} style={{ background: idx % 2 === 0 ? '#181818' : '#222' }}>
                    <td style={{ color: 'var(--color-primary)', fontWeight: 'bold', padding: '0.5em', textShadow: '2px 2px 0 #000, 4px 4px 8px #000a', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                      onClick={() => { nav.member(stat.name); setExpandedSongs({}); }}
                    >{stat.name}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.albums}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.songs}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.totalBars}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.maxBars}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.avgBars}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.uniqueWords.toLocaleString()}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.soloVerses}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.totalViews ? stat.totalViews.toLocaleString() : '—'}</td>
                    <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.charCount.toLocaleString()}</td>
                    {wordQuery && <td style={{ color: '#fff', padding: '0.5em', textAlign: 'center' }}>{stat.wordCount}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
              );
            })()}
          </div>
        </div>
      ) : selectedMemberName ? (
        <div className="card">
          <h2>{selectedMemberName}</h2>
          {Object.entries(getMemberAppearances(selectedMemberName)).map(([album, albumData]) => (
            <div key={album} style={{ marginBottom: '2em' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                {albumData.albumArt && (
                  <img src={albumData.albumArt} alt={album} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--color-primary)' }} />
                )}
                <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '1.1em', textShadow: '2px 2px 0 #000, 4px 4px 8px #000a' }}>{album}</span>
              </div>
              <div style={{ marginLeft: albumData.albumArt ? 76 : 0 }}>
                {albumData.songs.map((song) => (
                  <div key={song.songTitle} style={{ marginBottom: '1em', borderBottom: '1px solid #333', paddingBottom: 8 }}>
                    <div
                      style={{ cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '1.05em', textShadow: '2px 2px 0 #000, 4px 4px 8px #000a' }}
                      onClick={() => setExpandedSongs(prev => ({ ...prev, [album + song.songTitle]: !prev[album + song.songTitle] }))}
                    >
                      {song.songTitle}
                      <span style={{ marginLeft: 8, color: '#fff', fontWeight: 'normal', fontSize: '0.9em' }}>
                        {expandedSongs[album + song.songTitle] ? '\u25B2' : '\u25BC'}
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
                        <a href={song.songUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>View on Genius.com</a>
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
                  {data.albums.filter(album => album.songs && album.songs.length > 0).map((album, idx) => (
                    <div key={idx} style={{ minWidth: 200, cursor: 'pointer' }} onClick={() => nav.album(album.title)}>
                      {album.coverArtUrl && (
                        <img src={album.coverArtUrl} alt={album.title} style={{ width: '100%', maxWidth: 180, borderRadius: 12, marginBottom: 8, border: '2px solid var(--color-primary)' }} />
                      )}
                      <div style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '1.2em', marginBottom: 4, textShadow: '2px 2px 0 #000, 4px 4px 8px #000a' }}>{album.title || `Album ${idx+1}`}</div>
                      <div style={{ color: '#fff', opacity: 0.7 }}>{album.songs?.length || 0} songs</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {data && selectedAlbum && !selectedSong && (
              <>
                <button onClick={nav.albums}>&larr; Back to Albums</button>
                {selectedAlbum.coverArtUrl && (
                  <img src={selectedAlbum.coverArtUrl} alt={selectedAlbum.title} style={{ width: '100%', maxWidth: 220, borderRadius: 14, margin: '1em auto 1em auto', border: '2px solid var(--color-primary)', display: 'block' }} />
                )}
                <h2>{selectedAlbum.title || 'Album'}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1em', marginTop: '2em' }}>
                  {selectedAlbum.songs?.map((song, idx) => (
                    <div key={idx} className="song-title" onClick={() => nav.song(selectedAlbum.title, song.title)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{song.title}</span>
                      {song.pageviews > 0 && (
                        <span style={{ fontSize: '0.8em', opacity: 0.6, marginLeft: 12, whiteSpace: 'nowrap' }}>{formatViews(song.pageviews)} views</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {data && selectedSong && (
              <>
                <button onClick={() => nav.album(selectedAlbum.title)}>&larr; Back to Songs</button>
                {selectedAlbum && selectedAlbum.coverArtUrl && (
                  <img src={selectedAlbum.coverArtUrl} alt={selectedAlbum.title} style={{ width: '100%', maxWidth: 180, borderRadius: 12, margin: '1em auto 1em auto', border: '2px solid var(--color-primary)', display: 'block' }} />
                )}
                <h2 className="song-title" style={{ marginTop: '1em' }}>{selectedSong.title}</h2>
                {(selectedSong.pageviews > 0 || selectedSong.producers?.length > 0 || selectedSong.writers?.length > 0 || selectedSong.releaseDate) && (
                  <div style={{ margin: '1em 0', padding: '0.8em 1em', background: '#181818', borderRadius: 8, fontSize: '0.9em', textAlign: 'left' }}>
                    {selectedSong.pageviews > 0 && (
                      <div style={{ color: 'var(--color-primary)', fontWeight: 'bold', marginBottom: 4 }}>
                        {selectedSong.pageviews.toLocaleString()} views on Genius
                      </div>
                    )}
                    {selectedSong.releaseDate && <div style={{ color: '#aaa', marginBottom: 4 }}>Released: {selectedSong.releaseDate}</div>}
                    {selectedSong.producers?.length > 0 && <div style={{ color: '#aaa', marginBottom: 4 }}>Produced by: {selectedSong.producers.join(', ')}</div>}
                    {selectedSong.writers?.length > 0 && <div style={{ color: '#aaa' }}>Written by: {selectedSong.writers.join(', ')}</div>}
                  </div>
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
                      <pre style={{ color: '#fff', background: 'none', fontFamily: 'inherit', fontSize: '1.05em', whiteSpace: 'pre-wrap', margin: 0 }}>{verse.lyrics}</pre>
                    </div>
                  ))}
                </div>
                <a href={selectedSong.url} target="_blank" rel="noopener noreferrer">View on Genius.com</a>
              </>
            )}
          </div>
          <p className="read-the-docs">
            {config?.disclaimer || 'Tribute project'}
          </p>
        </>
      )}
    </>
  );
}

export default ArtistView;
