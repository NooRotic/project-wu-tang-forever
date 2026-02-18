import { useState } from 'react';

function DevToolbar({ onArtistAdded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [scraping, setScraping] = useState(null); // slug of artist being scraped
  const [scrapeResult, setScrapeResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setScrapeResult(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.artists || []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  const handleScrape = async (artist) => {
    setScraping(artist.slug);
    setScrapeResult(null);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist: artist.name, slug: artist.slug }),
      });
      const data = await res.json();
      setScrapeResult(data);
      if (data.success && onArtistAdded) onArtistAdded();
    } catch (err) {
      setScrapeResult({ success: false, error: err.message });
    }
    setScraping(null);
  };

  return (
    <div className="dev-toolbar">
      <div className="dev-toolbar-header">Dev Tools</div>
      <form onSubmit={handleSearch} className="dev-search-form">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search Genius.com for an artist..."
          className="dev-search-input"
        />
        <button type="submit" disabled={searching} className="dev-search-btn">
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="dev-results">
          {results.map(a => (
            <div key={a.id} className="dev-result-card">
              {a.imageUrl && <img src={a.imageUrl} alt={a.name} className="dev-result-img" />}
              <div className="dev-result-info">
                <div className="dev-result-name">{a.name}</div>
                <div className="dev-result-slug">{a.slug}</div>
              </div>
              <button
                onClick={() => handleScrape(a)}
                disabled={scraping !== null}
                className="dev-scrape-btn"
              >
                {scraping === a.slug ? 'Scraping...' : 'Scrape'}
              </button>
            </div>
          ))}
        </div>
      )}

      {scrapeResult && (
        <div className={`dev-scrape-result ${scrapeResult.success ? 'success' : 'error'}`}>
          {scrapeResult.success
            ? 'Scrape complete! Artist added to manifest.'
            : `Error: ${scrapeResult.error}`}
        </div>
      )}
    </div>
  );
}

export default DevToolbar;
