# Coding Conventions

## TypeScript

- Strict mode is on. No `any`. No type assertions (`as Foo`) unless absolutely unavoidable — if you use one, add a comment explaining why.
- Prefer `interface` for object shapes that describe data; use `type` for unions, intersections, and aliases.
- Export types from `src/types/` — do not define shared types inline in component files.
- Use named exports everywhere. No default exports except for Next.js page files (`src/app/**/page.tsx`, `layout.tsx`).

## File naming

- Components: `PascalCase.tsx` (e.g. `FeatureCard.tsx`)
- Hooks: `camelCase.ts` starting with `use` (e.g. `useSimulation.ts`)
- Pure modules: `camelCase.ts` (e.g. `engine.ts`, `storage.ts`)
- Tests: mirror the source path with `.test.ts` or `.spec.ts` suffix
- Feature specs: `feat-NNN-short-name.md` (e.g. `feat-001-speed-control.md`)

## React components

- One component per file.
- Props interface defined in the same file, named `[ComponentName]Props`.
- No prop drilling beyond 2 levels — lift state or use context.
- Use `React.memo` only when profiling shows a real performance problem.
- Event handlers named `handle[Event]` (e.g. `handleAddRole`, `handleSpeedChange`).
- Callbacks passed as props named `on[Event]` (e.g. `onAddRole`, `onSpeedChange`).

## Hooks

- Custom hooks live in `src/hooks/`.
- Each hook has a single responsibility.
- Hooks that manage simulation state return a stable API — state reads and action dispatchers separated clearly.

## Comments and documentation

The codebase is written for a beginner programmer who needs to read and understand it quickly. Comments must explain **what** the code does **and why** it does it that way.

**Required at type / interface level:**
```ts
/** Represents a single item in the product backlog or in-progress work.
 *  Each Feature has a list of Tasks that must all be completed before
 *  the feature is considered done and moved to the Done column. */
interface Feature { ... }
```

**Required at function level (JSDoc):**
```ts
/**
 * Advances the simulation by one time step.
 * Called on every animation frame so it must be fast — this is why
 * we mutate state in place instead of creating a new object each tick.
 *
 * @param state   - The current simulation state (mutated in place)
 * @param dtSim   - How many simulated seconds have passed since the last frame
 * @param settings - Configuration values (WIP limit, backlog size, etc.)
 * @param rng     - Seeded random number generator for deterministic results
 */
export function tick(...) { ... }
```

**Required inline for non-obvious logic:**
```ts
// Cap dtSim so a browser tab that was backgrounded doesn't cause a huge jump
const dtMs = Math.min(100, t - lastT)

// p85 means "85% of features finished faster than this value" —
// a common SLA metric in software delivery
const p85 = sorted[Math.floor(sorted.length * 0.85)]
```

## Simulation engine (`src/simulation/`)

- Pure TypeScript — zero React imports, zero browser APIs.
- All functions are pure (given same input, return same output) except `tick`, which mutates state in place for performance.
- State mutation in `tick` is intentional (avoids allocating on every frame at 60fps). Document this if it ever surprises a reader.
- Export everything as named exports. No `window.*` assignments.

## Styling

- CSS custom properties defined in `src/app/globals.css` are the design system. Do not hardcode color values — always use a variable.
- CSS Modules for component-specific static styles: create `ComponentName.module.css` next to the component file.
- Inline styles only for dynamic values that depend on runtime data (e.g. feature hue, progress percentage).
- No CSS-in-JS libraries.

## Testing

- Unit tests: `tests/unit/` — test pure functions in `src/simulation/` and utility modules in `src/lib/`.
- Component tests: `tests/unit/` — use `@testing-library/react`. Test behavior, not implementation.
- E2E tests: `tests/e2e/` — use Playwright. Test user-facing flows against a running app.
- Test file mirrors source: `src/simulation/engine.ts` → `tests/unit/simulation/engine.test.ts`.
- One `describe` block per module, one `it` per behavior. No nested describes beyond one level.
- No mocking of the simulation engine in component tests — use the real engine with a seeded RNG.

## Imports

- Use `@/` alias for all imports from `src/` (e.g. `import { tick } from '@/simulation/engine'`).
- No relative imports that go up more than one level (`../../` is a code smell).
- No barrel files (`index.ts` that re-exports everything from a folder).

## Git

- Branch naming: `feat/short-description`, `fix/short-description`, `chore/short-description`.
- Commit messages: imperative mood, under 72 characters, no period at end.
- One logical change per commit.
