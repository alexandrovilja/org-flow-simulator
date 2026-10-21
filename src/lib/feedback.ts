import type { FeedbackDraft, FeedbackErrors, FeedbackRating, FeedbackRole } from '@/types/feedback'

/**
 * Volby role v pořadí, v jakém je dialog ukazuje (feat-024). `label` je text v UI i v e-mailu autorovi.
 */
export const FEEDBACK_ROLE_OPTIONS: { value: FeedbackRole; label: string }[] = [
  { value: 'ai-coach', label: 'AI coach' },
  { value: 'agile-coach', label: 'Agile coach' },
  { value: 'manager', label: 'Manager' },
  { value: 'other', label: 'Other' },
]

/**
 * Názvy bodů škály užitečnosti 1–5. Každý bod má slovo, aby „4“ znamenalo pro každého totéž
 * („Very useful“), a stejný název jde i do e-mailu autorovi.
 */
export const FEEDBACK_RATING_LABELS: Record<FeedbackRating, string> = {
  1: 'Not useful',
  2: 'Slightly useful',
  3: 'Moderately useful',
  4: 'Very useful',
  5: 'Extremely useful',
}

/** Body škály v pořadí zleva doprava. */
export const FEEDBACK_RATINGS: readonly FeedbackRating[] = [1, 2, 3, 4, 5]

/** Nejvyšší počet znaků v každém textovém poli — dlouhé vložené texty se dál nepřijmou. */
export const FEEDBACK_MAX_TEXT_LENGTH = 2000

/** Prázdný formulář: stav při prvním otevření a po úspěšném odeslání. */
export const EMPTY_FEEDBACK_DRAFT: FeedbackDraft = {
  role: null,
  rating: null,
  helped: '',
  missing: '',
  openToCall: false,
  email: '',
}

/** Adresa služby Web3Forms, která odpověď doručí e-mailem autorovi. */
export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit'

/** Hláška u tlačítek, když není vyplněné hodnocení ani žádný text (Příklad 6). */
const EMPTY_FORM_MESSAGE = 'Add a rating or a comment first.'
/** Hláška u pole Email, když uživatel chce rozhovor, ale e-mail nevyplnil (Příklad 7). */
const EMAIL_REQUIRED_MESSAGE = 'Add your email so the author can reach you.'
/** Hláška u pole Email při neplatném formátu (Příklad 8). */
const EMAIL_INVALID_MESSAGE = 'Check your email address.'

// Záměrně volná kontrola: něco@něco.doména bez mezer. Přesnou platnost adresy ověří až odpověď autora;
// cílem je zachytit překlepy jako „jan@“ nebo chybějící doménu, ne odmítat neobvyklé, ale platné adresy.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Text, který ve zprávě zastupuje nevyplněný údaj — autor tak pozná „nevyplněno“ od chybějícího pole. */
const EMPTY_VALUE = '—'

/**
 * Zkontroluje koncept před odesláním (feat-024, Příklady 6–8). Neodesílá nic, jen řekne, co doplnit.
 *
 * @param draft - Rozepsaná zpětná vazba
 * @returns Hlášky k formuláři (`form`) a k poli Email (`email`); prázdný objekt = lze odeslat
 */
export function validateFeedback(draft: FeedbackDraft): FeedbackErrors {
  const errors: FeedbackErrors = {}

  // Formulář musí nést aspoň hodnocení, nebo nějaký text — samotná role autorovi nic neřekne
  const hasText = draft.helped.trim() !== '' || draft.missing.trim() !== ''
  if (draft.rating === null && !hasText) errors.form = EMPTY_FORM_MESSAGE

  // Vyplněný e-mail musí mít platný tvar vždy; prázdný vadí jen tehdy, když uživatel chce rozhovor
  const email = draft.email.trim()
  if (email !== '' && !EMAIL_PATTERN.test(email)) errors.email = EMAIL_INVALID_MESSAGE
  else if (draft.openToCall && email === '') errors.email = EMAIL_REQUIRED_MESSAGE

  return errors
}

