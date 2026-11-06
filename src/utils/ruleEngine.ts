import { ruleById } from '../data/rules'
import type { Finding, JobModel, PermissionModel, StepModel, WorkflowModel } from './model'
import { scanSecrets } from './secretScanner'
import { classifyUses, runnerIsGitHubHosted, runnerIsSelfHosted } from './uses'

const UNTRUSTED: { label: string; pattern: RegExp }[] = [
  { label: 'an issue title', pattern: /github\.event\.issue\.title\b/ },
  { label: 'an issue body', pattern: /github\.event\.issue\.body\b/ },
  { label: 'a pull request title', pattern: /github\.event\.pull_request\.title\b/ },
  { label: 'a pull request body', pattern: /github\.event\.pull_request\.body\b/ },
  { label: 'a comment body', pattern: /github\.event\.comment\.body\b/ },
  { label: 'a review body', pattern: /github\.event\.review\.body\b/ },
  { label: 'a review comment', pattern: /github\.event\.review_comment\.body\b/ },
  { label: 'a discussion title', pattern: /github\.event\.discussion\.title\b/ },
  { label: 'a discussion body', pattern: /github\.event\.discussion\.body\b/ },
  { label: 'a head ref', pattern: /github\.head_ref\b/ },
  { label: 'a pull request head ref', pattern: /github\.event\.pull_request\.head\.ref\b/ },
  { label: 'a pull request head label', pattern: /github\.event\.pull_request\.head\.label\b/ },
  { label: 'a commit message', pattern: /github\.event\.head_commit\.message\b/ },
  { label: 'a commit message', pattern: /github\.event\.commits(?:\[[^\]]*\]|\.[A-Za-z0-9_]+)*\.message\b/ },
  { label: 'a workflow run commit message', pattern: /github\.event\.workflow_run\.head_commit\.message\b/ },
]

const UNTRUSTED_EVENTS = new Set([
  'pull_request',
  'pull_request_target',
  'pull_request_review',
  'pull_request_review_comment',
  'issues',
  'issue_comment',
  'discussion',
  'discussion_comment',
  'workflow_run',
  'fork',
  'watch',
  'public',
  'repository_dispatch',
  'merge_group',
])

const DANGEROUS_WRITE = new Set(['actions', 'administration', 'members'])

const OIDC_MARKERS = [
  'configure-aws-credentials',
  'azure/login',
  'google-github-actions/auth',
  'actions/deploy-pages',
  'actions/attest',
  'pypa/gh-action-pypi-publish',
  'docker/login-action',
  'hashicorp/vault-action',
]

const LONG_LIVED = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AZURE_CLIENT_SECRET',
  'AZURE_CLIENT_CERTIFICATE',
  'GOOGLE_CREDENTIALS',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GCP_SERVICE_ACCOUNT',
  'GCLOUD_SERVICE_KEY',
]

const CHECKOUT_FIX = `- uses: actions/checkout@<40-character-commit-sha>
  with:
    persist-credentials: false`

function clip(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean
}

function makeFinding(
  ruleId: string,
  details: {
    message: string
    line: number
    column: number
    jobId?: string
    step?: number
    fix: string
  },
): Finding {
  const rule = ruleById(ruleId)
  return {
    ruleId: rule.id,
    title: rule.title,
    severity: rule.severity,
    rationale: rule.rationale,
    remediation: rule.remediation,
    reference: rule.reference,
    message: details.message,
    line: details.line,
    column: details.column,
    jobId: details.jobId,
    step: details.step,
    fix: details.fix,
  }
}

function untrustedLabel(text: string): string | null {
  const expression = /\$\{\{([\s\S]*?)\}\}/g
  let match: RegExpExecArray | null
  while ((match = expression.exec(text))) {
    const body = match[1] ?? ''
    for (const item of UNTRUSTED) {
      if (item.pattern.test(body)) return item.label
    }
  }
  return null
}

