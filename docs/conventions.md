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
