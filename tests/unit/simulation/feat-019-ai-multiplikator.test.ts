import { describe, it, expect } from 'vitest'
import {
  applyPreset, makeInitialState, mulberry32, PRESETS, resetFromSnapshot, setMemberAiMultiplier, tick,
} from '@/simulation/engine'
import type { Feature, Member, SimSettings, SimState, Task } from '@/types/simulation'

// feat-019 (AI multiplikátor výkonu) — chování enginu.
//
// Schválený kontrakt (spec features/feat-019-ai-multiplikator-vykonu.md):
//  - `Member` dostane volitelné pole `aiMultiplier?: AiMultiplier`, kde `AiMultiplier = 1 | 2 | 5`.
//    Chybějící hodnota znamená 1× (bez AI).
//  - V `tick()` postupuje rozpracovaný task o `dtSim × multiplikátor jednotky, která ho zpracovává`
//    (assignee). Multiplikátor se čte v každém ticku, takže změna za běhu platí okamžitě
//    a rozpracovanost se neztrácí.
//  - Multiplikátor zrychluje celou práci tasku včetně join taxu z coordination overhead (varianta A).
//  - Reset (`resetFromSnapshot`) nastavení AI zachová; presety (`applyPreset`) vytváří jednotky s 1×.
//  - Sdílený helper `setMemberAiMultiplier(state, memberId, value)` (používá ho Advanced i Cash Flow)
//    zapíše hodnotu a vrátí true jen při skutečné změně — volající podle toho přepíná preset na „custom“.
//  - Jednotka s AI si úkoly bere podle stejných pravidel jako ostatní, dřív se uvolní, čeká stejně
//    jako ostatní a nezrychluje práci jiných jednotek. Testy záměrně neověřují dopad na metriky týmu
//    (Cycle Time, Total Time, WIP) — spec ho netvrdí.
//
// Časy v testech jsou násobky 0.5 s, aby součty progresu byly v plovoucí čárce přesné.

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0,
  roleVar: 0,
  initialBacklog: 5,
  minSpecializations: 1,
}

/**
 * Vytvoří jednotku týmu. `ai` vynecháno = jednotka bez pole `aiMultiplier` (výchozí stav).
 *
 * @param id    - ID jednotky
 * @param roles - Specializace jednotky
 * @param ai    - AI multiplikátor; undefined = pole se nevytvoří
 * @returns Nová jednotka bez přiřazeného úkolu
 */
function unit(id: number, roles: string[], ai?: 1 | 2 | 5): Member {
  const m: Member = { id, name: `U${id}`, roles, currentTask: null, idleSec: 0 }
  if (ai !== undefined) m.aiMultiplier = ai
  return m
}

/**
 * Vytvoří featuru se zadanými tasky. Všechna povinná pole Feature mají neutrální hodnoty
 * (stejný vzor jako testy feat-002).
 *
 * @param id     - ID featury
 * @param tasks  - Tasky featury
 * @param status - 'in-progress' (už se na ní pracuje) nebo 'backlog'
 * @returns Nová featura
 */
function feature(id: number, tasks: Task[], status: 'in-progress' | 'backlog' = 'in-progress'): Feature {
  return {
    id, name: `F-${id}`, hue: 0, priority: id,
    createdAt: 0, startedAt: status === 'in-progress' ? 0 : null, finishedAt: null, status,
    revenuePerTick: 100, totalRevenue: 0, lastTickRevenue: null, lastRevenueTickAt: 0,
    joinCount: 0, reworkCount: 0, joinTaxSec: 0, reworkSec: 0, workedBy: [], pendingDivergence: [],
    revenueProfile: 'flat', revenueTickCount: 0, coordSeed: 0,
    tasks,
  }
}

/**
 * Sestaví stav, ve kterém jednotka `member` už zpracovává jediný task s prací `work`
 * (status 'doing', odvedeno `progress`). Backlog je prázdný, takže nic dalšího se nepřiřadí.
 *
 * @param member   - Jednotka, která task zpracovává
 * @param work     - Celková práce tasku v sekundách
 * @param progress - Už odvedená práce
 * @returns Stav simulace a odkaz na task
 */
function stateWithDoingTask(member: Member, work: number, progress = 0): { state: SimState; task: Task } {
  const state = makeInitialState(mulberry32(1), SETTINGS)
  const task: Task = { id: 1, role: member.roles[0], work, progress, status: 'doing', assignee: member.id }
  member.currentTask = { featureId: 1, taskId: 1 }
  state.team = [member]
  state.backlog = []
  state.backlogSnapshot = []
  state.inProgress = [feature(1, [task])]
  return { state, task }
}

