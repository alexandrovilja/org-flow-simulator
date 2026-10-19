import type { Metadata } from 'next'
import { Archivo, JetBrains_Mono, Kalam } from 'next/font/google'
import './globals.css'

export const metadata: Metadata = {
  title: 'Org Flow Simulator',
  description: 'Same backlog, different team structure — visible Lead Time difference',
}

// Písma design systému Org Flow (feat-021). next/font je stáhne při buildu a přibalí k aplikaci,
// takže fungují i na workshopu bez internetu a stránka se nepřekresluje po načtení písma.
// Každé písmo vystaví CSS proměnnou, na kterou odkazují tokeny --font-* v globals.css.

/** Archivo — titulky (800, verzálky) i běžný text UI. */
const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
})

/** JetBrains Mono — popisky, čísla a ID features (tabulkové číslice). */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

/** Kalam — jediná ručně psaná poznámka kouče (rám výsledku). */
const kalam = Kalam({
  subsets: ['latin', 'latin-ext'],
  weight: ['700'],
  variable: '--font-kalam',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable} ${kalam.variable}`}>
      <body>{children}</body>
    </html>
  )
}
