import type { Feature } from '@/types/simulation'

/**
 * Zjistí, zda se na feature právě pracuje.
 *
 * Proč: při velkém běhu (stovky rozpracovaných features) není v panelu In Progress poznat,
 * kterou feature zrovna zpracovává nějaká jednotka — aktivní feature se proto zvýrazňuje rámečkem (pořadí karet se nemění, aby nepřeskakovaly).
 *
 * @param feature - Rozpracovaná feature
 * @returns true, pokud má alespoň jeden task ve stavu 'doing'
 */
export function isFeatureActive(feature: Feature): boolean {
  return feature.tasks.some(t => t.status === 'doing')
}
