# Review Editor i18n Roadmap

## Goal
Build a stable i18n foundation for the desktop GUI, starting from Chinese/English and scaling to more locales without changing business logic code.

## Current Baseline (2026-03-15)
- UI language switch is available in top controls (`zh-CN` / `en-US`).
- User locale preference is persisted in `localStorage`.
- Core UI labels in `App.tsx` are centralized in one message map.

## Phase 1 - Foundation (done in current iteration)
1. Define locale model (`zh-CN`, `en-US`) and persistence key.
2. Centralize UI text in a dictionary and support variable interpolation.
3. Replace hard-coded labels in the main review workflow.

## Phase 2 - Modularization
1. Move message dictionaries out of `App.tsx` into `src/i18n/messages/*.ts`.
2. Add `I18nProvider` + `useI18n()` hook so components do not import dictionaries directly.
3. Add key naming convention and lint rule to block new hard-coded UI strings.

## Phase 3 - Full Coverage
1. Cover all dialogs, error states, and command feedback strings.
2. Localize date/time formatting with `Intl.DateTimeFormat` by locale.
3. Localize status labels (A/M/D/R...) with tooltip text.

## Phase 4 - Quality Gate
1. Add UI snapshot tests in both locales for key screens:
   - commit review
   - workspace review
   - project center
2. Add CI check:
   - fail if locale keys are missing in any supported language.
   - fail if unused keys exceed threshold.

## Phase 5 - Runtime Language Packs (optional)
1. Load locale bundles dynamically to reduce initial bundle size.
2. Support remote or plugin-provided language packs.

## Engineering Notes
- Keep translation keys stable; avoid using source text as keys.
- Keep text interpolation simple (`{count}`, `{date}`) and deterministic.
- Avoid concatenating translated fragments in code.
