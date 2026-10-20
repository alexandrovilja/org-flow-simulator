/**
 * Písmeno, které zastupuje jednotku na kartě (avatar) a v segmentu rozpracovaného tasku.
 * U týmů pojmenovaných „Team X“ je to písmeno týmu — jinak by všechny týmy presetu Teams měly „T“
 * a nešly by od sebe rozeznat. U lidí (Ada, Ben…) je to první písmeno jména.
 *
 * @param name - Jméno jednotky, např. „Team C“ nebo „Ada“
 * @returns Jedno velké písmeno (nebo „?“, když je jméno prázdné)
 */
export function memberInitial(name: string): string {
  const trimmed = name.trim()
  // „Team“ + mezera + cokoli: vezmi první znak po mezeře (Team C → C, Team 7 → 7)
  const team = /^team\s+(\S)/i.exec(trimmed)
  const letter = team ? team[1] : trimmed[0]
  return letter ? letter.toUpperCase() : '?'
}
