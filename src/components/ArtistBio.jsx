import { useEffect, useState } from 'react';
import wuLogo from '../assets/wu-logo.svg';
import '../App.bio.css';

function ArtistBio({ config, slug }) {
  const [bios, setBios] = useState({});
  const [groupBio, setGroupBio] = useState('');
  const [selected, setSelected] = useState(null);

  const members = config?.members || [];
  const isGroup = config?.type === 'group' && members.length > 0;

  useEffect(() => {
    async function fetchBios() {
      if (!isGroup) return;
      const biosObj = {};
      for (const m of members) {
        try {
          const res = await fetch(`/data/artists/${slug}/members/${m.slug}.json`);
          if (res.ok) biosObj[m.name] = await res.json();
        } catch { /* ignore fetch errors */ }
      }
      setBios(biosObj);
      try {
        const res = await fetch(`/data/artists/${slug}/lyrics.json`);
        if (res.ok) setGroupBio((await res.json()).bio);
      } catch { /* ignore */ }
    }
    fetchBios();
  }, [slug, isGroup, members]);

  if (!isGroup) {
    // Solo artist: simple bio layout
    return (
      <div className="wubio-root">
        <h1 style={{ color: 'var(--color-primary)', textShadow: '2px 2px 0 #000, 4px 4px 8px #000a' }}>{config?.bioTitle || config?.name}</h1>
        <div className="bio-panel" style={{ margin: '2em auto', maxWidth: 700, background: '#181818', borderRadius: 16, padding: 32, boxShadow: '0 0 32px #000a', color: '#fff', minHeight: 200 }}>
          <h2 style={{ color: 'var(--color-primary)' }}>{config?.name}</h2>
          <p style={{ color: '#aaa' }}>Solo artist biography coming soon.</p>
        </div>
        {config?.tagline && (
          <div className="wubio-footer" style={{ marginTop: 40, color: 'var(--color-primary)', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
            <span>"{config.tagline}"</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wubio-root">
      <h1 style={{ color: 'var(--color-primary)', textShadow: '2px 2px 0 #000, 4px 4px 8px #000a' }}>{config?.bioTitle || config?.name}</h1>
      <div className="clan-tree">
        <div className="clan-center" onClick={() => setSelected(config?.name)} style={{ background: 'var(--color-primary)', color: '#000', fontWeight: 'bold', borderRadius: '50%', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: 22, boxShadow: '0 0 32px var(--color-primary-glow)', cursor: 'pointer', marginBottom: 32 }}>
          {config?.name}
        </div>
        <div className="clan-members" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
          {members.map((m) => (
            <div key={m.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ color: m.color, fontWeight: 'bold', marginBottom: 6, fontSize: 16 }}>{m.name}</span>
              <div
                className="clan-member"
                onClick={() => setSelected(m.name)}
                style={{
                  background: 'var(--color-bg-card)',
                  borderRadius: '50%',
                  width: 90,
                  height: 90,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `4px solid var(--color-primary)`,
                  boxShadow: selected === m.name ? `0 0 16px var(--color-primary)` : `0 0 8px #222`,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s, border 0.2s',
                  position: 'relative',
                }}
              >
                {config?.theme?.logo
                  ? <img src={config.theme.logo} alt={config.name} style={{ width: 60, height: 60, display: 'block' }} />
                  : <img src={wuLogo} alt="Logo" style={{ width: 60, height: 60, display: 'block' }} />
                }
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bio-panel" style={{ margin: '2em auto', maxWidth: 700, background: '#181818', borderRadius: 16, padding: 32, boxShadow: '0 0 32px #000a', color: '#fff', minHeight: 200 }}>
        {selected === config?.name ? (
          <>
            <h2 style={{ color: 'var(--color-primary)' }}>{config?.name}</h2>
            <p>{groupBio || 'Loading group bio...'}</p>
          </>
        ) : selected && bios[selected] ? (
          <>
            <h2 style={{ color: members.find(m => m.name === selected)?.color || '#fff' }}>{selected}</h2>
            <p>{bios[selected].bio || 'Loading bio...'}</p>
            <a href={members.find(m => m.name === selected)?.wiki} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>Read more on Wikipedia</a>
            {bios[selected].facts && (
              <ul style={{ marginTop: 16 }}>
                {bios[selected].facts.map((fact, i) => (
                  <li key={i} style={{ color: 'var(--color-primary)' }}>{fact}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p style={{ color: '#888' }}>Select a member or the group to view their bio.</p>
        )}
      </div>
      {config?.tagline && (
        <div className="wubio-footer" style={{ marginTop: 40, color: 'var(--color-primary)', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
          <span>"{config.tagline}"</span>
        </div>
      )}
    </div>
  );
}

export default ArtistBio;
