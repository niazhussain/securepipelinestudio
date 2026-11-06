export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface PermissionModel {
  present: boolean
  kind: 'missing' | 'empty' | 'read-all' | 'write-all' | 'scalar' | 'map'
  scalar?: string
  scopes: Record<string, string>
  line: number
  column: number
}

export interface EnvEntry {
  key: string
  value: string
  line: number
  column: number
}

export interface StepModel {
  index: number
  name?: string
  uses?: string
  run?: string
  with: Record<string, string>
  env: EnvEntry[]
  line: number
  column: number
}

export interface JobModel {
  id: string
  name?: string
  runsOn: string[]
  runsOnLine: number
  runsOnColumn: number
  permissions: PermissionModel
  timeoutSet: boolean
  steps: StepModel[]
  env: EnvEntry[]
  secretsInherit: boolean
  secretsLine: number
  secretsColumn: number
  uses?: string
  usesLine: number
  usesColumn: number
  line: number
  column: number
}

export interface WorkflowModel {
  name?: string
  triggers: string[]
  triggerLine: number
  permissions: PermissionModel
  env: EnvEntry[]
  concurrency: boolean
  jobs: JobModel[]
}

export interface ParseError {
  message: string
  line: number
  column: number
}

export interface ParseResult {
  model: WorkflowModel | null
  parseError: ParseError | null
  warnings: string[]
}

export interface Finding {
  ruleId: string
  title: string
  severity: Severity
  rationale: string
  remediation: string
  reference: string
  message: string
  jobId?: string
  step?: number
  line: number
  column: number
  fix: string
}

export type AnalysisStatus = 'empty' | 'too-large' | 'invalid' | 'error' | 'ok'

export interface AnalysisResult {
  status: AnalysisStatus
  bytes: number
  parseError: ParseError | null
  warnings: string[]
  findings: Finding[]
  score: number
  grade: Grade
  workflowName?: string
}

export const MISSING_PERMISSIONS: PermissionModel = {
  present: false,
  kind: 'missing',
  scopes: {},
  line: 1,
  column: 1,
}
