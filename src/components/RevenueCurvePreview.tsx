import { revenueMultiplier, revenuePlateau } from '@/simulation/engine'
import { REVENUE_PROFILE_INFO } from '@/lib/revenueProfiles'
import type { RevenueProfile } from '@/types/simulation'
import styles from './RevenueCurvePreview.module.css'

/** Vstupní props komponenty RevenueCurvePreview. */
interface RevenueCurvePreviewProps {
  /** Profil, jehož tvar se kreslí. */
  profile: RevenueProfile
}

// Rozměry náhledu v jednotkách viewBoxu (SVG se roztáhne na šířku sloupce).
const WIDTH = 250
const HEIGHT = 46
/** Okraj, aby tlustá čára křivky na krajích nebyla oříznutá. */
const PAD = 3
/** Kolik ticků osa X zobrazuje (0–16 ticků = 48 s simulačního času). */
const MAX_TICK = 16
/** Horní hranice osy Y v násobcích základního výnosu — sdílená pro všechny profily, aby šlo vidět J-plató 2×. */
const MAX_MULTIPLIER = 2

/**
 * Převede násobek základního výnosu na souřadnici Y v SVG (osa Y míří dolů, takže vyšší násobek = menší y).
 *
 * @param multiplier - Násobek základního výnosu (0 až MAX_MULTIPLIER)
 * @returns Souřadnice y ve viewBoxu
 */
function toY(multiplier: number): number {
  return HEIGHT - PAD - (multiplier / MAX_MULTIPLIER) * (HEIGHT - 2 * PAD)
}

/**
 * Sestaví hodnotu atributu `points` pro křivku jednoho profilu: pro každý tik 0–16 spočítá násobek
 * stejnou funkcí, kterou používá engine.
 *
 * @param profile - Profil, jehož křivka se kreslí
 * @returns Řetězec bodů `x,y x,y …` pro SVG polyline
 */
function buildCurvePoints(profile: RevenueProfile): string {
  return Array.from({ length: MAX_TICK + 1 }, (_, k) => {
    const x = PAD + (k / MAX_TICK) * (WIDTH - 2 * PAD)
    return `${x.toFixed(1)},${toY(revenueMultiplier(profile, k)).toFixed(1)}`
  }).join(' ')
}

/** Body křivek se spočítají jednou při načtení modulu — existují jen tři a nemění se, zatímco se panel
 *  za běhu simulace překresluje ~60× za sekundu. Záznam je typově vyčerpávající. */
const CURVE_POINTS: Record<RevenueProfile, string> = {
  'flat': buildCurvePoints('flat'),
  'j-curve': buildCurvePoints('j-curve'),
  's-curve': buildCurvePoints('s-curve'),
}

/** Y souřadnice tečkované čáry úrovně Flat (1× základní výnos). */
const FLAT_LEVEL_Y = toY(1)

/**
 * Malý graf tvaru výnosové křivky zvoleného profilu (feat-017): násobek základního výnosu v čase
 * po dodání featury, tiky 0–16 na sdílené ose 0–2×. Tečkovaná čára značí úroveň Flat (1×), takže
 * je vidět, kde J-curve Flat překročí a že S-curve na něj dospěje. Je to jediné místo v aplikaci,
 * kde se tvar křivky kreslí — všechny featury v backlogu mají tentýž tvar.
 *
 * @param profile - Profil, jehož křivka se vykreslí
 */
export function RevenueCurvePreview({ profile }: RevenueCurvePreviewProps) {
  return (
    <div className={styles.wrap}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Revenue curve preview: ${REVENUE_PROFILE_INFO[profile].label}`}
      >
        <line data-testid="flat-level-line" className={styles.flatLine} x1={0} x2={WIDTH} y1={FLAT_LEVEL_Y} y2={FLAT_LEVEL_Y} />
        <text className={styles.flatLabel} x={2} y={FLAT_LEVEL_Y - 2}>Flat level</text>
        <polyline data-testid="revenue-curve-line" className={styles.curve} points={CURVE_POINTS[profile]} />
      </svg>
      <div className={styles.caption}>
        {`Revenue per tick after delivery · 0–${MAX_TICK} ticks · plateau ${revenuePlateau(profile)}× Flat`}
      </div>
    </div>
  )
}
