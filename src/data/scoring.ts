import type { Severity } from '../utils/model'

export const SCORING = {
  start: 100,
  floor: 0,
  weights: {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
    info: 0,
  } satisfies Record<Severity, number>,
  fullFindingsPerRule: 2,
  furtherFindingFactor: 0.25,
  grades: {
    A: { min: 90, max: 100 },
    B: { min: 80, max: 89 },
    C: { min: 65, max: 79 },
    D: { min: 50, max: 64 },
    F: { min: 0, max: 49 },
  },
  criticalCap: 'D' as const,
  multiCriticalGrade: 'F' as const,
  multiCriticalCount: 2,
  highPreventsA: true,
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']
