import { THEME_KEY } from '@/lib/storage'

/**
 * Malý skript, který `layout.tsx` vloží inline do `<head>` (feat-021, Příklad 5). Prohlížeč ho spustí
 * dřív, než vykreslí první pixel, a nastaví `data-theme` na `<html>`: uloženou volbu uživatele, nebo
 * bez ní nastavení systému (`prefers-color-scheme`). Bez něj by stránka v tmavém režimu na okamžik
 * problikla světle, než se načte React.
 *
 * Je to jediná vědomá výjimka z pravidla „localStorage jen přes storage.ts“: skript běží před
 * načtením modulů aplikace, takže storage.ts zavolat nemůže. Používá ale stejný klíč (`THEME_KEY`)
 * a stejnou kontrolu platné hodnoty jako `loadThemePreference`.
 *
 * Celé je to v try/catch: když prohlížeč úložiště zakáže (anonymní okno, blokovaná data webu),
 * stránka se vykreslí ve světlém tématu z `:root` místo chyby.
 */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var theme = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    if (theme !== 'light' && theme !== 'dark') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();`
