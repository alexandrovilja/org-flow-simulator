import { describe, it, expect } from 'vitest'
import {
  applyPreset, makeInitialState, mulberry32, PRESETS, resetFromSnapshot, ROLE_META, setMemberAiMultiplier, tick,
} from '@/simulation/engine'
import { deleteRole } from '@/simulation/roleManagement'
import type { AiMultiplier, Feature, Member, SimSettings, SimState, Task } from '@/types/simulation'

// feat-019 (AI multiplikátor výkonu, revize 2026-11-03: AI po skillech) — chování enginu.
//
// Schválený kontrakt (spec features/feat-019-ai-multiplikator-vykonu.md):
//  - `Member.aiMultiplier` zaniká, nahrazuje ho volitelné `Member.aiBySkill?: Partial<Record<Role, AiMultiplier>>`,
//    kde `AiMultiplier = 1 | 2 | 5`. Chybějící klíč znamená 1× (bez AI). Ukládají se jen hodnoty 2× a 5×:
//    nastavení na 1× klíč smaže a prázdný objekt se změní na `undefined`.
//  - V `tick()` postupuje rozpracovaný task o `dtSim × aiBySkill[task.role]` jednotky, která ho zpracovává
//    (assignee). Rozhoduje tedy skill úkolu, ne jednotka jako celek. Multiplikátor se čte v každém ticku,
//    takže změna za běhu platí okamžitě a rozpracovanost se neztrácí.
//  - Nastavení patří dvojici jednotka + skill: dvě jednotky se stejným skillem mají AI každá zvlášť.
//  - Multiplikátor zrychluje celou práci tasku včetně join taxu z coordination overhead (varianta A).
//  - Reset (`resetFromSnapshot`) nastavení AI zachová; presety (`applyPreset`) vytváří jednotky bez AI.
//  - Sdílený helper `setMemberAiMultiplier(state, memberId, role, value)` (používá ho Advanced i Cash Flow)
//    zapíše hodnotu a vrátí true jen při skutečné změně. Vrací false i tehdy, když jednotka ten skill nemá.
//    Zápis vytváří vždy nový objekt `aiBySkill` (členové se v „Generate new backlog“ kopírují mělce).
//  - Odebrání skillu (smazání ze seznamu skillů přes `deleteRole`, křížek na chipu řeší Simulator) nastavení
//    AI toho skillu zapomene; po opětovném přidání skillu je 1× (Příklad 9).
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
 * Vytvoří jednotku týmu. `ai` vynecháno = jednotka bez pole `aiBySkill` (výchozí stav).
 *
 * @param id    - ID jednotky
 * @param roles - Skilly jednotky
 * @param ai    - AI multiplikátory po skillech; undefined = pole se nevytvoří
 * @returns Nová jednotka bez přiřazeného úkolu
 */
function unit(id: number, roles: string[], ai?: Partial<Record<string, AiMultiplier>>): Member {
  const m: Member = { id, name: `U${id}`, roles, currentTask: null, idleSec: 0 }
  if (ai !== undefined) m.aiBySkill = { ...ai }
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
 * Sestaví stav, ve kterém jednotka `member` už zpracovává jediný task skillu `role` s prací `work`
 * (status 'doing', odvedeno `progress`). Backlog je prázdný, takže nic dalšího se nepřiřadí.
 *
 * @param member   - Jednotka, která task zpracovává
 * @param work     - Celková práce tasku v sekundách
 * @param progress - Už odvedená práce
 * @param role     - Skill úkolu; výchozí je první skill jednotky
 * @returns Stav simulace a odkaz na task
 */
function stateWithDoingTask(
  member: Member, work: number, progress = 0, role: string = member.roles[0],
): { state: SimState; task: Task } {
  const state = makeInitialState(mulberry32(1), SETTINGS)
  const task: Task = { id: 1, role, work, progress, status: 'doing', assignee: member.id }
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
  it('jednotka bez aiBySkill pracuje 1×: úkol s prací 10 s je hotový přesně po 10 s', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE']), 10)
    run(state, 0.5, 19) // 9.5 s
    expect(task.status).toBe('doing')
    expect(task.progress).toBeCloseTo(9.5, 10)
    run(state, 0.5, 1) // 10 s
    expect(task.status).toBe('done')
  })

  it('hodnota 1 u skillu se chová stejně jako chybějící klíč', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE'], { FE: 1 }), 10)
    run(state, 0.5, 19)
    expect(task.status).toBe('doing')
    run(state, 0.5, 1)
    expect(task.status).toBe('done')
  })

  it('jednotka se dvěma skilly bez AI zpracuje úkol druhého skillu také za 10 s', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE', 'QA']), 10, 0, 'QA')
    run(state, 0.5, 19)
    expect(task.status).toBe('doing')
    run(state, 0.5, 1)
    expect(task.status).toBe('done')
  })

  it('výchozí tým z makeInitialState nemá AI zapnuté u žádného skillu', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    for (const m of state.team) expect(m.aiBySkill ?? {}).toEqual({})
  })
})

