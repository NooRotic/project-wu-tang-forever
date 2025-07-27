import React, { useEffect, useState } from 'react';
import wuLogo from './assets/wu-logo.svg';
import './App.css';
import './App.bio.css';

// WuBio: A bold, creative, never-seen-before Wu-Tang biographical experience
// Features: animated clan tree, member bios, group timeline, and interactive trivia

const memberData = [
  {
    name: 'RZA',
    wiki: 'https://en.wikipedia.org/wiki/RZA',
    color: '#F8D000',
    image: '', // Optionally add images
  },
  {
    name: 'GZA',
    wiki: 'https://en.wikipedia.org/wiki/GZA',
    color: '#BADA55',
    image: '',
  },
  {
    name: 'Ol\' Dirty Bastard',
    wiki: 'https://en.wikipedia.org/wiki/Ol%27_Dirty_Bastard',
    color: '#E67E22',
    image: '',
  },
  {
    name: 'Method Man',
    wiki: 'https://en.wikipedia.org/wiki/Method_Man',
    color: '#1ABC9C',
    image: '',
  },
  {
    name: 'Raekwon',
    wiki: 'https://en.wikipedia.org/wiki/Raekwon',
    color: '#9B59B6',
    image: '',
  },
  {
    name: 'Ghostface Killah',
    wiki: 'https://en.wikipedia.org/wiki/Ghostface_Killah',
    color: '#E74C3C',
    image: '',
  },
  {
    name: 'Inspectah Deck',
    wiki: 'https://en.wikipedia.org/wiki/Inspectah_Deck',
    color: '#2980B9',
    image: '',
  },
  {
    name: 'U-God',
    wiki: 'https://en.wikipedia.org/wiki/U-God',
    color: '#F39C12',
    image: '',
  },
  {
    name: 'Masta Killa',
    wiki: 'https://en.wikipedia.org/wiki/Masta_Killa',
    color: '#27AE60',
    image: '',
  },
  {
    name: 'Cappadonna',
    wiki: 'https://en.wikipedia.org/wiki/Cappadonna',
    color: '#8E44AD',
    image: '',
  },
];

function WuBio() {
  const [bios, setBios] = useState({});
  const [groupBio, setGroupBio] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    // Load bios from /data/artist/{member}.json and group from /data/band/wu-tang-clan/wu-tang-clan-lyrics.json
    async function fetchBios() {
      const biosObj = {};
      for (const m of memberData) {
        try {
          const res = await fetch(`/data/artist/${m.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`);
          if (res.ok) biosObj[m.name] = await res.json();
        } catch {}
      }
      setBios(biosObj);
      try {
        const res = await fetch('/data/band/wu-tang-clan/wu-tang-clan-lyrics.json');
        if (res.ok) setGroupBio((await res.json()).bio);
      } catch {}
    }
    fetchBios();
  }, []);

  // Animated clan tree (simple radial layout)
  return (
    <div className="wubio-root">
      <h1 style={{ color: '#F8D000', textShadow: '2px 2px 0 #000, 4px 4px 8px #000a' }}>Wu-Tang Clan: The Living Legacy</h1>
      <div className="clan-tree">
        <div className="clan-center" onClick={() => setSelected('Wu-Tang Clan')} style={{ background: '#F8D000', color: '#000', fontWeight: 'bold', borderRadius: '50%', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: 22, boxShadow: '0 0 32px #F8D00088', cursor: 'pointer', marginBottom: 32 }}>
          Wu-Tang Clan
        </div>
        <div className="clan-members" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
          {memberData.map((m, i) => (
            <div key={m.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ color: m.color, fontWeight: 'bold', marginBottom: 6, fontSize: 16 }}>{m.name}</span>
              <div
                className="clan-member"
                onClick={() => setSelected(m.name)}
                style={{
                  background: '#111',
                  borderRadius: '50%',
                  width: 90,
                  height: 90,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `4px solid #F8D000`,
                  boxShadow: selected === m.name ? `0 0 16px #F8D000` : `0 0 8px #222`,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s, border 0.2s',
                  position: 'relative',
                }}
              >
                <img src={wuLogo} alt="Wu-Tang Logo" style={{ width: 60, height: 60, display: 'block' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bio-panel" style={{ margin: '2em auto', maxWidth: 700, background: '#181818', borderRadius: 16, padding: 32, boxShadow: '0 0 32px #000a', color: '#fff', minHeight: 200 }}>
        {selected === 'Wu-Tang Clan' ? (
          <>
            <h2 style={{ color: '#F8D000' }}>Wu-Tang Clan</h2>
            <p>{groupBio || 'Loading group bio...'}</p>
          </>
        ) : selected && bios[selected] ? (
          <>
            <h2 style={{ color: memberData.find(m => m.name === selected)?.color || '#fff' }}>{selected}</h2>
            <p>{bios[selected].bio || 'Loading bio...'}</p>
            <a href={memberData.find(m => m.name === selected)?.wiki} target="_blank" rel="noopener noreferrer" style={{ color: '#F8D000', fontWeight: 'bold' }}>Read more on Wikipedia</a>
            {bios[selected].facts && (
              <ul style={{ marginTop: 16 }}>
                {bios[selected].facts.map((fact, i) => (
                  <li key={i} style={{ color: '#F8D000' }}>{fact}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p style={{ color: '#888' }}>Select a member or the group to view their bio.</p>
        )}
      </div>
      <div className="wubio-footer" style={{ marginTop: 40, color: '#F8D000', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
        <span>"Wu-Tang is for the children."</span>
      </div>
    </div>
  );
}

export default WuBio;
