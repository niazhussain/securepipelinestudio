import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { WorkflowForm } from './WorkflowForm'

const initial = `name: Old
custom-note: keep
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`

function Harness() {
  const [yaml, setYaml] = useState(initial)
  return (
    <>
      <WorkflowForm yaml={yaml} disabled={false} onChange={setYaml} />
      <pre data-testid="yaml">{yaml}</pre>
    </>
  )
}

describe('WorkflowForm', () => {
  it('writes form edits back to YAML and keeps unknown keys', () => {
    render(<Harness />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Workflow name' }), {
      target: { value: 'New' },
    })
    const yaml = screen.getByTestId('yaml').textContent ?? ''
    expect(yaml).toContain('name: New')
    expect(yaml).toContain('custom-note: keep')
    expect(yaml).toContain('echo hi')
  })
})
