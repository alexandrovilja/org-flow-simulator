import { describe, it, expect, vi, afterEach } from 'vitest'
import type { FeedbackDraft } from '@/types/feedback'
import {
  EMPTY_FEEDBACK_DRAFT,
  FEEDBACK_RATING_LABELS,
  WEB3FORMS_ENDPOINT,
  buildFeedbackFields,
  formatFeedbackDate,
  sendFeedback,
  validateFeedback,
} from '@/lib/feedback'

// feat-024 Zpětná vazba od uživatelů — čistá logika v src/lib/feedback.ts (bez Reactu, bez sítě).
//
// Schválený kontrakt: features/feat-024-zpetna-vazba-uzivatelu.md
//  - Příklad 4: názvy bodů škály 1–5.
//  - Příklady 6–8: kontroly formuláře (prázdný formulář, povinný e-mail při rozhovoru, formát e-mailu).
//  - Příklad 9: obsah zprávy pro autora — role, hodnocení „4 – Very useful“, oba texty (prázdný „—“),
//    zájem o rozhovor yes / no, e-mail jen když je vyplněný, mód a datum; nic dalšího.
//  - Příklad 11 a Technical Notes: odeslání přes Web3Forms (`fetch` POST s JSON) nikdy nevyhodí výjimku,
//    vrátí jen úspěch / neúspěch; bez klíče varuje v konzoli a služba požadavek odmítne.
//
// Rozhraní, které testy určují (implementace přijde ve fázi 5):
//  - validateFeedback(draft) → FeedbackErrors ({ form?, email? })
//  - buildFeedbackFields(draft, { mode, date }) → pole zprávy (Record<string, string>)
//  - formatFeedbackDate(date) → „YYYY-MM-DD“ podle místního času
//  - sendFeedback(fields, { accessKey, botcheck?, fetchFn? }) → Promise<boolean>
//  - WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit'

/** Koncept s předvyplněnými hodnotami — test přepíše jen to, o co mu jde. */
function draft(overrides: Partial<FeedbackDraft> = {}): FeedbackDraft {
  return { ...EMPTY_FEEDBACK_DRAFT, ...overrides }
}

/** Hláška u tlačítek pro prázdný formulář (Příklad 6). */
const EMPTY_FORM = 'Add a rating or a comment first.'
/** Hláška u pole Email při zájmu o rozhovor bez e-mailu (Příklad 7). */
const EMAIL_REQUIRED = 'Add your email so the author can reach you.'
/** Hláška u pole Email při neplatném formátu (Příklad 8). */
const EMAIL_INVALID = 'Check your email address.'

// ── Příklad 4: názvy bodů škály ──────────────────────────────────────────────

describe('feat-024 Příklad 4: názvy bodů škály užitečnosti', () => {
  it('body 1–5 se jmenují Not / Slightly / Moderately / Very / Extremely useful', () => {
    expect(FEEDBACK_RATING_LABELS).toEqual({
      1: 'Not useful',
      2: 'Slightly useful',
      3: 'Moderately useful',
      4: 'Very useful',
      5: 'Extremely useful',
    })
  })
})

// ── Příklady 6–8: kontroly formuláře ─────────────────────────────────────────

describe('feat-024 Příklad 6: prázdný formulář se neodešle', () => {
  it('bez hodnocení a bez textů vrátí hlášku k formuláři', () => {
    expect(validateFeedback(draft())).toEqual({ form: EMPTY_FORM })
  })

  it('vybraná role sama nestačí', () => {
    expect(validateFeedback(draft({ role: 'manager' }))).toEqual({ form: EMPTY_FORM })
  })

  it('text jen z mezer a zalomení řádků se bere jako prázdný', () => {
    expect(validateFeedback(draft({ helped: '   ', missing: '\n\t ' }))).toEqual({ form: EMPTY_FORM })
  })

  it('stačí samotné hodnocení', () => {
    expect(validateFeedback(draft({ rating: 2 }))).toEqual({})
  })

  it('stačí jeden z textů', () => {
    expect(validateFeedback(draft({ helped: 'Compare mode' }))).toEqual({})
    expect(validateFeedback(draft({ missing: 'Saved setups' }))).toEqual({})
  })
})

