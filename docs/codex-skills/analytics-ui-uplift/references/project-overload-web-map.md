# Project Overload Web Map

## Primary Targets

### `apps/web/src/page.ts`

Main chat workspace.

Focus on:

- sidebar shell
- chat history rail
- chat header
- empty-state / intro area
- composer panel
- message bubble readability

### `apps/web/src/connect-page.ts`

Connection wizard.

Focus on:

- page header framing
- step indicator polish
- source / governance / activate panels
- card hierarchy

### `apps/web/src/usage-page.ts`

Usage dashboard.

Focus on:

- page hero
- metric cards
- table container clarity

### `apps/web/src/config-page.ts`

Global configuration workspace.

Focus on:

- hero framing
- section contrast
- editable form surfaces
- status badges

### `apps/web/src/login-page.ts`

High-leverage first impression.

Focus on:

- stronger brand framing
- cleaner form hierarchy
- clearer trust/credential hint treatment

## Safe Change Zones

- CSS variables
- background layers
- card styles
- headings and supporting copy
- static markup wrappers for page leads and content framing

## Risky Zones

- chat state / command handling logic
- data-preparation flow logic
- DOM ids used by existing scripts
- request/response payload wiring

When improving the UI, keep DOM ids and script hooks stable unless the behavioral code is updated at the same time.
