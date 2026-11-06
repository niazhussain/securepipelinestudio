import { useEffect, useMemo, useState } from 'react'
import { parseWorkflow } from '../utils/parser'
import { applyWorkflowEdit, toFormState, type PermissionForm, type WorkflowFormState } from '../utils/workflowEdit'

const TRIGGERS = [
  'push',
  'pull_request',
  'pull_request_target',
  'workflow_dispatch',
  'workflow_call',
  'workflow_run',
  'schedule',
  'issues',
  'issue_comment',
  'release',
]

const SCOPES = [
  'contents',
  'actions',
  'checks',
  'deployments',
  'discussions',
  'id-token',
  'issues',
  'packages',
  'pages',
  'pull-requests',
  'security-events',
  'statuses',
]

function PermissionFields({
  legend,
  value,
  disabled,
  onChange,
}: {
  legend: string
  value: PermissionForm
  disabled: boolean
  onChange: (next: PermissionForm) => void
}) {
  return (
    <fieldset className="job" disabled={disabled}>
      <legend>{legend}</legend>
      <div className="checks">
        {(['unset', 'empty', 'read-all', 'write-all', 'custom'] as const).map((mode) => (
          <label key={mode}>
            <input
              type="radio"
              name={legend}
              checked={value.mode === mode || (mode === 'custom' && value.mode === 'scalar')}
              onChange={() =>
                onChange(
                  mode === 'custom'
                    ? { mode: 'custom', entries: value.entries.length ? value.entries : [{ scope: 'contents', access: 'read' }] }
                    : { mode, entries: [] },
                )
              }
            />
            {mode === 'unset' ? 'Not set' : mode === 'empty' ? 'Empty (none)' : mode}
          </label>
        ))}
      </div>
      {value.mode === 'scalar' ? <p className="note">Current value: {value.value}. Choosing another option replaces it.</p> : null}
      {value.mode === 'custom' || value.mode === 'scalar' ? (
        <div className="form-grid">
          {value.entries.map((entry, index) => (
            <div className="row" key={`${entry.scope}-${index}`}>
              <label>
                Scope
                <select
                  aria-label={`Scope ${index + 1} for ${legend}`}
                  value={entry.scope}
                  onChange={(event) => {
                    const entries = value.entries.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, scope: event.target.value } : item,
                    )
                    onChange({ mode: 'custom', entries })
                  }}
                >
                  {SCOPES.map((scope) => (
                    <option key={scope} value={scope}>{scope}</option>
                  ))}
                </select>
              </label>
              <label>
                Access
                <select
                  aria-label={`Access ${index + 1} for ${legend}`}
                  value={['read', 'write', 'none'].includes(entry.access) ? entry.access : 'read'}
                  onChange={(event) => {
                    const entries = value.entries.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, access: event.target.value } : item,
                    )
                    onChange({ mode: 'custom', entries })
                  }}
                >
                  <option value="read">read</option>
                  <option value="write">write</option>
                  <option value="none">none</option>
                </select>
              </label>
            </div>
          ))}
          <button
            className="button"
            type="button"
            onClick={() => onChange({ mode: 'custom', entries: [...value.entries, { scope: 'contents', access: 'read' }] })}
          >
            Add scope
          </button>
        </div>
      ) : null}
    </fieldset>
  )
}

