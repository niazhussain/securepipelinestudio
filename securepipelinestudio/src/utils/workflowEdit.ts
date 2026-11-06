import { isMap, isSeq, YAMLMap, YAMLSeq } from 'yaml'
import type { PermissionModel, WorkflowModel } from './model'
import { documentRoot } from './parser'
import { findPair, pairKey } from './yamlNodes'

export interface StepForm {
  name: string
  mode: 'uses' | 'run'
  value: string
}

export interface PermissionForm {
  mode: 'unset' | 'empty' | 'read-all' | 'write-all' | 'scalar' | 'custom'
  value?: string
  entries: { scope: string; access: string }[]
}

export interface JobForm {
  id: string
  runsOn: string
  permissions: PermissionForm
  steps: StepForm[]
}

export interface WorkflowFormState {
  name: string
  triggers: string[]
  permissions: PermissionForm
  jobs: JobForm[]
}

export type WorkflowEdit =
  | { type: 'set-name'; name: string }
  | { type: 'set-triggers'; triggers: string[] }
  | { type: 'set-permissions'; permissions: PermissionForm }
  | { type: 'set-job-runs-on'; jobId: string; runsOn: string }
  | { type: 'set-job-permissions'; jobId: string; permissions: PermissionForm }
  | { type: 'add-job' }
  | { type: 'remove-job'; jobId: string }
  | { type: 'add-step'; jobId: string }
  | { type: 'remove-step'; jobId: string; index: number }
  | { type: 'set-step'; jobId: string; index: number; step: StepForm }

const TRIGGER_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const SCOPE_NAME = /^[a-z0-9-]{1,40}$/
const ACCESS = new Set(['read', 'write', 'none'])

export function permissionsToForm(permissions: PermissionModel): PermissionForm {
  if (!permissions.present || permissions.kind === 'missing') {
    return { mode: 'unset', entries: [] }
  }
  if (permissions.kind === 'read-all' || permissions.kind === 'write-all') {
    return { mode: permissions.kind, entries: [] }
  }
  if (permissions.kind === 'scalar') {
    return { mode: 'scalar', value: permissions.scalar ?? '', entries: [] }
  }
  if (Object.keys(permissions.scopes).length === 0) return { mode: 'empty', entries: [] }
  return {
    mode: 'custom',
    entries: Object.entries(permissions.scopes).map(([scope, access]) => ({ scope, access })),
  }
}

export function toFormState(model: WorkflowModel): WorkflowFormState {
  return {
    name: model.name ?? '',
    triggers: model.triggers,
    permissions: permissionsToForm(model.permissions),
    jobs: model.jobs.map((job) => ({
      id: job.id,
      runsOn: job.runsOn.join(', '),
      permissions: permissionsToForm(job.permissions),
      steps: job.steps.map((step) => ({
        name: step.name ?? '',
        mode: step.uses ? 'uses' : 'run',
        value: step.uses ?? step.run ?? '',
      })),
    })),
  }
}

function cleanText(value: string, max: number): string {
  return value.replaceAll('\u0000', '').slice(0, max)
}

function applyPermissions(map: YAMLMap, permissions: PermissionForm): void {
  if (permissions.mode === 'unset') {
    map.delete('permissions')
    return
  }
  if (permissions.mode === 'empty') {
    map.set('permissions', new YAMLMap())
    return
  }
  if (permissions.mode === 'read-all' || permissions.mode === 'write-all') {
    map.set('permissions', permissions.mode)
    return
  }
  if (permissions.mode === 'scalar') {
    map.set('permissions', cleanText(permissions.value ?? '', 40))
    return
  }
  const value = new YAMLMap()
  for (const entry of permissions.entries.slice(0, 20)) {
    if (!SCOPE_NAME.test(entry.scope) || !ACCESS.has(entry.access)) continue
    value.set(entry.scope, entry.access)
  }
  map.set('permissions', value)
}

function runsOnValue(input: string): string | string[] {
  const text = cleanText(input, 200).trim()
  if (text.includes('${{')) return text
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length > 1) return parts
  return parts[0] ?? 'ubuntu-latest'
}

function ensureJobs(root: YAMLMap): YAMLMap {
  const existing = findPair(root, 'jobs')?.value
  if (isMap(existing)) return existing
  const created = new YAMLMap()
  root.set('jobs', created)
  return created
}

