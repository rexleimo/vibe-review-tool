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
- `npm run build:pages`: build the production bundle for GitHub Pages
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

## GitHub Pages Deployment

The repository publishes this site through `.github/workflows/deploy-site-pages.yml`.

- Trigger: every push to `main` that touches `apps/site/**` or the workflow file itself
- Runtime: GitHub Actions + GitHub Pages artifact deploy
- Output: `apps/site/dist`

The build step also exports static entry files for:

- `/download`
- `/zh`
- `/zh/download`
- `/404.html`

This keeps the React Router paths directly reachable on GitHub Pages instead of only working after client-side navigation from `/`.

## Custom Domain

One-time GitHub setup:

1. Open `Settings -> Pages`
2. Set `Source` to `GitHub Actions`
3. Set `Custom domain` to `review.rexait.top`
4. Enable `Enforce HTTPS` after GitHub finishes certificate provisioning

DNS setup:

- Create a `CNAME` record for `review.rexait.top`
- Point it to `rexleimo.github.io`
