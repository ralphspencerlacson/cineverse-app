# Cineverse

React and Vite movie discovery app with Supabase-backed watchlists and playback progress.

[Live demo](https://cineverse.ralphscl.com/)

## Development

Use Node.js 22 or later. From `web`, install dependencies with `yarn install --frozen-lockfile`, configure your local `.env`, and run `npm run dev`. The development server uses port 9022.

Required environment variables:

- `VITE_TMDB_BASEURL`, `VITE_TMDB_TOKEN`, `VITE_TMDB_ASSET_BASEURL`
- `VITE_OMDB_BASEURL`, `VITE_OMDB_TOKEN`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

Player links are managed in Supabase `cineverse.player_sources`. Only enabled sources supporting the selected media type are used; there are no built-in fallback sources.

Supabase uses the `cineverse` schema and the `watchlist_items` and `video_progress` tables. The configured key is a browser publishable key; access control must be enforced by the database's existing row policies.

## Checks

Run `npm run check` from `web` to run lint, regression tests, and the production build. `npm run lint`, `npm test`, and `npm run build` can also run separately.

The regression suite uses Node's test runner, VM modules, and Vite's JSX transform with mocked services. It exercises account changes during sync, concurrent edits, offline removals, write ordering, and provider-reported playback progress. No live account or API credentials are needed for tests. Browser keyboard behavior and third-party player compatibility still require manual verification.

## Sync behavior

Watchlist edits persist locally and attempt remote writes immediately. Failed edits are reconciled on login, reconnection, manual sync, and the periodic sync. Per-account removal markers survive reloads and suppress stale remote entries; explicitly adding or importing a title clears its marker. These markers are local to the browser, not database-wide deletion records.

Playback progress uses timestamps reported by the embedded provider. Providers that do not report progress cannot advance resume position or automatically complete a title. Elapsed time while loading, buffering, or awaiting telemetry does not count as watched time.