describe('feat-019 Příklad 2: zrychlení 2× u skillu', () => {
  it('úkol s prací 10 s je hotový po 5 s simulačního času', () => {
    const member = unit(1, ['FE'], { FE: 2 })
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
    const { state } = stateWithDoingTask(unit(1, ['FE'], { FE: 2 }), 10)
    run(state, 0.5, 10)
    expect(state.leadTimes).toHaveLength(1)
    expect(state.leadTimes[0].ms).toBeCloseTo(5, 10)
  })
})

describe('feat-019 Příklad 3: zrychlení 5× u skillu', () => {
  it('úkol s prací 10 s je hotový po 2 s simulačního času', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE'], { FE: 5 }), 10)
    run(state, 0.5, 3) // 1.5 s → odvedeno 7.5 s práce
    expect(task.status).toBe('doing')
    expect(task.progress).toBeCloseTo(7.5, 10)
    run(state, 0.5, 1) // 2 s → odvedeno 10 s práce
    expect(task.status).toBe('done')
  })

  it('progress se na konci ořízne na work, i když by ho poslední tick přestřelil', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE'], { FE: 5 }), 1)
    run(state, 0.5, 1) // 0.5 s × 5 = 2.5 s práce > 1 s
    expect(task.status).toBe('done')
    expect(task.progress).toBe(1)
  })
})

describe('feat-019 Příklad 4: AI jen u jednoho skillu jednotky', () => {
  it('Development 5× a Code Review 1×: první úkol je hotový po 2 s, druhý po dalších 10 s (celkem 12 s)', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    // Skill FE hraje roli Development, QA roli Code Review
    const anna = unit(1, ['FE', 'QA'], { FE: 5 })
    state.team = [anna]
    state.inProgress = []
    state.backlogSnapshot = []
    state.backlog = [
      feature(1, [{ id: 1, role: 'FE', work: 10, progress: 0, status: 'todo', assignee: null }], 'backlog'),
      feature(2, [{ id: 2, role: 'QA', work: 10, progress: 0, status: 'todo', assignee: null }], 'backlog'),
    ]
    const dev = state.backlog[0].tasks[0]
    const review = state.backlog[1].tasks[0]

    run(state, 0.5, 4) // 2 s: Development 4 × 0.5 × 5 = 10 s práce
    expect(dev.status).toBe('done')
    expect(anna.currentTask).toBeNull()

    // Code Review jednotka převezme v dalším ticku a zpracuje ho 1× (20 ticků po 0.5 s)
    run(state, 0.5, 19) // 11.5 s celkem → odvedeno 9.5 s práce
    expect(review.status).toBe('doing')
    expect(review.progress).toBeCloseTo(9.5, 10)
    run(state, 0.5, 1) // 12 s celkem
    expect(review.status).toBe('done')
  })

  it('rychlost určuje skill úkolu, ne první skill jednotky: úkol Code Review jede 1×, i když je u Development 5×', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE', 'QA'], { FE: 5 }), 10, 0, 'QA')
    run(state, 1, 1)
    expect(task.progress).toBeCloseTo(1, 10)
  })

  it('úkol Development téže jednotky jede 5×', () => {
    const { state, task } = stateWithDoingTask(unit(1, ['FE', 'QA'], { FE: 5 }), 10, 0, 'FE')
    run(state, 1, 1)
    expect(task.progress).toBeCloseTo(5, 10)
  })
})

