import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { StatTile } from '@/components/StatTile'
import { CashFlowPanel } from '@/components/CashFlowPanel'
import type { RevenueComparison } from '@/lib/revenueComparison'
import { computeStats, makeInitialState, mulberry32 } from '@/simulation/engine'
import type { SimSettings, SimState } from '@/types/simulation'

// feat-018 (Time-matched revenue) — UI dlaždice „Revenue (time-matched)“.
//
// Schválený kontrakt (spec features/feat-018-time-matched-revenue.md):
//  - `StatTile` dostane nepovinnou prop `details?: ReactNode`. Když je zadaná, dlaždice obsahuje
//    tlačítko (přístupný název obsahuje „details“) s `aria-expanded`; obsah `details` se vykresluje
//    JEN v rozbaleném stavu. Tlačítko se ovládá myší i klávesnicí (Enter/Space) a je ve výchozím
//    stavu sbalené. Bez `details` se tlačítko nevykresluje.
//  - `CashFlowPanel` místo props `revenueDelta` a `revenueDeltaHint` přijímá `revenueComparison`
//    (tvar `RevenueComparison` z `@/lib/revenueComparison`). Dlaždice Total Revenue se přejmenuje na
//    „Revenue (time-matched)“ (data-testid `stat-tile-Revenue (time-matched)`).
//  - Velké číslo = `formatEuro(revenueComparison.value)`; delta badge a hint „@ mm:ss.s“ se zobrazí jen,
//    když je definovaná `comparison.delta`. Detail: „Total €X in mm:ss.s“ a, když existuje `comparison`,
//    „Previous run @ mm:ss.s: €Y“ a „Previous total €Z in mm:ss.s“.
//  - Dokud běh běží (state.simTime > 0 a není finished), dlaždice ukazuje hint „live total“, aby bylo
//    jasné, že číslo se po doběhnutí přepočítá na společný čas.
//  - Detail se sbalí, kdykoli se simTime vrátí zpět (Reset, i uprostřed běhu); samotný start běhu ho nesbalí.
//  - Delta badge ukazuje pod 10 % jedno desetinné místo (malé rozdíly se nesmí tvářit jako „0 %“);
//    změna zaokrouhlená na 0.0 % se zobrazí neutrálně jako „→ 0.0%“.

const TILE_ID = 'stat-tile-Revenue (time-matched)'

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 5,
  minSpecializations: 1,
}

/** Čerstvý stav (simTime 0, neběží). */
const freshState = (): SimState => makeInitialState(mulberry32(42), SETTINGS)

/** Běžící stav: simTime > 0, ještě nedoběhl. */
const runningState = (simTime: number): SimState => ({ ...freshState(), simTime })

/** Doběhnutý stav: CashFlowPanel čte jen simTime, finished, totalRevenueAllTime a done/doneOverflow. */
const finishedState = (simTime: number): SimState =>
  ({ ...freshState(), simTime, finished: true })

/** Příklad 2 z feat-018: aktuální běh je kratší (12 s), předchozí trval 24 s. */
const SHORTER: RevenueComparison = {
  value: 500,
  currentTotal: { revenue: 500, time: 12 },
  comparison: {
    compareTime: 12,
    delta: 150,
    previous: { revenueAtCompare: 200, totalRevenue: 1000, totalTime: 24 },
  },
}

/** Příklad 3 z feat-018: aktuální běh je delší (24 s), předchozí trval 12 s. */
const LONGER: RevenueComparison = {
  value: 200,
  currentTotal: { revenue: 1000, time: 24 },
  comparison: {
    compareTime: 12,
    delta: -60,
    previous: { revenueAtCompare: 500, totalRevenue: 500, totalTime: 12 },
  },
}

/** Příklad 1 z feat-018: živý běh bez předchozího běhu. */
const LIVE: RevenueComparison = {
  value: 3000,
  currentTotal: { revenue: 3000, time: 10 },
}

