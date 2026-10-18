'use client'

import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { RoleChip } from './RoleChip'
import styles from './MemberCard.module.css'
import type { AiMultiplier, Feature, Member, Task, Role, RoleMeta } from '@/types/simulation'

/** Volby menu AI v pořadí zobrazení (feat-019). Hodnota 1 je volba „off“ — nabízí se jen
 *  při zapnutém AI, protože bez AI není co vypínat. */
const AI_OPTIONS: AiMultiplier[] = [2, 5, 1]

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
export function MemberCard({ member, currentFeature, currentTask, roleConfig, onAddRole, onRemoveRole, onRename, onRemove, onSetAiMultiplier, isWaiting = false }: MemberCardProps) {
  const [adding, setAdding] = useState(false)
  // Pro kterou jednotku je otevřené menu voleb AI (feat-019) — lokální UI stav karty, simulace o něm
  // neví. Pamatujeme si objekt jednotky, ne jen true/false: karty jsou klíčované ID jednotky a po
  // výměně týmu (preset, nová jednotka se stejným ID) dostane karta jiný objekt — menu se pak samo
  // zavře, místo aby „přeskočilo“ na jednotku, na kterou uživatel neklikl.
  const [aiMenuFor, setAiMenuFor] = useState<Member | null>(null)
  const aiOpen = aiMenuFor === member
  // Tlačítko AI — po výběru volby nebo Escape na něj vracíme fokus, aby klávesnice neztratila pozici
  const aiButtonRef = useRef<HTMLButtonElement>(null)
  // Stabilní ID menu pro aria-controls tlačítka AI
  const aiMenuId = useId()
  // Chybějící hodnota = 1× (bez AI); odznak se ukazuje jen při 2× nebo 5×
  const ai = member.aiMultiplier ?? 1
  const aiOn = ai > 1
  // Přístupný název obsahuje i viditelnou hodnotu („5×“), aby ji čtečka ohlásila (WCAG 2.5.3)
  const aiLabel = aiOn ? `AI speed-up: ${ai}×` : 'AI speed-up'

  /** Zavře menu AI a vrátí fokus na tlačítko AI (menu s fokusovanou volbou právě zmizí). */
  function closeAiMenu() {
    setAiMenuFor(null)
    aiButtonRef.current?.focus()
  }

  /**
   * Escape v tlačítku AI nebo ve volbách menu zavře menu bez změny nastavení.
   *
   * @param e - Událost klávesnice z tlačítka AI nebo z volby menu
   */
  function handleAiKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && aiOpen) closeAiMenu()
  }
  // Object.keys(roleConfig) místo statického ROLES — zahrnuje i uživatelsky přidané specializace
  const availableRoles = Object.keys(roleConfig).filter(r => !member.roles.includes(r))
  const taskMeta = currentTask ? roleConfig[currentTask.role] ?? null : null
  const fillPct = currentTask ? (currentTask.progress / currentTask.work) * 100 : 0

  return (
    <div style={{
      background: isWaiting ? 'oklch(98.5% 0.015 60)' : 'var(--panel)',
      border: isWaiting ? '1px solid var(--warn)' : '1px solid var(--line)',
      borderRadius: 6,
      padding: '6px 8px',
      display: 'flex', flexDirection: 'column', gap: 4,
      minHeight: 0, overflow: 'hidden',
    }}>
      {/* Řádek 1: avatar + editovatelné jméno + tlačítko smazání */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--ink)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 600, flexShrink: 0,
        }}>
          {member.name[0]?.toUpperCase() ?? '?'}
        </div>

        {/* Inline name input — vždy editovatelný, uloží při blur nebo Enter */}
        <input
          type="text"
          value={member.name}
          onChange={e => onRename(member.id, e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            flex: 1, minWidth: 0,
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink)', padding: 0,
          }}
        />

        {/* Tlačítko AI (feat-019): bez AI průhledné „AI“ ve velikosti křížku; se zapnutým AI
            modrý odznak s bleskem a hodnotou („⚡ 5×“). Kliknutí otevře/zavře menu voleb. */}
        <button
          ref={aiButtonRef}
          onClick={() => setAiMenuFor(aiOpen ? null : member)}
          onKeyDown={handleAiKeyDown}
          title={aiLabel}
          aria-label={aiLabel}
          aria-expanded={aiOpen}
          aria-controls={aiOpen ? aiMenuId : undefined}
          className={aiOn ? `${styles.aiButton} ${styles.aiButtonOn}` : styles.aiButton}
        >
          {aiOn && <BoltIcon />}
          {aiOn ? `${ai}×` : 'AI'}
        </button>

        {/* Tlačítko odebrání jednotky */}
        <button
          onClick={() => onRemove(member.id)}
          title="Remove unit"
          style={{
            flexShrink: 0,
            width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 3, color: 'var(--ink-3)',
            fontSize: 11, lineHeight: 1, cursor: 'pointer',
            padding: 0,
          }}
        >×</button>
      </div>

      {/* Volby AI (feat-019) — inline pod horním řádkem, zarovnané doprava. Stejně jako picker
          specializací bez absolutního pozicování: karta má overflow: hidden, bublina by se usekla.
          Výběr volby nastaví multiplikátor, menu zavře a vrátí fokus na tlačítko AI. */}
      {aiOpen && (
        <div id={aiMenuId} role="group" aria-label="AI speed-up options" className={styles.aiMenu} onKeyDown={handleAiKeyDown}>
          {AI_OPTIONS.filter(v => v > 1 || aiOn).map(v => {
            const selected = v === ai
            // Třídy volby: základ + „off“ (slovo, tlumenější) + vybraná volba (modrá)
            const className = [styles.aiOption, v === 1 && styles.aiOptionOff, selected && styles.aiOptionSelected]
              .filter(Boolean).join(' ')
            return (
              <button
                key={v}
                aria-pressed={selected}
                onClick={() => { onSetAiMultiplier(member.id, v); closeAiMenu() }}
                className={className}
              >
                {v === 1 ? 'off' : `${v}×`}
              </button>
            )
          })}
        </div>
      )}

      {/* Řádek 2: specializační chipy + tlačítko přidání role */}
      {/* Řádek chipů + tlačítko přidání */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
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
          <button onClick={() => setAdding(true)} style={{
            background: 'transparent',
            border: '1px dashed var(--line-2)',
            color: 'var(--ink-3)',
            fontSize: 10, padding: '1px 5px', borderRadius: 3,
            fontWeight: 500, lineHeight: 1.2, cursor: 'pointer',
          }}>+</button>
        )}
      </div>

      {/* Picker specializací — inline pod chipy, žádné absolutní pozicování.
          Zobrazí se jen při kliknutí na +, vždy celý viditelný v rámci karty. */}
      {adding && (
        <div style={{
          display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center',
          padding: '4px 6px',
          background: 'var(--bg)',
          border: '1px solid var(--line-2)', borderRadius: 5,
        }}>
          {availableRoles.map(r => (
            <button key={r} onClick={() => { onAddRole(member.id, r); setAdding(false) }} style={{
              background: roleConfig[r]?.color ?? 'var(--ink-3)',
              border: 'none', color: 'white',
              fontSize: 10, fontWeight: 600,
              padding: '2px 8px', borderRadius: 3,
              letterSpacing: 0.3, cursor: 'pointer',
            }}>
              {roleConfig[r]?.label ?? r}
            </button>
          ))}
          {/* Tlačítko zavření — vždy viditelné, protože je ve flow */}
          <button onClick={() => setAdding(false)} style={{
            background: 'transparent', border: 'none',
            color: 'var(--ink-3)', fontSize: 10,
            padding: '0 2px', cursor: 'pointer', marginLeft: 'auto',
          }}>✕</button>
        </div>
      )}

      {/* Řádek 3: progress bar nebo idle stav.
          Fixní výška = label (12px) + gap (2px) + bar (22px) = 36px.
          Bez ní by karta měnila výšku při přechodu idle↔working a způsobovala
          reflow celého gridu (gridAutoRows: min-content) — viditelné jako trhání. */}
      <div style={{ minHeight: 36, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentFeature && currentTask && taskMeta ? (
          <>
            <div style={{
              fontSize: 10, color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', gap: 4,
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 2,
                background: `oklch(70% 0.14 ${currentFeature.hue})`, flexShrink: 0,
              }} />
              <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                {currentFeature.name}
              </span>
              <span className="mono" style={{ fontSize: 9, fontWeight: 600, color: taskMeta.color, flexShrink: 0 }}>
                {/* Plný název aktuálně pracované specializace */}
                {roleConfig[currentTask.role].label}
              </span>
            </div>
            {/* Progress bar — bez CSS transition, simulace běží na 60 fps a mutuje
                progress přímo; transition by přidávala lag a artefakty při přepnutí úkolu */}
            <div style={{ height: 22, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${fillPct}%`, background: taskMeta.color }} />
            </div>
          </>
        ) : (
          <div style={{
            fontSize: 10,
            color: member.roles.length === 0 ? 'var(--ink-3)' : isWaiting ? 'var(--warn)' : 'var(--ink-3)',
            fontStyle: isWaiting ? 'normal' : 'italic',
            fontWeight: isWaiting ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {/* Dot: amber + pulsing border when waiting, static gray when idle */}
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: isWaiting && member.roles.length > 0 ? 'var(--warn)' : 'var(--line-2)',
              boxShadow: isWaiting && member.roles.length > 0 ? '0 0 0 2px oklch(85% 0.10 60)' : 'none',
            }} />
            {member.roles.length === 0 ? 'no roles' : isWaiting ? 'waiting…' : 'idle'}
          </div>
        )}
      </div>
    </div>
  )
}