describe('feat-024 Příklad 7: zájem o rozhovor vyžaduje e-mail', () => {
  it('zaškrtnutý rozhovor a prázdný e-mail → hláška u pole Email', () => {
    expect(validateFeedback(draft({ rating: 4, openToCall: true }))).toEqual({ email: EMAIL_REQUIRED })
  })

  it('e-mail jen z mezer se bere jako prázdný', () => {
    expect(validateFeedback(draft({ rating: 4, openToCall: true, email: '   ' }))).toEqual({ email: EMAIL_REQUIRED })
  })

  it('bez rozhovoru je prázdný e-mail v pořádku', () => {
    expect(validateFeedback(draft({ rating: 4 }))).toEqual({})
  })

  it('s rozhovorem a platným e-mailem je vše v pořádku', () => {
    expect(validateFeedback(draft({ rating: 4, openToCall: true, email: 'jana@firma.cz' }))).toEqual({})
  })

  it('prázdný formulář s rozhovorem bez e-mailu vrátí obě hlášky', () => {
    expect(validateFeedback(draft({ openToCall: true }))).toEqual({ form: EMPTY_FORM, email: EMAIL_REQUIRED })
  })
})

describe('feat-024 Příklad 8: neplatný e-mail', () => {
  it.each(['jan@', 'jan', '@firma.cz', 'jan@firma', 'jan novak@firma.cz'])('„%s“ → „Check your email address.“ (bez rozhovoru)', email => {
    expect(validateFeedback(draft({ rating: 3, email }))).toEqual({ email: EMAIL_INVALID })
  })

  it('platí i se zaškrtnutým rozhovorem', () => {
    expect(validateFeedback(draft({ rating: 3, openToCall: true, email: 'jan@' }))).toEqual({ email: EMAIL_INVALID })
  })

  it.each(['jana@firma.cz', 'j.novak+workshop@example.co.uk', '  jana@firma.cz  '])('„%s“ je platný', email => {
    expect(validateFeedback(draft({ rating: 3, email }))).toEqual({})
  })
})

// ── Příklad 9: obsah zprávy ──────────────────────────────────────────────────

describe('feat-024 Příklad 9: obsah zprávy pro autora', () => {
  const context = { mode: 'Advanced', date: '2026-10-21' }

  it('role, hodnocení s názvem, oba texty (prázdný jako „—“), rozhovor, mód a datum — nic dalšího', () => {
    const fields = buildFeedbackFields(
      draft({ role: 'agile-coach', rating: 4, missing: 'Save a team setup for my next workshop.' }),
      context,
    )
    expect(fields).toEqual({
      subject: 'Org Flow feedback – 4 Very useful – Agile coach',
      from_name: 'Org Flow Simulator',
      Role: 'Agile coach',
      Usefulness: '4 – Very useful',
      'What helped': '—',
      "What's missing": 'Save a team setup for my next workshop.',
      'Open to a call': 'no',
      Mode: 'Advanced',
      Date: '2026-10-21',
    })
  })

  it('vyplněný e-mail jde v poli „email“ (Web3Forms ho použije jako Reply-To), oříznutý o mezery', () => {
    const fields = buildFeedbackFields(draft({ rating: 5, openToCall: true, email: '  jana@firma.cz ' }), context)
    expect(fields.email).toBe('jana@firma.cz')
    expect(fields['Open to a call']).toBe('yes')
  })

  it('bez e-mailu pole „email“ ve zprávě vůbec není', () => {
    const fields = buildFeedbackFields(draft({ rating: 5 }), context)
    expect(Object.keys(fields)).not.toContain('email')
  })

  it('nevybraná role a hodnocení jsou „—“ a předmět je jen „Org Flow feedback“', () => {
    const fields = buildFeedbackFields(draft({ helped: 'The handoff counter.' }), context)
    expect(fields.Role).toBe('—')
    expect(fields.Usefulness).toBe('—')
    expect(fields.subject).toBe('Org Flow feedback')
  })

  it('předmět obsahuje jen to, co je vyplněné', () => {
    expect(buildFeedbackFields(draft({ rating: 2 }), context).subject).toBe('Org Flow feedback – 2 Slightly useful')
    expect(buildFeedbackFields(draft({ role: 'ai-coach', helped: 'x' }), context).subject).toBe('Org Flow feedback – AI coach')
  })

  it('texty jsou oříznuté o mezery na začátku a konci', () => {
    const fields = buildFeedbackFields(draft({ helped: '  Compare mode  \n' }), context)
    expect(fields['What helped']).toBe('Compare mode')
  })

  it.each([
    ['ai-coach', 'AI coach'],
    ['agile-coach', 'Agile coach'],
    ['manager', 'Manager'],
    ['other', 'Other'],
  ] as const)('role „%s“ se ve zprávě jmenuje „%s“', (role, label) => {
    expect(buildFeedbackFields(draft({ role, rating: 3 }), context).Role).toBe(label)
  })

  it.each(['Compare', 'Advanced', 'Cash Flow'])('mód „%s“ jde do zprávy beze změny', mode => {
    expect(buildFeedbackFields(draft({ rating: 1 }), { mode, date: '2026-10-21' }).Mode).toBe(mode)
  })
})

