# Signal Desk Site

Standalone Vite + React + TypeScript app for the Signal Desk marketing site.

## Install

```bash
cd apps/site
npm install
```

## Commands

- `npm run dev`: start the local dev server
- `npm run build`: build the production bundle
- `npm run preview`: preview the production build locally
- `npm run test:site`: run site tests

## What The Site Includes

- English routes: `/` and `/download`
- Chinese routes: `/zh` and `/zh/download`
- Editorial homepage for the desktop app narrative
- Release-driven download page that maps GitHub assets into platform cards

## Release Data Source

The download page fetches the latest release at runtime from:

- `https://api.github.com/repos/rexleimo/vibe-review-tool/releases/latest`

The runtime flow is:

1. `src/lib/githubRelease.ts` fetches and validates the latest GitHub release payload.
2. `src/lib/releaseAssets.ts` classifies real assets into macOS / Windows / Linux download groups.
3. If live fetch fails, the site falls back to the most recent browser-cached release or the tracked bundled snapshot in `src/content/releaseSnapshot.ts`.
4. The UI renders ready, loading, or fallback states without inventing fake platform cards.

If GitHub is unavailable or rate limited, the page still prefers real tracked release data before falling back to a GitHub Releases entry point.
