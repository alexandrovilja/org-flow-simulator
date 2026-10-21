import type { AppMode } from '@/types/simulation'

/**
 * Názvy módů tak, jak je uživatel vidí na záložkách horní lišty. Jedno místo pro lištu i pro
 * zpětnou vazbu, která autorovi posílá, ve kterém módu uživatel byl (feat-024).
 */
export const MODE_LABELS: Record<AppMode, string> = {
  compare: 'Compare',
  experiment: 'Advanced',
  cashflow: 'Cash Flow',
}