function jobMap(root: YAMLMap, jobId: string): YAMLMap {
  const jobs = ensureJobs(root)
  const existing = findPair(jobs, jobId)?.value
  if (isMap(existing)) return existing
  const created = new YAMLMap()
  jobs.set(jobId, created)
  return created
}

function stepsOf(job: YAMLMap): YAMLSeq {
  const existing = findPair(job, 'steps')?.value
  if (isSeq(existing)) return existing
  const created = new YAMLSeq()
  job.set('steps', created)
  return created
}

function nextJobId(root: YAMLMap): string {
  const jobs = findPair(root, 'jobs')?.value
  const ids = new Set<string>()
  if (isMap(jobs)) {
    for (const item of jobs.items) {
      const key = pairKey(item)
      if (key) ids.add(key)
    }
  }
  if (!ids.has('job')) return 'job'
  let index = 2
  while (ids.has(`job_${index}`)) index += 1
  return `job_${index}`
}

function blankJob(): YAMLMap {
  const job = new YAMLMap()
  job.set('runs-on', 'ubuntu-latest')
  job.set('timeout-minutes', 15)
  const permissions = new YAMLMap()
  permissions.set('contents', 'read')
  job.set('permissions', permissions)
  const steps = new YAMLSeq()
  const step = new YAMLMap()
  step.set('run', 'echo hello')
  steps.add(step)
  job.set('steps', steps)
  return job
}

export function applyWorkflowEdit(source: string, edit: WorkflowEdit): string {
  const parsed = documentRoot(source)
  if (!parsed) return source
  const { doc, root } = parsed
  if (edit.type === 'set-name') {
    const name = cleanText(edit.name, 200)
    if (name.trim() === '') root.delete('name')
    else root.set('name', name)
  } else if (edit.type === 'set-triggers') {
    const previous = new Map<string, unknown>()
    const current = findPair(root, 'on')?.value
    if (isMap(current)) {
      for (const item of current.items) {
        const key = pairKey(item)
        if (key) previous.set(key, item.value)
      }
    }
    const next = new YAMLMap()
    const seen = new Set<string>()
    for (const trigger of edit.triggers.slice(0, 20)) {
      if (!TRIGGER_NAME.test(trigger) || seen.has(trigger)) continue
      seen.add(trigger)
      const value = previous.get(trigger)
      next.set(trigger, value === undefined ? new YAMLMap() : value)
    }
    root.set('on', next)
  } else if (edit.type === 'set-permissions') {
    applyPermissions(root, edit.permissions)
  } else if (edit.type === 'set-job-runs-on') {
    const job = jobMap(root, edit.jobId)
    job?.set('runs-on', runsOnValue(edit.runsOn))
  } else if (edit.type === 'set-job-permissions') {
    const job = jobMap(root, edit.jobId)
    if (job) applyPermissions(job, edit.permissions)
  } else if (edit.type === 'add-job') {
    ensureJobs(root).set(nextJobId(root), blankJob())
  } else if (edit.type === 'remove-job') {
    const jobs = findPair(root, 'jobs')?.value
    if (isMap(jobs)) jobs.delete(edit.jobId)
  } else if (edit.type === 'add-step') {
    const job = jobMap(root, edit.jobId)
    if (!job) return source
    const step = new YAMLMap()
    step.set('run', 'echo hello')
    stepsOf(job).add(step)
  } else if (edit.type === 'remove-step') {
    const job = jobMap(root, edit.jobId)
    if (!job) return source
    const steps = stepsOf(job)
    if (edit.index >= 0 && edit.index < steps.items.length) steps.items.splice(edit.index, 1)
  } else if (edit.type === 'set-step') {
    const job = jobMap(root, edit.jobId)
    if (!job) return source
    const steps = stepsOf(job)
    const current = steps.items[edit.index]
    const step = isMap(current) ? current : new YAMLMap()
    const name = cleanText(edit.step.name, 200)
    if (name.trim() === '') step.delete('name')
    else step.set('name', name)
    const value = cleanText(edit.step.value, 10_000)
    if (edit.step.mode === 'uses') {
      step.set('uses', value)
      step.delete('run')
    } else {
      step.set('run', value)
      step.delete('uses')
    }
    steps.items[edit.index] = step
  }
  return String(doc)
}
