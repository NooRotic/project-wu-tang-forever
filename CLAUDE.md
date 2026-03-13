# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lyrics Explorer — a multi-artist Vite + React platform for browsing and displaying scraped Genius.com lyrics data. Supports any musical artist or group with per-artist theming via JSON config files. Includes a generalized Node.js scraper and dev-mode tools for searching/adding new artists. Deploys as a fully static site.

Wu-Tang Clan is the original and primary artist template.

## Commands

- `npm run dev` — Start Vite dev server (localhost:5173) with dev API plugin
- `npm run build` — Production build to dist/ (static, no backend)
- `npm run build:artists -- {slug}` — Build for one or more artists only; removes others from dist/
- `npm run preview` — Serve production build locally
- `npm run lint` — ESLint on all files
- `npm test` — Run all unit tests (Vitest, 70 tests)
- `npm run test:watch` — Vitest in watch mode
- `npm run scrape -- --artist "Artist Name" --slug Genius-slug` — Scrape any artist from Genius.com
- `npm run scrape -- --artist "Artist Name" --slug Genius-slug --enrich` — Scrape + enrich with API metadata
- `npm run scrape -- --artist "Artist Name" --slug Genius-slug --enrich-only` — Enrich existing data only
- `npm run scrape:wu-tang` — Scrape Wu-Tang Clan specifically
- `npm run scrape:wu-tang:chunk1/2/3` — Chunked scraping (25 songs per chunk with offset)
- `npm run enrich:wu-tang` — Re-enrich Wu-Tang data with Genius API metadata
- `npm run enrich:member-images -- {slug}` — Download member photos locally from Genius API

## Architecture

### Data Pipeline

Genius.com → `scrape-lyrics.js` (Node.js, axios + cheerio) → `public/data/artists/{slug}/lyrics.json` → React frontend fetches JSON at runtime.

Member images: `scripts/enrich-member-images.js` fetches image URLs from Genius API, tries multiple candidates in order, downloads the first successful one to `public/data/artists/{slug}/members/{slug}.jpg`, and stores the local path in `members/{slug}.json`. Fallback: dev UI edit button.

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
        {member-slug}.json          # Bio text, facts wiki link, image path
        {member-slug}.jpg           # Downloaded photo (local, served as static asset)
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
    { "name": "RZA", "slug": "rza", "color": "#F8D000", "aliases": ["Bobby Digital"], "wiki": "..." }
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
- **components/LandingPage.jsx** — Fetches `manifest.json`, renders artist card grid. Includes "What is this?" About modal. In dev mode, shows DevToolbar for search/scrape.
- **components/ArtistView.jsx** — Main artist experience. Loads config + lyrics via `useArtistData` hook, applies theme. Three views: albums, dashboard (member stats + multi-word frequency search), member appearances.
- **components/ArtistBio.jsx** — Biography with radial member tree (groups) or simple bio (solo). Loads member bios and photos from `/data/artists/{slug}/members/`. `MemberCircle` renders circle-masked photos with `object-fit: cover`. In dev mode (`import.meta.env.DEV`), shows a ✎ edit button per member that allows pasting a URL (auto-downloaded server-side) or uploading a local file.
- **components/DevToolbar.jsx** — Dev-only: searches Genius.com via `/api/search`, triggers scraping via `/api/scrape`. Tree-shaken out of production builds.

### Hooks

- **useArtistData(slug)** — Fetches `config.json` + `lyrics.json` in parallel. Returns `{ config, data, loading, error }`.
- **useTheme** — `applyTheme(config)` sets CSS variables on `:root` from config.theme. `resetTheme()` clears them. Updates document title to `{Artist Name} Lyrics Explorer`.

### Utils (src/utils/artistUtils.js)

Pure functions extracted for testability:
- `matchMember(creditedName, members)` — finds a member by name or alias (case-insensitive)
- `formatViews(n)` — formats numbers as `1.5K` / `2.5M` strings
- `getDashboardStats(albums, members, wordQueries)` — aggregates per-member stats; `wordQueries` is an array of words to count independently, returns `wordCounts: { word: count }` per member

### CSS Variables

All theming is driven by CSS custom properties defined in `src/index.css` and overridden at runtime by `useTheme`:

- `--color-primary`, `--color-primary-hover`, `--color-primary-glow`, `--color-primary-faint`
- `--color-bg`, `--color-bg-card`, `--color-text`
- `--font-heading`

### Scraper (scrape-lyrics.js)

Generalized for any artist. Required CLI args: `--artist "Name"` and `--slug Genius-slug`. Optional: `--chunk-size`, `--offset`, `--chunks`, `--clear`, `--enrich`, `--enrich-only`. Auto-generates `config.json` template and updates `manifest.json` after scraping. Saves progress to `.tmp.json` with atomic rename on completion.

Exports for testing: `cleanSongTitle`, `parseArgs`, `parseLyricsIntoVerses`, `generateConfigTemplate`, `updateManifest`. The `main()` call is guarded so importing the module in tests does not trigger execution.

**API Enrichment:** With `--enrich` or `--enrich-only`, the scraper uses the Genius API (requires `GENIUS_CLIENT_ID` and `GENIUS_CLIENT_SECRET` in `.env`) to add metadata to each song: `pageviews`, `producers`, `writers`, `featuredArtists`, `releaseDate`, `songArtUrl`. The `--enrich-only` flag skips HTML scraping and just enriches existing data.

### Dev Tools (vite-plugin-dev-api.js)

Vite plugin loaded only in dev mode. Adds middleware:
- `GET /api/search?q=...` — Searches Genius.com API for artists
- `POST /api/scrape` — Spawns scraper as child process
- `GET /api/manifest` — Returns current manifest
- `POST /api/update-member-image` — Saves a member photo locally. Body: `{ artistSlug, memberSlug, imageUrl?, imageBase64?, imageExt? }`. External URLs are downloaded server-side; base64 payloads are decoded and written directly. Always stores a local `/data/...` path in the JSON — never an external URL.

### Test Suite

70 tests across three files using Vitest:
- `scrape-lyrics.test.js` — 35 tests: `cleanSongTitle`, `parseArgs`, `parseLyricsIntoVerses`
- `src/utils/artistUtils.test.js` — 27 tests: `matchMember`, `formatViews`, `getDashboardStats`
- `src/hooks/useTheme.test.js` — 8 tests: `applyTheme`, `resetTheme` (jsdom environment)

### Scripts (scripts/)

- **`enrich-member-images.js`** — Fetches member images from Genius API. Builds a candidate list (exact name matches first, then partial; existing external URL tried first if present). Tries each candidate in order, downloads the first successful one. Skips members that already have a local path. Logs `[fail]` for members where all candidates failed — use the dev UI edit button for those.
- **`build-artists.js`** — Runs a Vite production build via the JS API, then removes unselected artist directories from `dist/` and rewrites `dist/data/manifest.json` to only include selected artists.

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

- React 19 with hooks (`useState`, `useEffect`, `useMemo`), functional components only
- ES modules throughout (`"type": "module"` in package.json)
- Hash-based deep linking (`#/{slug}/album/{title}/{song}`) via custom `useHashRouter` hook
- Artist name matching uses config-driven aliases (generic, not hardcoded)
- Dev-only features gated with `import.meta.env.DEV` — tree-shaken from production builds
- Member images stored as local static assets under `public/data/` — no external URL dependencies at runtime
- Production builds are fully static (no backend required)
- Windows MSYS2/Git Bash environment — avoid `execSync`/shell spawning; use Vite JS API (`import { build } from 'vite'`) and normalize Windows paths with `.replace(/^\/([A-Z]:)/, '$1')`
