import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { THEME_INIT_SCRIPT } from '@/lib/themeInitScript'
import './globals.css'

export const metadata: Metadata = {
  title: 'Org Flow Simulator',
  description: 'Same backlog, different team structure — visible Lead Time difference',
}

// Písmo aplikace (feat-021, feat-023): jediné písmo je JetBrains Mono. next/font ho stáhne při buildu a přibalí
// k aplikaci, takže funguje i na workshopu bez internetu a stránka se nepřekresluje po načtení písma.
// Vystaví CSS proměnnou --font-jetbrains-mono, na kterou odkazuje token --font-mono v globals.css.

/** JetBrains Mono — všechen text: titulky, tlačítka a záložky (800, verzálky), jména a obsah, čísla i souvislé věty. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT nastaví data-theme na <html> dřív, než React
    // stránku převezme, takže se atribut liší od HTML ze serveru — to je záměr, ne chyba
    <html lang="en" className={jetbrainsMono.variable} suppressHydrationWarning>
      <head>
        {/* Téma před prvním vykreslením (feat-021): bez probliknutí světlé stránky v tmavém režimu.
            Jediná výjimka z pravidla „localStorage jen přes storage.ts“ — viz themeInitScript.ts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
