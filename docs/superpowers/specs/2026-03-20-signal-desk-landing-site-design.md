# Signal Desk Landing Site Design

Date: 2026-03-20  
Project: vibe-review-tool  
Scope: create a bilingual product marketing site with a homepage and a download page for the desktop app

## 1. Objective

Ship a first public-facing landing site for the desktop product.

The site should do two jobs well:

- convert AI-native engineering users into desktop app downloads
- establish a distinct product identity around professional, human-led AI code review

The site should feel like a product release, not like a placeholder docs page and not like a generic template SaaS site.

## 2. Product Positioning

The current desktop app is not another chat shell or another IDE skin.

Its product narrative should be:

- professional AI code review workbench
- human-led review workflow
- explicit issues and re-review before merge
- direct dispatch to Codex, Claude, or Gemini for execution

This landing site should therefore present the product as an editorial review desk:

- the human reviewer identifies and frames the issue
- the AI client performs the repair work
- the human reviewer validates the result

This is the core difference from "one-click AI coding" messaging and it must be visible in the first screen.

## 3. Problem Statement

The repository now has a functional desktop app and automated multi-platform releases, but it does not yet have a dedicated marketing surface that explains why the product exists or gives users a clear download path.

The current problems are:

1. there is no focused homepage that tells the product story
2. there is no mature download page that maps release assets to macOS, Windows, and Linux
3. the product brand is still being inferred from repo context instead of being presented intentionally
4. AI-native users do not get a quick explanation of how this workflow differs from generic AI editing tools

The missing capability is not more release automation.  
It is a site layer that turns the existing product into something understandable and downloadable.

## 4. Chosen Direction

Build a small two-page marketing site:

- `Home`
- `Download`

The site should use a brand-forward editorial visual language.

Working brand direction:

- naming style near `Signal Desk`
- product subtitle near `Professional AI Code Review Workbench`

This name direction is intentionally more distinctive than `Review Desk`, while the subtitle explains what the product is for first-time visitors.

The site should blend two ideas:

- an editorial desk aesthetic for brand memory
- enough AI workflow language to immediately speak to Codex / Claude / Gemini power users

## 5. Audience

Primary audience:

- AI coding power users already familiar with Codex, Claude, Gemini, or similar agent tools

Secondary audience:

- technical reviewers, leads, and senior engineers who want a more disciplined AI-assisted review workflow

This audience has low tolerance for vague marketing.

They need to see:

- a real product surface
- a concrete workflow
- evidence that the tool is already shippable

## 6. Site Architecture

### 6.1 Pages

The first version should include exactly two public routes:

- `/` for homepage
- `/download` for release downloads

Optional localized route handling may add:

- `/zh`
- `/zh/download`

but the first implementation should still conceptually remain a two-page site.

### 6.2 Navigation

Top navigation should stay minimal:

- Product or brand wordmark
- `Workflow`
- `Why It Works`
- `Download`
- language switch

There is no need for blog, docs, pricing, login, or company navigation in V1.

## 7. Homepage Design

### 7.1 Hero

The homepage hero should combine:

- a strong headline
- a short supporting paragraph
- a primary download CTA
- a secondary workflow CTA
- a real product screenshot packaged inside a designed editorial frame

The hero should answer three questions immediately:

1. what is this
2. why is it different
3. where do I download it

Recommended narrative direction:

- reviewer creates explicit issues
- AI client executes repairs
- reviewer inspects the result before merge

The hero must not read like "AI auto-fixes your code".  
The important promise is better judgment and better control.

### 7.2 Workflow Strip

Below the hero, add a compact step strip that explains the loop:

1. capture issue
2. dispatch to AI client
3. AI edits workspace
4. human reviews again

This is necessary because the product concept is not self-evident from screenshots alone.

### 7.3 Why It Works

The next major section should explain why the workflow is more professional than generic prompt-based AI coding:

- explicit review items
- direct AI execution without losing human control
- return-to-review state instead of silent automation
- desktop focus instead of tab sprawl

This section should be prose-forward, with sharp statements instead of feature checklist clutter.

### 7.4 AI Client Support

The homepage should explicitly mention support for:

- Codex
- Claude
- Gemini

The message is not "we have many providers".  
The message is "your existing AI clients can be used inside one review discipline".

### 7.5 Final CTA

The homepage should close with a strong conversion block that routes to `/download`.

This CTA should feel like the end of an editorial argument:

- not "learn more"
- but "get the desktop app"

## 8. Download Page Design

### 8.1 Core Purpose

