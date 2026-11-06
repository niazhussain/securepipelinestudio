import { useEffect, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ruleById } from '../data/rules'
import { SCENARIOS } from '../data/scenarios'
import { diffLines } from '../utils/diff'
import { safeHttpsUrl } from '../utils/safeUrl'

export function ThreatModeler() {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? null
  const [stepIndex, setStepIndex] = useState(0)
  const [mode, setMode] = useState<'vulnerable' | 'fixed'>('vulnerable')
  useEffect(() => {
    setStepIndex(0)
    setMode('vulnerable')
  }, [scenarioId])

  if (!scenario) {
    return (
      <main id="main" className="page">
        <h1>Threat modeler</h1>
        <p>These are lessons. Nothing runs, there are no network calls, and every payload is the placeholder attacker.example.</p>
        <div className="cards">
          {SCENARIOS.map((item) => (
            <Link className="panel card" key={item.id} to={`/threat-modeler/${item.id}`}>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
            </Link>
          ))}
        </div>
        {scenarioId ? <p className="callout" role="alert">That scenario is not in this lesson set.</p> : null}
      </main>
    )
  }

  const lesson = scenario
  const step = lesson.steps[Math.min(stepIndex, lesson.steps.length - 1)]
  const source = mode === 'vulnerable' ? lesson.vulnerable : lesson.fixed
  const progress = `${stepIndex + 1} of ${lesson.steps.length}`

  function move(next: number) {
    setStepIndex(Math.min(lesson.steps.length - 1, Math.max(0, next)))
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      move(stepIndex + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      move(stepIndex - 1)
    } else if (event.key === 'v') {
      setMode('vulnerable')
    } else if (event.key === 'f') {
      setMode('fixed')
    }
  }

  return (
    <main id="main" className="page">
      <p><Link to="/threat-modeler">All scenarios</Link></p>
      <h1>{scenario.title}</h1>
      <p>{scenario.summary}</p>
      <p className="callout">Education only. Nothing on this page executes, and the placeholder is attacker.example.</p>
      <section
        aria-label="Attack timeline"
        onKeyDown={onKeyDown}
        tabIndex={0}
      >
        <div className="row">
          <button className="button" type="button" onClick={() => move(stepIndex - 1)} disabled={stepIndex === 0}>Previous</button>
          <button className="button" type="button" onClick={() => move(stepIndex + 1)} disabled={stepIndex === scenario.steps.length - 1}>Next</button>
          <button className="button" type="button" aria-pressed={mode === 'vulnerable'} onClick={() => setMode('vulnerable')}>Vulnerable</button>
          <button className="button" type="button" aria-pressed={mode === 'fixed'} onClick={() => setMode('fixed')}>Fixed</button>
        </div>
        <p className="meta">Arrow keys move the timeline when this section is focused. V shows the vulnerable workflow and F shows the fix.</p>
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={scenario.steps.length} aria-valuenow={stepIndex + 1} aria-valuetext={progress}>
          <span style={{ width: `${((stepIndex + 1) / scenario.steps.length) * 100}%` }} />
        </div>
        <p className="meta">Step {progress}</p>
        <ol className="timeline" start={stepIndex + 1}>
          <li>
            <p><strong>Attacker.</strong> {step.attacker}</p>
            <p><strong>Effect.</strong> {step.effect}</p>
            <p><strong>Exposed.</strong> {step.exposed}</p>
            <p><strong>What the fix breaks.</strong> {step.brokenBy}</p>
          </li>
        </ol>
      </section>
      <section className="panel card" aria-label={mode === 'vulnerable' ? 'Vulnerable workflow' : 'Fixed workflow'}>
        <h2>{mode === 'vulnerable' ? 'Vulnerable workflow' : 'Fixed workflow'}</h2>
        <pre className="diff">
          {source.split('\n').map((line, index) => {
            const number = index + 1
            const risky = mode === 'vulnerable' && scenario.riskyLines.includes(number)
            return (
              <div key={`${number}-${line}`} className={risky ? 'diff-del' : undefined}>
                {line || ' '}
              </div>
            )
          })}
        </pre>
        {mode === 'fixed' ? (
          <>
            <h2>Diff from the vulnerable workflow</h2>
            <pre className="diff">
              {diffLines(scenario.vulnerable, scenario.fixed).map((line, index) => (
                <div key={`${line.kind}-${index}`} className={line.kind === 'remove' ? 'diff-del' : line.kind === 'add' ? 'diff-add' : undefined}>
                  {line.kind === 'remove' ? '- ' : line.kind === 'add' ? '+ ' : '  '}
                  {line.text || ' '}
                </div>
              ))}
            </pre>
          </>
        ) : null}
        <div className="row">
          {scenario.ruleIds.map((id) => {
            const rule = ruleById(id)
            const href = safeHttpsUrl(rule.reference)
            return href ? (
              <a key={id} href={href} rel="noopener noreferrer">{id}: {rule.title}</a>
            ) : (
              <span key={id}>{id}</span>
            )
          })}
        </div>
        <button className="button button-primary" type="button" onClick={() => navigate('/', { state: { yaml: source } })}>
          Load this workflow into the editor
        </button>
      </section>
    </main>
  )
}
