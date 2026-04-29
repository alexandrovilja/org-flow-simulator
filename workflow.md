# AI-Agent Development Workflow — Org Flow Simulator

_Last updated: 2026-04-28_

---

## Philosophy

AI agents are not a replacement for process — they are its executors. For this to work, three conditions must hold:

1. **Structured inputs** — feature specs, architectural decisions, coding conventions. The agent must know what to do.
2. **Verifiable outputs** — tests, linter, type system. The agent must know when it is done.
3. **Human checkpoints** — review and approval gates. Agents must not have unlimited authority.

---

## Pipeline Overview

```
 Human                      AI Agent                    Automation
 ─────                      ────────                    ──────────

 1. IDEA
 "I want feature X"
       │
       ▼
 2. FEATURE SPEC ◀──── Feature Spec Agent ────▶  features/XXX.md
    (clarify,            (asks questions,
     edge cases)          writes spec)
       │
       ▼
 3. UI DESIGN ◀──────── UI Design Agent ───────▶  component code / mockup
    (approve UI          (reads spec, proposes
     before coding)       visual changes)
       │
       ▼ (only features with UI changes)
 4. TEST DESIGN ◀───── TDD Agent ──────────────▶  tests/XXX.test.ts
    (approve tests        (writes tests before
     before coding)       implementation)
       │
       ▼
 5. IMPLEMENTATION ◀── Code Agent ─────────────▶  src/...
    (optional            (implements until
     checkpoint)          tests pass)
       │
       ▼
 6. REVIEW ◀─────────── Review Agent ──────────▶  blockers / suggestions
    (approve or          (security, quality,
     reject)              conventions)
       │
       ▼
 7. CI/CD ────────────────────────────────────▶  GitHub Actions
                                                  (build, tests, lint)
       │
       ▼
 8. DEPLOY ───────────── Deploy Agent ─────────▶  Vercel Preview → Production
                                                   
       │
       ▼
 9. SMOKE TESTS ◀─────── QA Agent ─────────────▶  Playwright E2E
    (approve              (tests live app,
     production)           reports issues)
```

---

## Phase Details

### Phase 1–2: Feature Spec Agent

**Tool:** Claude Code (interactive conversation)

**Trigger:** Human describes a new feature idea in natural language.

**Agent behavior:**
- Asks clarifying questions (user story, edge cases, out of scope, technical constraints)
- Records answers into a structured feature file

**Output file:** `features/feat-NNN-short-name.md`

```markdown
# Feature: [name]

## Status
draft | ready | in-progress | done

## User Story
As a [role], I want [goal] so that [reason].

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Out of Scope
- Item that will NOT be implemented

## Technical Notes
- Relevant architectural constraints
- Files likely to be touched

## Open Questions
- Question that needs answer before implementation
```

**Human checkpoint:** Review and approve the feature file before moving to Phase 3.

---

### Phase 3: UI Design Agent

**Tool:** Claude Code `frontend-design` skill

**Trigger:** Approved feature spec — pouze pro features, které mění nebo přidávají UI komponenty.

**Agent behavior:**
- Přečte feature spec (sekce UI/Design) a dotčené existující soubory (`globals.css`, relevantní komponenty)
- Navrhne konkrétní vizuální změny: nové komponenty, úpravy existujících, CSS
- Implementuje návrh jako funkční kód konzistentní s design systémem aplikace (`globals.css` CSS custom properties, CSS Modules, inline styles pro dynamické hodnoty)
- Prezentuje výsledek uživateli k posouzení

**Constraints:**
- Musí respektovat existující design systém (`--bg`, `--panel`, `--ink`, `--accent`, … z `globals.css`)
- Žádný Tailwind, žádné externí UI knihovny bez explicitního souhlasu
- TypeScript strict — žádné `any`

**Human checkpoint:** Uživatel schválí nebo zamítne navržené UI před tím, než se napíší testy a spustí implementace. Schválený návrh se stává vizuálním kontraktem pro TDD fázi.

**Přeskočit pokud:** Feature je čistě logická (engine, storage, typy) bez vizuálních změn.

