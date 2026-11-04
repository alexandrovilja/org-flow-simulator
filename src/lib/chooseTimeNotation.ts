import type { TimeNotation } from '@/types/workTime'

/**
 * Vybere zápis času podle změřených šířek: plná slova, když se vejdou do dlaždice, jinak zkratky „w“ a „d“.
 * Je to čistá funkce bez paměti, aby šla testovat bez prohlížeče; měření dělá hook `useTimeNotation`.
 *
 * Bez rozměrů (testy v jsdom, skrytý prvek: obě šířky 0) vychází plný zápis — zkratka se použije jen tehdy,
 * když je opravdu vidět, že se slova nevejdou.
 *
 * @param fullWidth - Šířka, kterou plná slova potřebují (px)
 * @param availableWidth - Šířka, kterou dlaždice nabízí (px)
 * @returns `full`, když se plná slova vejdou, jinak `short`
 */
export function chooseTimeNotation(fullWidth: number, availableWidth: number): TimeNotation {
  // Tolerance 1 px vyrovná zaokrouhlení rozměrů prohlížečem (stejně jako u `useIsTruncated`)
  return fullWidth <= availableWidth + 1 ? 'full' : 'short'
}
