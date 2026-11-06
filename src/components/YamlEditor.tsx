import { indentWithTab } from '@codemirror/commands'
import { yaml } from '@codemirror/lang-yaml'
import { forceLinting, linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { EditorState, type Text } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef } from 'react'
import type { Finding, ParseError } from '../utils/model'

function offset(doc: Text, line: number, column: number): number {
  const bounded = Math.min(Math.max(line, 1), doc.lines)
  const row = doc.line(bounded)
  return Math.min(row.from + Math.max(column - 1, 0), row.to)
}

function buildDiagnostics(doc: Text, findings: Finding[], parseError: ParseError | null): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  if (parseError) {
    const from = offset(doc, parseError.line, parseError.column)
    diagnostics.push({
      from,
      to: Math.min(doc.length, from + 1),
      severity: 'error',
      message: parseError.message,
    })
  }
  for (const finding of findings) {
    const from = offset(doc, finding.line, finding.column)
    const severity = finding.severity === 'critical' || finding.severity === 'high'
      ? 'error'
      : finding.severity === 'info'
        ? 'info'
        : 'warning'
    diagnostics.push({
      from,
      to: Math.min(doc.length, from + 1),
      severity,
      message: `${finding.ruleId}: ${finding.message}`,
    })
  }
  return diagnostics
}

export default function YamlEditor({
  value,
  onChange,
  findings,
  parseError,
}: {
  value: string
  onChange: (value: string) => void
  findings: Finding[]
  parseError: ParseError | null
}) {
  const parent = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const findingsRef = useRef(findings)
  const parseErrorRef = useRef(parseError)
  onChangeRef.current = onChange
  findingsRef.current = findings
  parseErrorRef.current = parseError

  useEffect(() => {
    if (!parent.current) return
    const view = new EditorView({
      parent: parent.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          yaml(),
          lintGutter(),
          keymap.of([indentWithTab]),
          EditorView.contentAttributes.of({ 'aria-label': 'Workflow YAML' }),
          EditorView.theme({
            '&': { backgroundColor: 'var(--sps-editor)', color: 'var(--sps-ink)', height: '100%' },
            '.cm-content': { fontFamily: 'var(--font-mono)' },
            '.cm-gutters': { backgroundColor: 'var(--sps-editor)', color: 'var(--sps-muted)', border: 'none' },
            '&.cm-focused': { outline: 'none' },
          }),
          linter((editor) => buildDiagnostics(editor.state.doc, findingsRef.current, parseErrorRef.current)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // The editor is recreated when the component mounts. External value updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  useEffect(() => {
    if (viewRef.current) forceLinting(viewRef.current)
  }, [findings, parseError])

  return <div ref={parent} className="editor-mount" />
}