---

### Phase 4: TDD Agent

**Tool:** Claude Code

**Trigger:** Approved feature file in `features/feat-NNN.md`.

**Agent behavior:**
- Reads the feature spec
- Writes unit tests (Vitest) covering all acceptance criteria
- Writes E2E test skeleton (Playwright) for user-facing flows
- Tests must fail at this point (no implementation yet — that is correct)

**Output files:**
- `tests/unit/feat-NNN.test.ts`
- `tests/e2e/feat-NNN.spec.ts`

**Human checkpoint:** Review and approve tests. Tests are the contract — once approved, they define what "done" means. Do not skip this step.

---

### Phase 5: Code Agent

**Tool:** Claude Code

**Trigger:** Approved test files.

**Agent behavior:**
- Reads feature spec + approved tests
- Implements the minimum code to make tests pass
- Runs `npm test` after each change, iterates until all tests pass
- Does not add features beyond what tests require
- **Přidává dokumentaci** do každého souboru, který upraví (viz `docs/conventions.md`):
  - JSDoc `/** */` nad každým `interface` a `type` — co to je a proč existuje
  - JSDoc `/** */` + `@param` + `@returns` nad každou exportovanou funkcí
  - Inline `//` komentáře u každé neobvyklé proměnné, algoritmu nebo magické hodnoty

**Constraints:**
- Access limited to `src/` directory
- Must not modify test files
- Must not modify deployment config or secrets
- Must not merge or push — only proposes changes

**Human checkpoint:** Optional spot-check of generated code before Phase 6.

---

### Phase 6: Review Agent

**Tool:** Claude Code `/ultrareview` skill or custom review prompt

**Trigger:** Implementation complete, all tests passing.

**Agent checks:**
- Security (OWASP Top 10: XSS, injection, auth bypass, sensitive data exposure)
- Adherence to `architecture-decisions.md`
- Test coverage — are all acceptance criteria actually covered?
- Performance anti-patterns (unnecessary re-renders, N+1 queries, missing memoization)
- Readability and project conventions (`docs/conventions.md`)
- No dead code, no commented-out blocks, no TODO without a ticket

**Output:**
- **Blockers** — must be fixed before merge
- **Suggestions** — optional improvements

**Human checkpoint:** Approve or reject. Blockers must be resolved. Suggestions are discretionary.

---

### Phase 7: CI/CD — GitHub Actions

**Tool:** GitHub Actions (deterministic automation, not AI)

**Runs on:** Every pull request and every merge to `main`.

```yaml
# .github/workflows/ci.yml

on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run typecheck      # TypeScript
      - run: npm run lint           # ESLint
      - run: npm run test           # Vitest unit tests
      - run: npm run build          # Next.js build

  e2e:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      - run: npx playwright install --with-deps
      - run: npm run test:e2e       # Playwright against preview URL
```

**Rule:** AI agents must not merge a PR without green CI. This is a hard gate, not a suggestion.

---

### Phase 8: Deploy Agent

**Tool:** Vercel CLI (automated) + Claude Code (monitors and interprets)

**Flow:**
1. Every PR automatically gets a **Vercel Preview URL** (no manual action needed).
2. On merge to `main` → automatic deploy to **production**.
3. Claude Code can be asked to monitor deploy logs and interpret errors if deploy fails.

**Vercel configuration:**
```json
// vercel.json
{
  "github": {
    "autoAlias": true,
    "silent": false
  }
}
```

**Human checkpoint:** Approve production deploy after smoke tests pass (Phase 8).

---

### Phase 9: QA Agent

**Tool:** Playwright (execution) + Claude Code (interpretation)

**Trigger:** Successful deploy to Vercel Preview or Production.

**Agent behavior:**
- Runs Playwright E2E suite against the live URL
- Interprets results: identifies flaky tests vs. real regressions
- Reports pass/fail with context

**Smoke test scope (minimum):**
- App loads without JS errors
- Simulation starts and generates backlog items
- Lead Time metrics update correctly
- Controls (speed, WIP limit) affect simulation
- localStorage save/load works

