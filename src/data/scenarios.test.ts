import { describe, expect, it } from 'vitest'
import { analyzeWorkflow } from '../utils/analyze'
import { SCENARIOS } from './scenarios'

describe('threat scenarios', () => {
  it('has five lessons whose vulnerable workflows match the linked rules', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(5)
    for (const scenario of SCENARIOS) {
      expect(scenario.vulnerable).not.toMatch(/curl\s+.*\|\s*(ba)?sh/)
      expect(scenario.steps.length).toBeGreaterThan(0)
      const lines = scenario.vulnerable.split('\n')
      for (const line of scenario.riskyLines) expect(lines[line - 1]?.trim().length).toBeGreaterThan(0)
      const vulnerable = analyzeWorkflow(scenario.vulnerable)
      const fixed = analyzeWorkflow(scenario.fixed)
      expect(vulnerable.status, scenario.id).toBe('ok')
      expect(fixed.status, scenario.id).toBe('ok')
      if (vulnerable.status !== 'ok' || fixed.status !== 'ok') continue
      for (const ruleId of scenario.ruleIds) {
        expect(vulnerable.findings.some((finding) => finding.ruleId === ruleId), scenario.id).toBe(true)
        expect(fixed.findings.some((finding) => finding.ruleId === ruleId), scenario.id).toBe(false)
      }
    }
  })
})
