---
name: analytics-ui-uplift
description: Use when refreshing an analytics or dashboard UI, especially inline HTML/CSS or server-rendered pages that need stronger visual hierarchy, premium depth, cleaner typography, and better empty-state framing without changing product behavior.
---

# Analytics UI Uplift

## Overview

Use this skill to modernize dense product surfaces such as chat workspaces, admin dashboards, connection wizards, and report viewers. It is tuned for product UI, not marketing sites: the result should feel sharper, calmer, and more premium while preserving workflow clarity.

## When To Use

- The UI feels flat, cramped, or visually repetitive.
- Multiple pages share a shell and need a coherent design system.
- The product has strong behavior already, but the presentation needs better hierarchy.
- The implementation is server-rendered HTML, template strings, or low-abstraction CSS where a direct visual pass is faster than a full component rewrite.

Do not use this skill to:

- Introduce decorative 3D widgets that distract from data work.
- Replace proven workflows with novelty navigation.
- Turn enterprise product UI into a portfolio clone.

## Workflow

1. Audit the surface before editing.
   Identify the real product zones first: shell, navigation, page hero, working canvas, primary actions, secondary controls, empty states.

2. Upgrade the shell before the details.
   Improve typography, spacing, background atmosphere, panel layering, and navigation emphasis first. This usually creates most of the perceived uplift.

3. Keep the information hierarchy obvious.
   The top of each page should answer:
   - where the user is
   - what this page is for
   - what action matters next

4. Use depth deliberately.
   Prefer layered surfaces, soft edge lighting, subtle gradients, and restrained shadows over flashy ornament. Product UI should feel dimensional, not noisy.

5. Add motion only where it helps.
   Good targets: page reveal, hover lift, active-state emphasis, sidebar/card transitions. Avoid continuous motion that competes with reading.

6. Preserve task density.
   Tables, cards, and chat bubbles can become more beautiful, but they still need to scan quickly. Never sacrifice readability for spectacle.

7. Validate in a real browser.
   Check desktop first, then a narrower viewport. Look for:
   - clipped or overflowing copy
   - washed-out contrast
   - overly dark empty space
   - action buttons that no longer read as primary

## Design Rules

### Typography

- Prefer a more polished sans family such as `Mona Sans` or another expressive non-default face if allowed by the app.
- Keep a monospace face only for code, metrics, ids, and system metadata.
- Use fewer all-caps labels; reserve them for overlines, pills, and minor metadata.

### Color And Atmosphere

- Build the page from 3 layers:
  - ambient background
  - structural surfaces
  - accent light
- Use 1 clear accent family. In analytics products, blue or cyan accents usually read best.
- Let background gradients create presence, but keep work surfaces darker and calmer than the ambient field.

### Surfaces

- Primary content areas should feel anchored with stronger contrast and softer corners.
- Secondary rails can be slightly darker and denser.
- Cards should vary by role:
  - hero / intro
  - standard container
  - compact metric
  - actionable state card

### Empty States

- Do not leave the working canvas visually empty.
- Give the top of the canvas a purpose with a concise page lead, product framing, or capability chips.

### Product-Safe Motion

- Default to 120-320ms transitions.
- Use motion for hover, focus, reveal, or active state changes.
- Avoid infinite looping unless it communicates live status.

## References

- For the extracted visual cues from the `3D_Portfolio` reference, read `references/portfolio-signals.md`.
- For mapping those cues into this repo's page-template architecture, read `references/project-overload-web-map.md`.

## Implementation Notes

- In this repo, prefer touching the page renderers first:
  - `apps/web/src/page.ts`
  - `apps/web/src/connect-page.ts`
  - `apps/web/src/usage-page.ts`
  - `apps/web/src/config-page.ts`
  - `apps/web/src/login-page.ts`
- When behavior is stable and markup is inline, a visual pass is often safer than a component-system rewrite.
- If multiple pages duplicate the same shell, keep the visual language synchronized even if the code remains duplicated.