export function WorkflowForm({
  yaml,
  disabled,
  onChange,
}: {
  yaml: string
  disabled: boolean
  onChange: (yaml: string) => void
}) {
  const parsed = useMemo(() => parseWorkflow(yaml), [yaml])
  const [snapshot, setSnapshot] = useState<WorkflowFormState | null>(null)
  const [customTrigger, setCustomTrigger] = useState('')

  useEffect(() => {
    if (parsed.model) setSnapshot(toFormState(parsed.model))
  }, [parsed])

  if (!snapshot) {
    return <p className="note">The form appears after the YAML parses.</p>
  }

  const triggers = Array.from(new Set([...TRIGGERS, ...snapshot.triggers]))

  return (
    <form
      className="form-grid"
      onSubmit={(event) => event.preventDefault()}
      aria-label="Workflow form"
    >
      {disabled ? <p className="callout">Fix the YAML before using the form. Unknown keys are kept when the file parses.</p> : null}
      <label>
        Workflow name
        <input
          type="text"
          value={snapshot.name}
          disabled={disabled}
          onChange={(event) => onChange(applyWorkflowEdit(yaml, { type: 'set-name', name: event.target.value }))}
        />
      </label>
      <fieldset className="job" disabled={disabled}>
        <legend>Triggers</legend>
        <div className="checks">
          {triggers.map((trigger) => (
            <label key={trigger}>
              <input
                type="checkbox"
                checked={snapshot.triggers.includes(trigger)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...snapshot.triggers, trigger]
                    : snapshot.triggers.filter((item) => item !== trigger)
                  onChange(applyWorkflowEdit(yaml, { type: 'set-triggers', triggers: next }))
                }}
              />
              {trigger}
            </label>
          ))}
        </div>
        <div className="row">
          <label>
            Custom event
            <input
              type="text"
              value={customTrigger}
              onChange={(event) => setCustomTrigger(event.target.value)}
            />
          </label>
          <button
            className="button"
            type="button"
            onClick={() => {
              const name = customTrigger.trim()
              if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return
              onChange(applyWorkflowEdit(yaml, { type: 'set-triggers', triggers: [...snapshot.triggers, name] }))
              setCustomTrigger('')
            }}
          >
            Add event
          </button>
        </div>
      </fieldset>
      <PermissionFields
        legend="Top-level permissions"
        value={snapshot.permissions}
        disabled={disabled}
        onChange={(permissions) => onChange(applyWorkflowEdit(yaml, { type: 'set-permissions', permissions }))}
      />
      {snapshot.jobs.map((job) => (
        <fieldset className="job" key={job.id} disabled={disabled}>
          <legend>Job {job.id}</legend>
          <label>
            runs-on
            <input
              type="text"
              aria-label={`runs-on for ${job.id}`}
              value={job.runsOn}
              onChange={(event) =>
                onChange(applyWorkflowEdit(yaml, { type: 'set-job-runs-on', jobId: job.id, runsOn: event.target.value }))
              }
            />
          </label>
          <PermissionFields
            legend={`Permissions for ${job.id}`}
            value={job.permissions}
            disabled={disabled}
            onChange={(permissions) =>
              onChange(applyWorkflowEdit(yaml, { type: 'set-job-permissions', jobId: job.id, permissions }))
            }
          />
          {job.steps.map((step, index) => (
            <div className="job" key={`${job.id}-step-${index}`}>
              <label>
                Step name
                <input
                  type="text"
                  aria-label={`Step name ${index + 1} for ${job.id}`}
                  value={step.name}
                  onChange={(event) =>
                    onChange(applyWorkflowEdit(yaml, {
                      type: 'set-step',
                      jobId: job.id,
                      index,
                      step: { ...step, name: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Step kind
                <select
                  aria-label={`Step kind ${index + 1} for ${job.id}`}
                  value={step.mode}
                  onChange={(event) =>
                    onChange(applyWorkflowEdit(yaml, {
                      type: 'set-step',
                      jobId: job.id,
                      index,
                      step: { ...step, mode: event.target.value === 'uses' ? 'uses' : 'run' },
                    }))
                  }
                >
                  <option value="uses">uses</option>
                  <option value="run">run</option>
                </select>
              </label>
              <label>
                {step.mode === 'uses' ? 'uses value' : 'run script'}
                <textarea
                  aria-label={`${step.mode} value ${index + 1} for ${job.id}`}
                  value={step.value}
                  onChange={(event) =>
                    onChange(applyWorkflowEdit(yaml, {
                      type: 'set-step',
                      jobId: job.id,
                      index,
                      step: { ...step, value: event.target.value },
                    }))
                  }
                />
              </label>
              <button
                className="button"
                type="button"
                onClick={() => onChange(applyWorkflowEdit(yaml, { type: 'remove-step', jobId: job.id, index }))}
              >
                Remove step
              </button>
            </div>
          ))}
          <div className="row">
            <button className="button" type="button" onClick={() => onChange(applyWorkflowEdit(yaml, { type: 'add-step', jobId: job.id }))}>
              Add step
            </button>
            <button className="button" type="button" onClick={() => onChange(applyWorkflowEdit(yaml, { type: 'remove-job', jobId: job.id }))}>
              Remove job
            </button>
          </div>
        </fieldset>
      ))}
      <button className="button" type="button" disabled={disabled} onClick={() => onChange(applyWorkflowEdit(yaml, { type: 'add-job' }))}>
        Add job
      </button>
    </form>
  )
}
