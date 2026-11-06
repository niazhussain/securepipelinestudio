import { SCORING } from '../data/scoring'
import type { Finding, Grade, Severity } from './model'

const RANK: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 }

export function worseGrade(left: Grade, right: Grade): Grade {
  return RANK[left] >= RANK[right] ? left : right
}

export function gradeFromScore(score: number): Grade {
  if (score >= SCORING.grades.A.min) return 'A'
  if (score >= SCORING.grades.B.min) return 'B'
  if (score >= SCORING.grades.C.min) return 'C'
  if (score >= SCORING.grades.D.min) return 'D'
  return 'F'
}

export function applyGradeCaps(score: number, findings: { severity: Severity }[]): Grade {
  let grade = gradeFromScore(score)
  const criticals = findings.filter((finding) => finding.severity === 'critical').length
  const highs = findings.filter((finding) => finding.severity === 'high').length
  if (SCORING.highPreventsA && highs > 0 && grade === 'A') grade = 'B'
  if (criticals >= 1) grade = worseGrade(grade, SCORING.criticalCap)
  if (criticals >= SCORING.multiCriticalCount) grade = SCORING.multiCriticalGrade
  return grade
}

export function scoreFindings(findings: Pick<Finding, 'ruleId' | 'severity' | 'line' | 'column'>[]): {
  score: number
  grade: Grade
} {
  const sorted = [...findings].sort(
    (a, b) => a.ruleId.localeCompare(b.ruleId) || a.line - b.line || a.column - b.column,
  )
  const groups = new Map<string, typeof sorted>()
  for (const finding of sorted) {
    const group = groups.get(finding.ruleId)
    if (group) group.push(finding)
    else groups.set(finding.ruleId, [finding])
  }
  let deduction = 0
  for (const group of groups.values()) {
    group.forEach((finding, index) => {
      const weight = SCORING.weights[finding.severity]
      const factor = index < SCORING.fullFindingsPerRule ? 1 : SCORING.furtherFindingFactor
      deduction += weight * factor
    })
  }
  const raw = SCORING.start - deduction
  const score = Math.max(SCORING.floor, Math.min(SCORING.start, Math.round(raw)))
  return { score, grade: applyGradeCaps(score, sorted) }
}