**Human checkpoint:** Final approval before declaring production deploy successful. If smoke tests fail → rollback (Vercel one-click).

---

## Repository File Structure

```
/
├── CLAUDE.md                        ← primary instructions for all agents
├── architecture-decisions.md        ← architectural decisions log
├── workflow.md                      ← this file
│
├── features/                        ← feature specs (Phase 2 output)
│   ├── feat-001-name.md
│   └── feat-002-name.md
│
├── docs/
│   ├── conventions.md               ← coding conventions agents must follow
│   └── testing-strategy.md         ← how to write tests in this project
│
├── .claude/
│   └── settings.json               ← Claude Code permissions and hooks
│
├── .github/
│   └── workflows/
│       └── ci.yml                  ← GitHub Actions pipeline
│
├── src/                            ← application source (Next.js App Router)
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── simulation/                 ← sim engine (migrated from prototype)
│
└── tests/
    ├── unit/                       ← Vitest unit tests
    └── e2e/                        ← Playwright E2E tests
```

---

## Control Files — The Agent's Brain

Every agent reads these files as context before acting. Keep them up to date — stale context produces bad agent output.

| File | Purpose | Update when |
|---|---|---|
| `CLAUDE.md` | Project overview, stack, what agents may/may not do | Stack or scope changes |
| `architecture-decisions.md` | Architectural choices and rationale | Any architectural decision is made |
| `docs/conventions.md` | Naming, file structure, component patterns | Conventions are established or changed |
| `docs/testing-strategy.md` | What to test, how to write tests | Testing approach evolves |
| `features/feat-NNN.md` | Feature specs | Feature is defined, clarified, or closed |

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Agent generates code that passes tests but does the wrong thing | Tests must be approved by a human *before* implementation starts |
| Agent overwrites critical files | `.claude/settings.json` — define read-only files, require confirmation for destructive actions |
| Inconsistent output across agents | CLAUDE.md + conventions.md as shared ground truth |
| Over-engineering from day one | MVP = only Phases 1–4, run manually and interactively. Automation is added incrementally. |
| Developer loses understanding of their own code | Developer does code review too, not just the agent. Never approve what you don't understand. |
| Agent secrets leak (API keys in code) | CI step: `npm run lint` includes secret scanning (e.g. `detect-secrets` or ESLint plugin) |

---

## Rollout Plan

### Step 1 — Now (MVP foundation)
- [ ] Create `CLAUDE.md` with project description and stack
- [ ] Create `docs/conventions.md` with initial TypeScript/React conventions
- [ ] Create `features/` directory with template
- [ ] Set up Next.js project with TypeScript + Vitest + ESLint
- [ ] Migrate prototype (`sim-engine.jsx`, `sim-ui.jsx`, `sim-app.jsx`) into Next.js

### Step 2 — After first working MVP
- [ ] Adopt feature spec workflow for every new feature
- [ ] Practice TDD approach with Claude Code (tests before code)
- [ ] Add `docs/testing-strategy.md`

### Step 3 — At Pro tier kickoff
- [ ] Set up GitHub Actions CI pipeline
- [ ] Set up Playwright E2E tests
- [ ] Enable automatic Vercel preview deploys per PR
- [ ] Add smoke test suite

### Step 4 — Mature product
- [ ] Review agents integrated into PR process
- [ ] Smoke tests run automatically after every production deploy
- [ ] Monitoring + alerting with agent-interpreted anomaly reports

---

## Recommended Tools by Phase

| Phase | Primary Tool | Supporting Tools |
|---|---|---|
| Feature Spec | Claude Code `define-feature` skill | — |
| UI Design | Claude Code `frontend-design` skill | — |
| TDD | Claude Code | Vitest, Playwright |
| Implementation | Claude Code | TypeScript, Next.js |
| Review | Claude Code `/ultrareview` | ESLint, TypeScript compiler |
| CI/CD | GitHub Actions | — |
| Deploy | Vercel (automatic) | Vercel CLI |
| Smoke Tests | Playwright | Claude Code (interpret results) |
