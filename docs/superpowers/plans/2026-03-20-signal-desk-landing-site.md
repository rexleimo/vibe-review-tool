# Signal Desk Landing Site Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual product landing site with a homepage and release-driven download page for the desktop app.

**Architecture:** Add a new standalone `apps/site` Vite + React + TypeScript app that renders two localized routes (`/` and `/download`, plus `/zh` variants), keeps all product copy in centralized locale modules, and maps real GitHub release assets into user-friendly platform download cards at runtime. Keep the site statically deployable, with routing and asset loading isolated from the existing desktop app.

**Tech Stack:** Vite, React, TypeScript, react-router-dom, native `node:test`, GitHub Releases API

---

## File Structure

### New app scaffold

- Create: `apps/site/package.json`
- Create: `apps/site/package-lock.json`
- Create: `apps/site/index.html`
- Create: `apps/site/vite.config.ts`
- Create: `apps/site/tsconfig.json`
- Create: `apps/site/tsconfig.node.json`
- Create: `apps/site/tsconfig.test.json`
- Create: `apps/site/README.md`

### App entry and routes

- Create: `apps/site/src/main.tsx`
- Create: `apps/site/src/App.tsx`
- Create: `apps/site/src/router.tsx`
- Create: `apps/site/src/pages/HomePage.tsx`
- Create: `apps/site/src/pages/DownloadPage.tsx`
- Create: `apps/site/src/pages/NotFoundPage.tsx`

### Shell, sections, and UI components

- Create: `apps/site/src/components/SiteShell.tsx`
- Create: `apps/site/src/components/Header.tsx`
- Create: `apps/site/src/components/LanguageToggle.tsx`
- Create: `apps/site/src/components/HeroSection.tsx`
- Create: `apps/site/src/components/WorkflowStrip.tsx`
- Create: `apps/site/src/components/WhyItWorksSection.tsx`
- Create: `apps/site/src/components/AiClientsSection.tsx`
- Create: `apps/site/src/components/DownloadCtaSection.tsx`
- Create: `apps/site/src/components/PlatformCard.tsx`
- Create: `apps/site/src/components/ReleaseMetaPanel.tsx`
- Create: `apps/site/src/components/DownloadStatePanel.tsx`
- Create: `apps/site/src/components/Footer.tsx`

### Content, routing, and release integration helpers

- Create: `apps/site/src/content/siteCopy.ts`
- Create: `apps/site/src/content/brand.ts`
- Create: `apps/site/src/lib/locale.ts`
- Create: `apps/site/src/lib/routes.ts`
- Create: `apps/site/src/lib/releaseAssets.ts`
- Create: `apps/site/src/lib/githubRelease.ts`
- Create: `apps/site/src/lib/formatting.ts`

### Styling and assets

- Create: `apps/site/src/styles/reset.css`
- Create: `apps/site/src/styles/theme.css`
- Create: `apps/site/src/styles/layout.css`
- Create: `apps/site/src/styles/components.css`
- Create: `apps/site/src/assets/hero-screenshot-frame.webp`
- Create: `apps/site/src/assets/download-preview.webp`

### Tests

- Create: `apps/site/tests/locale.test.mjs`
- Create: `apps/site/tests/routes.test.mjs`
- Create: `apps/site/tests/releaseAssets.test.mjs`
- Create: `apps/site/tests/githubRelease.test.mjs`
- Create: `apps/site/tests/siteCopy.test.mjs`

### Docs and integration

- Modify: `README.md`
- Modify: `.gitignore` (only if `apps/site/dist` or new generated assets need explicit ignore coverage)

---

## Chunk 1: Scaffold The Site App

### Task 1: Create the app shell and build scripts

**Files:**
- Create: `apps/site/package.json`
- Create: `apps/site/index.html`
- Create: `apps/site/vite.config.ts`
- Create: `apps/site/tsconfig.json`
- Create: `apps/site/tsconfig.node.json`
- Create: `apps/site/README.md`

- [ ] **Step 1: Write the failing package/build expectation**

