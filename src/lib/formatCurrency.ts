/**
 * Formátuje částku v eurech pro kompaktní zobrazení v Cash Flow módu.
 * Hodnoty od 1000 výše se zkracují příponou "k" (např. 1400 → "€1.4k").
 *
 * @param amount - Částka v eurech
 * @returns Naformátovaný řetězec, např. "€400" nebo "€1.4k"
 */
export function formatEuro(amount: number): string {
  // Zaokrouhlená hodnota rozhoduje o hranici, ne surová `amount` — jinak by 999.6 spadlo
  // do "€1000" (bez k-notace), zatímco 1000.0 by hned vedle ukázalo "€1k".
  if (Math.round(amount) >= 1000) {
    // toFixed(1) dá vždy jedno desetinné místo; regex ořízne zbytečné ".0" (€2.0k → €2k)
    const thousands = (amount / 1000).toFixed(1).replace(/\.0$/, '')
    return `€${thousands}k`
  }
  return `€${Math.round(amount)}`
}
