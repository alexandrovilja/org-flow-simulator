'use client'

import { useState } from 'react'
import type { RoleMeta } from '@/types/simulation'

/** Maximální povolená úroveň specializace (min je vždy 1). */
const MAX_LEVEL = 5

/**
 * Předvolby barev pro specializace — 8 hue hodnot v oklch prostoru.
 * Stejná sada se používá pro výběr barvy nové i existující specializace.
 */
export const COLOR_PRESETS: { hue: number; color: string }[] = [
  { hue: 250, color: 'oklch(70% 0.14 250)' },
  { hue: 285, color: 'oklch(66% 0.14 285)' },
  { hue: 25,  color: 'oklch(72% 0.13 25)'  },
  { hue: 145, color: 'oklch(68% 0.13 145)' },
  { hue: 75,  color: 'oklch(68% 0.13 75)'  },
  { hue: 320, color: 'oklch(64% 0.14 320)' },
  { hue: 180, color: 'oklch(68% 0.13 180)' },
  { hue: 30,  color: 'oklch(70% 0.14 30)'  },
]

interface RoleSettingsProps {
  /** Aktuální konfigurace všech specializací (label, color, level, required). */
  roleConfig: Record<string, RoleMeta>
  /**
   * Callback volaný při změně jakékoliv vlastnosti specializace.
   * @param roleId  - ID měněné role
   * @param updates - Částečná aktualizace (pouze změněné vlastnosti)
   */
  onChange: (roleId: string, updates: Partial<RoleMeta>) => void
  /**
   * Callback pro přidání nové specializace.
   * @param label - Zobrazovaný název nové specializace
   * @param color - Barva v oklch formátu
   */
  onAdd: (label: string, color: string) => void
  /**
   * Callback pro smazání specializace.
   * @param roleId - ID specializace k odstranění
   */
  onDelete: (roleId: string) => void
}

/**
 * Panel pro konfiguraci specializací týmu.
 * Každá specializace má editovatelný název, inline color picker, úroveň fáze
 * a příznak povinnosti. Lze přidávat nové a mazat existující specializace.
 */
export function RoleSettings({ roleConfig, onChange, onAdd, onDelete }: RoleSettingsProps) {
  /** ID specializace čekající na potvrzení smazání (null = žádné). */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  /** Stav formuláře pro přidání nové specializace. */
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0].color)
  const [addError, setAddError] = useState('')

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Záhlaví sloupců */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr 72px 40px 20px',
        gap: 6, alignItems: 'center',
        paddingBottom: 4,
        borderBottom: '1px solid var(--line)',
      }}>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Color</span>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</span>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Phase</span>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Req.</span>
        <span />
      </div>

      {/* Existující specializace */}
      {roleIds.map(roleId => {
        const meta = roleConfig[roleId]
        const isConfirming = confirmDelete === roleId

        return (
          <div key={roleId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr 72px 40px 20px',
              gap: 6, alignItems: 'center',
            }}>
              {/* Inline color picker — sada barevných teček */}
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {COLOR_PRESETS.map(p => (
                  <button
                    key={p.hue}
                    title={`Color hue ${p.hue}`}
                    onClick={() => onChange(roleId, { color: p.color })}
                    style={{
                      width: 10, height: 10,
                      borderRadius: '50%',
                      background: p.color,
                      border: meta.color === p.color
                        ? '2px solid var(--ink)'
                        : '2px solid transparent',
                      padding: 0, cursor: 'pointer', flexShrink: 0,
                    }}
                  />
                ))}
              </div>

              {/* Název — editovatelný textový vstup */}
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
                  title="Decrease phase"
                >−</button>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--ink)',
                  minWidth: 16, textAlign: 'center',
                }}>{meta.level}</span>
                <button
                  onClick={() => onChange(roleId, { level: Math.min(MAX_LEVEL, meta.level + 1) })}
                  disabled={meta.level >= MAX_LEVEL}
                  style={stepperBtn}
                  title="Increase phase"
                >+</button>
              </div>

              {/* Povinná role — checkbox */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={meta.required}
                  onChange={e => onChange(roleId, { required: e.target.checked })}
                  title={meta.required ? 'Required in every backlog item' : 'Optional'}
                  style={{ cursor: 'pointer', width: 13, height: 13, accentColor: meta.color }}
                />
              </div>

              {/* Tlačítko smazání — skryté pokud je jen 1 role */}
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
                <span style={{ flex: 1 }}>Delete <strong>{meta.label}</strong>? Tasks requiring it will be removed.</span>
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
        marginTop: 4,
        paddingTop: 8,
        borderTop: '1px solid var(--line)',
      }}>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Add specialization
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
              padding: '3px 8px', fontSize: 11,
            }}
          >Add</button>
        </div>

        {/* Color picker pro novou roli */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>Color:</span>
          {COLOR_PRESETS.map(p => (
            <button
              key={p.hue}
              onClick={() => setNewColor(p.color)}
              style={{
                width: 14, height: 14,
                borderRadius: '50%',
                background: p.color,
                border: newColor === p.color
                  ? '2px solid var(--ink)'
                  : '2px solid transparent',
                padding: 0, cursor: 'pointer',
              }}
            />
          ))}
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
