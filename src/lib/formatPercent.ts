/**
 * Formátuje nezáporné procento pro dlaždice metrik: pod 10 % s jedním desetinným místem, jinak
 * celé číslo. Malé hodnoty tak nezmizí v zaokrouhlení na „0 %“. Rozhoduje se podle už
 * zaokrouhlené hodnoty, aby 9.96 nevyšlo jako "10.0".
 *
 * @param v - Hodnota v procentech (nezáporná; znaménko řeší volající)
 * @returns Řetězec bez znaku %, např. "0.4", "4.5", "10", "150"
 */
export function formatPercent(v: number): string {
  return Math.round(v * 10) / 10 < 10 ? v.toFixed(1) : v.toFixed(0)
}
