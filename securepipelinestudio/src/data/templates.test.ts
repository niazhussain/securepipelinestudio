import { describe, expect, it } from 'vitest'
import { analyzeWorkflow } from '../utils/analyze'
import { STARTER_TEMPLATES } from './templates'

describe('starter templates', () => {
  it('ships at least six examples graded A or B', () => {
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(6)
    for (const template of STARTER_TEMPLATES) {
      const analysis = analyzeWorkflow(template.yaml)
      expect(analysis.status, template.id).toBe('ok')
      if (analysis.status !== 'ok') continue
      expect(['A', 'B'], template.id).toContain(analysis.grade)
    }
  })
})