function usesOidc(job: JobModel): boolean {
  const names = [job.uses ?? '', ...job.steps.map((step) => step.uses ?? '')]
  return names.some((name) => OIDC_MARKERS.some((marker) => name.includes(marker)))
}

function workflowUsesOidc(model: WorkflowModel): boolean {
  return model.jobs.some((job) => usesOidc(job))
}

function permissionIsBroad(permissions: PermissionModel): boolean {
  if (!permissions.present) return false
  if (permissions.kind === 'write-all') return true
  if (permissions.kind === 'scalar' && (permissions.scalar ?? '').toLowerCase().includes('write')) return true
  const writes = Object.entries(permissions.scopes).filter(([key, value]) => value === 'write' && key !== 'id-token')
  if (writes.length >= 2) return true
  return writes.some(([key]) => DANGEROUS_WRITE.has(key))
}

function idTokenWithoutNeed(permissions: PermissionModel, justified: boolean): boolean {
  if (permissions.kind === 'write-all') return false
  return permissions.scopes['id-token'] === 'write' && !justified
}

function pushPermissions(
  findings: Finding[],
  permissions: PermissionModel,
  justified: boolean,
  jobId?: string,
): void {
  if (permissionIsBroad(permissions)) {
    findings.push(
      makeFinding('SPS-011', {
        message: jobId
          ? `Job "${clip(jobId)}" grants broad write access to GITHUB_TOKEN.`
          : 'The workflow grants broad write access to GITHUB_TOKEN.',
        line: permissions.line,
        column: permissions.column,
        jobId,
        fix: `permissions:\n  contents: read`,
      }),
    )
  }
  if (idTokenWithoutNeed(permissions, justified)) {
    findings.push(
      makeFinding('SPS-011', {
        message: jobId
          ? `Job "${clip(jobId)}" sets id-token: write without an OpenID Connect action.`
          : 'The workflow sets id-token: write without an OpenID Connect action.',
        line: permissions.line,
        column: permissions.column,
        jobId,
        fix: `permissions:\n  contents: read\n# Add id-token: write only on a job that assumes a cloud role or deploys Pages.`,
      }),
    )
  }
}

function eachUse(model: WorkflowModel): {
  uses: string
  jobId: string
  step?: number
  line: number
  column: number
}[] {
  const uses: {
    uses: string
    jobId: string
    step?: number
    line: number
    column: number
  }[] = []
  for (const job of model.jobs) {
    if (job.uses) {
      uses.push({ uses: job.uses, jobId: job.id, line: job.usesLine, column: job.usesColumn })
    }
    for (const step of job.steps) {
      if (!step.uses) continue
      uses.push({
        uses: step.uses,
        jobId: job.id,
        step: step.index,
        line: step.line,
        column: step.column,
      })
    }
  }
  return uses
}

function checkoutKeepsCredentials(step: StepModel): boolean {
  return step.with['persist-credentials'] !== 'false'
}

function laterThirdParty(job: JobModel, stepIndex: number): boolean {
  return job.steps.slice(stepIndex).some((step) => {
    if (!step.uses) return false
    const kind = classifyUses(step.uses).kind
    return kind === 'third-party' || kind === 'docker'
  })
}

