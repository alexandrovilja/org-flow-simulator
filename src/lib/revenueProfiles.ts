import type { RevenueProfile } from '@/types/simulation'

/** Texty jednoho profilu v UI: název pro přepínač a popisek náhledu, hint pro hover. */
export interface RevenueProfileInfo {
  /** Zobrazovaný název (tlačítko přepínače, přístupný popisek náhledu). */
  label: string
  /** Hover hint přepínače — popisuje tvar právě zvoleného profilu. */
  hint: string
}

/** Texty všech profilů výnosu na jednom místě (feat-017). Záznam je typově vyčerpávající, takže nový
 *  profil v `RevenueProfile` bez doplnění textů se nepřeloží. Je to čistý modul bez Reactu: leží mimo
 *  soubory komponent, aby úprava textů nevyvolala plný reload místo Fast Refreshe a aby ho mohly
 *  sdílet přepínač i náhled. */
export const REVENUE_PROFILE_INFO: Record<RevenueProfile, RevenueProfileInfo> = {
  'flat': {
    label: 'Flat',
    hint: 'Every feature earns the same amount per tick from the moment it is delivered.',
  },
  'j-curve': {
    label: 'J-curve',
    hint: 'Earns little right after delivery, then grows past the flat level. Illustrative shape inspired by delayed returns to IT investment.',
  },
  's-curve': {
    label: 'S-curve',
    hint: 'Ramps up gradually after delivery and levels off at the flat amount. Bass adoption curve.',
  },
}
