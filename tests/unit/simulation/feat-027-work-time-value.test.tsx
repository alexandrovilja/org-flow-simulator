import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import { WorkTimeValue } from '@/components/WorkTimeValue'
import { StatTile } from '@/components/StatTile'

// feat-027 (Čas simulace v pracovních dnech) — komponenta `WorkTimeValue` a automatické zkrácení na „w“ a „d“.
//
// Schválený kontrakt (spec features/feat-027-cas-simulace-pracovni-dny.md, UI / Design a Příklad 18):
//  - `WorkTimeValue` (nový soubor `src/components/WorkTimeValue.tsx`, pojmenovaný export) dostane prop `days`
//    (pracovní dny) a ukáže Total Time jako `37 weeks 2.9 days`. Čísla jsou samostatné prvky (velké), slova také
//    (malá); text je přesto jedním řetězcem včetně mezer. Kořenový prvek má `data-testid="work-time-value"`.
//  - Plná slova se píšou vždy; jen když se nevejdou do dlaždice, ukáže se `37w 2.9d` (týdny se vynechají jako dřív).
//    Přístupný název (`aria-label` kořenového prvku) zůstává plný text `37 weeks 2.9 days`.
//  - Měří se kořenový prvek: při vykreslení plných slov je `scrollWidth` šířka, kterou slova potřebují, a
//    `clientWidth` je místo, které prvek má. Rozhodnutí o zápisu dělá čistá funkce `chooseTimeNotation`.
//    Přepočítá se při změně velikosti (`ResizeObserver`) i hodnoty. Každá dlaždice se rozhoduje sama.
//  - Prostředí bez rozměrů (jsdom: šířky 0) ukáže vždy plná slova.
//  - `StatTile` přijímá `value` i jako `ReactNode` (dlaždice Total Time dostane `WorkTimeValue`).
// jsdom nepočítá rozměry, proto je test simuluje: šířka plných slov = 10 px na znak, místo prvku = atribut
// `data-avail` nejbližšího obalu (px).

/** Šířka jednoho znaku v nasimulovaném rozložení (px). */
const CHAR_PX = 10

/** Kolikrát komponenta přečetla `scrollWidth` kořenového prvku (každé čtení je vynucený výpočet rozložení). */
let scrollWidthReads = 0

/** Falešný `ResizeObserver`: zapamatuje si pozorovatele, test jim pošle změnu velikosti ručně. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  readonly disconnect = vi.fn()
  readonly observe = vi.fn()
  readonly unobserve = vi.fn()
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this)
  }

  /** Zavolá callback tak, jako když prohlížeč ohlásí změnu velikosti pozorovaného prvku. */
  fire(): void {
    this.callback([], this as unknown as ResizeObserver)
  }
}

/** Oznámí všem pozorovatelům změnu velikosti (uvnitř act, aby se React stihl překreslit). */
function fireResize(): void {
  act(() => { FakeResizeObserver.instances.forEach(o => o.fire()) })
}

/** Nasimuluje rozložení: místo kořenového prvku z `data-avail` obalu, šířka plného textu z jeho délky. */
function installFakeLayout(): void {
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    const holder = this.closest('[data-avail]')
    return holder ? Number(holder.getAttribute('data-avail')) : 0
  })
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
    if (this.getAttribute('data-testid') !== 'work-time-value') return 0
    scrollWidthReads++
    return (this.textContent ?? '').length * CHAR_PX
  })
}

/** Vykreslí `WorkTimeValue` v obalu o dané šířce (px) a vrátí kořenový prvek hodnoty i obal. */
function renderIn(days: number, avail: number) {
  const view = render(<div data-avail={avail} data-testid="holder"><WorkTimeValue days={days} /></div>)
  return { ...view, holder: screen.getByTestId('holder'), value: screen.getByTestId('work-time-value') }
}

