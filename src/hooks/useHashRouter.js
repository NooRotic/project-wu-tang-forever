import { useState, useEffect, useCallback } from 'react';

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return { segments: [] };
  return { segments: hash.split('/').map(s => decodeURIComponent(s)) };
}

export function useHashRouter() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((path) => {
    const encoded = path
      .split('/')
      .map(s => encodeURIComponent(s))
      .join('/');
    window.location.hash = '#/' + encoded;
  }, []);

  return { segments: route.segments, navigate };
}