/**
 * Zavolá `tick()` `steps`-krát s krokem `dt`.
 *
 * @param state    - Stav simulace (mutován)
 * @param dt       - Délka jednoho ticku v simulačních sekundách
 * @param steps    - Počet ticků
 * @param settings - Nastavení simulace
 */
function run(state: SimState, dt: number, steps: number, settings: SimSettings = SETTINGS): void {
  const rng = mulberry32(1)
  for (let i = 0; i < steps; i++) tick(state, dt, settings, rng)
}

describe('feat-019 Příklad 1: výchozí stav bez AI', () => {
  it('jednotka bez aiMultiplier pracuje 1×: úkol s prací 10 s je hotový přesně po 10 s', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE']), 10)
    run(state, 0.5, 19) // 9.5 s
    expect(task.status).toBe('doing')
    expect(task.progress).toBeCloseTo(9.5, 10)
    run(state, 0.5, 1) // 10 s
    expect(task.status).toBe('done')
  })

  it('aiMultiplier 1 se chová stejně jako chybějící hodnota', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE'], 1), 10)
    run(state, 0.5, 19)
    expect(task.status).toBe('doing')
    run(state, 0.5, 1)
    expect(task.status).toBe('done')
  })

  it('výchozí tým z makeInitialState nemá AI zapnuté (všechny jednotky 1×)', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    for (const m of state.team) expect(m.aiMultiplier ?? 1).toBe(1)
  })
})

describe('feat-019 Příklad 2: zrychlení 2×', () => {
  it('úkol s prací 10 s je hotový po 5 s simulačního času', () => {
    const member = unit(1, ['FE'], 2)
    const { state, task } = stateWithDoingTask(member, 10)
    run(state, 0.5, 9) // 4.5 s → odvedeno 9 s práce
    expect(task.status).toBe('doing')
    expect(task.progress).toBeCloseTo(9, 10)
    run(state, 0.5, 1) // 5 s → odvedeno 10 s práce
    expect(task.status).toBe('done')
    // Jednotka se uvolní a featura se dokončí stejně jako bez AI
    expect(member.currentTask).toBeNull()
    expect(state.done.map(f => f.id)).toEqual([1])
  })

  it('Cycle Time dokončené featury odpovídá zrychlené práci (5 s místo 10 s)', () => {
    const { state } = stateWithDoingTask(unit(1, ['FE'], 2), 10)
    run(state, 0.5, 10)
    expect(state.leadTimes).toHaveLength(1)
    expect(state.leadTimes[0].ms).toBeCloseTo(5, 10)
  })
})

describe('feat-019 Příklad 3: zrychlení 5×', () => {
  it('úkol s prací 10 s je hotový po 2 s simulačního času', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE'], 5), 10)
    run(state, 0.5, 3) // 1.5 s → odvedeno 7.5 s práce
    expect(task.status).toBe('doing')
    expect(task.progress).toBeCloseTo(7.5, 10)
    run(state, 0.5, 1) // 2 s → odvedeno 10 s práce
    expect(task.status).toBe('done')
  })

  it('progress se na konci ořízne na work, i když by ho poslední tick přestřelil', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE'], 5), 1)
    run(state, 0.5, 1) // 0.5 s × 5 = 2.5 s práce > 1 s
    expect(task.status).toBe('done')
    expect(task.progress).toBe(1)
  })
})

