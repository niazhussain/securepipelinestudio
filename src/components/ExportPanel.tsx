import { useState } from 'react'
import { badgeSnippet, badgeSvg, buildJsonSummary, buildMarkdownReport } from '../utils/exportReport'
import { downloadText } from '../utils/download'
import { ANALYSIS_NOTE } from '../utils/limits'
import type { AnalysisResult } from '../utils/model'
import { hasSecrets } from '../utils/secretScanner'
import { buildSharePayload, encodeShare } from '../services/shareCodec'
import { useToast } from './toast-context'

export function ExportPanel({
  yaml,
  result,
  includeSource,
  onIncludeSource,
}: {
  yaml: string
  result: AnalysisResult | null
  includeSource: boolean
  onIncludeSource: (value: boolean) => void
}) {
  const toast = useToast()
  const [link, setLink] = useState('')
  const [warning, setWarning] = useState('')
  const blocked = hasSecrets(yaml) || (result?.findings.some((finding) => finding.ruleId === 'SPS-040') ?? false)
  const ready = result?.status === 'ok' && !blocked
  const grade = result?.status === 'ok' ? result.grade : null
  const svg = grade ? badgeSvg(grade) : ''
  const preview = grade ? `data:image/svg+xml,${encodeURIComponent(svg)}` : ''

  function guard(): boolean {
    if (blocked) {
      toast('A possible secret was found. Export, share, and publish stay blocked until it is removed.')
      return false
    }
    if (result?.status !== 'ok') {
      toast('Analyse a valid workflow before exporting.')
      return false
    }
    return true
  }

  return (
    <section className="panel" aria-labelledby="export-title" style={{ marginTop: 16 }}>
      <div className="pane-body">
        <h2 id="export-title" style={{ margin: 0, fontSize: 16 }}>Export and share</h2>
        <p className="note">A badge is a snapshot of this analysis, not a live check. {ANALYSIS_NOTE}</p>
        {blocked ? (
          <div className="callout danger" role="status">
            A possible secret was found. Export and sharing are blocked so the value is not copied into a file or a link.
          </div>
        ) : null}
        <div className="row">
          {preview && grade ? <img src={preview} alt={`Local badge preview for grade ${grade}`} width={168} height={20} /> : <p className="note">The badge preview appears after a successful analysis.</p>}
          <button
            className="button"
            type="button"
            disabled={!ready}
            onClick={() => {
              if (!guard() || !result) return
              void navigator.clipboard.writeText(badgeSnippet(result.grade)).then(
                () => toast('Badge snippet copied. It is a snapshot, not a live badge.'),
                () => toast('The snippet could not be copied.'),
              )
            }}
          >
            Copy badge snippet
          </button>
          <button
            className="button"
            type="button"
            disabled={!ready}
            onClick={() => {
              if (!guard() || !result) return
              downloadText(`securepipeline-${result.grade}.svg`, badgeSvg(result.grade), 'image/svg+xml')
            }}
          >
            Download SVG
          </button>
        </div>
        <label className="row" style={{ fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={includeSource}
            onChange={(event) => onIncludeSource(event.target.checked)}
          />
          Include workflow source
        </label>
        {includeSource ? (
          <p className="callout">The workflow source will be embedded in the file or link. Include it only when the file has nothing sensitive in it.</p>
        ) : null}
        <div className="row">
          <button
            className="button"
            type="button"
            disabled={!ready}
            onClick={() => {
              if (!guard() || !result) return
              const summary = buildJsonSummary({
                result,
                now: new Date().toISOString(),
                source: includeSource ? yaml : undefined,
              })
              downloadText('securepipeline-summary.json', JSON.stringify(summary, null, 2), 'application/json')
            }}
          >
            Download JSON summary
          </button>
          <button
            className="button"
            type="button"
            disabled={!ready}
            onClick={() => {
              if (!guard() || !result) return
              const report = buildMarkdownReport({
                result,
                now: new Date().toISOString(),
                source: includeSource ? yaml : undefined,
              })
              downloadText('securepipeline-report.md', report, 'text/markdown')
            }}
          >
            Download Markdown report
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={!ready}
            onClick={() => {
              if (!guard() || !result) return
              const payload = buildSharePayload(result, new Date().toISOString(), includeSource ? yaml : undefined)
              const prefix = `${window.location.origin}${window.location.pathname}${window.location.search}`
              const encoded = encodeShare(payload, prefix)
              if (!encoded.ok) {
                toast(encoded.error)
                setLink('')
                return
              }
              const href = `${prefix}${encoded.fragment}`
              setLink(href)
              setWarning(encoded.warning ?? '')
              void navigator.clipboard.writeText(href).then(
                () => toast(encoded.warning ?? 'Share link copied. The fragment stays in the browser.'),
                () => toast('The link is ready below. Copy it manually if clipboard access was denied.'),
              )
            }}
          >
            Copy share link
          </button>
        </div>
        {warning ? <p className="callout" role="status">{warning}</p> : null}
        {link ? (
          <label>
            Share link
            <input type="text" readOnly value={link} aria-label="Share link" />
          </label>
        ) : null}
      </div>
    </section>
  )
}
