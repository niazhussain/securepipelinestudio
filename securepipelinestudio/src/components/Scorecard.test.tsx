import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AnalysisResult } from '../utils/model'
import { ToastProvider } from './Toast'

import { Scorecard } from './Scorecard'

const result: AnalysisResult = {
  status: 'ok',
  bytes: 20,
  parseError: null,
  warnings: [],
  score: 85,
  grade: 'B',
  findings: [
    {
      ruleId: 'SPS-001',
      title: 'Third-party action is not pinned to a full commit SHA',
      severity: 'high',
      rationale: 'Tags can move.',
      remediation: 'Pin a commit SHA.',
      reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
      message: 'example-org/deploy@v1 is not pinned.',
      line: 4,
      column: 1,
      jobId: 'build',
      step: 1,
      fix: '- uses: owner/action@<40-character-commit-sha>',
    },
  ],
}

describe('Scorecard', () => {
  it('shows the grade letter, the rule, and the static-analysis limit', () => {
    render(
      <ToastProvider>
        <Scorecard result={result} pending={false} parseError={null} warnings={[]} />
      </ToastProvider>,
    )
    expect(screen.getByRole('img', { name: 'Grade B' })).toBeInTheDocument()
    expect(screen.getByText('SPS-001')).toBeInTheDocument()
    expect(screen.getByText(/static analysis and are not a guarantee/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot verify that a SHA belongs to a release/i)).toBeInTheDocument()
  })
})
