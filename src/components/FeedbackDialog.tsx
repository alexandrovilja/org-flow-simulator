import { useEffect, useId, useRef, type FormEvent } from 'react'
import type { FeedbackDraft, FeedbackErrors, FeedbackStatus } from '@/types/feedback'
import { FEEDBACK_MAX_TEXT_LENGTH, FEEDBACK_ROLE_OPTIONS } from '@/lib/feedback'
import { Button } from '@/components/Button'
import { RatingScale } from '@/components/RatingScale'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useModalFocus } from '@/hooks/useModalFocus'
import styles from './FeedbackDialog.module.css'

/**
 * Zásady ochrany osobních údajů služby, přes kterou zpětná vazba odchází (odkaz v poznámce).
 * Ověřeno 2026-10-21: stránka „Privacy Policy - Web3Forms“ pokrývá i zpracování odpovědí z formulářů.
 */
const WEB3FORMS_PRIVACY_URL = 'https://web3forms.com/privacy'

/** Props dialogu zpětné vazby. Dialog je řízený zvenku: stav formuláře i fázi drží Simulator. */
interface FeedbackDialogProps {
  /** Rozepsaná zpětná vazba (role, hodnocení, texty, rozhovor, e-mail). */
  draft: FeedbackDraft
  /** Každá změna formuláře pošle celý nový koncept. */
  onDraftChange: (draft: FeedbackDraft) => void
  /** Fáze dialogu: vyplňování, odesílání, odesláno, chyba. */
  status: FeedbackStatus
  /** Hlášky k tlačítkům a k poli Email; prázdný objekt = žádné. */
  errors: FeedbackErrors
  /** E-mail, na který se autor ozve kvůli rozhovoru — doplní poděkování; `null` = bez rozhovoru. */
  callEmail: string | null
  /** Kliknutí na Send (nebo Enter v poli Email); `botcheck` = robot vyplnil skryté pole. */
  onSend: (botcheck: boolean) => void
  /** Cancel, Close nebo Esc — dialog se zavře, koncept zůstane. */
  onClose: () => void
}

/**
 * Dialog „Send feedback“ (feat-024). Formulář s rolí, hodnocením 1–5, dvěma texty, zájmem
 * o rozhovor a e-mailem; po odeslání poděkování. Vzorem je potvrzovací dialog `ConfirmOverlay`:
 * závoj v barvě stránky, karta design systému, fokus uvnitř dialogu, Esc zavírá a fokus se po
 * zavření vrátí tam, odkud uživatel přišel (ikona bubliny v liště).
 *
 * @param props - Koncept, fáze, hlášky a obsluha změn, odeslání a zavření
 * @returns Modální dialog přes celou aplikaci
 */
