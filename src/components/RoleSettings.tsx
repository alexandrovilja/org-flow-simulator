import type { Role, RoleMeta } from '@/types/simulation'
import { ROLES, ROLE_META } from '@/simulation/engine'

/** Maximální povolená úroveň specializace (min je vždy 1). */
const MAX_LEVEL = 5

interface RoleSettingsProps {
  /** Aktuální konfigurace všech specializací (label, level, required). */
  roleConfig: Record<Role, RoleMeta>
  /**
   * Callback volaný při změně jakékoliv vlastnosti specializace.
   * @param roleId  - ID měněné role (FE, BE, ...)
   * @param updates - Částečná aktualizace (pouze změněné vlastnosti)
   */
  onChange: (roleId: Role, updates: Partial<Pick<RoleMeta, 'label' | 'level' | 'required'>>) => void
}

/**
 * Panel pro konfiguraci specializací týmu.
 * Každá specializace má editovatelný název, úroveň (pořadí fází) a příznak povinnosti.
 *
 * Úroveň (level): vyšší číslo = dříve musí být hotovo.
 *   Příklad: Design (3) → FE+BE (2) → QA (1) znamená, že Design se musí dokončit
 *   dřív než začne vývoj, a vývoj dřív než QA.
 *   Úkoly na stejné úrovni mohou probíhat paralelně.
 *
 * Povinná (required): pokud je zaškrtnutá, každá vygenerovaná feature musí obsahovat
 *   alespoň jeden úkol této specializace.
 *   Změny se projeví při příštím generování backlogu.
 */
export function RoleSettings({ roleConfig, onChange }: RoleSettingsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Záhlaví sloupců */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '10px 1fr 72px 48px',
        gap: 6, alignItems: 'center',
        paddingBottom: 4,
        borderBottom: '1px solid var(--line)',
      }}>
        <span />
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</span>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Phase</span>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Req.</span>
      </div>

      {ROLES.map(roleId => {
        const meta = roleConfig[roleId]
        // Výchozí barva vždy z ROLE_META — barva není uživatelsky konfigurovatelná
        const color = ROLE_META[roleId].color

        return (
          <div key={roleId} style={{
            display: 'grid',
            gridTemplateColumns: '10px 1fr 72px 48px',
            gap: 6, alignItems: 'center',
          }}>
            {/* Barevný indikátor specializace */}
            <span style={{
              width: 8, height: 8, borderRadius: 2,
              background: color, flexShrink: 0,
            }} />

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

            {/* Úroveň — stepper s tlačítky – a + */}
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
                title={meta.required
                  ? 'Every feature must include this specialization'
                  : 'Optional — features may or may not include this'}
                style={{ cursor: 'pointer', width: 13, height: 13, accentColor: color }}
              />
            </div>
          </div>
        )
      })}

      {/* Nápověda k efektu level nastavení */}
      <p style={{
        margin: 0, marginTop: 4,
        fontSize: 9, color: 'var(--ink-3)', lineHeight: 1.5,
      }}>
        <strong>Phase:</strong> 1 = first phase, 2 = second, … Same phase = parallel.{' '}
        <strong>Req.:</strong> always in every backlog item (takes effect on regenerate).
      </p>
    </div>
  )
}

/** Sdílený styl pro tlačítka steppers − a + */
const stepperBtn: React.CSSProperties = {
  width: 18, height: 18,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--line)', borderRadius: 3,
  background: 'var(--bg)', color: 'var(--ink-2)',
  fontSize: 13, lineHeight: 1, cursor: 'pointer',
  padding: 0,
}
