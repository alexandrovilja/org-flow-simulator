/**
 * Sdílené pomocné funkce unit testů pro ovládání v horní liště (feat-021, feat-025).
 * Vitest tenhle soubor nespouští jako test (nekončí na .test.ts), jen ho importují testy —
 * oba testy tak čtou ovládání stejně a nemůžou se rozejít.
 */

/**
 * Přístupný název tlačítka: `aria-label` (např. u „?“), jinak viditelný text.
 *
 * @param el - Tlačítko
 * @returns Název, jak ho uvidí čtečka obrazovky
 */
export function nameOf(el: Element): string {
  return el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''
}

/**
 * Názvy všech tlačítek v daném kořeni v pořadí, v jakém jsou v DOM.
 *
 * @param root - Element nebo kontejner, ve kterém se tlačítka hledají
 * @returns Seznam názvů zleva doprava
 */
export function namesIn(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('button')).map(nameOf)
}

/**
 * Pravá část horní lišty: zpětná vazba, přepínač tématu a ovládání běhu (třetí potomek `<header>`, viz TopBar).
 *
 * @returns Kontejner pravé části lišty
 */
export function barControls(): HTMLElement {
  return document.querySelector('header')!.lastElementChild as HTMLElement
}

/**
 * Ovládání běhu v liště bez ikony zpětné vazby (feat-024) a přepínače tématu — oboje je ve všech
 * módech stejné a nepatří k ovládání běhu.
 *
 * @returns Názvy tlačítek ovládání zleva doprava (např. „Restart tutorial“, „↺ Reset“, rychlosti, „▶ Run“)
 */
export function controlNames(): string[] {
  return namesIn(barControls()).filter(n => n !== 'Send feedback' && !/theme$/.test(n))
}
