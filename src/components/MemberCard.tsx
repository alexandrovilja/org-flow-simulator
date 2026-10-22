'use client'

import { useState } from 'react'
import { RoleChip } from './RoleChip'
import { TruncatedText } from './TruncatedText'
import { useIsTruncated } from '@/hooks/useIsTruncated'
import styles from './MemberCard.module.css'
import { memberInitial } from '@/lib/memberInitial'
import type { CssVariables } from '@/types/css'
import type { AiMultiplier, Feature, Member, Task, Role, RoleMeta } from '@/types/simulation'

/** Pořadí přepínání AI kliknutím (feat-019, změna 2026-10-20): každé kliknutí na tlačítko AI
 *  nastaví hodnotu, na kterou ukazuje ta současná — 1× → 2× → 5× → 1×. Po 5× se AI vypne. */
const NEXT_AI: Record<AiMultiplier, AiMultiplier> = { 1: 2, 2: 5, 5: 1 }

/** Vstupní props karty jednotky v Team panelu (Advanced i Cash Flow). */
interface MemberCardProps {
  member: Member
  currentFeature: Feature | null
  currentTask: Task | null
  /** Aktuální konfigurace specializací — pro zobrazení plných názvů rolí. */
  roleConfig: Record<Role, RoleMeta>
  onAddRole: (memberId: number, role: Role) => void
  onRemoveRole: (memberId: number, role: Role) => void
  /** Callback pro přejmenování jednotky. */
  onRename: (memberId: number, name: string) => void
  /** Callback pro odebrání jednotky. Volající zajistí uvolnění aktivního úkolu. */
  onRemove: (memberId: number) => void
  /** Callback pro nastavení AI multiplikátoru jednotky (feat-019); 1 = vypnout AI. */
  onSetAiMultiplier: (memberId: number, value: AiMultiplier) => void
  /**
   * True pokud člen čeká na práci: má roli pro dostupný 'todo' úkol,
   * ale ten úkol je zablokován fázovými závislostmi (level constraints).
   * Odpovídá přesně podmínce, kdy engine akumuluje member.idleSec.
   */
  isWaiting?: boolean
  /**
   * Volitelný `data-tutorial-target` karty (feat-025: první jednotka v Advanced a Cash Flow).
   * Tlačítko AI pak dostane cíl `${tutorialTarget}-ai`.
   */
  tutorialTarget?: string
}

/**
 * Ikona blesku na odznaku AI (feat-019). Barvu přebírá z textu tlačítka (`currentColor`),
 * takže na modrém odznaku je bílá. Pro čtečky obrazovky je skrytá — hodnotu nese aria-label tlačítka.
 */
function BoltIcon() {
  return (
    <svg width={6} height={9} viewBox="0 0 6 9" aria-hidden="true" className={styles.boltIcon}>
      <path d="M3.6 0 0 5h2.3L1.7 9 6 3.6H3.7L4.4 0z" fill="currentColor" />
    </svg>
  )
}

/**
 * Karta jednoho člena týmu zobrazující:
 * - editovatelné jméno + tlačítko AI (feat-019) + tlačítko pro odebrání jednotky
 * - přiřazené specializace (chipy s plným názvem)
 * - progress bar aktivního úkolu, nebo idle stav
 *
 * @param props - Jednotka, její aktuální feature a úkol, konfigurace specializací, callbacky
 *                pro úpravu jednotky (role, jméno, odebrání, AI) a příznak čekání
 */
