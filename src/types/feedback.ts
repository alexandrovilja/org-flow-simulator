/**
 * Role, kterou si uživatel v dialogu zpětné vazby může vybrat (feat-024). Hodnota se posílá
 * autorovi, aby věděl, z jakého pohledu odpověď přichází.
 */
export type FeedbackRole = 'ai-coach' | 'agile-coach' | 'manager' | 'other'

/** Hodnocení užitečnosti na škále 1–5 (1 = Not useful, 5 = Extremely useful). */
export type FeedbackRating = 1 | 2 | 3 | 4 | 5

/**
 * Rozepsaná zpětná vazba — vše, co uživatel v dialogu vyplnil. Drží se jen v paměti, takže
 * přežije zavření a nové otevření dialogu, ale ne obnovení stránky (feat-024, Příklad 12).
 */
export interface FeedbackDraft {
  /** Vybraná role; `null` = nevybráno (role je nepovinná). */
  role: FeedbackRole | null
  /** Vybrané hodnocení; `null` = nevybráno (hodnocení je nepovinné). */
  rating: FeedbackRating | null
  /** Text pole „What helped you most?“. */
  helped: string
  /** Text pole „What's missing or what would you improve?“. */
  missing: string
  /** Zaškrtávátko „I'm open to a 20-min call with the author“. */
  openToCall: boolean
  /** E-mail pro odpověď; povinný jen při zájmu o rozhovor. */
  email: string
}

/**
 * Fáze dialogu: vyplňování, probíhající odeslání, úspěšně odesláno, nebo chyba při odeslání.
 * Podle ní dialog ukáže formulář, „Sending…“, poděkování nebo chybovou hlášku.
 */
export type FeedbackStatus = 'editing' | 'sending' | 'sent' | 'error'

/**
 * Hlášky ke konkrétním místům formuláře. Chybějící klíč = žádná hláška.
 * `form` patří k tlačítkům (prázdný formulář), `email` k poli Email.
 */
export interface FeedbackErrors {
  /** Hláška u tlačítek, např. „Add a rating or a comment first.“. */
  form?: string
  /** Hláška u pole Email, např. „Check your email address.“. */
  email?: string
}