describe('feat-019 Příklad 4: změna za běhu', () => {
  it('přepnutí z 1× na 5× zachová rozpracovanost a zbývajících 6 s práce dokončí za 1,2 s', () => {
    const member = unit(1, ['FE'])
    const { state, task } = stateWithDoingTask(member, 10, 4)
    member.aiMultiplier = 5
    // Samotná změna nastavení nic neresetuje
    expect(task.progress).toBe(4)
    expect(task.status).toBe('doing')
    run(state, 1, 1) // 1 s × 5 → odvedeno 9 s
    expect(task.status).toBe('doing')
    expect(task.progress).toBeCloseTo(9, 10)
    run(state, 0.2, 1) // celkem 1,2 s × 5 = 6 s → hotovo
    expect(task.status).toBe('done')
  })

  it('přepnutí z 5× zpět na 1× („off“) zpomalí práci od dalšího ticku', () => {
    const member = unit(1, ['FE'], 5)
    const { state, task } = stateWithDoingTask(member, 10)
    run(state, 0.5, 1) // 0.5 s × 5 = 2.5 s práce
    expect(task.progress).toBeCloseTo(2.5, 10)
    member.aiMultiplier = 1
    run(state, 0.5, 1) // + 0.5 s práce
    expect(task.progress).toBeCloseTo(3, 10)
  })

  it('multiplikátor patří jednotce, která task zpracovává — dvě jednotky na jedné featuře postupují každá svou rychlostí', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    const fast = unit(1, ['FE'], 5)
    const slow = unit(2, ['BE'])
    fast.currentTask = { featureId: 1, taskId: 1 }
    slow.currentTask = { featureId: 1, taskId: 2 }
    const feTask: Task = { id: 1, role: 'FE', work: 10, progress: 0, status: 'doing', assignee: 1 }
    const beTask: Task = { id: 2, role: 'BE', work: 10, progress: 0, status: 'doing', assignee: 2 }
    state.team = [fast, slow]
    state.backlog = []
    state.backlogSnapshot = []
    state.inProgress = [feature(1, [feTask, beTask])]
    run(state, 1, 1)
    expect(feTask.progress).toBeCloseTo(5, 10)
    expect(beTask.progress).toBeCloseTo(1, 10)
  })
})

describe('feat-019 Příklad 8: jednotka s AI dřív dokončí a převezme další práci', () => {
  it('dva úkoly po 10 s: první hotový po 2 s, druhý jednotka převezme a oba jsou hotové po 4 s', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    const member = unit(1, ['FE'], 5)
    state.team = [member]
    state.inProgress = []
    state.backlog = [feature(1, [
      { id: 1, role: 'FE', work: 10, progress: 0, status: 'todo', assignee: null },
      { id: 2, role: 'FE', work: 10, progress: 0, status: 'todo', assignee: null },
    ], 'backlog')]
    state.backlogSnapshot = []
    const [first, second] = state.backlog[0].tasks
    // Každý task zabere 4 ticky po 0.5 s (4 × 0.5 × 5 = 10); druhý se převezme v ticku po dokončení prvního
    run(state, 0.5, 4) // 2 s
    expect([first.status, second.status].filter(s => s === 'done')).toHaveLength(1)
    expect(member.currentTask).toBeNull()
    run(state, 0.5, 4) // 4 s
    expect(first.status).toBe('done')
    expect(second.status).toBe('done')
    expect(state.done.map(f => f.id)).toEqual([1])
  })
})

describe('feat-019 Příklad 9: jednotka s AI čeká stejně jako ostatní a ostatní nezrychluje', () => {
  // Fáze: Design (level 1) → Frontend (level 2); úkol Frontend čeká na dokončení Designu
  const PHASED_ROLES = {
    DSGN: { label: 'Design',   color: 'oklch(72% 0.13 25)',  level: 1, required: false },
    FE:   { label: 'Frontend', color: 'oklch(70% 0.14 250)', level: 2, required: false },
  }

  it('Frontend s AI 5× čeká (roste idle čas), Design bez AI pracuje 1×; po Designu Frontend dokončí úkol za 2 s', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    const designer = unit(1, ['DSGN'])
    const frontend = unit(2, ['FE'], 5)
    designer.currentTask = { featureId: 1, taskId: 1 }
    const designTask: Task = { id: 1, role: 'DSGN', work: 10, progress: 0, status: 'doing', assignee: 1 }
    const feTask: Task = { id: 2, role: 'FE', work: 10, progress: 0, status: 'todo', assignee: null }
    state.team = [designer, frontend]
    state.backlog = []
    state.backlogSnapshot = []
    state.inProgress = [feature(1, [designTask, feTask])]
    const rng = mulberry32(1)
    const steps = (n: number) => { for (let i = 0; i < n; i++) tick(state, 0.5, SETTINGS, rng, PHASED_ROLES) }

    steps(19) // 9.5 s
    // Design pracuje 1× — AI jednotky Frontend ho nezrychluje
    expect(designTask.status).toBe('doing')
    expect(designTask.progress).toBeCloseTo(9.5, 10)
    // Frontend čeká na fázi Design stejně jako jednotka bez AI
    expect(feTask.status).toBe('todo')
    expect(frontend.currentTask).toBeNull()
    expect(frontend.idleSec).toBeCloseTo(9.5, 10)

    steps(1) // 10 s → Design hotový
    expect(designTask.status).toBe('done')
    expect(feTask.status).toBe('todo')

    steps(4) // 12 s → Frontend převzal úkol a dokončil ho 5× rychleji (10 s práce za 2 s)
    expect(feTask.status).toBe('done')
    expect(state.done.map(f => f.id)).toEqual([1])
  })
})

