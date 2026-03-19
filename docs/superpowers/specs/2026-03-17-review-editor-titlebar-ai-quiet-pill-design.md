# Review Editor Titlebar AI Quiet Pill Design

Date: 2026-03-17  
Project: review-editor  
Scope: refinement of the integrated titlebar AI entry

## 1. Objective

Refine the titlebar `AI` entry so it feels like a high-value tool control inside the integrated Arc-style titlebar, not a bright CTA or a generic toolbar button.

## 2. Problem Statement

The current `AI` entry is functional, but still reads closer to a utility button than a premium product control.

Risks in the current form:

- too close to a normal toolbar button
- not visually aligned with the quiet premium direction
- could overcompete with the central review context if brightened incorrectly

## 3. Chosen Direction

Use a `Quiet Pill` treatment.

This means:

- low-contrast dark surface
- restrained blue edge or inner glow
- compact label
- subtle hover change only

The button should communicate:

- this is important
- this is available
- this does not dominate the titlebar

## 4. Visual Rules

### 4.1 Base appearance

- dark translucent or near-solid background
- pill radius
- thin cool-toned border
- slightly brighter text than secondary controls

### 4.2 Emphasis level

Keep emphasis between:

- stronger than `Refresh`
- weaker than a primary CTA

It should feel like a premium tool entry, not a conversion button.

### 4.3 Hover behavior

Hover should only:

- slightly lift contrast
- slightly strengthen the cool edge tint

Avoid:

- strong glow bloom
- bright fill transitions
- size jumps or flashy animation

## 5. Relationship to Adjacent Controls

The `AI` pill should sit comfortably beside:

- `Refresh`
- mode switch

Hierarchy:

- center review context remains primary
- `AI` pill is secondary but intentional
- `Refresh` remains tertiary

## 6. Implementation Scope

Included:

- refine `AI` button styling
- slightly rebalance adjacent control contrast if needed

Excluded:

- AI backend behavior
- new AI menu actions
- wider titlebar layout changes

## 7. Definition of Done

This refinement is complete when:

- the `AI` entry feels more premium and product-like
- it no longer reads as a bright CTA
- it remains easy to find
- it does not compete with the central review context

