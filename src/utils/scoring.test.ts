import { describe, expect, it } from 'vitest'
import type { Severity } from './model'
import { applyGradeCaps, gradeFromScore, scoreFindings } from './scoring'

function finding(ruleId: string, severity: Severity, line = 1) {
  return { ruleId, severity, line, column: 1 }
}

describe('scoring', () => {
  it('starts at 100 and ignores info', () => {
    expect(scoreFindings([]).score).toBe(100)
    expect(scoreFindings([finding('SPS-100', 'info')])).toEqual({ score: 100, grade: 'A' })
  })

  it('counts only the first two findings of a rule in full', () => {
    const highs = [1, 2, 3].map((line) => finding('SPS-001', 'high', line))
    expect(scoreFindings(highs).score).toBe(66)
    const split = [finding('SPS-001', 'high', 1), finding('SPS-070', 'high', 2)]
    expect(scoreFindings(split).score).toBe(70)
  })

  it('maps score boundaries before caps', () => {
    expect(gradeFromScore(100)).toBe('A')
    expect(gradeFromScore(90)).toBe('A')
    expect(gradeFromScore(89)).toBe('B')
    expect(gradeFromScore(80)).toBe('B')
    expect(gradeFromScore(79)).toBe('C')
    expect(gradeFromScore(65)).toBe('C')
    expect(gradeFromScore(64)).toBe('D')
    expect(gradeFromScore(50)).toBe('D')
    expect(gradeFromScore(49)).toBe('F')
    expect(gradeFromScore(0)).toBe('F')
  })

  it('caps grades for high and critical findings', () => {
    expect(applyGradeCaps(96, [finding('SPS-001', 'high')])).toBe('B')
    expect(applyGradeCaps(75, [finding('SPS-020', 'critical')])).toBe('D')
    expect(applyGradeCaps(40, [finding('SPS-020', 'critical')])).toBe('F')
    expect(applyGradeCaps(100, [finding('SPS-020', 'critical'), finding('SPS-040', 'critical')])).toBe('F')
    expect(scoreFindings([finding('SPS-020', 'critical')]).grade).toBe('D')
    expect(
      scoreFindings([finding('SPS-020', 'critical', 1), finding('SPS-040', 'critical', 2)]).grade,
    ).toBe('F')
  })

  it('does not let info change a grade', () => {
    const result = scoreFindings([finding('SPS-090', 'low'), finding('SPS-100', 'info')])
    expect(result).toEqual({ score: 97, grade: 'A' })
  })
})
