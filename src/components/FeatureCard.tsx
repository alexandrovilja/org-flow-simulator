import { useState } from 'react'
import { ROLE_META } from '@/simulation/engine'
import { featureTotalWork } from '@/lib/featureSize'
import { CoordinationChips } from '@/components/CoordinationChips'
import type { Feature, Member, Role, RoleMeta } from '@/types/simulation'
import type { CssVariables } from '@/types/css'
import styles from './FeatureCard.module.css'

interface FeatureCardProps {
  feature: Feature
  team?: Member[]
  compact?: boolean
  neutral?: boolean
  /**
   * Maximální totalWork přes všechny viditelné features (backlog + inProgress).
   * Slouží k výpočtu proporcionální šířky baru: feature s maxWork dostane 100 %,
   * ostatní proporcionálně méně. Výchozí hodnota 0 = bar vždy 100 % (zpětná kompatibilita).
   */
  maxWork?: number
  /**
   * Konfigurace specializací — pro správné barvy tasků custom rolí.
   * Pokud není zadáno, použije se statický ROLE_META (zpětná kompatibilita).
   */
  roleConfig?: Record<Role, RoleMeta>
  /**
   * Předformátovaný výnos za tick (např. "€400/tick") — zobrazí se jako badge
   * v hlavičce karty. Používá se jen v Cash Flow módu; jinde se neposílá.
   */
  revenue?: string
  /**
   * Zobrazí čipy coordination overhead (⇄ předání, ↺ rework) s pulse efektem a probliknutí
   * segmentu vráceného tasku. Jen Cash Flow mód se zapnutým přepínačem (feat-016).
   */
  showCoordination?: boolean
  /**
   * Na feature se právě pracuje (má task ve stavu 'doing') — karta dostane výrazný rámeček.
   * Rámeček je přes box-shadow, takže se rozměry karty (a mřížka okolo) nemění. Výchozí false.
   */
  active?: boolean
}

/**
 * Karta jedné feature (design system Org Flow, feat-021): mono název, počet tasků a bar, ve kterém
 * má každý task segment v barvě své role. Tón karty se dopočítá v CSS z odstínu feature (`--hue`),
 * barva segmentu z role (`--role`); inline zůstávají jen vypočtené hodnoty (šířky, progres).
 *
 * @param props - Feature, tým (pro iniciály), režim zobrazení a volitelné doplňky (výnos, koordinace, aktivní stav)
 * @returns Vykreslená karta
 */
export function FeatureCard({ feature, team = [], compact = false, neutral = false, maxWork = 0, roleConfig, revenue, showCoordination = false, active = false }: FeatureCardProps) {
  const totalWork = featureTotalWork(feature.tasks)
  // Počet reworků při připojení karty (feat-016) — probliknutí vráceného tasku jen pro nové reworky
  const [mountReworks] = useState(feature.reworkCount)

  // Šířka celého baru vůči šířce karty — největší feature dostane 100 %.
  // Math.min(100, ...) zajišťuje, že FP nepřesnosti nevytvoří bar wider than track.
  // Pokud maxWork není zadáno nebo je 0, bar vyplní celou šířku (zachování starého chování).
  const barWidthPct = maxWork > 0 ? Math.min(100, (totalWork / maxWork) * 100) : 100

  const initialFor = (id: number | null) => {
    if (id == null) return null
    const m = team.find(m => m.id === id)
    return m ? m.name[0] : null
  }

  const cardClass = [styles.card, neutral && styles.neutral, compact ? styles.compact : styles.tall].filter(Boolean).join(' ')
  const cardStyle: CssVariables = {
    '--hue': feature.hue,
    // Zvýraznění aktivní karty: 2px prstenec v barvě --ink vně borderu. Border zůstává stejný,
    // takže se rozměry karty ani mřížka okolo nehýbou (box-shadow nezabírá místo v layoutu).
    boxShadow: active ? '0 0 0 2px var(--ink)' : undefined,
  }

  return (
    <div data-active={active} className={cardClass} style={cardStyle}>
      <div className={styles.top}>
        <span className={styles.name}>{feature.name}</span>
        <div className={styles.meta}>
          {showCoordination && (
            <CoordinationChips joins={feature.joinCount} reworks={feature.reworkCount} pulse />
          )}
          {revenue && <span className={styles.revenue}>{revenue}</span>}
          {!compact && <span className={styles.tasks}>{feature.tasks.length}t</span>}
        </div>
      </div>

      {/* Track — plná šířka karty, tvoří vizuální "stopu" ukazující maximum */}
      <div className={[styles.track, compact && styles.compactTrack].filter(Boolean).join(' ')}>
        {/* Bar — proporcionální šířka vůči největší feature */}
        <div className={styles.bar} style={{ width: `${barWidthPct}%` }}>
          {feature.tasks.map((t) => {
            // roleConfig má přednost před statickým ROLE_META — funguje i pro custom specializace
            const meta = (roleConfig ?? ROLE_META)[t.role] ?? { color: 'var(--ink-3)' }
            // Todo task má progress 0 — výjimkou je task vrácený reworkem (feat-016), který si nese
            // zbylý progres; ten musí být vidět, jinak by ztráta vypadala jako 100 %.
            const filled = t.status === 'done' ? 1 : t.progress / t.work
            const initial = !compact && t.status === 'doing' ? initialFor(t.assignee) : null

            // Šířka segmentu uvnitř baru — úměrná pracnosti tasku vůči celku feature
            const segWidthPct = totalWork > 0 ? (t.work / totalWork) * 100 : (100 / feature.tasks.length)
            const segStyle: CssVariables = { width: `${segWidthPct}%`, '--role': meta.color }

            return (
              <div key={t.id} className={styles.segment} style={segStyle}>
                <div className={styles.fill} style={{ width: `${filled * 100}%` }} />
                {t.status === 'todo' && <div className={styles.todoWash} />}
                {/* Rework (feat-016): task vrácený do todo si nese zbylý progres (> 0), běžný
                    todo task má progress 0. key={reworkCount} spustí probliknutí znovu při
                    každém dalším reworku featury; jen pro reworky po připojení karty, aby se
                    po remountu (přepnutí módu) staré probliknutí nepřehrálo. */}
                {showCoordination && t.status === 'todo' && t.progress > 0 && feature.reworkCount > mountReworks && (
                  <div key={feature.reworkCount} className={styles.reworkFlash} />
                )}
                {initial && <div className={styles.label}>{initial}</div>}
                {!compact && t.status === 'done' && <div className={styles.label}>✓</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
