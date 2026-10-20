'use client'

import { useState, useEffect, useRef } from 'react'
import type { RoleMeta } from '@/types/simulation'
import { ROLE_COLOR_SLOTS, type RoleColorSlot } from '@/simulation/roleColors'
import { Button } from '@/components/Button'
import styles from './RoleSettings.module.css'

/** Maximální povolená úroveň specializace (min je vždy 1). */
const MAX_LEVEL = 5

/**
 * Předvolby barev pro specializace — osm slotů design systému Org Flow (feat-021).
 * Dřívějších 16 pastelových odstínů nedrželo s bílým textem čipu kontrast; sloty ano (5:1 a víc).
 * Stejná sada se používá pro výběr barvy nové i existující specializace.
 */
export const COLOR_PRESETS: RoleColorSlot[] = ROLE_COLOR_SLOTS

/** Sentinelová hodnota openPickerId pro color picker formuláře nové specializace. */
const NEW_ROLE_PICKER_ID = '__new__'

/** Props editoru specializací. */
interface RoleSettingsProps {
  /** Aktuální specializace podle ID role. */
  roleConfig: Record<string, RoleMeta>
  /** Změna jedné specializace (název, barva, fáze, povinnost). */
  onChange: (roleId: string, updates: Partial<RoleMeta>) => void
  /** Přidání nové specializace s názvem a barvou. */
  onAdd: (label: string, color: string) => void
  /** Smazání specializace po potvrzení. */
  onDelete: (roleId: string) => void
}

/**
 * Panel pro konfiguraci specializací týmu.
 * Každá specializace má editovatelný název, floating color picker, úroveň fáze
 * a příznak povinnosti. Lze přidávat nové a mazat existující specializace.
 * Vzhled podle design systému Org Flow (feat-021): popisky v mono stylu „label“, nic pod 10 px,
 * barvy jen z tokenů; inline zůstává jen barva role (je to data).
 *
 * @param props - Specializace a callbacky změny, přidání a smazání
 * @returns Vykreslený editor
 */