export function MemberCard({ member, currentFeature, currentTask, roleConfig, onAddRole, onRemoveRole, onRename, onRemove, onSetAiMultiplier, isWaiting = false, tutorialTarget }: MemberCardProps) {
  const [adding, setAdding] = useState(false)
  // Plné jméno v title jen tehdy, když ho v úzké kartě zkrátí výpustka (feat-023)
  const [nameRef, nameTruncated] = useIsTruncated<HTMLInputElement>(member.name)
  // Chybějící hodnota = 1× (bez AI); odznak se ukazuje jen při 2× nebo 5×
  const ai = member.aiMultiplier ?? 1
  const aiOn = ai > 1
  // Hodnota, kterou nastaví další kliknutí na tlačítko AI
  const nextAi = NEXT_AI[ai]
  // Přístupný název obsahuje i viditelnou hodnotu („5×“), aby ji čtečka ohlásila (WCAG 2.5.3)
  const aiLabel = aiOn ? `AI speed-up: ${ai}×` : 'AI speed-up'
  // Tooltip říká, co udělá další kliknutí — bez menu by jinak nebylo poznat, že se hodnoty točí dokola
  const aiTitle = `${aiLabel} – ${nextAi === 1 ? 'click to turn off' : `click for ${nextAi}×`}`

  // Object.keys(roleConfig) místo statického ROLES — zahrnuje i uživatelsky přidané specializace
  const availableRoles = Object.keys(roleConfig).filter(r => !member.roles.includes(r))
  const taskMeta = currentTask ? roleConfig[currentTask.role] ?? null : null
  const fillPct = currentTask ? (currentTask.progress / currentTask.work) * 100 : 0

  // Barva právě zpracovávané role jako CSS proměnná pro výplň progress baru
  const progressStyle: CssVariables | undefined = taskMeta ? { '--role': taskMeta.color } : undefined
  // Odstín rozpracované feature pro čtvereček vedle jejího názvu
  const swatchStyle: CssVariables | undefined = currentFeature ? { '--hue': currentFeature.hue } : undefined

  return (
    <div data-tutorial-target={tutorialTarget} className={[styles.card, isWaiting && styles.waiting].filter(Boolean).join(' ')}>
      {/* Řádek 1: avatar + editovatelné jméno + tlačítko AI + tlačítko smazání */}
      <div className={styles.top}>
        {/* U týmů „Team X“ písmeno týmu, u lidí první písmeno jména (feat-021) */}
        <div className={styles.avatar}>{memberInitial(member.name)}</div>

        {/* Inline name input — vždy editovatelný, uloží při blur nebo Enter */}
        <input
          type="text"
          value={member.name}
          ref={nameRef}
          title={nameTruncated ? member.name : undefined}
          aria-label="Unit name"
          onChange={e => onRename(member.id, e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className={styles.name}
        />

        {/* Tlačítko AI (feat-019): bez AI průhledné „AI“ ve velikosti křížku; se zapnutým AI
            odznak v barvě accent s bleskem a hodnotou („⚡ 5×“). Každé kliknutí (i Enter / mezerník)
            nastaví další hodnotu 1× → 2× → 5× → 1×; fokus na tlačítku zůstává, takže jde přepínat
            opakovaně. */}
        <button
          type="button"
          onClick={() => onSetAiMultiplier(member.id, nextAi)}
          title={aiTitle}
          aria-label={aiLabel}
          data-tutorial-target={tutorialTarget ? `${tutorialTarget}-ai` : undefined}
          className={aiOn ? `${styles.aiButton} ${styles.aiButtonOn}` : styles.aiButton}
        >
          {aiOn && <BoltIcon />}
          {aiOn ? `${ai}×` : 'AI'}
        </button>

        {/* Tlačítko odebrání jednotky */}
        <button type="button" onClick={() => onRemove(member.id)} title="Remove unit" className={styles.mini}>×</button>
      </div>

      {/* Řádek 2: specializační chipy + tlačítko přidání role */}
      <div className={styles.roles}>
        {member.roles.map(r => (
          <RoleChip
            key={r}
            role={r}
            color={roleConfig[r]?.color ?? 'var(--ink-3)'}
            label={roleConfig[r]?.label}
            removable
            onRemove={() => onRemoveRole(member.id, r)}
          />
        ))}
        {!adding && availableRoles.length > 0 && (
          <button type="button" onClick={() => setAdding(true)} className={styles.addRole} aria-label="Add skill">+</button>
        )}
      </div>

      {/* Picker specializací — inline pod chipy, žádné absolutní pozicování.
          Zobrazí se jen při kliknutí na +, vždy celý viditelný v rámci karty. */}
      {adding && (
        <div className={styles.picker}>
          {availableRoles.map(r => {
            const pickStyle: CssVariables = { '--role': roleConfig[r]?.color ?? 'var(--ink-3)' }
            return (
              <button key={r} type="button" onClick={() => { onAddRole(member.id, r); setAdding(false) }} className={styles.pickRole} style={pickStyle}>
                {roleConfig[r]?.label ?? r}
              </button>
            )
          })}
          {/* Tlačítko zavření — vždy viditelné, protože je ve flow */}
          <button type="button" onClick={() => setAdding(false)} className={styles.pickerClose} aria-label="Close">×</button>
        </div>
      )}

      {/* Řádek 3: progress bar nebo idle stav.
          Fixní výška = popisek (16px) + mezera (2px) + bar (22px).
          Bez ní by karta měnila výšku při přechodu idle↔working a způsobovala
          reflow celého gridu (gridAutoRows: min-content) — viditelné jako trhání. */}
      <div className={styles.task}>
        {currentFeature && currentTask && taskMeta ? (
          <>
            <div className={styles.taskLine}>
              <span className={styles.swatch} style={swatchStyle} />
              <TruncatedText className={styles.taskName} text={currentFeature.name} />
              {/* Plný název aktuálně pracované specializace — v ink-3, barva role by v tmavém tématu neprošla kontrastem */}
              <span className={styles.taskRole}>{roleConfig[currentTask.role].label}</span>
            </div>
            {/* Progress bar — bez CSS transition, simulace běží na 60 fps a mutuje
                progress přímo; transition by přidávala lag a artefakty při přepnutí úkolu.
                Výška zůstává inline (22 px): podle ní bar najde integrační test feat-019. */}
            <div className={styles.progress} style={{ height: 22, ...progressStyle }}>
              <div className={styles.progressFill} style={{ width: `${fillPct}%` }} />
            </div>
          </>
        ) : (
          <div className={[styles.state, isWaiting && member.roles.length > 0 && styles.stateWaiting].filter(Boolean).join(' ')}>
            {/* Tečka: při čekání v barvě wait s prstencem, jinak tlumená */}
            <span className={styles.dot} />
            {member.roles.length === 0 ? 'no roles' : isWaiting ? 'waiting…' : 'idle'}
          </div>
        )}
      </div>
    </div>
  )
}
