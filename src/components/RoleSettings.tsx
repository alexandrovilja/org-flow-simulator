'use client'

import { useState, useEffect, useRef } from 'react'
import type { RoleMeta } from '@/types/simulation'

/** Maximální povolená úroveň specializace (min je vždy 1). */
const MAX_LEVEL = 5

/**
 * Předvolby barev pro specializace — 16 hue hodnot rovnoměrně rozložených
 * přes barevný kruh v oklch prostoru.
 * Stejná sada se používá pro výběr barvy nové i existující specializace.
 */
export const COLOR_PRESETS: { hue: number; color: string }[] = [
  { hue:   0, color: 'oklch(65% 0.18   0)' },  // červená
  { hue:  25, color: 'oklch(72% 0.13  25)' },  // oranžovo-červená
  { hue:  45, color: 'oklch(74% 0.14  45)' },  // oranžová
  { hue:  75, color: 'oklch(72% 0.14  75)' },  // žlutozelená
  { hue: 100, color: 'oklch(68% 0.15 100)' },  // zelená
  { hue: 145, color: 'oklch(68% 0.13 145)' },  // smaragdová
  { hue: 170, color: 'oklch(67% 0.13 170)' },  // tyrkysová
  { hue: 200, color: 'oklch(68% 0.13 200)' },  // azurová
  { hue: 220, color: 'oklch(69% 0.14 220)' },  // nebeská modrá
  { hue: 250, color: 'oklch(70% 0.14 250)' },  // modrá
  { hue: 270, color: 'oklch(66% 0.15 270)' },  // fialovo-modrá
  { hue: 285, color: 'oklch(66% 0.14 285)' },  // fialová
  { hue: 305, color: 'oklch(65% 0.15 305)' },  // purpurová
  { hue: 320, color: 'oklch(64% 0.14 320)' },  // růžovo-fialová
  { hue: 340, color: 'oklch(66% 0.15 340)' },  // růžová
  { hue: 355, color: 'oklch(65% 0.16 355)' },  // tmavě růžová
]

/** Sentinelová hodnota openPickerId pro color picker formuláře nové specializace. */
const NEW_ROLE_PICKER_ID = '__new__'

interface RoleSettingsProps {
  roleConfig: Record<string, RoleMeta>
  onChange: (roleId: string, updates: Partial<RoleMeta>) => void
  onAdd: (label: string, color: string) => void
  onDelete: (roleId: string) => void
}