beforeEach(() => {
  scrollWidthReads = 0
  FakeResizeObserver.instances = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('feat-027: WorkTimeValue bez rozměrů (jsdom)', () => {
  it('ukáže plná slova „37 weeks 2.9 days“ a stejný přístupný název', () => {
    render(<WorkTimeValue days={187.9} />)
    const value = screen.getByTestId('work-time-value')
    expect(value).toHaveTextContent(/^37 weeks 2\.9 days$/)
    expect(value).toHaveAttribute('aria-label', '37 weeks 2.9 days')
  })

  it('pod týden ukáže jen dny, nula je „0.0 days“, přesný týden „1 week 0.0 days“', () => {
    const { rerender } = render(<WorkTimeValue days={4.3} />)
    expect(screen.getByTestId('work-time-value')).toHaveTextContent(/^4\.3 days$/)
    rerender(<WorkTimeValue days={0} />)
    expect(screen.getByTestId('work-time-value')).toHaveTextContent(/^0\.0 days$/)
    rerender(<WorkTimeValue days={5} />)
    expect(screen.getByTestId('work-time-value')).toHaveTextContent(/^1 week 0\.0 days$/)
  })

  it('čísla a slova jsou samostatné prvky (čísla velká, slova malá), text zůstává jedním řetězcem', () => {
    render(<WorkTimeValue days={187.9} />)
    const value = screen.getByTestId('work-time-value')
    for (const part of ['37', 'weeks', '2.9', 'days']) {
      expect(within(value).getByText(part)).toBeInTheDocument()
    }
    expect(value.textContent).toBe('37 weeks 2.9 days')
  })

  it('bez týdnů se vykreslí jen číslo se slovem „days“', () => {
    render(<WorkTimeValue days={4.3} />)
    const value = screen.getByTestId('work-time-value')
    expect(within(value).getByText('4.3')).toBeInTheDocument()
    expect(within(value).getByText('days')).toBeInTheDocument()
    expect(within(value).queryByText(/week/)).toBeNull()
  })
})

describe('feat-027 Příklad 18: zkrácení na „w“ a „d“, když se plná slova nevejdou', () => {
  beforeEach(installFakeLayout)

  it('úzká dlaždice ukáže „37w 2.9d“, přístupný název zůstane plný text', () => {
    // „37 weeks 2.9 days“ = 17 znaků = 170 px, k dispozici 165 px
    const { value } = renderIn(187.9, 165)
    expect(value).toHaveTextContent(/^37w 2\.9d$/)
    expect(value).toHaveAttribute('aria-label', '37 weeks 2.9 days')
  })

  it('zkrácený zápis má stejně samostatná čísla a zkratky', () => {
    const { value } = renderIn(187.9, 165)
    for (const part of ['37', 'w', '2.9', 'd']) {
      expect(within(value).getByText(part)).toBeInTheDocument()
    }
    expect(value.textContent).toBe('37w 2.9d')
  })

  it('široká dlaždice ukáže plná slova', () => {
    const { value } = renderIn(187.9, 280)
    expect(value).toHaveTextContent(/^37 weeks 2\.9 days$/)
    expect(value).toHaveAttribute('aria-label', '37 weeks 2.9 days')
  })

  it('přesně vyhovující šířka (170 px pro 170 px) ještě ukáže plná slova', () => {
    const { value } = renderIn(187.9, 170)
    expect(value).toHaveTextContent(/^37 weeks 2\.9 days$/)
  })

  it('dvě dlaždice se rozhodují každá podle svého místa: úzká zkratku, široká plná slova', () => {
    render(
      <>
        <div data-avail={165}><WorkTimeValue days={187.9} /></div>
        <div data-avail={280}><WorkTimeValue days={187.9} /></div>
      </>,
    )
    const [narrow, wide] = screen.getAllByTestId('work-time-value')
    expect(narrow).toHaveTextContent(/^37w 2\.9d$/)
    expect(wide).toHaveTextContent(/^37 weeks 2\.9 days$/)
    expect(narrow).toHaveAttribute('aria-label', '37 weeks 2.9 days')
    expect(wide).toHaveAttribute('aria-label', '37 weeks 2.9 days')
  })

  it('bez týdnů se zkrácený zápis skládá jen ze dnů: „4.3d“', () => {
    // „4.3 days“ = 8 znaků = 80 px, k dispozici 60 px
    const { value } = renderIn(4.3, 60)
    expect(value).toHaveTextContent(/^4\.3d$/)
    expect(value).toHaveAttribute('aria-label', '4.3 days')
  })

  it('krátká hodnota, která se vejde, zůstane plnými slovy i v úzké dlaždici', () => {
    const { value } = renderIn(4.3, 100)
    expect(value).toHaveTextContent(/^4\.3 days$/)
  })

  it('zvětšení dlaždice vrátí plná slova; opětovné zmenšení zase zkratku', () => {
    const { holder, value } = renderIn(187.9, 165)
    expect(value).toHaveTextContent(/^37w 2\.9d$/)

    holder.setAttribute('data-avail', '280')
    fireResize()
    expect(screen.getByTestId('work-time-value')).toHaveTextContent(/^37 weeks 2\.9 days$/)

    holder.setAttribute('data-avail', '120')
    fireResize()
    expect(screen.getByTestId('work-time-value')).toHaveTextContent(/^37w 2\.9d$/)
  })

  it('zmenšení hodnoty (187.9 → 14.3) v úzké dlaždici vrátí plná slova, zvětšení zase zkratku', () => {
    // „2 weeks 4.3 days“ = 16 znaků = 160 px, vejde se do 165 px; „37 weeks 2.9 days“ (170 px) ne
    const { rerender } = render(<div data-avail={165}><WorkTimeValue days={187.9} /></div>)
    expect(screen.getByTestId('work-time-value')).toHaveTextContent(/^37w 2\.9d$/)

    rerender(<div data-avail={165}><WorkTimeValue days={14.3} /></div>)
    expect(screen.getByTestId('work-time-value')).toHaveTextContent(/^2 weeks 4\.3 days$/)

    rerender(<div data-avail={165}><WorkTimeValue days={187.9} /></div>)
    expect(screen.getByTestId('work-time-value')).toHaveTextContent(/^37w 2\.9d$/)
  })

  it('review: změna hodnoty beze změny délky textu (14.3 → 14.4) se znovu neměří, změna délky (4.3 → 14.3) ano', () => {
    // V neproporcionálním písmu (JetBrains Mono, tabulkové číslice) závisí šířka jen na počtu znaků,
    // takže při každém dalším desetinném místě za běhu (až 60× za sekundu) není co měřit.
    const { rerender } = render(<div data-avail={165}><WorkTimeValue days={14.3} /></div>)
    const afterMount = scrollWidthReads
    expect(afterMount).toBeGreaterThan(0)

    rerender(<div data-avail={165}><WorkTimeValue days={14.4} /></div>)
    expect(screen.getByTestId('work-time-value')).toHaveTextContent(/^2 weeks 4\.4 days$/)
    expect(scrollWidthReads).toBe(afterMount)

    rerender(<div data-avail={165}><WorkTimeValue days={4.3} /></div>)
    expect(scrollWidthReads).toBeGreaterThan(afterMount)
  })

  it('při odpojení se pozorování změny velikosti ukončí', () => {
    const { unmount } = renderIn(187.9, 165)
    expect(FakeResizeObserver.instances.length).toBeGreaterThan(0)
    unmount()
    expect(FakeResizeObserver.instances.every(o => o.disconnect.mock.calls.length > 0)).toBe(true)
  })
})

describe('feat-027: StatTile s hodnotou jako ReactNode', () => {
  it('dlaždice Total Time s WorkTimeValue ukáže čas v týdnech a dnech', () => {
    render(<StatTile label="Total Time" value={<WorkTimeValue days={14.3} />} variant="timer" wide />)
    const tile = screen.getByTestId('stat-tile-Total Time')
    expect(within(tile).getByTestId('work-time-value')).toHaveTextContent(/^2 weeks 4\.3 days$/)
  })

  it('řetězcová hodnota s jednotkou funguje dál (Avg Cycle Time: „9.1“ + „days“)', () => {
    render(<StatTile label="Avg Cycle Time" value="9.1" unit="days" />)
    const tile = screen.getByTestId('stat-tile-Avg Cycle Time')
    expect(within(tile).getByText('days')).toBeInTheDocument()
    expect(tile).toHaveTextContent('9.1')
  })
})