/**
 * Sestaví pole zprávy, která přijde autorovi e-mailem (feat-024, Příklad 9). Posílá jen to, co
 * uživatel vyplnil, plus mód a datum — nic dalšího. Pole `email` Web3Forms použije jako Reply-To.
 *
 * @param draft - Zkontrolovaná zpětná vazba
 * @param context - Název módu tak, jak je na záložce, a datum ve tvaru YYYY-MM-DD
 * @returns Pole zprávy (název pole → hodnota); `subject` a `from_name` čte Web3Forms pro hlavičku e-mailu
 */
export function buildFeedbackFields(draft: FeedbackDraft, context: { mode: string; date: string }): Record<string, string> {
  const roleLabel = FEEDBACK_ROLE_OPTIONS.find(option => option.value === draft.role)?.label ?? null
  const ratingLabel = draft.rating === null ? null : FEEDBACK_RATING_LABELS[draft.rating]

  // Předmět shrne odpověď na první pohled v poště, např. „Org Flow feedback – 4 Very useful – Agile coach“
  const subjectParts = [
    'Org Flow feedback',
    draft.rating === null ? null : `${draft.rating} ${ratingLabel}`,
    roleLabel,
  ]

  const fields: Record<string, string> = {
    subject: subjectParts.filter(part => part !== null).join(' – '),
    from_name: 'Org Flow Simulator',
    Role: roleLabel ?? EMPTY_VALUE,
    Usefulness: draft.rating === null ? EMPTY_VALUE : `${draft.rating} – ${ratingLabel}`,
    'What helped': draft.helped.trim() || EMPTY_VALUE,
    "What's missing": draft.missing.trim() || EMPTY_VALUE,
    'Open to a call': draft.openToCall ? 'yes' : 'no',
  }

  // E-mail jen když ho uživatel vyplnil — jinak ve zprávě vůbec není
  const email = draft.email.trim()
  if (email !== '') fields.email = email

  fields.Mode = context.mode
  fields.Date = context.date
  return fields
}

/**
 * Datum odeslání ve tvaru YYYY-MM-DD podle místního času uživatele (ne UTC), aby sedělo s tím,
 * kdy aplikaci používal.
 *
 * @param date - Okamžik odeslání
 * @returns Např. „2026-10-21“
 */
export function formatFeedbackDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Volby odeslání: klíč Web3Forms, výsledek skrytého pole proti robotům a (v testech) vlastní fetch. */
interface SendFeedbackOptions {
  /** Přístupový klíč Web3Forms (z NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY); bez něj služba odpověď odmítne. */
  accessKey: string | undefined
  /** `true`, když robot vyplnil skryté pole — Web3Forms takovou odpověď zahodí. */
  botcheck?: boolean
  /** Funkce pro síťový požadavek; výchozí je globální fetch. */
  fetchFn?: typeof fetch
}

/**
 * Odešle zpětnou vazbu přes Web3Forms (POST s JSON). Nikdy nevyhodí výjimku: nefunkční připojení,
 * chyba serveru, odpověď, která není JSON, i odmítnutí služby (chybějící klíč, vyčerpaný měsíční
 * limit) skončí jako `false`, aby dialog mohl ukázat hlášku z Příkladu 11.
 *
 * @param fields - Pole zprávy z `buildFeedbackFields`
 * @param options - Klíč, botcheck a případně vlastní fetch
 * @returns `true`, když služba odpověď přijala
 */
export async function sendFeedback(fields: Record<string, string>, options: SendFeedbackOptions): Promise<boolean> {
  // Volání přes šipku: globální fetch zavolaný jako metoda cizího objektu by v prohlížeči selhal
  const { accessKey, botcheck = false, fetchFn = (input, init) => fetch(input, init) } = options

  // Bez klíče se požadavek přesto pošle — služba ho odmítne a uživatel uvidí stejnou hlášku jako
  // při jiné chybě; varování v konzoli řekne vývojáři, co chybí
  if (!accessKey) {
    console.warn('Org Flow feedback: NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY is not set, Web3Forms will reject the submission.')
  }

  try {
    const response = await fetchFn(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ access_key: accessKey ?? '', botcheck, ...fields }),
    })
    if (!response.ok) return false
    const data: unknown = await response.json()
    // Web3Forms odpovídá { success: true | false, message }; za úspěch se bere jen výslovné true
    return typeof data === 'object' && data !== null && (data as { success?: unknown }).success === true
  } catch {
    return false
  }
}