The download page should do one thing extremely clearly:

- help the user pick the correct platform and download the latest release asset

### 8.2 Asset Presentation

Show three platform cards:

- macOS
- Windows
- Linux

Each card should map the latest GitHub release assets into human-readable choices.

Examples:

- macOS Intel `.dmg`
- macOS Apple Silicon `.dmg`
- Windows `.exe` and `.msi`
- Linux `.AppImage`, `.deb`, `.rpm`

### 8.3 Release Metadata

The page should also show:

- current version
- published date if available
- link to GitHub Release page
- short release notes excerpt or full release notes entry point

### 8.4 Integrity / Verification Surface

The user requested a more mature download experience including checksum-style confidence signals.

However, the current release pipeline does not publish checksums yet.

So V1 behavior should be:

- reserve a release metadata section that can display checksum links later
- show release notes and GitHub source of truth now
- avoid inventing checksum data that does not exist

This keeps the download page honest and expandable.

## 9. Language Strategy

The site should be bilingual:

- English
- Simplified Chinese

English should be the default experience.

Requirements:

- both pages must be fully localized
- language switch must be visible in header
- the active language should persist across page navigation
- localized copy should not rely on machine-translated placeholder phrasing

The English copy should be treated as the canonical product voice for launch, with the Chinese version matching meaning and tone rather than word-for-word structure.

## 10. Visual Direction

The approved direction is the editorial brand route similar to `Signal Desk`.

Visual principles:

- warm paper-like background tones instead of generic white SaaS canvas
- deep ink and red accent colors instead of purple-default AI styling
- typography with character and hierarchy, not neutral corporate blandness
- layout rhythm inspired by a front page or editorial desk
- real product screenshots with designed framing, captions, or annotations

The site should still feel modern and usable on desktop and mobile.

This is not retro for its own sake.  
It is editorial because the product itself is about review judgment.

## 11. Content Model

The content should be intentionally lean.

Do not add:

- company boilerplate
- investor-style claims
- vague "supercharge your productivity" copy
- huge comparison tables
- multiple audience funnels

The content hierarchy should stay tight:

- what the product is
- how the workflow works
- why it is better
- how to download it

## 12. Technical Direction

The first implementation should use a separate site app inside this repository.

Recommended structure:

- `apps/site`

Recommended stack:

- Vite
- React
- TypeScript

Reasons:

- consistent with the existing desktop frontend stack
- fast to ship
- sufficient for a two-page static marketing site
- easy to host on static infrastructure later

The site should not introduce SSR or a CMS in V1.

Those would add complexity without solving the current product need.

## 13. Release Data Integration

The download page should read GitHub release data at runtime from the repository's release API.

Responsibilities:

- fetch latest release
- classify assets by platform and package type
- render only real downloadable artifacts
- degrade gracefully if the GitHub API is unavailable or rate-limited

Graceful fallback behavior:

- show a clear error state
- provide a direct link to the GitHub Releases page

The site must never display fake package cards for assets that are not present.

## 14. Responsive Behavior

Desktop is the primary storytelling surface, but mobile must still work cleanly.

Requirements:

- hero stacks cleanly on narrow screens
- screenshot remains readable as a framed artifact, not a tiny blur
- workflow strip can collapse into a vertical sequence
- download cards reflow into one column on mobile
- language switching and CTA remain accessible without header overflow

## 15. Non-Goals

V1 should not include:

- blog
- docs portal
- live demo
- account system
- newsletter capture
- pricing
- feature comparison matrix
- multi-page marketing taxonomy beyond `Home` and `Download`
- checksum generation pipeline changes

Those can come later if needed.

## 16. Testing Expectations

The final implementation should be verified against:

- bilingual copy rendering on both pages
- release API parsing for current real assets
- empty/error state when release fetch fails
- desktop and mobile layout sanity
- CTA routing between homepage and download page
- asset classification correctness for macOS / Windows / Linux

## 17. Success Criteria

The first version is successful if:

- a first-time visitor can understand the product within one screen
- an AI-native engineer can see why this is not just another AI coding shell
- a user can reach the correct installer in one additional click
- the site feels distinct enough to be remembered
- the download page reflects real release artifacts without manual editing

## 18. Open Naming Decision

The visual and narrative design should proceed using a brand-forward working name in the `Signal Desk` family.

The exact final public product name does not need to block implementation as long as:

- the code keeps brand strings centralized
- the site copy can swap the final name later without layout breakage

This lets design and implementation move forward without pretending the naming process is permanently closed.