describe('feat-019 Příklad 6: Reset zachová nastavení AI', () => {
  it('resetFromSnapshot ponechá jednotkám jejich aiMultiplier', () => {
    const rng = mulberry32(1)
    const state = makeInitialState(rng, SETTINGS)
    state.team[0].aiMultiplier = 5
    state.team[1].aiMultiplier = 2
    for (let i = 0; i < 20; i++) tick(state, 0.5, SETTINGS, rng)
    resetFromSnapshot(state)
    expect(state.team[0].aiMultiplier).toBe(5)
    expect(state.team[1].aiMultiplier).toBe(2)
    // Ostatní jednotky zůstávají bez AI
    for (const m of state.team.slice(2)) expect(m.aiMultiplier ?? 1).toBe(1)
  })
})

describe('feat-019 Příklad 7: presety vytváří jednotky s AI 1×', () => {
  it.each(PRESETS.map(p => [p.id, p] as const))('preset %s', (_id, preset) => {
    const { team } = applyPreset(preset)
    expect(team.length).toBeGreaterThan(0)
    for (const m of team) expect(m.aiMultiplier ?? 1).toBe(1)
  })
})

describe('feat-019 rozhodnutí A: AI zrychluje i join tax (coordination overhead, feat-016)', () => {
  it('jednotka 5× připojená k featuře, na které už pracoval někdo jiný, zpracuje task včetně taxu 5× rychleji', () => {
    const settings: SimSettings = { ...SETTINGS, coordinationOverhead: true }
    const state = makeInitialState(mulberry32(1), settings)
    const member = unit(1, ['FE'], 5)
    state.team = [member]
    state.backlog = []
    state.backlogSnapshot = []
    // Featura už má v historii jinou jednotku (id 99) → přiřazení jednotky 1 je připojení s taxem 25 %.
    // Druhý task (QA) nemá v týmu nikoho, takže se featura nedokončí a případný čekající rozpor
    // (kostka coordinationRoll) nevrátí FE task zpět — test sleduje jen rychlost práce.
    const f = feature(1, [
      { id: 1, role: 'FE', work: 10, progress: 0, status: 'todo', assignee: null },
      { id: 2, role: 'QA', work: 10, progress: 0, status: 'todo', assignee: null },
    ])
    f.workedBy = [99]
    state.inProgress = [f]
    const task = f.tasks[0]

    run(state, 0.5, 1, settings) // přiřazení + první krok
    // Tax se přičetl k práci: 10 → 12.5 s
    expect(task.work).toBeCloseTo(12.5, 10)
    expect(task.progress).toBeCloseTo(2.5, 10)
    run(state, 0.5, 3, settings) // 2 s → odvedeno 10 s z 12.5 s
    expect(task.status).toBe('doing')
    run(state, 0.5, 1, settings) // 2.5 s → odvedeno 12.5 s (bez AI by to trvalo 12.5 s)
    expect(task.status).toBe('done')
  })
})

describe('feat-019: sdílený helper setMemberAiMultiplier (Advanced i Cash Flow)', () => {
  it('nastaví jednotce multiplikátor a vrátí true', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    const id = state.team[0].id
    expect(setMemberAiMultiplier(state, id, 5)).toBe(true)
    expect(state.team[0].aiMultiplier).toBe(5)
    expect(setMemberAiMultiplier(state, id, 1)).toBe(true)
    expect(state.team[0].aiMultiplier ?? 1).toBe(1)
  })

  it('stejná hodnota není změna: vrátí false (volající pak nepřepne preset na „custom“)', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    const m = state.team[0]
    // Chybějící hodnota a 1 jsou totéž (bez AI)
    expect(setMemberAiMultiplier(state, m.id, 1)).toBe(false)
    m.aiMultiplier = 2
    expect(setMemberAiMultiplier(state, m.id, 2)).toBe(false)
    expect(m.aiMultiplier).toBe(2)
  })

  it('neexistující jednotka: vrátí false a tým nezmění', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    expect(setMemberAiMultiplier(state, 9999, 5)).toBe(false)
    for (const m of state.team) expect(m.aiMultiplier ?? 1).toBe(1)
  })
})
