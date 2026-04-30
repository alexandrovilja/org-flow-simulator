import { describe, it, expect } from 'vitest'
import { featureTotalWork, featureMaxWork } from '@/lib/featureSize'
import type { Feature, Task } from '@/types/simulation'

/** Pomocná továrna pro Task — nastaví jen hodnoty relevantní pro testy. */
function makeTask(id: number, work: number): Task {
  return { id, role: 'FE', work, progress: 0, status: 'todo', assignee: null }
}

/** Pomocná továrna pro Feature — nastaví jen tasks, zbytek jsou výchozí hodnoty. */
function makeFeature(id: number, tasks: Task[]): Feature {
  return {
    id, name: `F-${id}`, hue: 0, priority: id,
    tasks, createdAt: 0, startedAt: null, finishedAt: null, status: 'backlog',
  }
}

describe('feat-006: vizualizace velikosti features', () => {
  describe('featureTotalWork', () => {
    it('vrátí součet work všech tasků', () => {
      const tasks = [makeTask(1, 1.0), makeTask(2, 2.5), makeTask(3, 0.8)]
      expect(featureTotalWork(tasks)).toBeCloseTo(4.3, 5)
    })

    it('vrátí 0 pro prázdné pole tasků', () => {
      expect(featureTotalWork([])).toBe(0)
    })

    it('vrátí work jediného tasku', () => {
      expect(featureTotalWork([makeTask(1, 1.75)])).toBeCloseTo(1.75, 5)
    })
  })

  describe('featureMaxWork', () => {
    it('vrátí totalWork největší feature', () => {
      const features = [
        makeFeature(1, [makeTask(1, 1.0), makeTask(2, 2.0)]),  // total=3.0
        makeFeature(2, [makeTask(3, 5.0)]),                     // total=5.0
        makeFeature(3, [makeTask(4, 0.8), makeTask(5, 1.2)]),   // total=2.0
      ]
      expect(featureMaxWork(features)).toBeCloseTo(5.0, 5)
    })

    it('vrátí 0 pro prázdné pole features', () => {
      expect(featureMaxWork([])).toBe(0)
    })

    it('vrátí totalWork jediné feature', () => {
      const features = [makeFeature(1, [makeTask(1, 2.5), makeTask(2, 1.5)])]
      expect(featureMaxWork(features)).toBeCloseTo(4.0, 5)
    })

    it('vrátí správnou hodnotu pro features se stejnou totalWork', () => {
      const features = [
        makeFeature(1, [makeTask(1, 3.0)]),
        makeFeature(2, [makeTask(2, 3.0)]),
      ]
      expect(featureMaxWork(features)).toBeCloseTo(3.0, 5)
    })
  })

  describe('proporce segmentů', () => {
    it('segmenty stejně velkých tasků mají každý 50 % šířky', () => {
      const tasks = [makeTask(1, 2.0), makeTask(2, 2.0)]
      const total = featureTotalWork(tasks)
      const widths = tasks.map(t => t.work / total * 100)
      expect(widths[0]).toBeCloseTo(50, 5)
      expect(widths[1]).toBeCloseTo(50, 5)
    })

    it('součet šířek segmentů je vždy 100 %', () => {
      const tasks = [makeTask(1, 0.9), makeTask(2, 1.4), makeTask(3, 2.1)]
      const total = featureTotalWork(tasks)
      const sum = tasks.reduce((s, t) => s + t.work / total * 100, 0)
      expect(sum).toBeCloseTo(100, 5)
    })

    it('task s dvojnásobným work má dvojnásobnou šířku', () => {
      const tasks = [makeTask(1, 1.0), makeTask(2, 2.0)]
      const total = featureTotalWork(tasks)
      const w1 = tasks[0].work / total * 100
      const w2 = tasks[1].work / total * 100
      expect(w2).toBeCloseTo(w1 * 2, 5)
    })
  })

  describe('proporce celkové šířky baru', () => {
    it('největší feature má šířku 100 %', () => {
      const features = [
        makeFeature(1, [makeTask(1, 6.0)]),
        makeFeature(2, [makeTask(2, 3.0)]),
      ]
      const maxWork = featureMaxWork(features)
      const barWidth = featureTotalWork(features[0].tasks) / maxWork * 100
      expect(barWidth).toBeCloseTo(100, 5)
    })

    it('feature s poloviční totalWork má šířku 50 %', () => {
      const features = [
        makeFeature(1, [makeTask(1, 6.0)]),
        makeFeature(2, [makeTask(2, 3.0)]),
      ]
      const maxWork = featureMaxWork(features)
      const barWidth = featureTotalWork(features[1].tasks) / maxWork * 100
      expect(barWidth).toBeCloseTo(50, 5)
    })

    it('šířka baru nepřesáhne 100 %', () => {
      const features = [makeFeature(1, [makeTask(1, 5.0)])]
      const maxWork = featureMaxWork(features)
      const barWidth = Math.min(100, featureTotalWork(features[0].tasks) / maxWork * 100)
      expect(barWidth).toBeLessThanOrEqual(100)
    })
  })
})