Document the intended script contract in `apps/site/package.json` before implementation:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test:site": "npm run test:site-lib",
    "test:site-lib": "node --test tests/*.test.mjs"
  }
}
```

- [ ] **Step 2: Run the missing-app command to verify RED**

Run:

```bash
cd apps/site && npm run build
```

Expected: fail because `apps/site` does not exist yet.

- [ ] **Step 3: Create the minimal Vite + React + TypeScript scaffold**

Use `apps/desktop` as the reference for Vite/TS config shape, but keep the site isolated.

Minimal starter content:

```tsx
// apps/site/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/reset.css";
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/components.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
cd apps/site && npm install react react-dom react-router-dom
cd apps/site && npm install -D typescript vite @vitejs/plugin-react @types/react @types/react-dom
```

Expected: `package-lock.json` created successfully.

- [ ] **Step 5: Run the build to verify GREEN**

Run:

```bash
cd apps/site && npm run build
```

Expected: Vite build succeeds with the starter app.

- [ ] **Step 6: Commit**

```bash
git add apps/site
git commit -m "feat(site): scaffold landing site app"
```

## Chunk 2: Locale, Routes, And Brand Content

### Task 2: Lock the locale model with test-first helpers

**Files:**
- Create: `apps/site/src/lib/locale.ts`
- Create: `apps/site/src/lib/routes.ts`
- Create: `apps/site/src/content/brand.ts`
- Create: `apps/site/src/content/siteCopy.ts`
- Create: `apps/site/tests/locale.test.mjs`
- Create: `apps/site/tests/routes.test.mjs`
- Create: `apps/site/tests/siteCopy.test.mjs`
- Create: `apps/site/tsconfig.test.json`

- [ ] **Step 1: Write the failing locale tests**

Add explicit behavior tests:

```js
test("resolveLocaleFromPath defaults English for /", () => {
  assert.equal(resolveLocaleFromPath("/"), "en");
});

test("resolveLocaleFromPath returns zh for /zh/download", () => {
  assert.equal(resolveLocaleFromPath("/zh/download"), "zh");
});

test("buildLocalePath maps download route in Chinese", () => {
  assert.equal(buildLocalePath({ locale: "zh", page: "download" }), "/zh/download");
});
```

- [ ] **Step 2: Write the failing content integrity tests**

Require both locales to define the same top-level sections and CTA IDs:

```js
test("site copy contains both locales with matching page keys", () => {
  assert.deepEqual(Object.keys(siteCopy.en), Object.keys(siteCopy.zh));
});

