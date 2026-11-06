import { describe, expect, it } from 'vitest'
import { applyWorkflowEdit } from './workflowEdit'

const source = `name: Old
custom-note: keep
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Echo
        run: echo hi
        if: success()
`

describe('workflow edits', () => {
  it('preserves unknown keys when the form changes the name', () => {
    const next = applyWorkflowEdit(source, { type: 'set-name', name: 'New' })
    expect(next).toContain('name: New')
    expect(next).toContain('custom-note: keep')
    expect(next).toContain('branches:')
    expect(next).toContain('success()')
  })

  it('keeps the branch filter for a trigger that stays selected', () => {
    const next = applyWorkflowEdit(source, { type: 'set-triggers', triggers: ['push', 'workflow_dispatch'] })
    expect(next).toContain('branches:')
    expect(next).toContain('workflow_dispatch')
  })
})
