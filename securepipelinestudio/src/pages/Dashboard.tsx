import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { ExportPanel } from '../components/ExportPanel'
import { Scorecard } from '../components/Scorecard'
import { useToast } from '../components/toast-context'
import { WorkflowForm } from '../components/WorkflowForm'
import { DEMO_WORKFLOW, SECURE_WORKFLOW } from '../data/sample'
import { useAnalysis } from '../hooks/useAnalysis'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useSettings } from '../hooks/useTheme'
import { pushHistory, readDraft, readHistory, writeDraft } from '../services/storage'
import { byteLength } from '../utils/analyze'
import { MAX_WORKFLOW_BYTES } from '../utils/limits'
import type { AnalysisResult } from '../utils/model'
import { parseWorkflow } from '../utils/parser'
import { hasSecrets } from '../utils/secretScanner'

const YamlEditor = lazy(() => import('../components/YamlEditor'))

const incomingSchema = z.object({ yaml: z.string().max(MAX_WORKFLOW_BYTES) })

export function Dashboard() {
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const { settings, update } = useSettings()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [yaml, setYaml] = useState(() => readDraft()?.yaml ?? DEMO_WORKFLOW)
  const [pane, setPane] = useState<'editor' | 'scorecard'>('editor')
  const [mode, setMode] = useState<'yaml' | 'form'>('yaml')
  const [history, setHistory] = useState(() => readHistory().items)
  const analysis = useAnalysis(yaml)
  const local = useMemo(() => parseWorkflow(yaml), [yaml])

  useEffect(() => {
    const parsed = incomingSchema.safeParse(location.state)
    if (!parsed.success || parsed.data.yaml.includes('\u0000')) return
    setYaml(parsed.data.yaml)
    navigate('/', { replace: true, state: null })
  }, [location.state, navigate])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = writeDraft(yaml, new Date().toISOString())
      if (!saved.ok && saved.reason === 'quota') toast('The draft could not be saved because browser storage is full.')
    }, 400)
    return () => window.clearTimeout(timer)
  }, [yaml, toast])

  const historySignature = useRef('')
  useEffect(() => {
    if (analysis.pending || analysis.result.status !== 'ok' || local.parseError || hasSecrets(yaml)) return
    const signature = `${analysis.result.grade}:${analysis.result.score}:${analysis.result.findings.length}:${analysis.result.workflowName ?? ''}`
    if (signature === historySignature.current) return
    historySignature.current = signature
    pushHistory({
      at: new Date().toISOString(),
      grade: analysis.result.grade,
      score: analysis.result.score,
      findingCount: analysis.result.findings.length,
      workflowName: analysis.result.workflowName || 'workflow',
    })
    setHistory(readHistory().items)
  }, [analysis.pending, analysis.result, local.parseError, yaml])

  const shown: AnalysisResult = local.parseError
    ? { ...analysis.result, status: 'invalid', findings: [], parseError: local.parseError, warnings: local.warnings }
    : { ...analysis.result, warnings: local.warnings.length ? local.warnings : analysis.result.warnings }

  async function openFile(file: File) {
    if (file.size > MAX_WORKFLOW_BYTES) {
      toast('That file is over 256 KB and was not opened.')
      return
    }
    const text = await file.text()
    const parsed = z.string().max(MAX_WORKFLOW_BYTES).safeParse(text)
    if (!parsed.success || parsed.data.includes('\u0000')) {
      toast('That file could not be opened.')
      return
    }
    setYaml(parsed.data)
  }

  return (
    <main id="main" className="page workspace-page">
      <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 28 }}>Dashboard</h1>
          <p className="note" style={{ margin: 0 }}>{byteLength(yaml).toLocaleString()} bytes. Nothing in the editor is uploaded by analysis.</p>
        </div>
        <div className="row">
          <button className="button" type="button" onClick={() => setYaml(DEMO_WORKFLOW)}>Load demo</button>
          <button className="button" type="button" onClick={() => setYaml(SECURE_WORKFLOW)}>Load secure example</button>
          <label className="button">
            Open YAML
            <input
              className="sr-only"
              type="file"
              accept=".yml,.yaml,text/yaml,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void openFile(file)
                event.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Dashboard panes" onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          setPane((current) => (current === 'editor' ? 'scorecard' : 'editor'))
        }
      }}>
        <button className="button" type="button" role="tab" id="tab-editor" aria-selected={pane === 'editor'} aria-controls="panel-editor" onClick={() => setPane('editor')}>Editor</button>
        <button className="button" type="button" role="tab" id="tab-scorecard" aria-selected={pane === 'scorecard'} aria-controls="panel-scorecard" onClick={() => setPane('scorecard')}>Scorecard</button>
      </div>
      <div className="workspace" style={{ ['--editor-width' as string]: `${settings.editorWidth}%` }}>
        <section className="panel pane" id="panel-editor" role="tabpanel" aria-labelledby="tab-editor" hidden={!desktop && pane !== 'editor'}>
          <div className="pane-head">
            <div className="row" role="tablist" aria-label="Editor mode">
              <button className="button" type="button" aria-selected={mode === 'yaml'} onClick={() => setMode('yaml')}>YAML</button>
              <button className="button" type="button" aria-selected={mode === 'form'} onClick={() => setMode('form')}>Form</button>
            </div>
          </div>
          {mode === 'yaml' ? (
            <Suspense fallback={<p className="pane-body">Loading editor…</p>}>
              <YamlEditor value={yaml} onChange={setYaml} findings={shown.findings} parseError={local.parseError} />
            </Suspense>
          ) : (
            <div className="pane-body">
              <WorkflowForm yaml={yaml} disabled={!!local.parseError} onChange={setYaml} />
            </div>
          )}
        </section>
        <button
          className="handle"
          type="button"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and scorecard"
          aria-valuemin={30}
          aria-valuemax={70}
          aria-valuenow={settings.editorWidth}
          onPointerDown={(event) => {
            const parent = event.currentTarget.parentElement
            if (!parent) return
            const move = (ev: PointerEvent) => {
              const rect = parent.getBoundingClientRect()
              const percent = ((ev.clientX - rect.left) / rect.width) * 100
              update({ editorWidth: Math.min(70, Math.max(30, Math.round(percent))) })
            }
            const up = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') update({ editorWidth: Math.max(30, settings.editorWidth - 2) })
            if (event.key === 'ArrowRight') update({ editorWidth: Math.min(70, settings.editorWidth + 2) })
          }}
        />
        <section className="panel pane" id="panel-scorecard" role="tabpanel" aria-labelledby="tab-scorecard" hidden={!desktop && pane !== 'scorecard'}>
          <Scorecard result={shown} pending={analysis.pending} parseError={local.parseError} warnings={shown.warnings} />
        </section>
      </div>
      <ExportPanel
        yaml={yaml}
        result={local.parseError ? null : analysis.result}
        includeSource={settings.includeSource}
        onIncludeSource={(includeSource) => update({ includeSource })}
      />
      <section className="panel" style={{ marginTop: 16 }} aria-labelledby="history-title">
        <div className="pane-body">
          <h2 id="history-title" style={{ margin: 0, fontSize: 16 }}>Recent local analyses</h2>
          {history.length === 0 ? <p className="note">Grades are stored on this browser without the workflow source.</p> : null}
          <ul className="timeline">
            {history.map((item) => (
              <li key={item.id}>
                <strong>Grade {item.grade}</strong> · {item.score}/100 · {item.findingCount} findings · {item.workflowName}
                <div className="meta">{item.at}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
