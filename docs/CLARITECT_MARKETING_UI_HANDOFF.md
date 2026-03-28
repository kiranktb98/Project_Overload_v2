# Claritect Marketing UI Handoff

This handoff is for the UI designer / front-end collaborator who will redesign the public Claritect marketing pages.

## Scope

You can redesign these public pages freely:

- `/`
- `/pricing`

You can also prepare additions in the same visual system for:

- `/terms`
- `/privacy`
- `/refund-policy`
- `/security`

Those policy pages are not wired yet, but they should use the same public shell and visual language.

## What Must Not Be Touched

Do not redesign or restructure the authenticated product app in this pass:

- `/app`
- `/login`
- `/admin/login`
- anything under the chat, connect, scheduled, usage, config, or admin product shell

Do not change:

- product auth flows
- API routes
- database logic
- scheduling logic
- report-generation logic
- proxy behavior

This pass is only for the public marketing layer.

## Current Marketing Architecture

The public pages are intentionally isolated from the product shell.

Primary files:

- [apps/web/src/marketing-page.ts](D:/Project%20Overload/Project_Overload_v2/apps/web/src/marketing-page.ts)
- [apps/web/src/marketing-build.ts](D:/Project%20Overload/Project_Overload_v2/apps/web/src/marketing-build.ts)
- [apps/web/src/marketing-content.ts](D:/Project%20Overload/Project_Overload_v2/apps/web/src/marketing-content.ts)
- [apps/web/src/marketing-client/home.tsx](D:/Project%20Overload/Project_Overload_v2/apps/web/src/marketing-client/home.tsx)
- [apps/web/src/marketing-client/pricing.tsx](D:/Project%20Overload/Project_Overload_v2/apps/web/src/marketing-client/pricing.tsx)
- [apps/web/src/marketing-client/scene.tsx](D:/Project%20Overload/Project_Overload_v2/apps/web/src/marketing-client/scene.tsx)
- [apps/web/src/marketing-client/shared.css](D:/Project%20Overload/Project_Overload_v2/apps/web/src/marketing-client/shared.css)

How it works:

- Fastify still owns the routes.
- `marketing-page.ts` renders the public shell and mounts the client bundle.
- `marketing-build.ts` builds isolated page bundles for home and pricing.
- The product app remains server-rendered and separate.

## Best Return Format

The easiest format for reintegration is:

1. updated `home.tsx`
2. updated `pricing.tsx`
3. any new shared marketing components or helpers inside `apps/web/src/marketing-client/`
4. updated `shared.css`
5. any new lightweight assets used by those pages

If the redesign needs new files, keep them under:

- `apps/web/src/marketing-client/`
- `apps/web/src/assets/`

If the redesign needs copy updates, keep them in:

- `apps/web/src/marketing-content.ts`

## Design Constraints

The marketing pages should be premium, cinematic, and desktop-first, but still readable and product-safe.

Brand system:

- Base: `#0F0B1A`
- Accent gradient: `#6C3AED -> #EC4899`
- Supporting input: `#6B5C8A`
- Supporting output: `#F5F3FF`

Typography:

- `Inter`
- `Sohne`
- `Suisse Intl`

Rules:

- use gradient sparingly
- maintain strong contrast
- keep copy readable over motion
- avoid game-like or neon-heavy treatment
- mobile should be compressed, not redesigned as a different story

## Navigation Requirements

Public nav should continue to support:

- Home
- Pricing
- Customer Login
- Admin
- Book a Live Pilot

Footer should stay public-facing and separate from the product shell.

## Content Requirements

The homepage should stay focused on:

- recurring business questions
- governed data access
- report generation
- scheduled intelligence
- follow-up clarifications
- business-case support

Do not reintroduce the old PM-specific framing. The persona can be any operator or business owner with a recurring company question.

The pricing page should continue to include the comparison benchmark between:

- Claritect
- self-serve AI tools
- regular analysts

## Policy Pages

If policy page designs are included, build them to fit the same public shell. They should be calmer than the homepage but still clearly Claritect.

Expected policy page style:

- simple hero / page title
- structured legal content
- readable widths
- no heavy 3D choreography
- same nav and footer as the public site

## Codex Skills Included

The repo now contains the same Codex skills used to build and polish the public site:

- [docs/codex-skills/analytics-ui-uplift/SKILL.md](D:/Project%20Overload/Project_Overload_v2/docs/codex-skills/analytics-ui-uplift/SKILL.md)
- [docs/codex-skills/project-click-3d-ui/SKILL.md](D:/Project%20Overload/Project_Overload_v2/docs/codex-skills/project-click-3d-ui/SKILL.md)

These should be used together:

- `project-click-3d-ui` for the cinematic marketing direction
- `analytics-ui-uplift` for hierarchy, polish, and product-safe clarity

## Integration Promise

Yes, if the redesign comes back as just:

- home
- pricing
- shared marketing files/assets

we can reintegrate it without touching the main Claritect product app.

That same path also works for adding:

- terms
- privacy
- refund policy
- security / trust page

after the marketing redesign lands.
