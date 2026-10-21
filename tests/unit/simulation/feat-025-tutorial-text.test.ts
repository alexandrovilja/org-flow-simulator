import { describe, it, expect } from 'vitest'
import { splitTutorialText } from '@/lib/tutorialText'

// feat-025 (Revize tutoriálu) — odkazy v textech kroků.
//
// Schválený kontrakt: features/feat-025-revize-tutorialu.md (Technical Notes, „Odkazy“).
//  - Text a odrážky kroku mohou obsahovat odkazy ve tvaru `[popisek](https://…)`.
//  - `splitTutorialText(text)` v `src/lib/tutorialText.ts` rozdělí text na části: obyčejný text
//    `{ kind: 'text', text }` a odkaz `{ kind: 'link', label, href }`. Overlay z nich vykreslí
//    `<a target="_blank" rel="noopener noreferrer">` (viz feat-025-tutorial-overlay).
//  - Odkazem se stane jen adresa `https://…`. Cokoli jiného (http, javascript:, neúplný zápis)
//    zůstane beze změny jako obyčejný text — konfigurace kroků je statická, ale pravidlo brání
//    tomu, aby se do karty omylem dostal nebezpečný odkaz.
//  - Prázdné textové části se nevracejí.

describe('feat-025: splitTutorialText — odkazy v textu kroku', () => {
  it('text bez odkazu vrátí jako jednu textovou část', () => {
    expect(splitTutorialText('Plain text, no links.')).toEqual([{ kind: 'text', text: 'Plain text, no links.' }])
  })

  it('odkaz uprostřed věty rozdělí text na text, odkaz a text', () => {
    expect(splitTutorialText('Inspired by a [traffic simulator](https://traffic-simulation.de/) and more.')).toEqual([
      { kind: 'text', text: 'Inspired by a ' },
      { kind: 'link', label: 'traffic simulator', href: 'https://traffic-simulation.de/' },
      { kind: 'text', text: ' and more.' },
    ])
  })

  it('dva odkazy v jednom textu vrátí oba ve správném pořadí', () => {
    expect(splitTutorialText('[A](https://a.example/) and [B](https://b.example/x)')).toEqual([
      { kind: 'link', label: 'A', href: 'https://a.example/' },
      { kind: 'text', text: ' and ' },
      { kind: 'link', label: 'B', href: 'https://b.example/x' },
    ])
  })

  it('odkaz na konci věty s tečkou za ním', () => {
    expect(splitTutorialText('I recommend [Org Topologies](https://www.orgtopologies.com).')).toEqual([
      { kind: 'text', text: 'I recommend ' },
      { kind: 'link', label: 'Org Topologies', href: 'https://www.orgtopologies.com' },
      { kind: 'text', text: '.' },
    ])
  })

  it('popisek s diakritikou zůstane beze změny', () => {
    expect(splitTutorialText('[Robert Batůšek](https://www.batusek.cz/en/)')).toEqual([
      { kind: 'link', label: 'Robert Batůšek', href: 'https://www.batusek.cz/en/' },
    ])
  })

  it.each([
    ['http (ne https)', 'See [site](http://example.com) now.'],
    ['javascript:', 'Click [here](javascript:alert(1)) now.'],
    ['neúplný zápis', 'Broken [label](https://example.com and text.'],
    ['hranaté závorky bez adresy', 'Use [brackets] in text.'],
  ])('%s zůstane obyčejným textem', (_case, text) => {
    expect(splitTutorialText(text)).toEqual([{ kind: 'text', text }])
  })

  it('prázdný text vrátí prázdný seznam', () => {
    expect(splitTutorialText('')).toEqual([])
  })
})
