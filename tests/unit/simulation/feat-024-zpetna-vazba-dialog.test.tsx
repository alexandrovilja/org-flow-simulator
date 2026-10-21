import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { ConfirmOverlay } from '@/components/ConfirmOverlay'
import { FeedbackDialog } from '@/components/FeedbackDialog'
import { EMPTY_FEEDBACK_DRAFT, WEB3FORMS_ENDPOINT, formatFeedbackDate } from '@/lib/feedback'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'

// feat-024 Zpětná vazba od uživatelů — ikona v liště a dialog „Send feedback“ v celé aplikaci.
//
// Schválený kontrakt: features/feat-024-zpetna-vazba-uzivatelu.md, Příklady 1–13.
//  - Příklad 1: ikona „Send feedback“ v liště ve všech módech, vlevo od přepínače tématu.
//  - Příklad 2: otevření dialogu, jeho obsah a fokus na prvním prvku.
//  - Příklad 3: otevření dialogu zastaví běžící simulaci (tlačítko ukáže „▶ Run“, čas stojí i po
//    zavření, dokud uživatel neklikne na Run); nespuštěná ani dokončená simulace se nemění.
//  - Příklady 4–5: škála 1–5 s názvy bodů; role i hodnocení jdou změnit a zrušit.
//  - Příklady 6–8: kontroly před odesláním (nic se neodešle).
//  - Příklady 9–11: odeslání („Sending…“, poděkování, obsah zprávy, chyba).
//  - Příklad 12: zavření bez odeslání zachová rozepsané (obnovení stránky ověřuje E2E).
//  - Příklad 13: fokus zůstává v dialogu, limit 2000 znaků, Esc zavře a vrátí fokus na ikonu.
// Síť se nikdy nevolá doopravdy: fetch je atrapa a klíč Web3Forms je testovací.

/** Testovací klíč Web3Forms (v aplikaci z proměnné prostředí NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY). */
const TEST_KEY = 'test-access-key'

/** Časový limit (reálný čas) testů, které nechávají simulaci doběhnout. */
const SIM_RUN_TIMEOUT_MS = 20_000

/** Atrapa fetch pro aktuální test. */
let fetchMock: ReturnType<typeof vi.fn>

/** Odpověď Web3Forms s daným výsledkem. */
const web3formsResponse = (success: boolean, status = 200) => new Response(JSON.stringify({ success }), { status })

beforeEach(() => {
  // Běh simulace pohání requestAnimationFrame — falešný čas dává deterministický průběh.
  // setTimeout a Promise zůstávají skutečné, aby findBy* počkalo na asynchronní odeslání.
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  localStorage.clear()
  resetTutorial()
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
  markModeSeen('cashflow')
  vi.stubEnv('NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY', TEST_KEY)
  fetchMock = vi.fn(async () => web3formsResponse(true))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Názvy tří módů tak, jak je mají záložky v liště. */
type ModeName = 'Compare' | 'Advanced' | 'Cash Flow'
const MODE_NAMES: ModeName[] = ['Compare', 'Advanced', 'Cash Flow']

/** Posune falešný čas o `ms` milisekund uvnitř act(), aby se React stihl překreslit. */
async function advance(ms: number): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(ms) })
}

/** Přepne na záložku módu. */
const openMode = (mode: ModeName) => fireEvent.click(screen.getByRole('tab', { name: mode }))

/** Ikona zpětné vazby v liště. */
const feedbackIcon = () => screen.getByRole('button', { name: 'Send feedback' })

/** Klikne na ikonu bubliny a otevře dialog. */
const openFeedback = () => fireEvent.click(feedbackIcon())

/** Otevřený dialog (jeho název se po odeslání mění na poděkování, proto bez jména). */
const dialog = () => screen.getByRole('dialog')

/** Tlačítko v dialogu podle přesného názvu. */
const dialogButton = (name: string) => within(dialog()).getByRole('button', { name })

/** Pole „What helped you most?“. */
const helpedField = () => within(dialog()).getByRole('textbox', { name: 'What helped you most?' })
/** Pole „What's missing or what would you improve?“. */
const missingField = () => within(dialog()).getByRole('textbox', { name: "What's missing or what would you improve?" })
/** Pole Email (název obsahuje i poznámku „(optional, for a reply)“ / „(required for the call)“). */
const emailField = () => within(dialog()).getByRole('textbox', { name: /^Email/ })
/** Zaškrtávátko rozhovoru. */
const callCheckbox = () => within(dialog()).getByRole('checkbox', { name: "I'm open to a 20-min call with the author" })