describe('feat-019 Příklad 5: AI patří dvojici jednotka + skill', () => {
  it('Anna i Petr mají skill Development, AI 5× jen u Anny: Anna je hotová po 2 s, Petr po 10 s', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    const anna = unit(1, ['FE'], { FE: 5 })
    const petr = unit(2, ['FE'])
    anna.currentTask = { featureId: 1, taskId: 1 }
    petr.currentTask = { featureId: 1, taskId: 2 }
    const annaTask: Task = { id: 1, role: 'FE', work: 10, progress: 0, status: 'doing', assignee: 1 }
    const petrTask: Task = { id: 2, role: 'FE', work: 10, progress: 0, status: 'doing', assignee: 2 }
    state.team = [anna, petr]
    state.backlog = []
    state.backlogSnapshot = []
    state.inProgress = [feature(1, [annaTask, petrTask])]

    run(state, 0.5, 4) // 2 s
    expect(annaTask.status).toBe('done')
    expect(petrTask.status).toBe('doing')
    expect(petrTask.progress).toBeCloseTo(2, 10)
    run(state, 0.5, 16) // 10 s
    expect(petrTask.status).toBe('done')
  })

  it('nastavení AI u skillu jedné jednotky nezmění nastavení jiné jednotky se stejným skillem', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    state.team = [unit(1, ['FE']), unit(2, ['FE'])]
    expect(setMemberAiMultiplier(state, 1, 'FE', 5)).toBe(true)
    expect(state.team[0].aiBySkill).toEqual({ FE: 5 })
    expect(state.team[1].aiBySkill).toBeUndefined()
  })
})