describe('feat-024 Příklad 9: datum ve zprávě', () => {
  it('formát YYYY-MM-DD podle místního času, s nulami na začátku', () => {
    expect(formatFeedbackDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(formatFeedbackDate(new Date(2026, 9, 21, 0, 1))).toBe('2026-10-21')
  })
})

// ── Příklad 11 a Technical Notes: odeslání přes Web3Forms ───────────────────

describe('feat-024 Příklad 11: odeslání přes Web3Forms', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const fields = { subject: 'Org Flow feedback', Mode: 'Compare' }

  /** Atrapa fetch, která vrátí odpověď Web3Forms s daným `success` a HTTP stavem. */
  function fetchReturning(success: boolean, status = 200) {
    return vi.fn(async () => new Response(JSON.stringify({ success }), { status }))
  }

  it('pošle POST s JSON na api.web3forms.com/submit s klíčem, botcheck a poli zprávy', async () => {
    const fetchFn = fetchReturning(true)
    await sendFeedback(fields, { accessKey: 'key-123', fetchFn })

    expect(WEB3FORMS_ENDPOINT).toBe('https://api.web3forms.com/submit')
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(WEB3FORMS_ENDPOINT)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
    expect(new Headers(init.headers).get('Accept')).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({
      access_key: 'key-123',
      botcheck: false,
      subject: 'Org Flow feedback',
      Mode: 'Compare',
    })
  })

  it('vyplněné skryté pole proti robotům se pošle jako botcheck: true (služba odpověď zahodí)', async () => {
    const fetchFn = fetchReturning(true)
    await sendFeedback(fields, { accessKey: 'key-123', botcheck: true, fetchFn })
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string).botcheck).toBe(true)
  })

  it('úspěch jen při HTTP 2xx a success: true', async () => {
    expect(await sendFeedback(fields, { accessKey: 'k', fetchFn: fetchReturning(true) })).toBe(true)
  })

  it('success: false (např. vyčerpaný měsíční limit) → neúspěch', async () => {
    expect(await sendFeedback(fields, { accessKey: 'k', fetchFn: fetchReturning(false) })).toBe(false)
  })

  it('HTTP chyba → neúspěch', async () => {
    expect(await sendFeedback(fields, { accessKey: 'k', fetchFn: fetchReturning(true, 500) })).toBe(false)
  })

  it('odpověď, která není JSON → neúspěch, žádná výjimka', async () => {
    const fetchFn = vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 200 }))
    expect(await sendFeedback(fields, { accessKey: 'k', fetchFn })).toBe(false)
  })

  it('nefunkční připojení (fetch vyhodí výjimku) → neúspěch, žádná výjimka', async () => {
    const fetchFn = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    await expect(sendFeedback(fields, { accessKey: 'k', fetchFn })).resolves.toBe(false)
  })

  it('bez klíče varuje v konzoli, odešle prázdný access_key a služba ho odmítne', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchFn = fetchReturning(false, 400)

    expect(await sendFeedback(fields, { accessKey: undefined, fetchFn })).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY'))
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string).access_key).toBe('')
  })

  it('s klíčem nevaruje', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await sendFeedback(fields, { accessKey: 'k', fetchFn: fetchReturning(true) })
    expect(warn).not.toHaveBeenCalled()
  })
})
