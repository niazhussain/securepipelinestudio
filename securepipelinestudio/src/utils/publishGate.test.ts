import { describe, expect, it } from 'vitest'
import { STARTER_TEMPLATES } from '../data/templates'
import { evaluatePublishGate } from './publishGate'

const valid = {
  yaml: STARTER_TEMPLATES[0].yaml,
  title: 'Node test workflow',
  description: 'A least-privilege CI workflow.',
  tags: ['ci', 'node'],
  license: 'MIT',
  consent: true,
}

describe('publish gate', () => {
  it('accepts a starter that grades A or B', () => {
    expect(evaluatePublishGate(valid).ok).toBe(true)
  })

  it('blocks a secret, a critical finding, and a missing confirmation', () => {
    const secret = evaluatePublishGate({ ...valid, yaml: `${valid.yaml}\n# ghp_${'a'.repeat(36)}\n` })
    expect(secret.ok).toBe(false)
    expect(secret.errors.some((error) => error.includes('secret'))).toBe(true)

    const injected = evaluatePublishGate({
      ...valid,
      yaml: `name: bad\non: issues\npermissions: {}\njobs:\n  run:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "\${{ github.event.issue.title }}"\n`,
    })
    expect(injected.ok).toBe(false)
    expect(injected.errors.some((error) => error.includes('Critical'))).toBe(true)

    expect(evaluatePublishGate({ ...valid, consent: false }).ok).toBe(false)
    expect(evaluatePublishGate({ ...valid, title: '' }).ok).toBe(false)
    expect(evaluatePublishGate({ ...valid, title: 'x'.repeat(81) }).ok).toBe(false)
    expect(evaluatePublishGate({ ...valid, tags: ['Bad Tag'] }).ok).toBe(false)
    expect(evaluatePublishGate({ ...valid, license: 'Proprietary' }).ok).toBe(false)
  })
})
