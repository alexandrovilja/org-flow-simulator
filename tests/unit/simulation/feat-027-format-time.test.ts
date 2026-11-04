import { describe, it, expect } from 'vitest'
import { formatTime, formatDays, formatDaysValue, formatTimeShort } from '@/lib/formatTime'
import { chooseTimeNotation } from '@/lib/chooseTimeNotation'

// feat-027 (Čas simulace v pracovních dnech) — čistá logika zápisu času.
//
// Schválený kontrakt (spec features/feat-027-cas-simulace-pracovni-dny.md, Příklady 1–3, 6–8 a 18):
//  - Jednotka simulačního času je pracovní den (1 s = 1 den), týden má 5 pracovních dnů.
//  - `formatTime(days)` (Total Time): `2 weeks 4.3 days`. Dny se ZKRACUJÍ na desetinu (floor), nikdy nezaokrouhlují.
//    Část s týdny se vynechá při 0 týdnech, část se dny je vždy (i `0.0 days`). `week` je jednotné číslo jen pro
//    přesně 1 týden, `days` je vždy množné. Počítá se v celých desetinách dne, takže zbytek po odečtení týdnů
//    nevyjde o desetinu nižší kvůli plovoucí desetinné čárce.
//  - `formatDays(days)` (Done list, Compare): prosté dny s jednou desetinou, `9.1 days`. Zaokrouhluje stejně jako
//    dnešní `toFixed(1)` (doby trvání se oproti dnešku nemění, mění se jen jednotka), a `days` je vždy množné.
//  - `formatTimeShort(days)`: zkrácený zápis `2w 4.3d` pro dlaždice, kam se plná slova nevejdou; stejná čísla
//    jako `formatTime`.
//  - `chooseTimeNotation(fullWidth, availableWidth)` je čistá volba zápisu podle změřených šířek (px): plná
//    slova, když se vejdou, jinak zkratka. Bez rozměrů (jsdom, skrytý prvek: obě šířky 0) vždy plná slova.
// Nové moduly: `@/lib/chooseTimeNotation` (nový soubor), nové exporty `formatDays` a `formatTimeShort`
// v `@/lib/formatTime`.