/** Napíše text do pole formuláře. */
const typeInto = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } })

/** Body škály v pořadí 1–5 (přístupné názvy „N – název“). */
const RATING_NAMES = ['1 – Not useful', '2 – Slightly useful', '3 – Moderately useful', '4 – Very useful', '5 – Extremely useful']

/** Pravá část horní lišty: zpětná vazba, přepínač tématu a ovládání běhu (třetí potomek `<header>`). */
const barControls = () => document.querySelector('header')!.lastElementChild as HTMLElement

/** Přístupný název tlačítka: `aria-label`, jinak viditelný text. */
const nameOf = (el: Element) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''

/** Tlačítko běhu „▶ Run“ (přesný název, takže „❙❙ Pause“ ani „✓ Done“ nesedí). */
const runButton = () => screen.getByRole('button', { name: '▶ Run' })

/**
 * Simulační čas z prvního čítače „MM:SS.d“ na obrazovce.
 *
 * @returns Čas v sekundách
 */
function simSeconds(): number {
  const [minutes, rest] = screen.getAllByText(/^\d\d:\d\d\.\d$/)[0].textContent!.split(':')
  return Number(minutes) * 60 + Number(rest)
}

/**
 * Tělo požadavku, který aplikace poslala na Web3Forms.
 *
 * @param call - Pořadí volání fetch (výchozí první)
 * @returns Rozparsovaný JSON a adresa
 */
function sentRequest(call = 0): { url: string; body: Record<string, unknown> } {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit]
  return { url, body: JSON.parse(init.body as string) as Record<string, unknown> }
}

// ── Příklad 1 ────────────────────────────────────────────────────────────────

describe('feat-024 Příklad 1: ikona v liště ve všech módech', () => {
  it.each(MODE_NAMES)('%s: ikona „Send feedback“ s tooltipem stojí vlevo od přepínače tématu', mode => {
    render(<Simulator />)
    openMode(mode)
    expect(feedbackIcon()).toHaveAttribute('title', 'Send feedback')
    const names = Array.from(barControls().querySelectorAll('button')).map(nameOf)
    expect(names[0]).toBe('Send feedback')
    expect(names[1]).toMatch(/^Switch to (dark|light) theme$/)
  })
})

// ── Příklad 2 ────────────────────────────────────────────────────────────────

