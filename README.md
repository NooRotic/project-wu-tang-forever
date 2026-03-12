# Lyrics Explorer

A multi-artist web app for scraping, browsing, and deep-diving into lyrics from Genius.com. Built with Vite + React. Deploys as a fully static site — no backend required.

Originally built around Wu-Tang Clan. Supports any artist or group with per-artist theming via JSON config.

![Landing page](docs/screenshots/01-landing.png)

---

## Features

- **Scrape any artist** from Genius.com via CLI or in-browser dev tools
- **Browse albums and songs** with cover art, Genius view counts, release dates, and credits
- **Member dashboard** — per-member stats: song counts, total bars, max bars, avg bars/song, unique vocabulary, solo verses, and total Genius views
- **Live word frequency search** — type any word and see counts per member in real time
- **Member appearances** — click any member to see every verse they appear on, grouped by album
- **Bio page** — radial member tree with individual bios (groups), or simple bio (solo artists)
- **Per-artist theming** — colors, fonts, and logos driven entirely by `config.json`
- **Dev tools** — search Genius.com and trigger scrapes directly from the browser in dev mode
- **69 unit tests** with Vitest covering scraper logic, utility functions, and theme functions

---

## Screenshots

### Albums
![Albums grid](docs/screenshots/02-albums.png)

### Album Songs
![Album songs](docs/screenshots/03-album-songs.png)

### Song Lyrics
![Song lyrics](docs/screenshots/04-song-lyrics.png)

### Member Dashboard
![Dashboard](docs/screenshots/05-dashboard.png)

### Member Appearances
![Member appearances](docs/screenshots/06-member.png)

### Bios
![Bio page](docs/screenshots/07-bio.png)

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Adding a New Artist

### Option A: CLI Scraper

```bash
# Scrape any artist by their Genius.com slug
npm run scrape -- --artist "Kendrick Lamar" --slug Kendrick-lamar

# Enrich with API metadata (pageviews, producers, writers, release dates)
npm run scrape -- --artist "Kendrick Lamar" --slug Kendrick-lamar --enrich

# Large catalogs: scrape in chunks
npm run scrape -- --artist "Nas" --slug Nas --chunk-size 25 --offset 0
npm run scrape -- --artist "Nas" --slug Nas --chunk-size 25 --offset 25
```

The scraper will:
- Fetch all albums and songs from Genius.com
- Parse lyrics into typed, artist-attributed verses
- Save to `public/data/artists/{slug}/lyrics.json`
- Auto-generate a `config.json` template (detects group vs solo artist)
- Update `public/data/manifest.json` so the artist appears on the landing page

### Option B: Dev Tools (in-browser)

In dev mode, a **Dev Tools** panel appears at the bottom of the landing page. Search for an artist by name and click **Scrape** to add them without leaving the browser.

### Enriching with API Metadata

To add pageviews, producers, writers, featured artists, and release dates, set up a Genius API app and add credentials to `.env`:

```
GENIUS_CLIENT_ID=your_client_id
GENIUS_CLIENT_SECRET=your_client_secret
```

Then run with `--enrich` or enrich existing data with `--enrich-only`.

---

## Customizing an Artist

Edit `public/data/artists/{slug}/config.json`:

```json
{
  "slug": "wu-tang-clan",
  "name": "Wu-Tang Clan",
  "type": "group",
  "theme": {
    "primaryColor": "#F8D000",
    "primaryColorHover": "#fff200",
    "headerFont": "'Oswald', Impact, Arial Black, Arial, sans-serif",
    "logo": "/data/artists/wu-tang-clan/logo.png"
  },
  "members": [
    { "name": "RZA", "slug": "rza", "color": "#F8D000", "aliases": ["Bobby Digital", "Prince Rakeem"] }
  ],
  "tagline": "Wu-Tang is for the children.",
  "dashboardTitle": "Wu-Tang Dashboard"
}
```

The `aliases` array is used to attribute verses correctly when credits use stage names or alternate spellings.

---

## Project Structure

```
public/data/
  manifest.json                   # All available artists (landing page)
  artists/{slug}/
    config.json                   # Theme, members, aliases
    lyrics.json                   # Scraped lyrics + metadata
    logo.png                      # Artist logo (optional)
    members/{slug}.json           # Member bios (groups)

src/
  components/                     # React UI (LandingPage, ArtistView, ArtistBio, DevToolbar)
  hooks/                          # useArtistData, useTheme, useHashRouter
  utils/artistUtils.js            # matchMember, formatViews, getDashboardStats

scrape-lyrics.js                  # Genius.com scraper
vite-plugin-dev-api.js            # Dev-only API middleware
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at localhost:5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Run unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run scrape -- --artist "..." --slug ...` | Scrape an artist |
| `npm run scrape:wu-tang` | Scrape Wu-Tang Clan |

---

## License

MIT
