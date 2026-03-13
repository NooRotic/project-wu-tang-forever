import { useEffect, useMemo, useState } from 'react';
import wuLogo from '../assets/wu-logo.svg';
import '../App.bio.css';

const IS_DEV = import.meta.env.DEV;

function MemberCircle({ member, bio, selected, onClick, artistSlug, onImageUpdate }) {
  const [editing, setEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = { current: null };

  const imageUrl = bio?.image || null;

  async function saveWithUrl(url) {
    setSaving(true);
    const res = await fetch('/api/update-member-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistSlug, memberSlug: member.slug, imageUrl: url }),
    });
    const json = await res.json();
    setSaving(false);
    setEditing(false);
    onImageUpdate(member.name, json.localPath || url || null);
  }

  async function saveWithFile(file) {
    setSaving(true);
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch('/api/update-member-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistSlug, memberSlug: member.slug, imageBase64: base64, imageExt: ext }),
    });
    const json = await res.json();
    setSaving(false);
    setEditing(false);
    onImageUpdate(member.name, json.localPath || null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ color: member.color, fontWeight: 'bold', marginBottom: 6, fontSize: 16 }}>{member.name}</span>
      <div style={{ position: 'relative' }}>
        <div
          className="clan-member"
          onClick={onClick}
          style={{
            borderRadius: '50%',
            width: 90,
            height: 90,
            overflow: 'hidden',
            border: `4px solid ${member.color || 'var(--color-primary)'}`,
            boxShadow: selected ? `0 0 16px var(--color-primary)` : `0 0 8px #222`,
            cursor: 'pointer',
            transition: 'box-shadow 0.2s, border 0.2s',
            background: 'var(--color-bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {imageUrl
            ? <img src={imageUrl} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <img src={wuLogo} alt="Logo" style={{ width: 60, height: 60, display: 'block' }} />
          }
        </div>
        {IS_DEV && (
          <button
            onClick={(e) => { e.stopPropagation(); setInputUrl(imageUrl || ''); setEditing(v => !v); }}
            title="Edit image"
            style={{
              position: 'absolute', bottom: 0, right: 0,
              background: '#222', border: '1px solid var(--color-primary)',
              borderRadius: '50%', width: 22, height: 22, padding: 0,
              cursor: 'pointer', fontSize: 11, color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >✎</button>
        )}
      </div>
      {IS_DEV && editing && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch', width: 210 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveWithUrl(inputUrl.trim()); if (e.key === 'Escape') setEditing(false); }}
              placeholder="Paste URL (auto-downloaded)"
              disabled={saving}
              style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#111', color: '#fff', flex: 1, minWidth: 0 }}
              autoFocus
            />
            <button onClick={() => saveWithUrl(inputUrl.trim())} disabled={saving} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--color-primary)', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {saving ? '…' : 'Save'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              ref={el => fileRef.current = el}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) saveWithFile(e.target.files[0]); }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              style={{ fontSize: 11, padding: '2px 8px', background: '#333', color: '#ccc', border: '1px solid #555', borderRadius: 4, cursor: 'pointer', flex: 1 }}
            >
              {saving ? 'Uploading…' : 'Choose local file'}
            </button>
            <button onClick={() => setEditing(false)} style={{ fontSize: 11, padding: '2px 6px', background: '#222', color: '#888', border: 'none', borderRadius: 4, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArtistBio({ config, slug }) {
  const [bios, setBios] = useState({});
  const [groupBio, setGroupBio] = useState('');
  const [selected, setSelected] = useState(null);

  const members = useMemo(() => config?.members || [], [config?.members]);
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
            <MemberCircle
              key={m.name}
              member={m}
              bio={bios[m.name]}
              selected={selected === m.name}
              onClick={() => setSelected(m.name)}
              artistSlug={slug}
              onImageUpdate={(name, url) => setBios(prev => ({
                ...prev,
                [name]: { ...prev[name], image: url || undefined },
              }))}
            />
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
