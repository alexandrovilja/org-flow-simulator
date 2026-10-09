import { useState } from 'react'
import styles from './CoordinationChips.module.css'

/** Vstupní props komponenty CoordinationChips. */
interface CoordinationChipsProps {
  /** Počet předání featury (`Feature.joinCount`). */
  joins: number
  /** Počet reworků featury (`Feature.reworkCount`). */
  reworks: number
  /** true = při zvýšení počtu čip krátce zapulsuje (karty In Progress); false = statické (Done list). */
  pulse?: boolean
}

/** Konfigurace jednoho čipu — oba čipy sdílí stejný markup, liší se jen těmito hodnotami. */
interface ChipSpec {
  /** Klíč čipu, zároveň prefix React key. */
  id: 'h' | 'r'
  /** Symbol před počtem. */
  glyph: string
  /** Aktuální počet událostí. */
  count: number
  /** Počet událostí v okamžiku připojení komponenty — pulse jen nad touto hodnotou. */
  mountCount: number
  /** CSS Module třída barevné varianty. */
  variantClass: string
  /** Text tooltipu pro daný počet. */
  title: (n: number) => string
}

/**
 * Čipy coordination overhead (feat-016): `⇄ n` = počet předání, `↺ n` = počet reworků.
 * Každý čip se zobrazí až od n ≥ 1 — feature bez předání zůstane vizuálně čistá.
 *
 * Pulse: `key={n}` způsobí, že React při změně počtu čip znovu připojí do DOM, a tím
 * se CSS animace spustí znovu od začátku. Animace se ale použije jen pro počty VYŠŠÍ než
 * při připojení komponenty — jinak by se po každém remountu (např. přepnutí módu) přehrály
 * pulsy všech karet najednou, i když žádná nová událost nenastala.
 *
 * @param joins - Počet připojených jednotek (po první)
 * @param reworks - Počet reworků
 * @param pulse - Zda čip při změně počtu zapulsuje
 */
export function CoordinationChips({ joins, reworks, pulse = false }: CoordinationChipsProps) {
  // Počty při připojení — useState initializer se vyhodnotí jen jednou za život komponenty
  const [mountJoins] = useState(joins)
  const [mountReworks] = useState(reworks)

  const chips: ChipSpec[] = [
    { id: 'h', glyph: '⇄', count: joins, mountCount: mountJoins, variantClass: styles.handoff,
      title: n => `${n} unit${n !== 1 ? 's' : ''} joined this feature` },
    { id: 'r', glyph: '↺', count: reworks, mountCount: mountReworks, variantClass: styles.rework,
      title: n => `${n} rework${n !== 1 ? 's' : ''} — finished work returned because units understood the feature differently` },
  ]

  return (
    <>
      {chips.filter(c => c.count > 0).map(c => (
        <span
          key={`${c.id}-${c.count}`}
          title={c.title(c.count)}
          className={[styles.chip, c.variantClass, pulse && c.count > c.mountCount ? styles.pulse : ''].join(' ')}
        >
          {c.glyph} <b>{c.count}</b>
        </span>
      ))}
    </>
  )
}
