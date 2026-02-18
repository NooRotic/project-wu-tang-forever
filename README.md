
# Lyrics Explorer

A multi-artist web app to scrape, browse, and explore lyrics from Genius.com. Built with Vite + React. Deploys as a fully static site.

Originally built for Wu-Tang Clan, now supports any artist or group with per-artist theming.

## Features

- Scrape any artist's lyrics, albums, and metadata from Genius.com
- Browse albums and songs with a themed, dark-mode UI
- Member dashboard with stats: song counts, character totals, max bars, word frequency search
- Per-artist theming via JSON config (colors, fonts, logos, member lists)
- Landing page to switch between multiple scraped artists
- Dev tools for searching Genius.com and triggering scrapes from the browser
- Fully static production builds (no backend required)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173

## Adding a New Artist

### Option A: CLI Scraper

```bash
# Scrape any artist by their Genius.com slug
node scrape-lyrics.js --artist "Kendrick Lamar" --slug Kendrick-lamar

# With chunked scraping for large catalogs
node scrape-lyrics.js --artist "Nas" --slug Nas --chunk-size 25 --offset 0
```

The scraper will:
- Fetch all albums and songs from Genius.com
- Save lyrics to `public/data/artists/{slug}/lyrics.json`
- Auto-generate a `config.json` template with detected members
- Update `public/data/manifest.json` so the artist appears on the landing page

### Option B: Dev Tools (in-browser)

In dev mode (`npm run dev`), a Dev Tools panel appears on the landing page. Search for an artist and click "Scrape" to add them.

## Customizing an Artist Theme

Edit `public/data/artists/{slug}/config.json`:

```json
{
  "theme": {
    "primaryColor": "#C41E3A",
    "primaryColorHover": "#E8384F",
    "headerFont": "'Oswald', Impact, Arial Black, Arial, sans-serif",
    "logo": "/data/artists/{slug}/logo.png"
  },
  "members": [
    { "name": "...", "slug": "...", "color": "#...", "aliases": ["..."] }
  ]
}
```

## Building for Production

```bash
npm run build
```

The `dist/` directory contains a fully static site with all artist data. Upload to any static host.

## Project Structure

- `src/` — React frontend (components, hooks, styles)
- `public/data/` — Artist configs, lyrics, member bios (JSON)
- `scrape-lyrics.js` — Genius.com scraper (Node.js)
- `vite-plugin-dev-api.js` — Dev-only API for in-browser search/scrape

## License

MIT
