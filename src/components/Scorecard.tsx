import { AlertTriangle, Info, OctagonAlert, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SEVERITY_ORDER } from '../data/scoring'
import { ANALYSIS_NOTE, PINNING_NOTE } from '../utils/limits'
import type { AnalysisResult, Finding, ParseError, Severity } from '../utils/model'
import { GradeBadge } from './GradeBadge'
import { RuleTooltip } from './RuleTooltip'
import { useToast } from './toast-context'

const SEVERITY_ICON = {
  critical: OctagonAlert,
  high: ShieldAlert,
  medium: AlertTriangle,
  low: AlertTriangle,
  info: Info,
} as const

function SeverityMark({ severity }: { severity: Severity }) {
  const Icon = SEVERITY_ICON[severity]
  return (
    <span className={`severity severity-${severity}`}>
      <Icon aria-hidden="true" size={14} />
      {severity}
    </span>
  )
}

function FindingCard({ finding }: { finding: Finding }) {
  const toast = useToast()
  return (
    <article className="finding">
      <div className="finding-top">
        <div>
          <div className="row">
            <SeverityMark severity={finding.severity} />
            <strong>{finding.ruleId}</strong>
            <RuleTooltip ruleId={finding.ruleId} rationale={finding.rationale} reference={finding.reference} />
          </div>
          <h3 style={{ margin: '6px 0 0', fontSize: 15 }}>{finding.title}</h3>
        </div>
      </div>
      <p style={{ margin: 0 }}>{finding.message}</p>
      <p className="meta">
        {finding.jobId ? `Job ${finding.jobId}` : 'Workflow'}
        {finding.step ? ` · step ${finding.step}` : ''}
        {` · line ${finding.line}, column ${finding.column}`}
      </p>
      <p className="muted" style={{ margin: 0 }}>{finding.remediation}</p>
      <pre className="fix">{finding.fix}</pre>
      <button
        className="button"
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(finding.fix).then(
            () => toast('Suggested fix copied.'),
            () => toast('The fix could not be copied.'),
          )
        }}
      >
        Copy fix
      </button>
    </article>
  )
}

export function Scorecard({
  result,
  pending,
  parseError,
  warnings,
}: {
  result: AnalysisResult | null
  pending: boolean
  parseError: ParseError | null
  warnings: string[]
}) {
  const [announcement, setAnnouncement] = useState('')
  const grade = result?.status === 'ok' && !parseError ? result.grade : null
  const score = result?.status === 'ok' && !parseError ? result.score : null

  useEffect(() => {
    if (grade && score != null) setAnnouncement(`Security grade ${grade}, score ${score} out of 100.`)
  }, [grade, score])

  const groups = SEVERITY_ORDER.map((severity) => ({
    severity,
    items: (result?.findings ?? []).filter((finding) => finding.severity === severity),
  })).filter((group) => group.items.length > 0)

  return (
    <section className="pane-body" aria-labelledby="scorecard-title">
      <div className="sr-only" aria-live="polite">{announcement}</div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="scorecard-title" style={{ margin: 0, fontSize: 16 }}>Security scorecard</h2>
        {pending ? <span className="muted">Updating analysis</span> : null}
      </div>
      {parseError ? (
        <div className="callout danger" role="status">
          {parseError.message} Line {parseError.line}, column {parseError.column}.
        </div>
      ) : null}
      {result?.status === 'empty' ? (
        <div className="callout">Paste a workflow or open a YAML file to score it.</div>
      ) : null}
      {result?.status === 'too-large' ? (
        <div className="callout danger" role="status">
          This workflow is over 256 KB, so it was not analysed.
        </div>
      ) : null}
      {result?.status === 'error' ? (
        <div className="callout danger" role="status">The workflow could not be analysed.</div>
      ) : null}
      {grade && score != null ? (
        <div className="grade-row">
          <GradeBadge grade={grade} />
          <div>
            <div className="score-figure">{score}</div>
            <div className="muted">out of 100</div>
          </div>
        </div>
      ) : null}
      <p className="note">{ANALYSIS_NOTE}</p>
      <p className="note">{PINNING_NOTE}</p>
      {warnings.map((warning) => (
        <div className="callout" key={warning} role="status">{warning}</div>
      ))}
      {groups.map((group) => (
        <div key={group.severity}>
          <h3 style={{ fontSize: 14, textTransform: 'capitalize' }}>
            {group.severity} ({group.items.length})
          </h3>
          <div className="form-grid">
            {group.items.map((finding, index) => (
              <FindingCard finding={finding} key={`${finding.ruleId}-${finding.line}-${finding.column}-${index}`} />
            ))}
          </div>
        </div>
      ))}
      {result?.status === 'ok' && !parseError && result.findings.length === 0 ? (
        <div className="callout">No findings. This is still not a guarantee.</div>
      ) : null}
    </section>
  )
}
