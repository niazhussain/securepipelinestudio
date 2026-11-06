import { describe, expect, it } from 'vitest'
import { analyzeWorkflow } from './analyze'

const workflows = import.meta.glob('../../.github/workflows/*.{yml,yaml}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('repository workflows', () => {
  it('grades every workflow in this repository A', () => {
    const entries = Object.entries(workflows)
    expect(entries.length).toBeGreaterThan(0)
    for (const [path, source] of entries) {
      expect(typeof source).toBe('string')
      const analysis = analyzeWorkflow(source as string)
      expect(analysis.status, path).toBe('ok')
      if (analysis.status !== 'ok') continue
      expect(analysis.grade, `${path} ${analysis.findings.map((finding) => finding.ruleId).join(',')}`).toBe('A')
    }
  })
})
