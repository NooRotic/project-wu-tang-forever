import { useState, useEffect } from 'react';

export function useArtistData(slug) {
  const [config, setConfig] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/data/artists/${slug}/config.json`).then(r => {
        if (!r.ok) throw new Error(`Config not found for ${slug}`);
        return r.json();
      }),
      fetch(`/data/artists/${slug}/lyrics.json`).then(r => {
        if (!r.ok) throw new Error(`Lyrics not found for ${slug}`);
        return r.json();
      }),
    ])
      .then(([cfg, lyr]) => {
        setConfig(cfg);
        setData(lyr);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  return { config, data, loading, error };
}