describe('feat-019 Příklad 6: změna za běhu u skillu, na kterém jednotka pracuje', () => {
  it('přepnutí z 1× na 5× zachová rozpracovanost a zbývajících 6 s práce dokončí za 1,2 s', () => {
    const member = unit(1, ['FE'])
    const { state, task } = stateWithDoingTask(member, 10, 4)
    expect(setMemberAiMultiplier(state, member.id, 'FE', 5)).toBe(true)
    // Samotná změna nastavení nic neresetuje
    expect(task.progress).toBe(4)
    expect(task.status).toBe('doing')
    run(state, 1, 1) // 1 s × 5 → odvedeno 9 s
    expect(task.status).toBe('doing')
    expect(task.progress).toBeCloseTo(9, 10)
    run(state, 0.2, 1) // celkem 1,2 s × 5 = 6 s → hotovo
    expect(task.status).toBe('done')
  })

  it('přepnutí z 5× zpět na 1× zpomalí práci od dalšího ticku', () => {
    const member = unit(1, ['FE'], { FE: 5 })
    const { state, task } = stateWithDoingTask(member, 10)
    run(state, 0.5, 1) // 0.5 s × 5 = 2.5 s práce
    expect(task.progress).toBeCloseTo(2.5, 10)
    expect(setMemberAiMultiplier(state, member.id, 'FE', 1)).toBe(true)
    run(state, 0.5, 1) // + 0.5 s práce
    expect(task.progress).toBeCloseTo(3, 10)
  })

  it('multiplikátor patří jednotce, která task zpracovává — dvě jednotky na jedné featuře postupují každá svou rychlostí', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    const fast = unit(1, ['FE'], { FE: 5 })
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

describe('feat-019 Příklad 7: změna AI u jiného skillu rozpracovaný úkol neovlivní', () => {
  it('jednotka pracuje na Development (odvedeno 4 s z 10 s); AI 5× u Code Review: Development jede dál 1×', () => {
    const member = unit(1, ['FE', 'QA'])
    const { state, task } = stateWithDoingTask(member, 10, 4, 'FE')
    expect(setMemberAiMultiplier(state, member.id, 'QA', 5)).toBe(true)
    run(state, 1, 1)
    expect(task.progress).toBeCloseTo(5, 10)
    run(state, 1, 5) // zbývajících 6 s práce je hotových za 6 s
    expect(task.status).toBe('done')
  })
})

describe('feat-019 Příklad 9: odebrání skillu zapomene AI', () => {
  it('deleteRole smaže nastavení AI smazaného skillu u všech jednotek a ostatní skilly ponechá', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    state.team = [unit(1, ['FE', 'QA'], { FE: 5, QA: 2 }), unit(2, ['FE'], { FE: 2 })]
    state.backlog = []
    state.inProgress = []
    deleteRole(state, ROLE_META, 'FE')
    expect(state.team[0].aiBySkill).toEqual({ QA: 2 })
    // Poslední klíč pryč → pole zmizí úplně (normalizace)
    expect(state.team[1].aiBySkill).toBeUndefined()
  })

  it('po opětovném přidání smazaného skillu je AI 1×', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    state.team = [unit(1, ['FE', 'QA'], { FE: 5 })]
    state.backlog = []
    state.inProgress = []
    deleteRole(state, ROLE_META, 'FE')
    state.team[0].roles.push('FE')
    expect(state.team[0].aiBySkill?.FE).toBeUndefined()
    // Nic se nezměnilo, takže nastavení na 1× není změna
    expect(setMemberAiMultiplier(state, 1, 'FE', 1)).toBe(false)
  })
})

describe('feat-019 Příklad 10: Reset zachová nastavení AI', () => {
  it('resetFromSnapshot ponechá jednotkám jejich aiBySkill', () => {
    const rng = mulberry32(1)
    const state = makeInitialState(rng, SETTINGS)
    const [first, second] = state.team
    expect(first.roles.length).toBeGreaterThan(0)
    expect(second.roles.length).toBeGreaterThan(0)
    setMemberAiMultiplier(state, first.id, first.roles[0], 5)
    setMemberAiMultiplier(state, second.id, second.roles[0], 2)
    for (let i = 0; i < 20; i++) tick(state, 0.5, SETTINGS, rng)
    resetFromSnapshot(state)
    expect(state.team[0].aiBySkill).toEqual({ [first.roles[0]]: 5 })
    expect(state.team[1].aiBySkill).toEqual({ [second.roles[0]]: 2 })
    // Ostatní jednotky zůstávají bez AI
    for (const m of state.team.slice(2)) expect(m.aiBySkill ?? {}).toEqual({})
  })
})

describe('feat-019 Příklad 11: presety vytvářejí jednotky bez AI', () => {
  it.each(PRESETS.map(p => [p.id, p] as const))('preset %s', (_id, preset) => {
    const { team } = applyPreset(preset)
    expect(team.length).toBeGreaterThan(0)
    for (const m of team) expect(m.aiBySkill ?? {}).toEqual({})
  })
})

describe('feat-019 Příklad 12: skill s AI dřív dokončí a jednotka převezme další práci', () => {
  it('dva úkoly Development po 10 s: první hotový po 2 s, druhý jednotka převezme a oba jsou hotové po 4 s', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    const member = unit(1, ['FE'], { FE: 5 })
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

describe('feat-019 Příklad 13: jednotka s AI čeká stejně jako ostatní a ostatní nezrychluje', () => {
  // Fáze: Design (level 1) → Frontend (level 2); úkol Frontend čeká na dokončení Designu
  const PHASED_ROLES = {
    DSGN: { label: 'Design',   color: 'oklch(72% 0.13 25)',  level: 1, required: false },
    FE:   { label: 'Frontend', color: 'oklch(70% 0.14 250)', level: 2, required: false },
  }

  it('Frontend s AI 5× čeká (roste idle čas), Design bez AI pracuje 1×; po Designu Frontend dokončí úkol za 2 s', () => {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    const designer = unit(1, ['DSGN'])
    const frontend = unit(2, ['FE'], { FE: 5 })
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

describe('feat-019 rozhodnutí A: AI zrychluje i join tax (coordination overhead, feat-016)', () => {
  it('jednotka s AI 5× u skillu připojená k featuře, na které už pracoval někdo jiný, zpracuje task včetně taxu 5× rychleji', () => {
    const settings: SimSettings = { ...SETTINGS, coordinationOverhead: true }
    const state = makeInitialState(mulberry32(1), settings)
    const member = unit(1, ['FE'], { FE: 5 })
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
  /**
   * Stav s jednou jednotkou se skilly FE a QA bez AI.
   *
   * @returns Stav a ID jednotky
   */
  function stateWithOneUnit(): { state: SimState; id: number } {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    state.team = [unit(1, ['FE', 'QA'])]
    return { state, id: 1 }
  }

  it('nastaví skillu multiplikátor a vrátí true; nastavení na 1× klíč smaže a prázdné pole zmizí', () => {
    const { state, id } = stateWithOneUnit()
    expect(setMemberAiMultiplier(state, id, 'FE', 5)).toBe(true)
    expect(state.team[0].aiBySkill).toEqual({ FE: 5 })
    expect(setMemberAiMultiplier(state, id, 'FE', 1)).toBe(true)
    expect(state.team[0].aiBySkill).toBeUndefined()
  })

  it('nastavení jednoho skillu nezmění ostatní skilly jednotky', () => {
    const { state, id } = stateWithOneUnit()
    setMemberAiMultiplier(state, id, 'FE', 5)
    setMemberAiMultiplier(state, id, 'QA', 2)
    expect(state.team[0].aiBySkill).toEqual({ FE: 5, QA: 2 })
    setMemberAiMultiplier(state, id, 'FE', 1)
    expect(state.team[0].aiBySkill).toEqual({ QA: 2 })
  })

  it('stejná hodnota není změna: vrátí false (volající pak nepřepne preset na „custom“)', () => {
    const { state, id } = stateWithOneUnit()
    // Chybějící klíč a 1 jsou totéž (bez AI)
    expect(setMemberAiMultiplier(state, id, 'FE', 1)).toBe(false)
    expect(state.team[0].aiBySkill).toBeUndefined()
    setMemberAiMultiplier(state, id, 'FE', 2)
    expect(setMemberAiMultiplier(state, id, 'FE', 2)).toBe(false)
    expect(state.team[0].aiBySkill).toEqual({ FE: 2 })
  })

  it('jednotka skill nemá: vrátí false a nic nezapíše', () => {
    const { state, id } = stateWithOneUnit()
    expect(setMemberAiMultiplier(state, id, 'DATA', 5)).toBe(false)
    expect(state.team[0].aiBySkill).toBeUndefined()
  })

  it('neexistující jednotka: vrátí false a tým nezmění', () => {
    const { state } = stateWithOneUnit()
    expect(setMemberAiMultiplier(state, 9999, 'FE', 5)).toBe(false)
    expect(state.team[0].aiBySkill).toBeUndefined()
  })

  it('zápis vytváří nový objekt aiBySkill: mělká kopie jednotky ({ ...m }) zůstane beze změny', () => {
    const { state, id } = stateWithOneUnit()
    setMemberAiMultiplier(state, id, 'FE', 2)
    // „Generate new backlog“ kopíruje členy přes { ...m } — vnořený objekt se tím nezkopíruje
    const copy: Member = { ...state.team[0] }
    setMemberAiMultiplier(state, id, 'FE', 5)
    expect(copy.aiBySkill).toEqual({ FE: 2 })
    expect(state.team[0].aiBySkill).toEqual({ FE: 5 })
  })
})
