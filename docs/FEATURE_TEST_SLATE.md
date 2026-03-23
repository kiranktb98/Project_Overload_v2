# Feature Test Slate

Use this checklist for any new feature before calling it done.

## Core expectations
- Keep the diff minimal and limited to the relevant modules.
- Add tests close to the changed code.
- Do not weaken existing SQL guardrails.
- Preserve evidence row cap behavior (`<= 200` rows).
- Keep database access read-only (`SELECT` only).

## Required test coverage

### 1. Unit tests
- Pure logic helpers
- State transition logic
- Parsing and normalization
- Zod boundary validation
- Prompt/output normalization if the feature touches LLM boundaries

### 2. API / integration tests
- Happy path
- Invalid input
- Missing state
- Upstream failure handling
- Persistence behavior if chat state, saved runs, or stored sessions are affected

### 3. Web flow tests
- Exact user path through the feature
- Button visibility at the correct time
- Correct state transitions
- No stale UI from prior steps
- Reload behavior if state persistence matters

### 4. Provider parity tests
Run when the feature touches query generation, data preparation, or connection-aware behavior.

- Postgres
- MySQL
- Snowflake
- BigQuery

### 5. Guardrail tests
- No write access regression
- Allowlist enforcement still holds
- Evidence row cap remains enforced
- Governed query behavior remains safe

### 6. Neighboring regression tests
Run neighboring flow checks when the feature touches shared orchestration or shared UI.

- Single-query flow
- Multi-query flow
- Report generation
- Report clarification
- Business case flow
- Connect / governance / activate flow when connection state is involved

### 7. Browser smoke tests
- Desktop pass for the affected feature flow
- Mobile or smaller viewport pass if UI changes are involved
- Back / go back behavior
- Error state visibility
- Success state visibility

### 8. Final verification
- Focused Vitest runs
- Relevant `tsc --noEmit`
- `pnpm lint`

## Working style
- Prefer one strong happy-path browser pass over scattered manual clicks.
- Add explicit regression coverage for the exact bug or user-visible behavior being changed.
- If a feature affects multiple layers, verify each layer directly instead of relying on one end-to-end pass.
