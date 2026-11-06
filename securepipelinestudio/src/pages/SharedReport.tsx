import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Scorecard } from '../components/Scorecard'
import { useAnalysis } from '../hooks/useAnalysis'
import { decodeShare } from '../services/shareCodec'
import type { Finding, Severity } from '../utils/model'

export function SharedReport() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const decoded = useMemo(() => decodeShare(params.get('d') ?? ''), [params])
  const source = decoded.ok ? (decoded.data.workflow ?? '') : ''
  const analysis = useAnalysis(source)

  if (!decoded.ok) {
    return (
      <main id="main" className="page">
        <h1>Shared report</h1>
        <div className="callout danger" role="status">{decoded.error}</div>
      </main>
    )
  }

  const snapshotFindings: Finding[] = decoded.data.findings.map((finding) => ({
    ruleId: finding.ruleId,
    title: finding.title,
    severity: finding.severity as Severity,
    rationale: 'This text came from the shared snapshot.',
    remediation: 'Load the workflow into the editor to recheck it.',
    reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
    message: finding.message,
    jobId: finding.jobId,
    step: finding.step,
    line: finding.line,
    column: finding.column,
    fix: '',
  }))

  return (
    <main id="main" className="page">
      <h1>Shared report</h1>
      {source ? (
        <>
          <p className="note">This grade was computed again in your browser. The grade stored in the link is not used.</p>
          <section className="panel">
            <Scorecard
              result={analysis.result}
              pending={analysis.pending}
              parseError={analysis.result.parseError}
              warnings={analysis.result.warnings}
            />
          </section>
          <button className="button button-primary" type="button" onClick={() => navigate('/', { state: { yaml: source } })}>
            Load into editor
          </button>
        </>
      ) : (
        <>
          <div className="callout">
            This is an unverified snapshot. The sender reported grade {decoded.data.grade}. The workflow source was not included, so it cannot be rechecked or loaded into the editor.
          </div>
          <ul className="timeline">
            {snapshotFindings.map((finding) => (
              <li key={`${finding.ruleId}-${finding.line}-${finding.column}`}>
                <strong>{finding.ruleId}</strong> · {finding.severity} · line {finding.line}
                <div>{finding.message}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
