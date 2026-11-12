# Koncepty testů módu Organization (feat-028 až feat-036)

Tyto soubory jsou **koncept testů** z fáze TDD z 2026-11-11, napsaný ještě pro celou feature „Týmy složené z lidí“. Má 185 testů a pokrývá všech 107 scénářů z [`docs/feat-028-test-analysis.md`](../feat-028-test-analysis.md). Feature se pak rozdělila na 9 inkrementů (feat-028 až feat-036).

- Soubory mají příponu `.txt`, aby je nespouštěl Vitest ani Playwright a nekontroloval typecheck a ESLint. Odkazují na rozhraní, které ještě neexistuje.
- Testy inkrementu 1 (feat-028) jsou v `tests/` a jen v nich platí kontrakt.
- Když začne fáze TDD dalšího inkrementu, vezmou se odtud jeho bloky `describe` (podle čísel scénářů v názvech), upraví se na tehdejší stav kódu a přesunou se do `tests/`. Teprve potom se schvalují.

## Které bloky patří ke kterému inkrementu

| Inkrement | Spec | Scénáře |
|---|---|---|
| 1 | feat-028 Mandáty a tok práce | A1, A2, A4, A5, B1–B4, C1, C2, D1–D7, D10, D11, D14, F1–F3, F6–F9 (bez výnosu a Idle Time), H5, H8 (bez výnosu), I1–I4, I6, I7, J2, J9–J11 |
| 2 | feat-029 Proč práce čeká | B5, E1–E5, H1–H4, H6, H7, J1 a části D2, D3, D5, D10, D11 o Idle Time; Idle Time v F6–F9 |
| 3 | feat-030 Úpravy týmů a lidí | B6–B11, B22, C3, C5, C7, C9, C10, D13, E6, J3, J4, J8 |
| 4 | feat-031 Nastavení backlogu | A6–A9, A11, C11, I5 a rozsahy v A2 |
| 5 | feat-032 Min units po týmech | B21, D8, D9, D15 a část F3 s D15 |
| 6 | feat-033 Výnosy | F4, F5 a výnosové části A2, F6, H5, H7, H8 a snapshotu v I3 |
| 7 | feat-034 Timeline hotové featury | G1–G3, G5, G6, J7 |
| 8 | feat-035 AI na skillech lidí | B12, B13, D12, G4 |
| 9 | feat-036 Vlastní skilly a oblasti | A3, A10, B14–B20, B15b, C4, C6, C8, J5, J6 a editory v I1 |
