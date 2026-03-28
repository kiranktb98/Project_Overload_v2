---
name: project-click-3d-ui
description: Build or refine premium customer-facing Project Click pages with a bold luxury 3D direction. Use when creating marketing or product-shell UI that should feel cinematic, scroll-led, layered, and high-end using React, MUI, React Three Fiber, drei, and GSAP, especially for landing, features, samples, pricing, and signed-in workflow surfaces that need a desktop-first story with a compressed mobile version.
---

# Project Click 3D UI

Use this skill to turn Project Click pages into polished 3D experiences without slipping into game-like or developer-facing design.

## Core Workflow

1. Read [references/visual-direction.md](references/visual-direction.md) to align on luxury styling and how to translate the Apple and MSI references.
2. Read [references/motion-rules.md](references/motion-rules.md) before adding scroll, parallax, camera movement, or staged reveals.
3. Read [references/page-patterns.md](references/page-patterns.md) when building a full page or scroll narrative.
4. Keep all copy customer-facing and conversion-oriented.
5. Verify in a real browser on desktop and mobile before finishing.

## Stack Rules

- Use `@react-three/fiber` for true depth, planes, particles, lighting, and camera motion.
- Use `@react-three/drei` for helpers such as `Float`, `Environment`, `Text`, `Image`, `PerspectiveCamera`, `MeshTransmissionMaterial`, and `RenderTexture` when appropriate.
- Use `gsap` with `ScrollTrigger` for scroll choreography, pinning, staged reveals, and crossfades.
- Keep MUI for layout, responsive utilities, buttons, chips, and forms unless a custom surface is clearly better.
- Prefer image planes and procedural depth over heavy GLB assets unless a 3D model materially improves the page.

## Guardrails

- Keep the experience premium, not playful.
- Avoid purple bias, neon gamer palettes, generic SaaS blobs, and internal product-route labels.
- Do not describe the UI as a wireframe, demo, scaffold, preview, or prototype in customer-facing copy.
- Treat mobile as the same story compressed, not a different story.
- Respect reduced-motion users with toned-down transforms and shorter timelines.
- Keep WebGL scenes lightweight enough to degrade gracefully on phones and average laptops.

## Implementation Notes

- Build the 3D layer as a reusable scene component and keep textual content in normal React/MUI structure.
- Sync scene state to scroll progress rather than relying on autoplay motion alone.
- Use strong lighting contrast, restrained color count, and luxurious spacing.
- Favor a small number of memorable moments over many competing animations.