test("brand strings stay centralized", () => {
  assert.ok(brand.productName.length > 0);
  assert.ok(brand.tagline.en.length > 0);
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
cd apps/site && npm run test:site-lib
```

Expected: fail with module-not-found or missing export errors for locale/content helpers.

- [ ] **Step 4: Implement the minimal locale and copy helpers**

Keep copy centralized and serializable. Suggested structure:

```ts
export const siteCopy = {
  en: {
    home: { hero: { eyebrow: "", title: "", body: "" } },
    download: { title: "", intro: "" },
  },
  zh: {
    home: { hero: { eyebrow: "", title: "", body: "" } },
    download: { title: "", intro: "" },
  },
} as const;
```

- [ ] **Step 5: Implement route helpers**

Provide deterministic helpers:

```ts
export function resolveLocaleFromPath(pathname: string): "en" | "zh" { ... }
export function buildLocalePath(input: { locale: "en" | "zh"; page: "home" | "download" }): string { ... }
```

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```bash
cd apps/site && npm run test:site-lib
```

Expected: locale, route, and content tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/lib apps/site/src/content apps/site/tests apps/site/tsconfig.test.json
git commit -m "feat(site): add localized route and content model"
```

### Task 3: Build the two-page router with paired English and Chinese routes

**Files:**
- Create: `apps/site/src/router.tsx`
- Create: `apps/site/src/App.tsx`
- Create: `apps/site/src/pages/HomePage.tsx`
- Create: `apps/site/src/pages/DownloadPage.tsx`
- Create: `apps/site/src/pages/NotFoundPage.tsx`

- [ ] **Step 1: Write the failing route smoke expectation**

Add a simple render-oriented route assertion by exposing route config as data:

```js
test("route table includes four public localized routes", () => {
  assert.deepEqual(publicRoutePaths, ["/", "/download", "/zh", "/zh/download"]);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd apps/site && npm run test:site-lib
```

Expected: fail because `publicRoutePaths` or router module does not exist.

- [ ] **Step 3: Implement route definitions and minimal page shells**

Keep the first implementation plain:

```tsx
export const publicRoutePaths = ["/", "/download", "/zh", "/zh/download"] as const;
```

Pages can initially render placeholders using localized page titles pulled from `siteCopy`.

- [ ] **Step 4: Wire `App.tsx` to the router**

Use `react-router-dom` with a browser router, but keep the base path configurable through Vite env / config if needed later.

- [ ] **Step 5: Run tests and build to verify GREEN**

Run:

```bash
cd apps/site && npm run test:site-lib
cd apps/site && npm run build
```

Expected: route tests pass and the localized route app builds.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/App.tsx apps/site/src/router.tsx apps/site/src/pages
git commit -m "feat(site): add localized home and download routes"
```

## Chunk 3: Homepage Sections And Editorial Visual System

### Task 4: Add the site shell, header, language toggle, and shared footer

**Files:**
- Create: `apps/site/src/components/SiteShell.tsx`
- Create: `apps/site/src/components/Header.tsx`
- Create: `apps/site/src/components/LanguageToggle.tsx`
- Create: `apps/site/src/components/Footer.tsx`
- Create: `apps/site/src/styles/reset.css`
- Create: `apps/site/src/styles/theme.css`
- Create: `apps/site/src/styles/layout.css`
- Create: `apps/site/src/styles/components.css`

- [ ] **Step 1: Write the failing navigation contract tests**

Use pure data exports instead of full DOM tests:

```js
test("header nav exposes the expected anchors", () => {
  assert.deepEqual(primaryNavIds, ["workflow", "why-it-works", "download"]);
});

test("language toggle can compute the paired route", () => {
  assert.equal(buildLanguageSwitchTarget("/download"), "/zh/download");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd apps/site && npm run test:site-lib
```

Expected: fail because nav exports or switch helper is missing.

- [ ] **Step 3: Implement the theme tokens**

Define the editorial system with CSS variables for:

- paper background tones
- ink text
- red accent
- border and card colors
- type scale
- spacing scale

Do not use default purple AI styling or generic white-card SaaS tokens.

- [ ] **Step 4: Implement shell and header components**

Requirements:

- minimal nav
- visible language switch
- stable CTA link to `/download`
- mobile-safe layout without header overflow

- [ ] **Step 5: Run tests and build to verify GREEN**

Run:

```bash
cd apps/site && npm run test:site-lib
cd apps/site && npm run build
```

Expected: helper tests pass and styles/components compile.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/components apps/site/src/styles
git commit -m "feat(site): add shell and editorial visual system"
```

### Task 5: Implement the homepage narrative sections with real localized copy

**Files:**
- Create: `apps/site/src/components/HeroSection.tsx`
- Create: `apps/site/src/components/WorkflowStrip.tsx`
- Create: `apps/site/src/components/WhyItWorksSection.tsx`
- Create: `apps/site/src/components/AiClientsSection.tsx`
- Create: `apps/site/src/components/DownloadCtaSection.tsx`
- Modify: `apps/site/src/pages/HomePage.tsx`
- Create: `apps/site/src/assets/hero-screenshot-frame.webp`

- [ ] **Step 1: Write the failing content tests for the homepage**

Add assertions for required homepage sections:

```js
test("home copy includes workflow steps for both locales", () => {
  assert.equal(siteCopy.en.home.workflow.steps.length, 4);
  assert.equal(siteCopy.zh.home.workflow.steps.length, 4);
});

test("home copy names supported AI clients", () => {
  assert.deepEqual(siteCopy.en.home.aiClients, ["Codex", "Claude", "Gemini"]);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd apps/site && npm run test:site-lib
```

Expected: fail because homepage content shape is incomplete.

- [ ] **Step 3: Expand the content model and implement the homepage sections**

Homepage must include:

- hero
- workflow strip
- why-it-works
- AI clients
- final download CTA

The sections should be driven by content data, not hard-coded duplicated strings in each component.

- [ ] **Step 4: Prepare a real screenshot asset**

Capture a real desktop app screenshot from the current product and package it into a polished framed asset.

Rules:

- do not fabricate a fake UI screenshot
- optimize the file to web-friendly size
- keep the raw screenshot out of the marketing layout if the framed version is cleaner

- [ ] **Step 5: Integrate the screenshot into the hero**

Make the hero feel like a release front page:

- screenshot framed inside the editorial system
- strong headline
- two CTAs
- immediate product differentiation

- [ ] **Step 6: Run tests and build to verify GREEN**

Run:

```bash
cd apps/site && npm run test:site-lib
cd apps/site && npm run build
```

Expected: content tests pass and the homepage builds with the real screenshot asset.

- [ ] **Step 7: Manual visual review**

Run:

```bash
cd apps/site && npm run dev
```

Check manually:

- desktop hero hierarchy
- mobile stacking
- screenshot readability
- workflow strip clarity
- bilingual copy spacing

- [ ] **Step 8: Commit**

```bash
git add apps/site/src/pages/HomePage.tsx apps/site/src/components apps/site/src/content apps/site/src/assets
git commit -m "feat(site): implement homepage narrative and hero"
```

## Chunk 4: Release-Driven Download Page

### Task 6: Implement deterministic release asset classification helpers

**Files:**
- Create: `apps/site/src/lib/releaseAssets.ts`
- Create: `apps/site/src/lib/formatting.ts`
- Create: `apps/site/tests/releaseAssets.test.mjs`

- [ ] **Step 1: Write the failing asset classification tests**

Use the real current asset patterns as fixtures:

```js
const assets = [
  { name: "Review.Editor_0.1.0_aarch64.dmg", browser_download_url: "https://example.test/a.dmg" },
  { name: "Review.Editor_0.1.0_x64-setup.exe", browser_download_url: "https://example.test/w.exe" },
  { name: "Review.Editor_0.1.0_amd64.AppImage", browser_download_url: "https://example.test/l.appimage" },
];

test("classifyReleaseAssets groups macOS, Windows, and Linux downloads", () => {
  const result = classifyReleaseAssets(assets);
  assert.equal(result.macos.primary.label, "macOS (Apple Silicon)");
  assert.equal(result.windows.primary.label, "Windows Installer");
  assert.equal(result.linux.primary.label, "Linux AppImage");
});
```

- [ ] **Step 2: Add failing tests for advanced artifacts**

```js
test("tar.gz app archives are advanced downloads, not primary CTA assets", () => {
  const result = classifyReleaseAssets([
    { name: "Review.Editor_x64.app.tar.gz", browser_download_url: "https://example.test/archive" },
  ]);
  assert.equal(result.macos.primary, null);
  assert.equal(result.macos.advanced.length, 1);
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
cd apps/site && npm run test:site-lib
```

Expected: fail because release asset helpers do not exist.

- [ ] **Step 4: Implement the classifier**

Create a deterministic mapping layer that:

- normalizes raw filenames
- derives platform and architecture
- sets the primary installer per platform
- retains alternate installers
- sends archive artifacts into advanced downloads

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```bash
cd apps/site && npm run test:site-lib
```

Expected: release asset tests pass against the real naming patterns.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/lib/releaseAssets.ts apps/site/src/lib/formatting.ts apps/site/tests/releaseAssets.test.mjs
git commit -m "feat(site): classify release assets for download page"
```

### Task 7: Add the GitHub release client with error and fallback handling

**Files:**
- Create: `apps/site/src/lib/githubRelease.ts`
- Create: `apps/site/tests/githubRelease.test.mjs`

- [ ] **Step 1: Write the failing release fetch tests**

Test the pure transformation layer, not the network itself:

```js
test("mapLatestReleasePayload extracts version, release url, and assets", () => {
  const result = mapLatestReleasePayload(fixturePayload);
  assert.equal(result.version, "0.1.0");
  assert.equal(result.assets.length > 0, true);
});

test("mapLatestReleasePayload rejects malformed GitHub payloads", () => {
  assert.throws(() => mapLatestReleasePayload({}), /assets/i);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd apps/site && npm run test:site-lib
```

Expected: fail because the GitHub release mapping module is missing.

- [ ] **Step 3: Implement the release fetch and mapper**

Split responsibilities:

- `mapLatestReleasePayload` for deterministic validation
- `fetchLatestRelease` for runtime network fetch

Handle:

- success
- malformed payload
- fetch failure / rate limit fallback

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
cd apps/site && npm run test:site-lib
```

Expected: mapping tests pass and the API client compiles.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/githubRelease.ts apps/site/tests/githubRelease.test.mjs
git commit -m "feat(site): add latest release client"
```

### Task 8: Implement the download page UI and fallback states

**Files:**
- Create: `apps/site/src/components/PlatformCard.tsx`
- Create: `apps/site/src/components/ReleaseMetaPanel.tsx`
- Create: `apps/site/src/components/DownloadStatePanel.tsx`
- Create: `apps/site/src/assets/download-preview.webp`
- Modify: `apps/site/src/pages/DownloadPage.tsx`

- [ ] **Step 1: Write the failing download-page content tests**

Add a content-shape test:

```js
test("download copy defines macOS, Windows, and Linux labels in both locales", () => {
  assert.equal(siteCopy.en.download.platforms.length, 3);
  assert.equal(siteCopy.zh.download.platforms.length, 3);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd apps/site && npm run test:site-lib
```

Expected: fail because download copy or page state shape is incomplete.

- [ ] **Step 3: Implement the download page states**

States required:

- loading
- ready
- error fallback with GitHub Releases link

The page should never show empty fake cards for missing assets.

- [ ] **Step 4: Render the platform cards**

Show:

- macOS with Intel and Apple Silicon
- Windows with `.exe` primary and `.msi` alternate
- Linux with `.AppImage` primary and distro packages as alternates

- [ ] **Step 5: Render release metadata**

Show:

- version
- publish date if available
- GitHub Release link
- release notes entry point
- placeholder-ready verification area for future checksums

- [ ] **Step 6: Run tests and build to verify GREEN**

Run:

```bash
cd apps/site && npm run test:site-lib
cd apps/site && npm run build
```

Expected: all library/content tests pass and the localized download page builds.

- [ ] **Step 7: Manual browser review**

Run:

```bash
cd apps/site && npm run dev
```

Check:

- English default route
- `/zh/download`
- platform card ordering
- error fallback by temporarily forcing fetch failure
- mobile layout for stacked cards

- [ ] **Step 8: Commit**

```bash
git add apps/site/src/pages/DownloadPage.tsx apps/site/src/components apps/site/src/content apps/site/src/assets
git commit -m "feat(site): implement release-driven download page"
```

## Chunk 5: Final Integration, Docs, And Verification

### Task 9: Polish metadata, documentation, and launch readiness

**Files:**
- Modify: `apps/site/index.html`
- Modify: `apps/site/README.md`
- Modify: `README.md`

- [ ] **Step 1: Write the failing metadata checklist**

Before editing, verify current HTML metadata is still placeholder/default.

Run:

```bash
sed -n '1,160p' apps/site/index.html
```

Expected: generic Vite defaults still present.

- [ ] **Step 2: Replace placeholder metadata**

Set:

- branded `<title>`
- localized-friendly meta description
- theme color
- social/OG-ready baseline tags if practical without over-scoping

- [ ] **Step 3: Update app-level README**

Document:

- install
- dev
- test
- build
- how release data is sourced

- [ ] **Step 4: Update root README**

Add a short section linking to the new site app and its commands.

- [ ] **Step 5: Run final verification**

Run:

```bash
cd apps/site && npm run test:site-lib
cd apps/site && npm run build
```

Also run one live manual pass:

```bash
cd apps/site && npm run dev
```

Expected:

- tests pass
- build succeeds
- homepage and download page work in English and Chinese
- download page reflects real GitHub release assets

- [ ] **Step 6: Commit**

```bash
git add apps/site README.md
git commit -m "docs(site): finalize landing site metadata and docs"
```

## Review Notes For Executors

- Keep the final public brand name centralized in `src/content/brand.ts` so naming can change later without layout surgery.
- Do not let release API parsing logic leak directly into React components; keep it in `src/lib/githubRelease.ts` and `src/lib/releaseAssets.ts`.
- Do not use fake screenshots. If the current desktop UI has rough edges, frame a real screenshot elegantly rather than inventing a mock UI.
- Keep the Chinese copy idiomatic. Do not ship direct machine-translation phrasing.
- Treat GitHub API failure as a first-class UX state, not as an edge case hidden in console errors.

## Suggested Execution Order

1. Chunk 1
2. Chunk 2
3. Chunk 3
4. Chunk 4
5. Chunk 5

Plan complete and saved to `docs/superpowers/plans/2026-03-20-signal-desk-landing-site.md`. Ready to execute?
