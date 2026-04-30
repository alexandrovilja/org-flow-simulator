import type { Task, Feature } from '@/types/simulation'

/**
 * Spočítá celkové množství práce (work) pro pole tasků.
 * Používá se pro výpočet proporcionální šířky baru feature karty.
 *
 * @param tasks - pole tasků, jejichž work se sečte
 * @returns součet task.work přes všechny tasky; 0 pro prázdné pole
 */
export function featureTotalWork(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + t.work, 0)
}

/**
 * Najde maximální totalWork přes dvě pole features (typicky backlog + inProgress).
 * Přijímá dvě pole místo jednoho, aby se předešlo alokaci spread pole při každém renderu.
 * Výsledek slouží jako jmenovatel při výpočtu proporcionální šířky baru:
 * feature s největší totalWork dostane bar šířky 100 %, ostatní proporcionálně méně.
 *
 * @param a - první pole features (např. backlog)
 * @param b - druhé pole features (např. inProgress); výchozí prázdné pole
 * @returns maximální totalWork přes obě pole; 0 pokud jsou obě prázdná
 */
export function featureMaxWork(a: Feature[], b: Feature[] = []): number {
  const maxA = a.reduce((m, f) => Math.max(m, featureTotalWork(f.tasks)), 0)
  const maxB = b.reduce((m, f) => Math.max(m, featureTotalWork(f.tasks)), 0)
  return Math.max(maxA, maxB)
}
