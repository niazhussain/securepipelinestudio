import { describe, expect, it } from 'vitest'
import { RULES } from '../data/rules'
import { fixtures, secureWorkflow } from '../test/fixtures'
import { analyzeWorkflow } from './analyze'
import { parseWorkflow } from './parser'

describe('rule catalogue', () => {
  it('covers every catalogue rule with a vulnerable and a safe fixture', () => {
    expect(Object.keys(fixtures).sort()).toEqual(RULES.map((rule) => rule.id).sort())
  })

  it('pins the specified severities and https references', () => {
    const expected: Record<string, string> = {
      'SPS-001': 'high',
      'SPS-002': 'medium',
      'SPS-003': 'medium',
      'SPS-010': 'high',
      'SPS-011': 'high',
      'SPS-020': 'critical',
      'SPS-030': 'critical',
      'SPS-031': 'high',
      'SPS-040': 'critical',
      'SPS-041': 'medium',
      'SPS-050': 'high',
      'SPS-060': 'medium',
      'SPS-070': 'high',
      'SPS-080': 'high',
      'SPS-090': 'low',
      'SPS-091': 'low',
      'SPS-100': 'info',
    }
    for (const rule of RULES) {
      expect(rule.severity).toBe(expected[rule.id])
      expect(rule.reference.startsWith('https://')).toBe(true)
      expect(rule.rationale.length).toBeGreaterThan(20)
      expect(rule.remediation.length).toBeGreaterThan(10)
    }
  })
})

describe.each(RULES.map((rule) => rule.id))('%s', (id) => {
  it('flags the vulnerable fixture', () => {
    const result = analyzeWorkflow(fixtures[id]!.vulnerable)
    expect(result.status).toBe('ok')
    expect(result.findings.some((finding) => finding.ruleId === id)).toBe(true)
  })

  it('accepts the safe fixture', () => {
    const result = analyzeWorkflow(fixtures[id]!.safe)
    expect(result.status).toBe('ok')
    expect(result.findings.some((finding) => finding.ruleId === id)).toBe(false)
  })
})

describe('parser edges', () => {
  it('reports the line and column of invalid YAML without throwing', () => {
    const result = analyzeWorkflow('name: [broken')
    expect(result.status).toBe('invalid')
    expect(result.parseError?.line).toBe(1)
    expect(result.parseError?.column).toBeGreaterThan(1)
    expect(result.parseError?.message).not.toContain('broken')
  })

  it('does not crash on anchors, aliases, or merge keys', () => {
    const result = analyzeWorkflow(anchored())
    expect(result.status).toBe('ok')
    const parsed = parseWorkflow(anchored())
    expect(parsed.model?.jobs).toHaveLength(2)
    expect(parsed.model?.jobs[1]?.runsOn).toEqual(['ubuntu-latest'])
  })

  it('analyses only the first of several documents', () => {
    const result = analyzeWorkflow('name: one\non: push\n---\nname: two\n')
    expect(result.status).toBe('ok')
    expect(result.warnings[0]).toMatch(/more than one YAML document/i)
    expect(result.workflowName).toBe('one')
  })

  it('accepts a matrix expression and unknown event names', () => {
    const result = analyzeWorkflow(`name: matrix
on:
  repository_dispatch:
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: \${{ matrix.os }}
    steps:
      - uses: ./actions/build
      - run: echo ok
`)
    expect(result.status).toBe('ok')
    expect(result.findings.some((finding) => finding.ruleId === 'SPS-070')).toBe(false)
  })

  it('treats an empty file and an oversized file as distinct states', () => {
    expect(analyzeWorkflow('   ').status).toBe('empty')
    expect(analyzeWorkflow('name: x\n'.repeat(40_000)).status).toBe('too-large')
  })

  it('flags a short SHA and a floating reusable workflow', () => {
    const short = analyzeWorkflow('on: push\njobs:\n  build:\n    steps:\n      - uses: example-org/deploy@abc1234\n')
    expect(short.findings.some((finding) => finding.ruleId === 'SPS-001')).toBe(true)
    const reusable = analyzeWorkflow(
      'on: push\njobs:\n  call:\n    uses: example-org/repo/.github/workflows/ci.yml@main\n',
    )
    expect(reusable.findings.some((finding) => finding.ruleId === 'SPS-003')).toBe(true)
  })

  it('does not treat id-token write as broad when deploy-pages is present', () => {
    const result = analyzeWorkflow(`name: pages
on: push
permissions: {}
concurrency:
  group: pages
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      pages: write
      id-token: write
    steps:
      - uses: actions/deploy-pages@0123456789abcdef0123456789abcdef01234567
`)
    expect(result.findings.some((finding) => finding.ruleId === 'SPS-011')).toBe(false)
  })

  it('scores a pinned, least-privilege workflow as A', () => {
    const result = analyzeWorkflow(secureWorkflow)
    expect(result.grade).toBe('A')
    expect(result.score).toBe(100)
    expect(result.findings).toEqual([])
  })
})

function anchored(): string {
  return `name: anchored
on: push
permissions:
  contents: read
jobs:
  build: &base
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: echo one
  reuse:
    <<: *base
`
}