/** Příklad 4 z feat-018: předchozí běh nevydělal nic ve společném čase → bez delty. */
const PREVIOUS_ZERO: RevenueComparison = {
  value: 500,
  currentTotal: { revenue: 500, time: 12 },
  comparison: {
    compareTime: 12,
    previous: { revenueAtCompare: 0, totalRevenue: 100, totalTime: 24 },
  },
}

function renderPanel(state: SimState, revenueComparison: RevenueComparison, extra: Partial<ComponentProps<typeof CashFlowPanel>> = {}) {
  const props: ComponentProps<typeof CashFlowPanel> = {
    state,
    stats: computeStats(state.leadTimes),
    totalTimeDisplay: '00:12.0',
    avgWip: 2,
    revenueComparison,
    ...extra,
  }
  return render(<CashFlowPanel {...props} />)
}

describe('feat-018: StatTile — rozbalitelný detail', () => {
  it('bez prop details se tlačítko rozbalení nevykresluje', () => {
    render(<StatTile label="Plain" value="1" />)
    const tile = screen.getByTestId('stat-tile-Plain')
    expect(within(tile).queryByRole('button')).not.toBeInTheDocument()
  })

  it('s prop details je tlačítko ve výchozím stavu sbalené a obsah se nevykresluje', () => {
    render(<StatTile label="Rich" value="1" details={<span>Detail body</span>} />)
    const tile = screen.getByTestId('stat-tile-Rich')
    const button = within(tile).getByRole('button', { name: /details/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Detail body')).not.toBeInTheDocument()
  })

  it('kliknutí obsah rozbalí a druhé kliknutí ho sbalí', async () => {
    const user = userEvent.setup()
    render(<StatTile label="Rich" value="1" details={<span>Detail body</span>} />)
    const button = within(screen.getByTestId('stat-tile-Rich')).getByRole('button', { name: /details/i })

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Detail body')).toBeInTheDocument()

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Detail body')).not.toBeInTheDocument()
  })

  it('tlačítko jde ovládat klávesnicí (Enter i Space)', async () => {
    const user = userEvent.setup()
    render(<StatTile label="Rich" value="1" details={<span>Detail body</span>} />)
    const button = within(screen.getByTestId('stat-tile-Rich')).getByRole('button', { name: /details/i })

    button.focus()
    await user.keyboard('{Enter}')
    expect(button).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard(' ')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it.each([
    [0.4, '↑ 0.4%'],
    [4.5, '↑ 4.5%'],
    [0, '→ 0.0%'],
    [0.04, '→ 0.0%'],
    [-0.04, '→ 0.0%'],
    [-0.4, '↓ 0.4%'],
    [9.96, '↑ 10%'],
    [31.6, '↑ 32%'],
    [-60, '↓ 60%'],
  ])('delta %s se zobrazí jako „%s“ (pod 10 %% jedno desetinné místo)', (delta, text) => {
    render(<StatTile label="Delta" value="1" delta={delta} higherIsBetter />)
    expect(screen.getByTestId('stat-tile-Delta')).toHaveTextContent(text)
  })

  it('hodnota, delta badge a hint zůstávají vidět i s detailem', () => {
    render(<StatTile label="Rich" value="€500" delta={150} higherIsBetter hint="@ 00:12.0" details={<span>Detail body</span>} />)
    const tile = screen.getByTestId('stat-tile-Rich')
    expect(tile).toHaveTextContent('€500')
    expect(tile).toHaveTextContent('↑ 150%')
    expect(tile).toHaveTextContent('@ 00:12.0')
  })
})

describe('feat-018: CashFlowPanel — dlaždice „Revenue (time-matched)“', () => {
  it('dlaždice je přejmenovaná a Total Revenue už neexistuje', () => {
    renderPanel(finishedState(12), SHORTER)
    expect(screen.getByTestId(TILE_ID)).toHaveTextContent('Revenue (time-matched)')
    expect(screen.queryByTestId('stat-tile-Total Revenue')).not.toBeInTheDocument()
  })

  it('ostatní metriky zůstávají (Total Time, Avg Cycle Time, Avg WIP)', () => {
    renderPanel(finishedState(12), SHORTER)
    expect(screen.getByTestId('stat-tile-Total Time')).toBeInTheDocument()
    expect(screen.getByTestId('stat-tile-Avg Cycle Time')).toBeInTheDocument()
    expect(screen.getByTestId('stat-tile-Avg WIP')).toBeInTheDocument()
  })

  describe('Příklad 1: živý běh bez předchozího běhu', () => {
    it('ukáže kumulativní výnos, bez delty a bez hintu', () => {
      renderPanel(freshState(), LIVE)
      const tile = screen.getByTestId(TILE_ID)
      expect(tile).toHaveTextContent('€3k')
      expect(tile).not.toHaveTextContent('vs prev run')
      expect(tile).not.toHaveTextContent('@')
    })

    it('po rozkliknutí ukáže „Total €3k in 00:10.0“ a nic o předchozím běhu', async () => {
      const user = userEvent.setup()
      renderPanel(freshState(), LIVE)
      const tile = screen.getByTestId(TILE_ID)
      await user.click(within(tile).getByRole('button', { name: /details/i }))
      expect(tile).toHaveTextContent('Total €3k in 00:10.0')
      expect(tile).not.toHaveTextContent('Previous')
    })
  })

  describe('hint „live total“ za běhu', () => {
    it('běžící běh ukazuje hint „live total“', () => {
      renderPanel(runningState(10), LIVE)
      expect(screen.getByTestId(TILE_ID)).toHaveTextContent('live total')
    })

    it('čerstvý běh (simTime 0) hint nemá', () => {
      renderPanel(freshState(), LIVE)
      expect(screen.getByTestId(TILE_ID)).not.toHaveTextContent('live total')
    })

    it('doběhnutý běh bez předchozího běhu hint nemá', () => {
      renderPanel(finishedState(10), LIVE)
      expect(screen.getByTestId(TILE_ID)).not.toHaveTextContent('live total')
    })

    it('po doběhnutí se srovnáním hint „live total“ nahradí hint „@ čas“', () => {
      renderPanel(finishedState(12), SHORTER)
      const tile = screen.getByTestId(TILE_ID)
      expect(tile).not.toHaveTextContent('live total')
      expect(tile).toHaveTextContent('@ 00:12.0')
    })
  })

  describe('Příklad 2: aktuální běh je kratší než předchozí', () => {
    it('ukáže výnos ve společném čase, deltu +150 % a hint „@ 00:12.0“', () => {
      renderPanel(finishedState(12), SHORTER)
      const tile = screen.getByTestId(TILE_ID)
      expect(tile).toHaveTextContent('€500')
      expect(tile).toHaveTextContent('↑ 150%')
      expect(tile).toHaveTextContent('vs prev run')
      expect(tile).toHaveTextContent('@ 00:12.0')
    })

    it('detail je ve výchozím stavu sbalený', () => {
      renderPanel(finishedState(12), SHORTER)
      const tile = screen.getByTestId(TILE_ID)
      expect(within(tile).getByRole('button', { name: /details/i })).toHaveAttribute('aria-expanded', 'false')
      expect(tile).not.toHaveTextContent('Total €500 in')
      expect(tile).not.toHaveTextContent('Previous run')
    })

    it('po rozkliknutí ukáže celkový výnos a předchozí běh', async () => {
      const user = userEvent.setup()
      renderPanel(finishedState(12), SHORTER)
      const tile = screen.getByTestId(TILE_ID)
      await user.click(within(tile).getByRole('button', { name: /details/i }))
      expect(tile).toHaveTextContent('Total €500 in 00:12.0')
      expect(tile).toHaveTextContent('Previous run @ 00:12.0: €200')
      expect(tile).toHaveTextContent('Previous total €1k in 00:24.0')
    })
  })

  describe('Příklad 3: aktuální běh je delší než předchozí', () => {
    it('velké číslo je výnos ve společném čase (€200), ne celkový výnos běhu (€1k)', () => {
      renderPanel(finishedState(24), LONGER)
      const tile = screen.getByTestId(TILE_ID)
      expect(tile).toHaveTextContent('€200')
      expect(tile).not.toHaveTextContent('€1k')
    })

    it('ukáže deltu −60 % (šipka dolů) a hint „@ 00:12.0“', () => {
      renderPanel(finishedState(24), LONGER)
      const tile = screen.getByTestId(TILE_ID)
      expect(tile).toHaveTextContent('↓ 60%')
      expect(tile).toHaveTextContent('@ 00:12.0')
    })

    it('po rozkliknutí ukáže skutečný celkový výnos za celý čas běhu', async () => {
      const user = userEvent.setup()
      renderPanel(finishedState(24), LONGER)
      const tile = screen.getByTestId(TILE_ID)
      await user.click(within(tile).getByRole('button', { name: /details/i }))
      expect(tile).toHaveTextContent('Total €1k in 00:24.0')
      expect(tile).toHaveTextContent('Previous run @ 00:12.0: €500')
      expect(tile).toHaveTextContent('Previous total €500 in 00:12.0')
    })
  })

  describe('Příklad 4: předchozí běh nevydělal nic ve společném čase', () => {
    it('ukáže výnos, ale bez delta badge a bez hintu', () => {
      renderPanel(finishedState(12), PREVIOUS_ZERO)
      const tile = screen.getByTestId(TILE_ID)
      expect(tile).toHaveTextContent('€500')
      expect(tile).not.toHaveTextContent('vs prev run')
      expect(tile).not.toHaveTextContent('@ 00:12.0')
    })
  })

  describe('Příklad 5: Reset sbalí detail', () => {
    it('po návratu na nový běh (simTime 0) je detail opět sbalený', async () => {
      const user = userEvent.setup()
      const { rerender } = renderPanel(finishedState(12), SHORTER)
      const tile = screen.getByTestId(TILE_ID)
      const button = within(tile).getByRole('button', { name: /details/i })
      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')

      // Reset: nový stav od nuly, živý výnos bez porovnání (delta zmizí do doběhnutí)
      const fresh = freshState()
      rerender(
        <CashFlowPanel
          state={fresh}
          stats={computeStats(fresh.leadTimes)}
          totalTimeDisplay="00:00.0"
          avgWip={null}
          revenueComparison={{ value: 0, currentTotal: { revenue: 0, time: 0 } }}
        />,
      )

      const tileAfter = screen.getByTestId(TILE_ID)
      expect(within(tileAfter).getByRole('button', { name: /details/i })).toHaveAttribute('aria-expanded', 'false')
      expect(tileAfter).not.toHaveTextContent('vs prev run')
    })

    it('Reset uprostřed běhu detail také sbalí', async () => {
      const user = userEvent.setup()
      const { rerender } = renderPanel(runningState(10), LIVE)
      const button = within(screen.getByTestId(TILE_ID)).getByRole('button', { name: /details/i })
      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')

      const fresh = freshState()
      rerender(
        <CashFlowPanel
          state={fresh}
          stats={computeStats(fresh.leadTimes)}
          totalTimeDisplay="00:00.0"
          avgWip={null}
          revenueComparison={{ value: 0, currentTotal: { revenue: 0, time: 0 } }}
        />,
      )
      expect(within(screen.getByTestId(TILE_ID)).getByRole('button', { name: /details/i })).toHaveAttribute('aria-expanded', 'false')
    })

    it('samotný start běhu (simTime 0 → >0) rozbalený detail nesbalí', async () => {
      const user = userEvent.setup()
      const { rerender } = renderPanel(freshState(), LIVE)
      const button = within(screen.getByTestId(TILE_ID)).getByRole('button', { name: /details/i })
      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')

      const running = runningState(0.1)
      rerender(
        <CashFlowPanel
          state={running}
          stats={computeStats(running.leadTimes)}
          totalTimeDisplay="00:00.1"
          avgWip={null}
          revenueComparison={{ value: 0, currentTotal: { revenue: 0, time: 0.1 } }}
        />,
      )
      expect(within(screen.getByTestId(TILE_ID)).getByRole('button', { name: /details/i })).toHaveAttribute('aria-expanded', 'true')
    })
  })
})