export function RoleSettings({ roleConfig, onChange, onAdd, onDelete }: RoleSettingsProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0].color)
  const [addError, setAddError] = useState('')

  /**
   * ID role s aktuálně otevřeným color pickerem.
   * '__new__' = picker formuláře nové role, null = žádný otevřený.
   */
  const [openPickerId, setOpenPickerId] = useState<string | null>(null)

  /** Ref kontejneru panelu — slouží k detekci kliknutí mimo picker. */
  const containerRef = useRef<HTMLDivElement>(null)

  // Zavřít picker při kliknutí mimo celý RoleSettings panel
  useEffect(() => {
    if (!openPickerId) return
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPickerId(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [openPickerId])

  // Zavřít picker klávesou Escape
  useEffect(() => {
    if (!openPickerId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPickerId(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openPickerId])

  const roleIds = Object.keys(roleConfig)
  const canDelete = roleIds.length > 1

  const handleAdd = () => {
    const trimmed = newLabel.trim()
    if (!trimmed) { setAddError('Name is required'); return }
    const duplicate = Object.values(roleConfig).some(
      m => m.label.toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) { setAddError(`"${trimmed}" already exists`); return }
    onAdd(trimmed, newColor)
    setNewLabel('')
    setAddError('')
    // Posun výchozí barvy na další nepoužitou předvolbu
    const usedColors = new Set(Object.values(roleConfig).map(m => m.color))
    const next = COLOR_PRESETS.find(p => !usedColors.has(p.color))
    if (next) setNewColor(next.color)
  }

  /**
   * Plovoucí výběr barvy: osm slotů rolí v mřížce, vybraný slot má rámeček a ✓.
   *
   * @param selected - Barva, která je teď zvolená
   * @param onPick - Volá se se zvolenou barvou
   * @param forNewRole - Výběr patří formuláři nové role (větší čtverec → panel níž)
   */
  const colorPicker = (selected: string, onPick: (color: string) => void, forNewRole = false) => (
    <div className={`${styles.picker} ${forNewRole ? styles.pickerBelowNew : ''}`}>
      {COLOR_PRESETS.map(p => (
        <button
          key={p.color}
          type="button"
          title={p.name}
          onClick={() => onPick(p.color)}
          className={[styles.pickerSwatch, selected === p.color && styles.swatchSelected].filter(Boolean).join(' ')}
          style={{ background: p.color }}
        >
          {selected === p.color && <span className={styles.check}>✓</span>}
        </button>
      ))}
    </div>
  )

  return (
    <div ref={containerRef} className={styles.root}>
      {/* Záhlaví sloupců */}
      <div className={`${styles.grid} ${styles.head}`}>
        <span className={styles.colLabel}>Col.</span>
        <span className={styles.colLabel}>Name</span>
        <span className={`${styles.colLabel} ${styles.center}`}>Phase</span>
        <span className={`${styles.colLabel} ${styles.center}`}>Req.</span>
        <span />
      </div>

      {/* Existující specializace */}
      {roleIds.map(roleId => {
        const meta = roleConfig[roleId]
        const isConfirming = confirmDelete === roleId
        const pickerOpen = openPickerId === roleId

        return (
          <div key={roleId} className={styles.row}>
            <div className={styles.grid}>
              {/* Barevný čtverec — klik otevře / zavře floating picker; barva role je inline (data) */}
              <div className={styles.swatchWrap}>
                <button
                  type="button"
                  onClick={() => setOpenPickerId(pickerOpen ? null : roleId)}
                  title="Change color"
                  className={[styles.swatch, pickerOpen && styles.swatchSelected].filter(Boolean).join(' ')}
                  style={{ background: meta.color }}
                >
                  {/* Malá šipka signalizující, že je klikatelné */}
                  <span className={styles.caret}>▾</span>
                </button>

                {pickerOpen && colorPicker(meta.color, color => {
                  onChange(roleId, { color })
                  setOpenPickerId(null)
                })}
              </div>

              {/* Název */}
              <input
                type="text"
                value={meta.label}
                onChange={e => onChange(roleId, { label: e.target.value })}
                className={styles.input}
              />

              {/* Úroveň fáze — stepper */}
              <div className={styles.stepper}>
                <button
                  type="button"
                  onClick={() => onChange(roleId, { level: Math.max(1, meta.level - 1) })}
                  disabled={meta.level <= 1}
                  className={styles.stepButton}
                >−</button>
                <span className={styles.level}>{meta.level}</span>
                <button
                  type="button"
                  onClick={() => onChange(roleId, { level: Math.min(MAX_LEVEL, meta.level + 1) })}
                  disabled={meta.level >= MAX_LEVEL}
                  className={styles.stepButton}
                >+</button>
              </div>

              {/* Povinná role; checkbox je zbarvený barvou role (inline, je to data) */}
              <div className={styles.cell}>
                <input
                  type="checkbox"
                  checked={meta.required}
                  onChange={e => onChange(roleId, { required: e.target.checked })}
                  title={meta.required ? 'Required in every backlog item' : 'Optional'}
                  className={styles.checkbox}
                  style={{ accentColor: meta.color }}
                />
              </div>

              {/* Smazání */}
              <div className={styles.cell}>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(roleId)}
                    title={`Delete ${meta.label}`}
                    className={styles.deleteButton}
                  >🗑</button>
                )}
              </div>
            </div>

            {/* Inline potvrzení smazání — v barvách reworku, protože se zahodí práce */}
            {isConfirming && (
              <div className={styles.confirm}>
                <span className={styles.confirmText}>
                  Delete <strong>{meta.label}</strong>? Tasks requiring it will be removed.
                </span>
                <button
                  type="button"
                  onClick={() => { onDelete(roleId); setConfirmDelete(null) }}
                  className={`${styles.smallButton} ${styles.danger}`}
                >Delete</button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className={`${styles.smallButton} ${styles.neutral}`}
                >Cancel</button>
              </div>
            )}
          </div>
        )
      })}

      {/* Formulář pro přidání nové specializace */}
      <div className={styles.addSection}>
        <span className={styles.colLabel}>Add specialization</span>

        <div className={styles.addRow}>
          {/* Barevný čtverec nové role s floating pickerem */}
          <div className={styles.swatchWrap}>
            <button
              type="button"
              onClick={() => setOpenPickerId(
                openPickerId === NEW_ROLE_PICKER_ID ? null : NEW_ROLE_PICKER_ID
              )}
              title="Pick color"
              className={[styles.swatch, styles.swatchLarge, openPickerId === NEW_ROLE_PICKER_ID && styles.swatchSelected].filter(Boolean).join(' ')}
              style={{ background: newColor }}
            >
              <span className={styles.caret}>▾</span>
            </button>

            {openPickerId === NEW_ROLE_PICKER_ID && colorPicker(newColor, color => {
              setNewColor(color)
              setOpenPickerId(null)
            }, true)}
          </div>

          <input
            type="text"
            value={newLabel}
            onChange={e => { setNewLabel(e.target.value); setAddError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Name…"
            aria-invalid={addError ? true : undefined}
            className={[styles.input, styles.addInput, addError && styles.inputError].filter(Boolean).join(' ')}
          />
          <Button variant="strong" onClick={handleAdd}>Add</Button>
        </div>

        {addError && <span className={styles.error}>{addError}</span>}
      </div>

      {/* Nápověda */}
      <p className={styles.help}>
        <strong>Phase:</strong> 1 = first, 2 = second, … Same phase = parallel.{' '}
        <strong>Req.:</strong> always in every item (takes effect on regenerate).
      </p>
    </div>
  )
}