const PIPE_TO_SHELL = /(curl|wget)\b[\s\S]{0,400}\|\s*(?:sudo\s+)?(?:ba)?sh\b/i
const PROCESS_SUB = /(?:ba)?sh\b[^\n]{0,200}<\s*\(\s*(?:curl|wget)\b/i
const PR_CONTROLLED = /github\.event\.pull_request\.head\.|github\.head_ref\b|refs\/pull\/|github\.event\.pull_request\.number/

function enabled(value: string): boolean {
  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function isLongLived(key: string, value: string): boolean {
  const blob = `${key}\n${value}`.toUpperCase()
  return LONG_LIVED.some((name) => blob.includes(name))
}

export function runRules(model: WorkflowModel, source: string): Finding[] {
  const findings: Finding[] = []

  for (const item of eachUse(model)) {
    const used = classifyUses(item.uses)
    const shown = clip(item.uses)
    if (used.kind === 'third-party' && !used.pinnedSha) {
      findings.push(
        makeFinding('SPS-001', {
          message: `The third-party action "${shown}" is not pinned to a full 40-character commit SHA.`,
          ...item,
          fix: `- uses: owner/action@<40-character-commit-sha> # v1.2.3`,
        }),
      )
    }
    if (used.kind === 'first-party' && !used.pinnedSha) {
      findings.push(
        makeFinding('SPS-002', {
          message: `The first-party action "${shown}" is pinned by a tag, branch, or missing ref.`,
          ...item,
          fix: `- uses: actions/checkout@<40-character-commit-sha> # v7.0.1`,
        }),
      )
    }
    if (used.kind === 'docker' && !used.hasDigest) {
      findings.push(
        makeFinding('SPS-003', {
          message: `The container "${shown}" has no image digest.`,
          ...item,
          fix: `- uses: docker://image@sha256:<64-character-digest>`,
        }),
      )
    }
    if (used.kind === 'reusable' && !used.pinnedSha) {
      findings.push(
        makeFinding('SPS-003', {
          message: `The reusable workflow "${shown}" is not pinned to a full commit SHA.`,
          ...item,
          fix: `uses: org/repo/.github/workflows/ci.yml@<40-character-commit-sha>`,
        }),
      )
    }
  }

  if (!model.permissions.present) {
    findings.push(
      makeFinding('SPS-010', {
        message: 'This workflow does not set a top-level permissions block.',
        line: 1,
        column: 1,
        fix: `permissions: {}`,
      }),
    )
  }
  pushPermissions(findings, model.permissions, workflowUsesOidc(model))
  for (const job of model.jobs) {
    pushPermissions(findings, job.permissions, usesOidc(job), job.id)
  }

  for (const job of model.jobs) {
    for (const step of job.steps) {
      const script = step.run ?? ''
      const label = script ? untrustedLabel(script) : null
      if (label) {
        findings.push(
          makeFinding('SPS-020', {
            message: `Job "${clip(job.id)}" step ${step.index} interpolates ${label} directly into run.`,
            line: step.line,
            column: step.column,
            jobId: job.id,
            step: step.index,
            fix: `- name: Use an environment variable\n  env:\n    VALUE: \${{ github.event.issue.title }}\n  run: echo "$VALUE"`,
          }),
        )
      }
      if (step.uses && step.uses.startsWith('actions/github-script')) {
        const scriptLabel = untrustedLabel(step.with.script ?? '')
        if (scriptLabel) {
          findings.push(
            makeFinding('SPS-020', {
              message: `Job "${clip(job.id)}" step ${step.index} interpolates ${scriptLabel} into actions/github-script.`,
              line: step.line,
              column: step.column,
              jobId: job.id,
              step: step.index,
              fix: `script: |\n  const title = context.payload.issue.title\n  core.info(title)`,
            }),
          )
        }
      }
    }
  }

  if (model.triggers.includes('pull_request_target')) {
    for (const job of model.jobs) {
      let checkedOutUntrusted = false
      for (const step of job.steps) {
        const checkout = !!step.uses && classifyUses(step.uses).name.startsWith('actions/checkout')
        const untrustedCheckout = checkout && PR_CONTROLLED.test(`${step.with.ref ?? ''}\n${step.with.repository ?? ''}`)
        const untrustedRun = !!step.run && PR_CONTROLLED.test(step.run) && /git\s+(checkout|clone|fetch)|actions\/checkout|\$\{\{/.test(step.run)
        const localAfterCheckout = !!step.uses && (step.uses.startsWith('./') || step.uses.startsWith('.\\')) && checkedOutUntrusted
        if (untrustedCheckout || untrustedRun || localAfterCheckout) {
          findings.push(
            makeFinding('SPS-030', {
              message: `pull_request_target in job "${clip(job.id)}" checks out or runs pull-request-controlled code.`,
              line: step.line,
              column: step.column,
              jobId: job.id,
              step: step.index,
              fix: CHECKOUT_FIX + '\n# On pull_request_target, do not set ref to the pull request head.',
            }),
          )
        }
        if (untrustedCheckout || untrustedRun) checkedOutUntrusted = true
      }
    }
  }

  if (model.triggers.includes('workflow_run')) {
    const validated = /head_repository\.full_name\s*==\s*github\.repository/.test(source) || /sha256sum|shasum\s+-a|cosign\s+verify|gpg\s+--verify|minisign\s+-V/.test(source)
    if (!validated) {
      for (const job of model.jobs) {
        for (const step of job.steps) {
          const uses = step.uses ?? ''
          const run = step.run ?? ''
          if (/download-artifact/.test(uses) || /gh\s+run\s+download|downloadArtifact|download-artifact/.test(run)) {
            findings.push(
              makeFinding('SPS-031', {
                message: `Job "${clip(job.id)}" downloads a workflow_run artifact without checking the source repository or a digest.`,
                line: step.line,
                column: step.column,
                jobId: job.id,
                step: step.index,
                fix: `- name: Trust the same repository only\n  if: github.event.workflow_run.head_repository.full_name == github.repository\n  run: echo "Add a checksum or signature check before using the artifact"`,
              }),
            )
          }
        }
      }
    }
  }

  for (const match of scanSecrets(source)) {
    findings.push(
      makeFinding('SPS-040', {
        message: `A ${match.kind} pattern is hardcoded at this line. Remove it and rotate the credential.`,
        line: match.line,
        column: match.column,
        fix: `env:\n  TOKEN: \${{ secrets.EXAMPLE_TOKEN }}`,
      }),
    )
  }

  for (const entry of model.env) {
    if (entry.value.includes('secrets.')) {
      findings.push(
        makeFinding('SPS-041', {
          message: `Workflow-level environment variable "${clip(entry.key)}" exposes a secret to every job.`,
          line: entry.line,
          column: entry.column,
          fix: `# Move the secret environment variable onto the single job or step that needs it.`,
        }),
      )
    }
  }
  for (const job of model.jobs) {
    if (job.secretsInherit) {
      findings.push(
        makeFinding('SPS-041', {
          message: `Job "${clip(job.id)}" uses secrets: inherit, which forwards every secret.`,
          line: job.secretsLine,
          column: job.secretsColumn,
          jobId: job.id,
          fix: `secrets:\n  TOKEN: \${{ secrets.TOKEN }}`,
        }),
      )
    }
  }

  for (const job of model.jobs) {
    for (const step of job.steps) {
      if (!step.run) continue
      if (PIPE_TO_SHELL.test(step.run) || PROCESS_SUB.test(step.run)) {
        findings.push(
          makeFinding('SPS-050', {
            message: `Job "${clip(job.id)}" step ${step.index} pipes a download into a shell.`,
            line: step.line,
            column: step.column,
            jobId: job.id,
            step: step.index,
            fix: `# Download a pinned file, verify its checksum, then run the local file.`,
          }),
        )
      }
    }
  }

  for (const job of model.jobs) {
    job.steps.forEach((step, index) => {
      if (!step.uses || !classifyUses(step.uses).name.startsWith('actions/checkout')) return
      if (!checkoutKeepsCredentials(step)) return
      if (!laterThirdParty(job, index + 1)) return
      findings.push(
        makeFinding('SPS-060', {
          message: `Job "${clip(job.id)}" checks out with credentials that remain available to later third-party code.`,
          line: step.line,
          column: step.column,
          jobId: job.id,
          step: step.index,
          fix: CHECKOUT_FIX,
        }),
      )
    })
  }

  const publicEvent = model.triggers.some((event) => UNTRUSTED_EVENTS.has(event))
  if (publicEvent) {
    for (const job of model.jobs) {
      if (!runnerIsSelfHosted(job.runsOn)) continue
      findings.push(
        makeFinding('SPS-070', {
          message: `Job "${clip(job.id)}" uses a self-hosted runner and can be triggered by a public or pull request event.`,
          line: job.runsOnLine,
          column: job.runsOnColumn,
          jobId: job.id,
          fix: `runs-on: ubuntu-latest`,
        }),
      )
    }
  }

  const envBlocks = [
    ...model.env.map((entry) => ({ ...entry, jobId: undefined as string | undefined })),
    ...model.jobs.flatMap((job) => [
      ...job.env.map((entry) => ({ ...entry, jobId: job.id })),
      ...job.steps.flatMap((step) => step.env.map((entry) => ({ ...entry, jobId: job.id }))),
    ]),
  ]
  for (const entry of envBlocks) {
    if (entry.key === 'ACTIONS_ALLOW_UNSECURE_COMMANDS' && enabled(entry.value)) {
      findings.push(
        makeFinding('SPS-080', {
          message: 'ACTIONS_ALLOW_UNSECURE_COMMANDS is enabled.',
          line: entry.line,
          column: entry.column,
          jobId: entry.jobId,
          fix: `# Delete ACTIONS_ALLOW_UNSECURE_COMMANDS.`,
        }),
      )
    }
    if (isLongLived(entry.key, entry.value)) {
      findings.push(
        makeFinding('SPS-091', {
          message: `Environment variable "${clip(entry.key)}" looks like a long-lived cloud credential.`,
          line: entry.line,
          column: entry.column,
          jobId: entry.jobId,
          fix: `- uses: aws-actions/configure-aws-credentials@<40-character-commit-sha>\n  with:\n    role-to-assume: arn:aws:iam::123456789012:role/example\n    aws-region: us-east-1`,
        }),
      )
    }
  }
  for (const job of model.jobs) {
    for (const step of job.steps) {
      for (const [key, value] of Object.entries(step.with)) {
        if (!isLongLived(key, value)) continue
        findings.push(
          makeFinding('SPS-091', {
            message: `Step input "${clip(key)}" in job "${clip(job.id)}" looks like a long-lived cloud credential.`,
            line: step.line,
            column: step.column,
            jobId: job.id,
            step: step.index,
            fix: `- uses: aws-actions/configure-aws-credentials@<40-character-commit-sha>\n  with:\n    role-to-assume: arn:aws:iam::123456789012:role/example\n    aws-region: us-east-1`,
          }),
        )
      }
    }
  }

  if (!model.concurrency) {
    findings.push(
      makeFinding('SPS-090', {
        message: 'The workflow does not set concurrency.',
        line: model.triggerLine,
        column: 1,
        fix: `concurrency:\n  group: \${{ github.workflow }}-\${{ github.ref }}\n  cancel-in-progress: true`,
      }),
    )
  }
  for (const job of model.jobs) {
    if (job.timeoutSet) continue
    findings.push(
      makeFinding('SPS-090', {
        message: `Job "${clip(job.id)}" does not set timeout-minutes.`,
        line: job.line,
        column: job.column,
        jobId: job.id,
        fix: `timeout-minutes: 15`,
      }),
    )
  }

  for (const job of model.jobs) {
    if (!runnerIsGitHubHosted(job.runsOn)) continue
    const hardened = job.steps.some((step) => step.uses?.includes('step-security/harden-runner'))
    if (hardened) continue
    findings.push(
      makeFinding('SPS-100', {
        message: `Job "${clip(job.id)}" runs on a GitHub-hosted runner without step-security/harden-runner.`,
        line: job.runsOnLine,
        column: job.runsOnColumn,
        jobId: job.id,
        fix: `- uses: step-security/harden-runner@<40-character-commit-sha>\n  with:\n    egress-policy: audit`,
      }),
    )
  }

  return findings
}