describe('feat-024 Příklad 2: otevření dialogu', () => {
  it('před kliknutím žádný dialog není', () => {
    render(<Simulator />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('kliknutí otevře modální dialog „Send feedback“ s celým obsahem', () => {
    render(<Simulator />)
    openFeedback()

    const d = screen.getByRole('dialog', { name: 'Send feedback' })
    expect(d).toHaveAttribute('aria-modal', 'true')
    expect(within(d).getByText('Takes a minute. Goes straight to the author.')).toBeInTheDocument()

    // Skupinu rolí pojmenuje viditelný popisek „Your role“ (oprava z review)
    const role = within(d).getByRole('group', { name: 'Your role' })
    expect(within(role).getAllByRole('button').map(nameOf)).toEqual(['AI coach', 'Agile coach', 'Manager', 'Other'])

    const rating = within(d).getByRole('group', { name: 'How useful is Org Flow Simulator for your work?' })
    expect(within(rating).getAllByRole('button').map(nameOf)).toEqual(RATING_NAMES)

    expect(helpedField()).toHaveValue('')
    expect(missingField()).toHaveValue('')
    expect(callCheckbox()).not.toBeChecked()
    expect(emailField()).toHaveAccessibleName('Email (optional, for a reply)')
    expect(emailField()).toHaveAttribute('placeholder', 'name@company.com')

    // Poznámka o ochraně údajů: komu odpovědi chodí, přes koho a co se posílá navíc
    expect(d).toHaveTextContent('Your answers are emailed to Ilja Alexandrov, the author of Org Flow Simulator, through Web3Forms.')
    expect(d).toHaveTextContent("Along with them we send the mode you're in and today's date. Nothing else.")
    expect(d).toHaveTextContent('Your email is used only to reply to you.')
    expect(within(d).getByRole('link', { name: 'Web3Forms' })).toHaveAttribute('target', '_blank')

    expect(dialogButton('Cancel')).toBeEnabled()
    expect(dialogButton('Send')).toBeEnabled()
  })

  it('fokus je po otevření na prvním prvku dialogu (role „AI coach“)', () => {
    render(<Simulator />)
    openFeedback()
    expect(document.activeElement).toBe(dialogButton('AI coach'))
  })
})

// ── Příklad 3 ────────────────────────────────────────────────────────────────

describe('feat-024 Příklad 3: otevření dialogu zastaví běžící simulaci', { timeout: SIM_RUN_TIMEOUT_MS }, () => {
  it('Advanced: běh se zastaví, čas stojí i po zavření a Run pokračuje od stejného bodu', async () => {
    render(<Simulator />)
    openMode('Advanced')
    fireEvent.click(runButton())
    await advance(1000)
    expect(screen.getByRole('button', { name: '❙❙ Pause' })).toBeInTheDocument()

    openFeedback()
    expect(screen.queryByRole('button', { name: '❙❙ Pause' })).toBeNull()
    expect(runButton()).toBeInTheDocument()
    const stoppedAt = simSeconds()
    expect(stoppedAt).toBeGreaterThan(0)
    await advance(2000)
    expect(simSeconds()).toBe(stoppedAt)

    fireEvent.click(dialogButton('Cancel'))
    await advance(2000)
    expect(simSeconds()).toBe(stoppedAt)
    expect(runButton()).toBeInTheDocument()

    fireEvent.click(runButton())
    await advance(1000)
    expect(screen.getByRole('button', { name: '❙❙ Pause' })).toBeInTheDocument()
    expect(simSeconds()).toBeGreaterThan(stoppedAt)
  })

  it.each(['Compare', 'Cash Flow'] as const)('%s: běžící simulace se po otevření dialogu zastaví', async mode => {
    render(<Simulator />)
    openMode(mode)
    fireEvent.click(runButton())
    await advance(1000)
    expect(screen.getByRole('button', { name: '❙❙ Pause' })).toBeInTheDocument()

    openFeedback()
    expect(screen.queryByRole('button', { name: '❙❙ Pause' })).toBeNull()
    const stoppedAt = simSeconds()
    await advance(2000)
    expect(simSeconds()).toBe(stoppedAt)
  })

  it.each(MODE_NAMES)('%s: nespuštěná simulace zůstane nespuštěná (pulzující „▶ Run“)', mode => {
    render(<Simulator />)
    openMode(mode)
    openFeedback()
    fireEvent.click(dialogButton('Cancel'))
    expect(/pulse/.test(runButton().className)).toBe(true)
  })

  it('Advanced: dokončená simulace zůstane „✓ Done“', async () => {
    render(<Simulator />)
    openMode('Advanced')
    fireEvent.click(screen.getByRole('button', { name: 'Backlog' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Backlog size' }), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: /Generate new backlog/ }))
    fireEvent.click(within(barControls()).getByRole('button', { name: '10×' }))
    fireEvent.click(runButton())
    for (let waited = 0; waited < 60_000 && !screen.queryByRole('button', { name: '✓ Done' }); waited += 500) {
      await advance(500)
    }
    expect(screen.getByRole('button', { name: '✓ Done' })).toBeDisabled()

    openFeedback()
    expect(screen.getByRole('button', { name: '✓ Done' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '▶ Run' })).toBeNull()
  })
})

// ── Příklady 4 a 5 ───────────────────────────────────────────────────────────

describe('feat-024 Příklad 4: hodnocení s pojmenovanými body', () => {
  it('kraje škály jsou popsané hned, vybraný bod ukáže svůj název', () => {
    render(<Simulator />)
    openFeedback()
    expect(within(dialog()).getByText('Not useful')).toBeInTheDocument()
    expect(within(dialog()).getByText('Extremely useful')).toBeInTheDocument()
    expect(within(dialog()).queryByText('Very useful')).toBeNull()
    for (const name of RATING_NAMES) expect(dialogButton(name)).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(dialogButton('4 – Very useful'))
    expect(dialogButton('4 – Very useful')).toHaveAttribute('aria-pressed', 'true')
    for (const name of RATING_NAMES.filter(n => !n.startsWith('4'))) {
      expect(dialogButton(name)).toHaveAttribute('aria-pressed', 'false')
    }
    expect(within(dialog()).getByText('Very useful')).toBeInTheDocument()
  })
})

describe('feat-024 Příklad 5: role i hodnocení jdou změnit a zrušit', () => {
  it('vybraná je vždy jen jedna role; klik na vybranou ji zruší', () => {
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('Manager'))
    fireEvent.click(dialogButton('AI coach'))
    expect(dialogButton('AI coach')).toHaveAttribute('aria-pressed', 'true')
    expect(dialogButton('Manager')).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(dialogButton('AI coach'))
    for (const role of ['AI coach', 'Agile coach', 'Manager', 'Other']) {
      expect(dialogButton(role)).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('druhý klik na vybraný bod hodnocení výběr zruší a název pod škálou zmizí', () => {
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('4 – Very useful'))
    fireEvent.click(dialogButton('4 – Very useful'))
    for (const name of RATING_NAMES) expect(dialogButton(name)).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog()).queryByText('Very useful')).toBeNull()
  })
})

// ── Příklady 6–8 ─────────────────────────────────────────────────────────────

describe('feat-024 Příklad 6: prázdný formulář se neodešle', () => {
  it('Send ukáže hlášku a nic neodešle; hláška zmizí po výběru hodnocení', () => {
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('Manager'))
    typeInto(helpedField(), '   ')
    fireEvent.click(dialogButton('Send'))

    expect(within(dialog()).getByText('Add a rating or a comment first.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(dialogButton('2 – Slightly useful'))
    expect(within(dialog()).queryByText('Add a rating or a comment first.')).toBeNull()
  })

  it('hláška zmizí, jakmile uživatel začne psát', () => {
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('Send'))
    expect(within(dialog()).getByText('Add a rating or a comment first.')).toBeInTheDocument()

    typeInto(missingField(), 'S')
    expect(within(dialog()).queryByText('Add a rating or a comment first.')).toBeNull()
  })
})

describe('feat-024 Příklad 7: zájem o rozhovor vyžaduje e-mail', () => {
  it('bez e-mailu se nic neodešle a pole Email je povinné; po odškrtnutí zase nepovinné', () => {
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('4 – Very useful'))
    fireEvent.click(callCheckbox())
    expect(emailField()).toHaveAccessibleName('Email (required for the call)')

    fireEvent.click(dialogButton('Send'))
    expect(within(dialog()).getByText('Add your email so the author can reach you.')).toBeInTheDocument()
    expect(emailField()).toHaveAttribute('aria-invalid', 'true')
    expect(emailField()).toHaveAccessibleDescription('Add your email so the author can reach you.')
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(callCheckbox())
    expect(emailField()).toHaveAccessibleName('Email (optional, for a reply)')
  })
})

describe('feat-024 Příklad 8: neplatný e-mail', () => {
  it.each([false, true])('„jan@“ → „Check your email address.“ a nic se neodešle (rozhovor zaškrtnutý: %s)', withCall => {
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('3 – Moderately useful'))
    if (withCall) fireEvent.click(callCheckbox())
    typeInto(emailField(), 'jan@')
    fireEvent.click(dialogButton('Send'))

    expect(within(dialog()).getByText('Check your email address.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Příklady 9–11 ────────────────────────────────────────────────────────────

describe('feat-024 Příklad 9: úspěšné odeslání', () => {
  it('„Sending…“ během odesílání, pak poděkování; zpráva obsahuje jen vyplněné údaje, mód a datum', async () => {
    // Odpověď služby přijde, až ji test pustí — mezitím se ověří stav „Sending…“
    let respond: (response: Response) => void = () => {}
    fetchMock.mockImplementation(() => new Promise<Response>(resolve => { respond = resolve }))

    render(<Simulator />)
    openMode('Advanced')
    openFeedback()
    fireEvent.click(dialogButton('Agile coach'))
    fireEvent.click(dialogButton('4 – Very useful'))
    typeInto(missingField(), 'Save a team setup for my next workshop.')
    fireEvent.click(dialogButton('Send'))

    const sending = dialogButton('Sending…')
    expect(sending).toBeDisabled()
    fireEvent.click(sending)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => { respond(web3formsResponse(true)) })
    expect(await within(dialog()).findByRole('heading', { name: 'Thanks for your feedback.' })).toBeInTheDocument()
    expect(dialogButton('Close')).toBeEnabled()
    expect(within(dialog()).queryByText(/will email you/)).toBeNull()

    const { url, body } = sentRequest()
    expect(url).toBe(WEB3FORMS_ENDPOINT)
    expect(body).toEqual({
      access_key: TEST_KEY,
      botcheck: false,
      subject: 'Org Flow feedback – 4 Very useful – Agile coach',
      from_name: 'Org Flow Simulator',
      Role: 'Agile coach',
      Usefulness: '4 – Very useful',
      'What helped': '—',
      "What's missing": 'Save a team setup for my next workshop.',
      'Open to a call': 'no',
      Mode: 'Advanced',
      Date: formatFeedbackDate(new Date()),
    })
  })

  it('po zavření poděkování je formulář při dalším otevření prázdný', async () => {
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('Manager'))
    fireEvent.click(dialogButton('5 – Extremely useful'))
    typeInto(helpedField(), 'The handoff counter.')
    fireEvent.click(callCheckbox())
    typeInto(emailField(), 'jana@firma.cz')
    fireEvent.click(dialogButton('Send'))
    await within(dialog()).findByRole('heading', { name: 'Thanks for your feedback.' })

    fireEvent.click(dialogButton('Close'))
    expect(screen.queryByRole('dialog')).toBeNull()

    openFeedback()
    expect(screen.getByRole('dialog', { name: 'Send feedback' })).toBeInTheDocument()
    for (const name of [...RATING_NAMES, 'AI coach', 'Agile coach', 'Manager', 'Other']) {
      expect(dialogButton(name)).toHaveAttribute('aria-pressed', 'false')
    }
    expect(helpedField()).toHaveValue('')
    expect(missingField()).toHaveValue('')
    expect(callCheckbox()).not.toBeChecked()
    expect(emailField()).toHaveValue('')
  })

  it.each(['Compare', 'Cash Flow'] as const)('mód „%s“ jde do zprávy tak, jak je na záložce', async mode => {
    render(<Simulator />)
    openMode(mode)
    openFeedback()
    fireEvent.click(dialogButton('1 – Not useful'))
    fireEvent.click(dialogButton('Send'))
    await within(dialog()).findByRole('heading', { name: 'Thanks for your feedback.' })
    expect(sentRequest().body.Mode).toBe(mode)
  })

  it('skryté pole proti robotům je mimo dosah uživatele i čtečky obrazovky', () => {
    render(<Simulator />)
    openFeedback()
    const honeypot = dialog().querySelector<HTMLInputElement>('input[name="botcheck"]')
    expect(honeypot).not.toBeNull()
    expect(honeypot).toHaveAttribute('tabindex', '-1')
    expect(honeypot!.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})

describe('feat-024 Příklad 10: poděkování se zájmem o rozhovor', () => {
  it('řekne, na jaký e-mail se autor ozve; e-mail jde ve zprávě jako Reply-To', async () => {
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('5 – Extremely useful'))
    fireEvent.click(callCheckbox())
    typeInto(emailField(), 'jana@firma.cz')
    fireEvent.click(dialogButton('Send'))

    expect(await within(dialog()).findByText('The author will email you at jana@firma.cz to set up a call.')).toBeInTheDocument()
    expect(within(dialog()).getByRole('heading', { name: 'Thanks for your feedback.' })).toBeInTheDocument()
    const { body } = sentRequest()
    expect(body.email).toBe('jana@firma.cz')
    expect(body['Open to a call']).toBe('yes')
  })
})

describe('feat-024 Příklad 11: chyba při odeslání', () => {
  const ERROR = "Couldn't send your feedback. Check your connection and try again."

  /** Vyplní hodnocení a text, odešle a počká na chybovou hlášku. */
  async function sendAndExpectError(): Promise<void> {
    fireEvent.click(dialogButton('3 – Moderately useful'))
    typeInto(helpedField(), 'Compare mode')
    fireEvent.click(dialogButton('Send'))
    expect(await within(dialog()).findByText(ERROR)).toBeInTheDocument()
  }

  it('nefunkční připojení: dialog zůstane otevřený a vyplněný, Send jde stisknout znovu', async () => {
    fetchMock.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
    render(<Simulator />)
    openFeedback()
    await sendAndExpectError()

    expect(dialogButton('3 – Moderately useful')).toHaveAttribute('aria-pressed', 'true')
    expect(helpedField()).toHaveValue('Compare mode')
    expect(dialogButton('Send')).toBeEnabled()

    fetchMock.mockImplementation(async () => web3formsResponse(true))
    fireEvent.click(dialogButton('Send'))
    expect(await within(dialog()).findByRole('heading', { name: 'Thanks for your feedback.' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('služba odpověď odmítne (success: false) → stejná hláška', async () => {
    fetchMock.mockImplementation(async () => web3formsResponse(false))
    render(<Simulator />)
    openFeedback()
    await sendAndExpectError()
  })

  it('bez klíče Web3Forms: varování v konzoli a stejná hláška, aplikace nespadne', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY', '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchMock.mockImplementation(async () => web3formsResponse(false, 400))
    render(<Simulator />)
    openFeedback()
    await sendAndExpectError()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY'))
  })
})

// ── Příklad 12 ───────────────────────────────────────────────────────────────

describe('feat-024 Příklad 12: zavření bez odeslání zachová rozepsané', () => {
  it.each(['Cancel', 'Esc'] as const)('%s: text i hodnocení jsou po novém otevření zpět, nic se neodeslalo', how => {
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('3 – Moderately useful'))
    typeInto(missingField(), 'More scenarios')

    if (how === 'Cancel') fireEvent.click(dialogButton('Cancel'))
    else fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    openFeedback()
    expect(dialogButton('3 – Moderately useful')).toHaveAttribute('aria-pressed', 'true')
    expect(missingField()).toHaveValue('More scenarios')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Příklad 13 ───────────────────────────────────────────────────────────────

describe('feat-024 Příklad 13: ovládání klávesnicí a délka textu', () => {
  it('Tab z posledního prvku skočí na první, Shift+Tab z prvního na poslední (Send)', () => {
    render(<Simulator />)
    openFeedback()
    const first = dialogButton('AI coach')
    const last = dialogButton('Send')

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('každé textové pole přijme nejvýš 2000 znaků', () => {
    render(<Simulator />)
    openFeedback()
    expect(helpedField()).toHaveAttribute('maxlength', '2000')
    expect(missingField()).toHaveAttribute('maxlength', '2000')
  })

  it('Esc dialog zavře a fokus se vrátí na ikonu bubliny', () => {
    render(<Simulator />)
    feedbackIcon().focus()
    openFeedback()
    expect(document.activeElement).not.toBe(feedbackIcon())

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(feedbackIcon())
  })
})

// ── Opravy z review (2026-10-21) ─────────────────────────────────────────────
// Spec, UI / Design → Stavy dialogu: zamčená pole během odesílání, výsledek odeslání po zavření
// a novém otevření, fokus na poděkování, Tab a Esc jen pro horní dialog, přístupný název skupiny rolí.

/** Atrapa fetch, jejíž odpověď pustí test sám — mezitím je dialog ve stavu „Sending…“. */
function deferFetch(): { respond: (response: Response) => void; fail: () => void } {
  // Skutečné obsluhy dosadí atrapa fetch při odeslání; do té doby nic nedělají
  const handlers: { respond: (response: Response) => void; fail: () => void } = { respond: () => {}, fail: () => {} }
  fetchMock.mockImplementation(() => new Promise<Response>((resolve, reject) => {
    handlers.respond = resolve
    handlers.fail = () => reject(new TypeError('Failed to fetch'))
  }))
  return {
    respond: response => handlers.respond(response),
    fail: () => handlers.fail(),
  }
}

describe('feat-024 review: pole jsou během odesílání zamčená', () => {
  it('role, hodnocení, texty, rozhovor i e-mail nejdou během „Sending…“ měnit; Cancel ano', async () => {
    const pending = deferFetch()
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('4 – Very useful'))
    typeInto(helpedField(), 'Compare mode')
    fireEvent.click(dialogButton('Send'))

    for (const name of ['AI coach', ...RATING_NAMES]) expect(dialogButton(name)).toBeDisabled()
    expect(helpedField()).toBeDisabled()
    expect(missingField()).toBeDisabled()
    expect(callCheckbox()).toBeDisabled()
    expect(emailField()).toBeDisabled()
    expect(dialogButton('Cancel')).toBeEnabled()

    await act(async () => { pending.respond(web3formsResponse(true)) })
    await within(dialog()).findByRole('heading', { name: 'Thanks for your feedback.' })
  })
})

describe('feat-024 review: výsledek odeslání po zavření během odesílání', () => {
  it('úspěch: příští otevření ukáže poděkování, další otevření prázdný formulář', async () => {
    const pending = deferFetch()
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('5 – Extremely useful'))
    fireEvent.click(dialogButton('Send'))
    fireEvent.click(dialogButton('Cancel'))
    expect(screen.queryByRole('dialog')).toBeNull()

    await act(async () => { pending.respond(web3formsResponse(true)) })
    openFeedback()
    expect(await within(dialog()).findByRole('heading', { name: 'Thanks for your feedback.' })).toBeInTheDocument()

    fireEvent.click(dialogButton('Close'))
    openFeedback()
    expect(screen.getByRole('dialog', { name: 'Send feedback' })).toBeInTheDocument()
    expect(dialogButton('5 – Extremely useful')).toHaveAttribute('aria-pressed', 'false')
  })

  it('chyba: příští otevření ukáže chybu a vyplněný formulář; po zavření a otevření už bez hlášky', async () => {
    const pending = deferFetch()
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('2 – Slightly useful'))
    fireEvent.click(dialogButton('Send'))
    fireEvent.keyDown(document, { key: 'Escape' })

    await act(async () => { pending.fail() })
    openFeedback()
    const ERROR = "Couldn't send your feedback. Check your connection and try again."
    expect(await within(dialog()).findByText(ERROR)).toBeInTheDocument()
    expect(dialogButton('2 – Slightly useful')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(dialogButton('Cancel'))
    openFeedback()
    expect(within(dialog()).queryByText(ERROR)).toBeNull()
    expect(dialogButton('2 – Slightly useful')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('feat-024 review: fokus po odeslání', () => {
  it('fokus přejde na nadpis poděkování a Tab ho drží v dialogu (na Close)', async () => {
    render(<Simulator />)
    openFeedback()
    fireEvent.click(dialogButton('3 – Moderately useful'))
    fireEvent.click(dialogButton('Send'))
    const heading = await within(dialog()).findByRole('heading', { name: 'Thanks for your feedback.' })

    expect(document.activeElement).toBe(heading)
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(dialogButton('Close'))
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(dialogButton('Close'))
  })
})

describe('feat-024 review: dva dialogy nad sebou', () => {
  /** Potvrzovací dialog nastavení a přes něj dialog zpětné vazby — jako když uživatel otevře zpětnou vazbu z lišty. */
  function renderStacked(withFeedback: boolean, onCancelConfirm: () => void, onCloseFeedback: () => void) {
    return (
      <>
        <ConfirmOverlay title="Change preset?" body="Your edits will be lost." confirmLabel="Change" onCancel={onCancelConfirm} onConfirm={() => {}} />
        {withFeedback && (
          <FeedbackDialog
            draft={EMPTY_FEEDBACK_DRAFT}
            onDraftChange={() => {}}
            status="editing"
            errors={{}}
            callEmail={null}
            onSend={() => {}}
            onClose={onCloseFeedback}
          />
        )}
      </>
    )
  }

  it('Esc a Tab patří jen hornímu dialogu (zpětná vazba); po jeho zavření zase potvrzovacímu', () => {
    const onCancelConfirm = vi.fn()
    const onCloseFeedback = vi.fn()
    const { rerender } = render(renderStacked(false, onCancelConfirm, onCloseFeedback))
    rerender(renderStacked(true, onCancelConfirm, onCloseFeedback))

    const feedback = screen.getByRole('dialog', { name: 'Send feedback' })
    const first = within(feedback).getByRole('button', { name: 'AI coach' })
    const last = within(feedback).getByRole('button', { name: 'Send' })
    expect(document.activeElement).toBe(first)

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCloseFeedback).toHaveBeenCalledTimes(1)
    expect(onCancelConfirm).not.toHaveBeenCalled()

    // Zpětná vazba se zavře — klávesy zase obsluhuje potvrzovací dialog
    rerender(renderStacked(false, onCancelConfirm, onCloseFeedback))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancelConfirm).toHaveBeenCalledTimes(1)
  })
})
