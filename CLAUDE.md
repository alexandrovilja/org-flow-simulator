# Org Flow Simulator — Claude Instructions

## What this project is
A real-time agile backlog simulation tool for agile coaches. It demonstrates how team structure (roles, specialization, cross-functionality) affects Lead Time. Target users: coaches running management workshops ("show, don't tell" in 60 seconds).

## Product model
- **Free tier (MVP):** fully client-side, no accounts, localStorage only
- **Pro tier (future):** auth, cloud persistence, advanced scenarios, PDF reports, Jira integration

## Tech stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode — no `any`)
- **Styling:** CSS custom properties (defined in `src/app/globals.css`) — no Tailwind
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Hosting:** Vercel

## Project structure
```
src/
  app/              # Next.js App Router — pages and layouts
  components/       # React UI components
  simulation/       # Pure simulation engine (no React dependencies)
  types/            # Shared TypeScript types
tests/
  unit/             # Vitest unit tests
  e2e/              # Playwright E2E tests
features/           # Feature specs (one file per feature)
docs/               # Conventions and strategy docs
```

## Key files to read before making changes
- `architecture-decisions.md` — all architectural decisions with rationale
- `workflow.md` — the full AI-agent development workflow
- `docs/conventions.md` — coding conventions you must follow
- `src/simulation/engine.ts` — core simulation logic (pure TypeScript, no React)
- `src/types/simulation.ts` — shared types used across simulation and UI

## Coding rules (enforced — do not deviate)
- **TypeScript strict:** no `any`, no `@ts-ignore` without a comment explaining why
- **Comments are required** at three levels (audience: beginner programmer learning the codebase):
  - **Type / interface level** — JSDoc `/** */` above every `interface` and `type`: what it represents and why it exists
  - **Function level** — JSDoc `/** */` above every exported function: what it does, why it exists, `@param` for each parameter, `@returns` if non-void
  - **Inline** — short `//` comment above any non-obvious variable, algorithm step, or magic value explaining what AND why
- **No barrel files** (`index.ts` re-exports) — import directly from the source file
- **Components are pure** — no side effects outside hooks; no direct DOM manipulation
- **Simulation engine is framework-free** — `src/simulation/engine.ts` must not import React or Next.js
- **Tests before implementation** — follow the TDD workflow defined in `workflow.md`
- **No localStorage access in components** — use a dedicated `src/lib/storage.ts` module

## CSS conventions
- Use CSS custom properties from `globals.css` (e.g. `var(--ink)`, `var(--panel)`)
- Inline styles are acceptable for dynamic/computed values (e.g. feature hue-based colors)
- For static structural styles, use CSS Modules (`.module.css` files next to components)

## What agents may do without asking
- Read any file in the project
- Edit files in `src/`, `tests/`, `features/`, `docs/`
- Run `npm run test`, `npm run typecheck`, `npm run lint`

## What agents must NOT do without human approval
- Modify `architecture-decisions.md` or `workflow.md`
- Change `package.json` dependencies
- Modify deployment config (`next.config.ts`, `vercel.json`, `.github/workflows/`)
- Commit, push, or create pull requests
- Delete files

## Development workflow (short version)
1. Feature idea → `features/feat-NNN.md` spec
2. Tests written and approved → `tests/unit/feat-NNN.test.ts`
3. Implementation → `src/`
4. Review → `/ultrareview`
5. CI green → merge

Full workflow: see `workflow.md`.
