/** Způsob zápisu času v pracovních týdnech a dnech (feat-027): `full` = plná slova („37 weeks 2.9 days“),
 *  `short` = zkratky „w“ a „d“ („37w 2.9d“), které se použijí jen tam, kde se plná slova nevejdou. */
export type TimeNotation = 'full' | 'short'

/** Jedna část zobrazeného času: číslo a jeho jednotka, např. „37“ + „ weeks“. Čísla a jednotky se kreslí
 *  zvlášť (číslo velké, jednotka malá), ale dohromady tvoří jeden čitelný řetězec. */
export interface TimePart {
  /** Číslo části: celé týdny („37“) nebo dny s jednou desetinou („2.9“). */
  value: string
  /** Jednotka za číslem včetně případné mezery před sebou (plná slova „ weeks“ / „ days“, zkratky „w“ / „d“). */
  unit: string
}
