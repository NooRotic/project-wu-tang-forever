# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lyrics Explorer — a multi-artist Vite + React platform for browsing and displaying scraped Genius.com lyrics data. Supports any musical artist or group with per-artist theming via JSON config files. Includes a generalized Node.js scraper and dev-mode tools for searching/adding new artists. Deploys as a fully static site.

Wu-Tang Clan is the original and primary artist template.

## Commands

- `npm run dev` — Start Vite dev server (localhost:5173) with dev API plugin
- `npm run build` — Production build to dist/ (static, no backend)
- `npm run preview` — Serve production build locally
- `npm run lint` — ESLint on all files
- `npm run scrape -- --artist "Artist Name" --slug Genius-slug` — Scrape any artist from Genius.com
- `npm run scrape -- --artist "Artist Name" --slug Genius-slug --enrich` — Scrape + enrich with API metadata
- `npm run scrape:wu-tang` — Scrape Wu-Tang Clan specifically
- `npm run scrape:wu-tang:chunk1/2/3` — Chunked scraping (25 songs per chunk with offset)
- `npm run enrich:wu-tang` — Enrich existing Wu-Tang data with Genius API metadata (pageviews, credits)

No test framework is configured.

## Architecture

### Data Pipeline

Genius.com → `scrape-lyrics.js` (Node.js, axios + cheerio) → `public/data/artists/{slug}/lyrics.json` → React frontend fetches JSON at runtime.

### Data Directory Structure

```
public/data/
  manifest.json                     # Lists all available artists for landing page
  artists/
    {artist-slug}/
      config.json                   # Theme, members, aliases, metadata
      lyrics.json                   # Scraped lyrics data
      logo.png                      # Artist logo (optional)
      members/                      # Member bios (groups only)
        {member-slug}.json
```

### Artist Config System

Each artist has a `config.json` that drives all theming and UI:

```json
{
  "slug": "wu-tang-clan",
  "name": "Wu-Tang Clan",
  "type": "group",                           // "group" or "solo"
  "geniusSlug": "Wu-tang-clan",
  "theme": {
    "primaryColor": "#F8D000",
    "primaryColorHover": "#fff200",
    "headerFont": "'Oswald', Impact, Arial Black, Arial, sans-serif",
    "logo": "/data/artists/wu-tang-clan/logo.png"
  },
  "members": [
    { "name": "RZA", "slug": "rza", "color": "#F8D000", "aliases": [], "wiki": "..." }
  ],
  "tagline": "...",
  "disclaimer": "...",
  "bioTitle": "...",
  "dashboardTitle": "..."
}
```

The scraper auto-generates a config template for new artists, detecting group vs solo by counting distinct verse credits.

### Frontend (src/)

- **App.jsx** — Lightweight router: switches between LandingPage and ArtistView based on `selectedArtist` state.
- **components/LandingPage.jsx** — Fetches `manifest.json`, renders artist card grid. In dev mode, shows DevToolbar for search/scrape.
- **components/ArtistView.jsx** — Main artist experience. Loads config + lyrics via `useArtistData` hook, applies theme. Three views: albums, dashboard (member stats + word search), member appearances.
- **components/ArtistBio.jsx** — Biography with radial member tree (groups) or simple bio (solo). Config-driven, loads member bios from `/data/artists/{slug}/members/`.
- **components/Dashboard.jsx** — Member statistics table with song counts, character totals, max bars, live word frequency search.
- **components/DevToolbar.jsx** — Dev-only: searches Genius.com via `/api/search`, triggers scraping via `/api/scrape`. Tree-shaken out of production builds.

### Hooks

- **useArtistData(slug)** — Fetches `config.json` + `lyrics.json` in parallel. Returns `{ config, data, loading, error }`.
- **useTheme** — `applyTheme(config)` sets CSS variables on `:root` from config.theme. `resetTheme()` clears them. Also updates document title.

### CSS Variables

All theming is driven by CSS custom properties defined in `src/index.css` and overridden at runtime by `useTheme`:

- `--color-primary`, `--color-primary-hover`, `--color-primary-glow`, `--color-primary-faint`
- `--color-bg`, `--color-bg-card`, `--color-text`
- `--font-heading`

### Scraper (scrape-lyrics.js)

Generalized for any artist. Required CLI args: `--artist "Name"` and `--slug Genius-slug`. Optional: `--chunk-size`, `--offset`, `--chunks`, `--clear`, `--enrich`, `--enrich-only`. Auto-generates `config.json` template and updates `manifest.json` after scraping. Saves progress to `.tmp.json` with atomic rename on completion.

**API Enrichment:** With `--enrich` or `--enrich-only`, the scraper uses the Genius API (requires `GENIUS_CLIENT_ID` and `GENIUS_CLIENT_SECRET` in `.env`) to add metadata to each song: `pageviews`, `producers`, `writers`, `featuredArtists`, `releaseDate`, `songArtUrl`. The `--enrich-only` flag skips HTML scraping and just enriches existing data.

### Dev Tools (vite-plugin-dev-api.js)

Vite plugin loaded only in dev mode. Adds middleware:
- `GET /api/search?q=...` — Searches Genius.com API for artists
- `POST /api/scrape` — Spawns scraper as child process
- `GET /api/manifest` — Returns current manifest

### Lyrics Data Shape

```json
{
  "artist": "Wu-Tang Clan",
  "albums": [{
    "title": "...",
    "coverArtUrl": "...",
    "songs": [{
      "title": "...",
      "url": "https://genius.com/...",
      "pageviews": 2455660,
      "producers": ["RZA"],
      "writers": ["RZA", "GZA", "..."],
      "featuredArtists": [],
      "releaseDate": "November 9, 1993",
      "verses": [{ "type": "verse", "artists": ["RZA"], "lyrics": "..." }]
    }]
  }]
}
```

### Key Patterns

- React 19 with hooks (`useState`, `useEffect`), functional components only
- ES modules throughout (`"type": "module"` in package.json)
- Hash-based deep linking (`#/{slug}/album/{title}/{song}`) via custom `useHashRouter` hook
- Artist name matching uses config-driven aliases (generic, not hardcoded)
- Production builds are fully static (no backend required)
