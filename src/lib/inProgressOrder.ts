import type { Feature } from '@/types/simulation'

/**
 * Zjistí, zda se na feature právě pracuje.
 *
 * Proč: při velkém běhu (stovky rozpracovaných features) není v panelu In Progress poznat,
 * kterou feature zrovna zpracovává nějaká jednotka — aktivní feature se proto zvýrazňuje a řadí nahoru.
 *
 * @param feature - Rozpracovaná feature
 * @returns true, pokud má alespoň jeden task ve stavu 'doing'
 */
export function isFeatureActive(feature: Feature): boolean {
  return feature.tasks.some(t => t.status === 'doing')
}

/**
 * Seřadí rozpracované features pro zobrazení: aktivní nahoře, uvnitř skupin podle priority.
 *
 * Řazení je jen v zobrazení — vrací NOVÉ pole a nemutuje vstup, takže `state.inProgress`
 * (a s ním simulace) zůstává beze změny.
 *
 * @param features - Features v pořadí, v jakém jsou ve stavu simulace
 * @returns Nové pole: aktivní features první; shoda priorit se rozhoduje podle id (deterministické pořadí)
 */
export function sortInProgressForDisplay(features: Feature[]): Feature[] {
  return [...features].sort((a, b) => {
    // Aktivní (0) před čekajícími (1)
    const activeDiff = (isFeatureActive(a) ? 0 : 1) - (isFeatureActive(b) ? 0 : 1)
    if (activeDiff !== 0) return activeDiff
    // Nižší číslo = vyšší priorita; id jako tiebreak, aby se karty při shodě neprohazovaly
    return a.priority - b.priority || a.id - b.id
  })
}
