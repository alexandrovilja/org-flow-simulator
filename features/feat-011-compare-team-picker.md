# feat-011 — Compare mode: team-type picker

## Status
`draft`

## Problem
Compare mode currently has two hard-coded teams: Single-skill specialists (Team A) and a Double-skill team (Team B). Coaches cannot change what they are comparing — the comparison is fixed. This limits the pedagogical value of the tool: a coach may want to compare Single vs Multi-skill, or Double vs Multi-skill, depending on the audience.

## Goal
Let the user choose the team configuration for each column in Compare mode independently, from three pre-defined team types. The two columns remain side-by-side; only the team composition changes.

## Team types

| Key | Label | Description | Roles per member |
|---|---|---|---|
| `single` | Single-skill specialists | Each of the 6 members has exactly 1 role. | 1 |
| `double` | Double-skill specialists | Each member has 2 adjacent roles (ring: DSGN+FE, FE+BE, …). | 2 |
| `multi` | Multi-skill specialists | Each member has 3 adjacent roles (ring: DSGN+FE+BE, FE+BE+DATA, …). | 3 |

All three types have 6 members (one per role in `COMPARE_ROLES`). The ID ranges stay non-overlapping: Team A IDs 1–6, Team B IDs 7–12.

## Default pairing
On first load and after "↺ Reset": **Single-skill** (left) vs **Double-skill** (right).

## UX

### Placement
Each `ComparePanel` column header gets a small team-type picker rendered below the team label. This keeps the picker visually tied to its column.

### Picker appearance
Three buttons in a compact segmented-control style (same visual language as the existing speed selector in the header):
```
[ Single ]  [ Double ]  [ Multi ]
```
The selected type is highlighted. Clicking a type:
1. Changes the team composition of that column immediately.
2. Resets both simulations to their initial state (same backlog, new teams).
3. Pauses the simulation and resets `compareHasStarted`.

### Behaviour rules
- Both columns use the same fixed backlog seed (`COMPARE_SEED = 42`), so switching teams always compares against an identical feature set.
- The picker is available before and after a run. Changing a picker mid-run resets both simulations.
- Both columns can show the same team type (e.g. Single vs Single) — no restriction.

## Implementation notes

### `src/simulation/compareMode.ts`
- Add `TeamType = 'single' | 'double' | 'multi'` type (export).
- Extract `makeTeamByType(type: TeamType, idOffset: number): Member[]` helper.
  - `single`: 1 role per member (existing Team A logic).
  - `double`: 2 adjacent roles per member (existing Team B logic).
  - `multi`: 3 adjacent roles per member (same ring pattern, wrapping).
- Update `makeCompareTeams()` to accept `(typeA: TeamType, typeB: TeamType)`.
- Update `makeCompareStates()` to accept `(typeA: TeamType, typeB: TeamType, settings?)`.

### `src/components/ComparePanel.tsx`
- Add `teamType: TeamType` and `onChangeType: (t: TeamType) => void` props.
- Render the picker inside the team header section (below the team label).

### `src/components/Simulator.tsx`
- Add state: `compareTeamTypeA: TeamType` (default `'single'`) and `compareTeamTypeB: TeamType` (default `'double'`).
- Pass types to `makeCompareStates()`.
- Pass `teamType` + `onChangeType` to each `ComparePanel`.
- `handleSwitchToCompare` and `handleCompareReset` reset types to `'single'` / `'double'`.
- When `onChangeType` is called: update the type state, rebuild both compare states, pause and reset `compareHasStarted`.

## Out of scope
- More than 3 team types.
- Per-member role customisation in Compare mode (that belongs to Experiment mode).
- Persisting the selected types across page refreshes (future Pro feature).

## Related Features
- **feat-013-zprehledneni-aplikace** — the Compare mode tutorial Step 2 covers Team A / Team B
  configuration. Once feat-011 is implemented, the Step 2 tutorial text should be updated to
  also mention the team type picker (Single / Double / Multi) so new users know it exists.

## Acceptance criteria
1. Each column in Compare mode shows a 3-button picker (Single / Double / Multi) below the team label.
2. Selecting a type resets and rebuilds both simulations with the correct team compositions.
3. Default on load: left = Single-skill, right = Double-skill.
4. Multi-skill team has 3 adjacent roles per member (ring pattern, wraps around).
5. The team composition section at the bottom of each column correctly reflects the selected type.
6. Picker is accessible (button elements, visible focus ring).
