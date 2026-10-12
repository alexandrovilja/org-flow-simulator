import { computeRevenueAsOf } from '@/simulation/engine'
import type { Feature, RevenueProfile } from '@/types/simulation'

/**
 * Minimální data jedné dokončené featury potřebná k dopočtu výnosu k libovolnému času.
 * `revenueProfile` je nepovinný, aby fungovaly i starší snapshoty (chybějící = Flat).
 */
export type RunFeatureRevenue = Pick<Feature, 'finishedAt' | 'revenuePerTick'> & { revenueProfile?: RevenueProfile }

/** Výnosová data aktuálního běhu Cash Flow simulace — vstup pro `computeRevenueComparison`. */
export interface CurrentRunRevenue {
  /** true = běh doběhl do konce (celý backlog zpracován); jen pak lze srovnávat. */
  finished: boolean
  /** Aktuální simulační čas běhu v sekundách. */
  simTime: number
  /** Kumulativní výnos běhu k aktuálnímu času. */
  totalRevenue: number
  /** Všechny dokončené featury (včetně vytěsněných z displaye — `done` + `doneOverflow`). */
  features: RunFeatureRevenue[]
}

/** Uložený výnosový snapshot předchozího doběhnutého běhu (podmnožina `CashFlowRunSnapshot`). */
export interface PreviousRunRevenue {
  /** Celkový čas předchozího běhu v sekundách. */
  totalTime: number
  /** Celkový výnos předchozího běhu za celý jeho čas. */
  totalRevenue: number
  /** Dokončené featury předchozího běhu pro zpětný dopočet výnosu. */
  doneFeatures: RunFeatureRevenue[]
}

/**
 * Srovnání s předchozím během ve společném čase. Existuje jen po doběhnutí aktuálního běhu
 * a když je s čím srovnávat — proto je celý objekt v `RevenueComparison` nepovinný.
 */
export interface RevenueTimeMatch {
  /** Společný čas `min(časy obou běhů)` v sekundách. */
  compareTime: number
  /** % změna oproti předchozímu běhu ve společném čase; undefined = bez delty (dělení nulou). */
  delta?: number
  /** Předchozí běh: jeho výnos ve společném čase a jeho vlastní celkový výnos a čas. */
  previous: { revenueAtCompare: number; totalRevenue: number; totalTime: number }
}

/**
 * Hodnoty dlaždice „Revenue (time-matched)“: velké číslo, srovnání a data pro rozbalený detail.
 */
export interface RevenueComparison {
  /** Velké číslo dlaždice: kumulativní výnos běhu, nebo po srovnání výnos ve společném čase. */
  value: number
  /** Skutečný celkový výnos aktuálního běhu a jeho čas (zobrazuje se v detailu). */
  currentTotal: { revenue: number; time: number }
  /** Srovnání ve společném čase; undefined, dokud se nesrovnává (běh běží, nebo není předchozí běh). */
  comparison?: RevenueTimeMatch
}

/**
 * Spočítá hodnoty dlaždice „Revenue (time-matched)“. Důvod: celkový výnos běhu přestane růst,
 * jakmile je backlog hotový, takže rychlejší tým by měl na konci nižší číslo než pomalejší.
 * Proto se po doběhnutí obou běhů porovnává výnos ve stejném čase (kratší z obou časů).
 *
 * @param current - Výnosová data aktuálního běhu
 * @param previous - Snapshot předchozího doběhnutého běhu, nebo `null`, když žádný není
 * @returns Hodnoty dlaždice; bez srovnání je `value` prostý kumulativní výnos aktuálního běhu
 */
export function computeRevenueComparison(
  current: CurrentRunRevenue,
  previous: PreviousRunRevenue | null,
): RevenueComparison {
  const currentTotal = { revenue: current.totalRevenue, time: current.simTime }

  // Srovnávat lze až po doběhnutí aktuálního běhu a jen když existuje předchozí běh
  if (!current.finished || previous === null) {
    return { value: current.totalRevenue, currentTotal }
  }

  // Obě strany se vyhodnotí ve stejném čase; delší běh se dopočte zpětně z `finishedAt`
  const compareTime = Math.min(current.simTime, previous.totalTime)
  // Když je společný čas konec vlastního běhu, platí skutečně nasbíraný výnos — uzavřený dopočet
  // by se mohl o tik rozejít se simulací kvůli zaokrouhlení času a „Total“ v detailu by nesedělo
  const value = compareTime >= current.simTime
    ? current.totalRevenue
    : computeRevenueAsOf(current.features, compareTime)
  // Stejné pravidlo i pro předchozí běh: identické běhy se tak srovnají přesně (delta 0), ne s float šumem
  const revenueAtCompare = compareTime >= previous.totalTime
    ? previous.totalRevenue
    : computeRevenueAsOf(previous.doneFeatures, compareTime)

  // Nulový výnos předchozího běhu: procentuální změna z nuly nedává smysl, delta se vynechá
  const delta = revenueAtCompare === 0 ? undefined : ((value - revenueAtCompare) / revenueAtCompare) * 100

  return {
    value,
    currentTotal,
    comparison: {
      compareTime,
      delta,
      previous: { revenueAtCompare, totalRevenue: previous.totalRevenue, totalTime: previous.totalTime },
    },
  }
}