export function FeedbackDialog({ draft, onDraftChange, status, errors, callEmail, onSend, onClose }: FeedbackDialogProps) {
  const ids = {
    title: useId(),
    role: useId(),
    rating: useId(),
    helped: useId(),
    missing: useId(),
    email: useId(),
    emailError: useId(),
  }
  const cardRef = useRef<HTMLDivElement>(null)
  // Skryté pole proti robotům: člověk ho nevidí ani na něj nedosáhne, robot vyplňující formuláře ano
  const honeypotRef = useRef<HTMLInputElement>(null)
  // Nadpis poděkování — po odeslání na něj přejde fokus, aby ho čtečka obrazovky přečetla
  const thanksRef = useRef<HTMLHeadingElement>(null)

  // Fokus na první prvek dialogu, Tab cyklí uvnitř, Esc zavře, po zavření se fokus vrátí na ikonu;
  // je-li pod dialogem jiný (potvrzovací) dialog, klávesy patří jen tomuto
  useModalFocus(cardRef, onClose)

  // Po odeslání tlačítko Send zmizí; bez přesunu by fokus spadl mimo dialog a poděkování by nikdo nepřečetl
  useEffect(() => {
    if (status === 'sent') thanksRef.current?.focus()
  }, [status])

  /** Změní jedno pole konceptu a pošle nový koncept nahoru. */
  const update = <K extends keyof FeedbackDraft>(key: K, value: FeedbackDraft[K]) => {
    onDraftChange({ ...draft, [key]: value })
  }

  /** Enter v poli formuláře odešle stejně jako tlačítko Send. */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (status !== 'sending') onSend((honeypotRef.current?.value ?? '') !== '')
  }

  const sending = status === 'sending'

  return (
    <div className={styles.overlay}>
      <div ref={cardRef} className={styles.card} role="dialog" aria-modal="true" aria-labelledby={ids.title}>
        {status === 'sent' ? (
          // Poděkování nahradí formulář; při zájmu o rozhovor řekne, kam se autor ozve
          <div className={styles.thanks}>
            <h2 ref={thanksRef} id={ids.title} tabIndex={-1} className={[styles.title, styles.thanksTitle].join(' ')}>
              {/* Fajfka v barvě „hotovo“ — stejný znak jako u ✓ Done, potvrzuje, že odeslání proběhlo */}
              <span className={styles.check} aria-hidden="true">✓</span>
              Thanks for your feedback.
            </h2>
            {callEmail !== null && (
              <p className={styles.intro}>The author will email you at {callEmail} to set up a call.</p>
            )}
            <div className={styles.footer}>
              <Button variant="strong" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <header className={styles.header}>
              <h2 id={ids.title} className={styles.title}>Send feedback</h2>
              <p className={styles.intro}>Takes a minute. Goes straight to the author.</p>
            </header>

            {/* Během odesílání jsou pole zamčená: změna by se neodeslala a po úspěchu by se formulář vyprázdnil */}
            <fieldset className={styles.fields} disabled={sending}>
              <div className={styles.field}>
                <span id={ids.role} className={styles.label}>Your role</span>
                <SegmentedControl
                  fullWidth
                  labelledBy={ids.role}
                  options={FEEDBACK_ROLE_OPTIONS}
                  value={draft.role}
                  // Klik na už vybranou roli výběr zruší — role je nepovinná (Příklad 5)
                  onChange={role => update('role', role === draft.role ? null : role)}
                />
              </div>

              <div className={styles.field}>
                <span id={ids.rating} className={styles.label}>How useful is Org Flow Simulator for your work?</span>
                <RatingScale labelId={ids.rating} value={draft.rating} onChange={rating => update('rating', rating)} />
              </div>

              <div className={styles.field}>
                <label htmlFor={ids.helped} className={styles.label}>What helped you most?</label>
                <textarea
                  id={ids.helped}
                  className={styles.textarea}
                  rows={3}
                  maxLength={FEEDBACK_MAX_TEXT_LENGTH}
                  placeholder="Compare mode made the cost of handoffs obvious to my managers."
                  value={draft.helped}
                  onChange={e => update('helped', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor={ids.missing} className={styles.label}>What&apos;s missing or what would you improve?</label>
                <textarea
                  id={ids.missing}
                  className={styles.textarea}
                  rows={3}
                  maxLength={FEEDBACK_MAX_TEXT_LENGTH}
                  placeholder="I'd like to save a team setup for my next workshop."
                  value={draft.missing}
                  onChange={e => update('missing', e.target.value)}
                />
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={draft.openToCall}
                  onChange={e => update('openToCall', e.target.checked)}
                />
                I&apos;m open to a 20-min call with the author
              </label>

              <div className={styles.field}>
                <label htmlFor={ids.email} className={styles.label}>
                  Email{' '}
                  <span className={styles.labelHint}>
                    {draft.openToCall ? '(required for the call)' : '(optional, for a reply)'}
                  </span>
                </label>
                <input
                  id={ids.email}
                  type="email"
                  autoComplete="email"
                  className={[styles.input, errors.email && styles.inputError].filter(Boolean).join(' ')}
                  placeholder="name@company.com"
                  value={draft.email}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? ids.emailError : undefined}
                  onChange={e => update('email', e.target.value)}
                />
                {errors.email && (
                  <p id={ids.emailError} className={styles.error} role="alert">{errors.email}</p>
                )}
              </div>

              {/* Past na roboty (Web3Forms botcheck): mimo obrazovku, mimo Tab i mimo čtečku obrazovky */}
              <div className={styles.honeypot} aria-hidden="true">
                <label>
                  Leave this field empty
                  <input ref={honeypotRef} type="text" name="botcheck" tabIndex={-1} autoComplete="off" defaultValue="" />
                </label>
              </div>
            </fieldset>

            <p className={styles.note}>
              Your answers are emailed to Ilja Alexandrov, the author of Org Flow Simulator, through{' '}
              <a href={WEB3FORMS_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>Web3Forms</a>.
              Along with them we send the mode you&apos;re in and today&apos;s date. Nothing else.
              Your email is used only to reply to you.
            </p>

            <div className={styles.footer}>
              {/* Hláška k celému formuláři (prázdný formulář, chyba odeslání) stojí u tlačítek, kam se uživatel dívá */}
              <p className={styles.formMessage} role="alert">
                {status === 'error'
                  ? "Couldn't send your feedback. Check your connection and try again."
                  : errors.form ?? ''}
              </p>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="strong" disabled={sending}>
                {sending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