/** Očekávaný zápis spočítaný jen z celých čísel (desetin dne), nezávisle na implementaci. */
function expectedFromTenths(tenths: number): string {
  const weeks = Math.floor(tenths / 50)
  const rest = tenths - weeks * 50
  const days = `${Math.floor(rest / 10)}.${rest % 10} days`
  if (weeks === 0) return days
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ${days}`
}

describe('feat-027 Příklad 1: délka pod týden', () => {
  it('4.3 pracovních dnů → „4.3 days“', () => {
    expect(formatTime(4.3)).toBe('4.3 days')
  })

  it('nula → „0.0 days“ (bez týdnů, ale se dny)', () => {
    expect(formatTime(0)).toBe('0.0 days')
  })

  it('zlomek pod desetinou dne se zkrátí na 0.0', () => {
    expect(formatTime(0.09)).toBe('0.0 days')
  })
})

describe('feat-027 Příklad 2: týdny a dny', () => {
  it.each([
    [14.3, '2 weeks 4.3 days'],
    [5, '1 week 0.0 days'],
    [10, '2 weeks 0.0 days'],
    [187.9, '37 weeks 2.9 days'],
  ])('%s pracovních dnů → „%s“', (days, expected) => {
    expect(formatTime(days)).toBe(expected)
  })

  it('„week“ je jednotné číslo jen pro přesně jeden týden, „days“ je vždy množné', () => {
    expect(formatTime(5.4)).toBe('1 week 0.4 days')
    expect(formatTime(10.4)).toBe('2 weeks 0.4 days')
    expect(formatTime(1)).toBe('1.0 days')
  })

  it('velké hodnoty: 104 týdnů se dvěma dny', () => {
    expect(formatTime(522.3)).toBe('104 weeks 2.3 days')
  })

  it('část se dny se zobrazuje vždy, i když je 0.0 (čítač nemění tvar při přechodu přes týden)', () => {
    expect(formatTime(15)).toBe('3 weeks 0.0 days')
    expect(formatTime(14.9)).toBe('2 weeks 4.9 days')
  })
})

describe('feat-027 Příklad 3: zkrácení místo zaokrouhlení', () => {
  it('4.96 → „4.9 days“, 4.999 → „4.9 days“ (nikdy „5.0 days“)', () => {
    expect(formatTime(4.96)).toBe('4.9 days')
    expect(formatTime(4.999)).toBe('4.9 days')
  })

  it('9.99 → „1 week 4.9 days“; 14.99 → „2 weeks 4.9 days“', () => {
    expect(formatTime(9.99)).toBe('1 week 4.9 days')
    expect(formatTime(14.99)).toBe('2 weeks 4.9 days')
  })

  it('zbytek po odečtení týdnů se nikdy nezobrazí jako „5.0 days“', () => {
    for (let tenths = 0; tenths <= 3000; tenths++) {
      expect(formatTime(tenths / 10 + 0.099)).not.toContain('5.0 days')
    }
  })

  it('hodnoty zadané v desetinách se po odečtení týdnů zobrazí přesně (bez chyby plovoucí desetinné čárky)', () => {
    // 6.3 − 5 = 1.2999999999999998 v plovoucí čárce, správně je „1 week 1.3 days“
    expect(formatTime(6.3)).toBe('1 week 1.3 days')
    expect(formatTime(14.3)).toBe('2 weeks 4.3 days')
    expect(formatTime(187.9)).toBe('37 weeks 2.9 days')
    // všechny desetiny od 0.0 do 300.0 dne (60 týdnů)
    for (let tenths = 0; tenths <= 3000; tenths++) {
      expect(formatTime(tenths / 10), `${tenths / 10} dní`).toBe(expectedFromTenths(tenths))
    }
  })

  it('hodnota mezi desetinami se zkrátí na nižší desetinu (celý rozsah)', () => {
    for (let tenths = 0; tenths <= 3000; tenths++) {
      expect(formatTime(tenths / 10 + 0.05), `${tenths / 10 + 0.05} dní`).toBe(expectedFromTenths(tenths))
    }
  })
})

describe('feat-027 Příklady 6–8: prosté dny', () => {
  it.each([
    [9.1, '9.1 days'],
    [24.1, '24.1 days'],
    [12.4, '12.4 days'],
    [117.3, '117.3 days'],
    [0, '0.0 days'],
    [1, '1.0 days'],
  ])('%s → „%s“', (days, expected) => {
    expect(formatDays(days)).toBe(expected)
  })

  it('nepřevádí na týdny, ani když je víc než pět dnů', () => {
    expect(formatDays(37.4)).toBe('37.4 days')
    expect(formatDays(37.4)).not.toContain('week')
  })

  it('zaokrouhluje na desetinu jako dnešní toFixed(1), na rozdíl od Total Time, který zkracuje', () => {
    expect(formatDays(9.16)).toBe('9.2 days')
    expect(formatDays(9.14)).toBe('9.1 days')
    expect(formatTime(4.96)).toBe('4.9 days')
    expect(formatDays(4.96)).toBe('5.0 days')
  })
})

describe('feat-027 review: číslo doby trvání bez jednotky', () => {
  it.each([
    [9.1, '9.1'],
    [0, '0.0'],
    [117.3, '117.3'],
    [9.16, '9.2'],
    [9.14, '9.1'],
  ])('%s → „%s“ (dlaždice si jednotku kreslí zvlášť)', (days, expected) => {
    expect(formatDaysValue(days)).toBe(expected)
  })

  it('formatDays je číslo z formatDaysValue + „ days“ (jedno pravidlo zaokrouhlení)', () => {
    for (const days of [0, 1, 4.96, 9.14, 9.16, 117.35]) {
      expect(formatDays(days)).toBe(`${formatDaysValue(days)} days`)
    }
  })
})

describe('feat-027 Příklad 18: zkrácený zápis „w“ a „d“', () => {
  it.each([
    [187.9, '37w 2.9d'],
    [14.3, '2w 4.3d'],
    [5, '1w 0.0d'],
    [10, '2w 0.0d'],
    [9.99, '1w 4.9d'],
  ])('%s → „%s“', (days, expected) => {
    expect(formatTimeShort(days)).toBe(expected)
  })

  it('týdny se vynechají jako u plného zápisu, dny zůstanou i při nule', () => {
    expect(formatTimeShort(4.3)).toBe('4.3d')
    expect(formatTimeShort(0)).toBe('0.0d')
    expect(formatTimeShort(4.999)).toBe('4.9d')
  })

  it('má stejná čísla jako plný zápis v celém rozsahu (jen slova nahradí zkratkou)', () => {
    for (let tenths = 0; tenths <= 3000; tenths++) {
      const full = formatTime(tenths / 10)
      const short = full.replace(/ weeks?/, 'w').replace(/ days/, 'd')
      expect(formatTimeShort(tenths / 10), `${tenths / 10} dní`).toBe(short)
    }
  })
})

describe('feat-027 Příklad 18: volba zápisu podle změřených šířek', () => {
  it('plná slova, když se vejdou do dlaždice', () => {
    // Compare při šířce okna 1440 px: k dispozici 194 px, „2 weeks 4.3 days“ potřebuje 121 px
    expect(chooseTimeNotation(121, 194)).toBe('full')
    // pravý sloupec Advanced: k dispozici 221 px, nejdelší zápis 171 px
    expect(chooseTimeNotation(171, 221)).toBe('full')
  })

  it('zkratka, když se plná slova nevejdou', () => {
    // Compare při šířce okna 1024 px: k dispozici 125 px, „104 weeks 0.4 days“ potřebuje 145 px
    expect(chooseTimeNotation(145, 125)).toBe('short')
    expect(chooseTimeNotation(204, 125)).toBe('short')
  })

  it('přesné vejití ještě znamená plná slova', () => {
    expect(chooseTimeNotation(125, 125)).toBe('full')
  })

  it('bez rozměrů (obě šířky 0: jsdom, skrytý prvek) vždy plná slova', () => {
    expect(chooseTimeNotation(0, 0)).toBe('full')
  })

  it('rozhodnutí je čistá funkce: stejné vstupy dají vždy stejný zápis (žádná paměť mezi voláními)', () => {
    expect(chooseTimeNotation(145, 125)).toBe('short')
    expect(chooseTimeNotation(121, 125)).toBe('full')
    expect(chooseTimeNotation(145, 125)).toBe('short')
  })
})
