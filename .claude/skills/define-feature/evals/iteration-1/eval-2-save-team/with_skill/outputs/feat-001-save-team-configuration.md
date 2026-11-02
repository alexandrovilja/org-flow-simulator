# Feature: Save Team Configuration

## Status
draft

## Problem
Coaches set up a specific team (roles, WIP limits, specializations) before each workshop, but every page refresh resets everything to defaults. Re-entering 6–8 team members with their skills wastes 2–3 minutes of precious workshop time and introduces setup errors. There is no way to persist or recall a previously configured team, making repeated use of the tool for recurring workshops tedious.

## User Story
As an agile coach, I want to save my current team configuration under a name and reload it in a future session, so that I can start workshops immediately without re-entering the team setup each time.

## UI / Design
- A **"Save config"** button appears at the top of the Team Configuration panel (left panel).
- Clicking it opens a small inline form directly below the button with a text input ("Config name") pre-filled with a default like "My Team" and a **"Save"** confirm button.
- A **"Load config"** dropdown (select element) sits next to the Save button, listing all previously saved configurations by name. A placeholder option reads "— load saved config —".
- Selecting a config from the dropdown immediately replaces all team member rows with the saved values (roles, skill levels, WIP limits).
- A small toast notification appears at the bottom of the screen for 2 seconds: "Configuration '[name]' loaded." or "Configuration '[name]' saved."
- A small **"×"** delete icon appears next to each config name in the dropdown (rendered as a separate list below the dropdown if the browser select element cannot support icons).

## Specification by Example

**Example 1: Save a new configuration**
- Given: The coach has configured a team with 3 developers, 1 QA, and 1 designer with specific WIP limits
- When: The coach clicks "Save config", types "Cross-functional 5" in the name field, and clicks "Save"
- Then: The configuration is stored in localStorage, the "Load config" dropdown now includes "Cross-functional 5", and a toast "Configuration 'Cross-functional 5' saved." appears

**Example 2: Load a saved configuration**
- Given: A configuration named "Cross-functional 5" exists in localStorage and the team panel currently shows a different team
- When: The coach selects "Cross-functional 5" from the "Load config" dropdown
- Then: All team member rows are replaced with the saved values (roles, skill levels, WIP limits) and a toast "Configuration 'Cross-functional 5' loaded." appears

**Example 3: Overwrite an existing configuration**
- Given: A configuration named "Cross-functional 5" already exists
- When: The coach modifies the team, clicks "Save config", types "Cross-functional 5", and clicks "Save"
- Then: The existing entry is overwritten with the new values, the dropdown still shows one entry for "Cross-functional 5", and a toast "Configuration 'Cross-functional 5' saved." appears

**Example 4: Delete a saved configuration**
- Given: A configuration named "Cross-functional 5" exists in the dropdown
- When: The coach clicks the "×" delete icon next to "Cross-functional 5"
- Then: The configuration is removed from localStorage and no longer appears in the "Load config" dropdown

## Out of Scope
- Cloud sync or sharing configurations between devices or users
- Export / import configurations as JSON or CSV files
- Versioning or history of changes to a configuration
- Automatic saving on every change (autosave)
- Configurations tied to user accounts (Pro tier concern)

## Technical Notes
- All persistence uses localStorage via the existing `src/lib/storage.ts` module (per CLAUDE.md: no localStorage access in components).
- A new module `src/lib/teamConfigStorage.ts` should be created for config-specific read/write helpers.
- Main component to update: `src/components/TeamPanel.tsx` (add Save/Load UI and wire up storage helpers).
- The stored data shape should match the existing `TeamConfig` type from `src/types/simulation.ts` (or a new serialisable subset of it).
- Consider a max of 10 saved configurations to keep localStorage usage bounded (to be confirmed — see Open Questions).

## Open Questions
- Should there be a hard limit on the number of saved configurations? If so, what is the limit (suggestion: 10)?
- Should loading a config require a confirmation step if the current team has unsaved changes, or should it replace immediately?