/**
 * Panel pro konfiguraci specializací týmu.
 * Každá specializace má editovatelný název, floating color picker, úroveň fáze
 * a příznak povinnosti. Lze přidávat nové a mazat existující specializace.
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

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Záhlaví sloupců */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr 72px 40px 20px',
        gap: 6, alignItems: 'center',
        paddingBottom: 4,
        borderBottom: '1px solid var(--line)',
      }}>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Col.</span>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</span>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Phase</span>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Req.</span>
        <span />
      </div>

      {/* Existující specializace */}
      {roleIds.map(roleId => {
        const meta = roleConfig[roleId]
        const isConfirming = confirmDelete === roleId
        const pickerOpen = openPickerId === roleId

        return (
          <div key={roleId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr 72px 40px 20px',
              gap: 6, alignItems: 'center',
            }}>
              {/* Barevný čtverec — klik otevře / zavře floating picker */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setOpenPickerId(pickerOpen ? null : roleId)}
                  title="Change color"
                  style={{
                    width: 20, height: 20,
                    borderRadius: 4,
                    background: meta.color,
                    border: pickerOpen ? '2px solid var(--ink)' : '2px solid transparent',
                    cursor: 'pointer', padding: 0, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {/* Malá šipka signalizující, že je klikatelné */}
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>▾</span>
                </button>

                {/* Floating color picker panel */}
                {pickerOpen && (
                  <div style={{
                    position: 'absolute', top: 26, left: 0, zIndex: 100,
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    padding: 8,
                    display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  }}>
                    {COLOR_PRESETS.map(p => (
                      <button
                        key={p.hue}
                        title={`Hue ${p.hue}`}
                        onClick={() => {
                          onChange(roleId, { color: p.color })
                          setOpenPickerId(null)
                        }}
                        style={{
                          width: 22, height: 22,
                          borderRadius: 5,
                          background: p.color,
                          border: meta.color === p.color
                            ? '2px solid var(--ink)'
                            : '2px solid transparent',
                          cursor: 'pointer', padding: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {meta.color === p.color && (
                          <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Název */}
              <input
                type="text"
                value={meta.label}
                onChange={e => onChange(roleId, { label: e.target.value })}
                style={{
                  fontSize: 11, fontFamily: 'inherit',
                  border: '1px solid var(--line)',
                  borderRadius: 3, padding: '2px 5px',
                  background: 'var(--bg)', color: 'var(--ink)',
                  width: '100%', minWidth: 0,
                }}
              />

              {/* Úroveň fáze — stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button
                  onClick={() => onChange(roleId, { level: Math.max(1, meta.level - 1) })}
                  disabled={meta.level <= 1}
                  style={stepperBtn}
                >−</button>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', minWidth: 16, textAlign: 'center' }}>
                  {meta.level}
                </span>
                <button
                  onClick={() => onChange(roleId, { level: Math.min(MAX_LEVEL, meta.level + 1) })}
                  disabled={meta.level >= MAX_LEVEL}
                  style={stepperBtn}
                >+</button>
              </div>

              {/* Povinná role */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={meta.required}
                  onChange={e => onChange(roleId, { required: e.target.checked })}
                  title={meta.required ? 'Required in every backlog item' : 'Optional'}
                  style={{ cursor: 'pointer', width: 13, height: 13, accentColor: meta.color }}
                />
              </div>

              {/* Smazání */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {canDelete && (
                  <button
                    onClick={() => setConfirmDelete(roleId)}
                    title={`Delete ${meta.label}`}
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--ink-3)', fontSize: 12,
                      cursor: 'pointer', padding: 0, lineHeight: 1,
                    }}
                  >🗑</button>
                )}
              </div>
            </div>

            {/* Inline potvrzení smazání */}
            {isConfirming && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px',
                background: 'oklch(97% 0.02 25)',
                border: '1px solid oklch(85% 0.08 25)',
                borderRadius: 4, fontSize: 10, color: 'var(--ink-2)',
              }}>
                <span style={{ flex: 1 }}>
                  Delete <strong>{meta.label}</strong>? Tasks requiring it will be removed.
                </span>
                <button
                  onClick={() => { onDelete(roleId); setConfirmDelete(null) }}
                  style={{ ...actionBtn, background: 'oklch(50% 0.15 25)', color: 'white' }}
                >Delete</button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  style={{ ...actionBtn, background: 'var(--line)', color: 'var(--ink-2)' }}
                >Cancel</button>
              </div>
            )}
          </div>
        )
      })}

      {/* Formulář pro přidání nové specializace */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        marginTop: 4, paddingTop: 8,
        borderTop: '1px solid var(--line)',
      }}>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Add specialization
        </span>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Barevný čtverec nové role s floating pickerem */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setOpenPickerId(
                openPickerId === NEW_ROLE_PICKER_ID ? null : NEW_ROLE_PICKER_ID
              )}
              title="Pick color"
              style={{
                width: 28, height: 28,
                borderRadius: 5,
                background: newColor,
                border: openPickerId === NEW_ROLE_PICKER_ID
                  ? '2px solid var(--ink)'
                  : '2px solid transparent',
                cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>▾</span>
            </button>

            {openPickerId === NEW_ROLE_PICKER_ID && (
              <div style={{
                position: 'absolute', top: 34, left: 0, zIndex: 100,
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: 6, padding: 8,
                display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5,
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              }}>
                {COLOR_PRESETS.map(p => (
                  <button
                    key={p.hue}
                    title={`Hue ${p.hue}`}
                    onClick={() => { setNewColor(p.color); setOpenPickerId(null) }}
                    style={{
                      width: 22, height: 22,
                      borderRadius: 5,
                      background: p.color,
                      border: newColor === p.color
                        ? '2px solid var(--ink)'
                        : '2px solid transparent',
                      cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {newColor === p.color && (
                      <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            value={newLabel}
            onChange={e => { setNewLabel(e.target.value); setAddError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Name…"
            style={{
              flex: 1, minWidth: 0,
              fontSize: 11, fontFamily: 'inherit',
              border: `1px solid ${addError ? 'oklch(60% 0.18 25)' : 'var(--line)'}`,
              borderRadius: 3, padding: '3px 6px',
              background: 'var(--bg)', color: 'var(--ink)',
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              ...actionBtn,
              background: 'var(--ink)', color: 'white',
              padding: '4px 10px', fontSize: 11,
            }}
          >Add</button>
        </div>

        {addError && (
          <span style={{ fontSize: 10, color: 'oklch(50% 0.18 25)' }}>{addError}</span>
        )}
      </div>

      {/* Nápověda */}
      <p style={{ margin: 0, fontSize: 9, color: 'var(--ink-3)', lineHeight: 1.5 }}>
        <strong>Phase:</strong> 1 = first, 2 = second, … Same phase = parallel.{' '}
        <strong>Req.:</strong> always in every item (takes effect on regenerate).
      </p>
    </div>
  )
}

const stepperBtn: React.CSSProperties = {
  width: 18, height: 18,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--line)', borderRadius: 3,
  background: 'var(--bg)', color: 'var(--ink-2)',
  fontSize: 13, lineHeight: 1, cursor: 'pointer',
  padding: 0,
}

const actionBtn: React.CSSProperties = {
  border: 'none', borderRadius: 3,
  padding: '2px 7px', fontSize: 10,
  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
}
