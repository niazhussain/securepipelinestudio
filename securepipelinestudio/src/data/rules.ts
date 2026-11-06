import type { Severity } from '../utils/model'

export interface RuleDefinition {
  id: string
  title: string
  severity: Severity
  rationale: string
  remediation: string
  reference: string
}

const HARDENING = 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions'

export const RULES: RuleDefinition[] = [
  {
    id: 'SPS-001',
    title: 'Third-party action is not pinned to a full commit SHA',
    severity: 'high',
    rationale:
      'A tag or branch is mutable. The publisher, or someone who compromises the repository, can move it to code that steals tokens or changes a release. A full 40-character commit SHA pins the exact tree you reviewed.',
    remediation: 'Replace the tag or branch with the full commit SHA of the release you intend to run, and keep the version in a comment.',
    reference: `${HARDENING}#using-third-party-actions`,
  },
  {
    id: 'SPS-002',
    title: 'First-party action is pinned by tag or branch',
    severity: 'medium',
    rationale:
      'actions/* and github/* are maintained by GitHub, but a moving tag still changes what runs. Pinning to a commit SHA makes an upgrade a deliberate review.',
    remediation: 'Pin actions/* and github/* references to a full commit SHA and record the version in a trailing comment.',
    reference: `${HARDENING}#using-third-party-actions`,
  },
  {
    id: 'SPS-003',
    title: 'Container or reusable workflow is not pinned',
    severity: 'medium',
    rationale:
      'A docker:// image without a digest, or a reusable workflow referenced by tag or branch, can change between runs. Digests and commit SHAs identify one artifact.',
    remediation: 'Pin container images with @sha256:<64 hex chars> and reusable workflows with a full commit SHA.',
    reference: `${HARDENING}#using-third-party-actions`,
  },
  {
    id: 'SPS-010',
    title: 'Workflow has no top-level permissions',
    severity: 'high',
    rationale:
      'If the permissions key is omitted, the GITHUB_TOKEN keeps the repository default, which may be permissive. An explicit top-level permissions block makes the default deny, and jobs opt in to what they need.',
    remediation: 'Set permissions: {} at the workflow root and grant the smallest scopes on each job.',
    reference: 'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions',
  },
  {
    id: 'SPS-011',
    title: 'Token permissions are broader than this job needs',
    severity: 'high',
    rationale:
      'write-all, several write scopes, or id-token: write without an OpenID Connect login give a compromised step more power. A stolen token can then push code, publish packages, or assume a cloud role.',
    remediation: 'Grant contents: read by default. Add a write scope only on the job that needs it. Use id-token: write only beside an OIDC action such as a cloud login or deploy-pages.',
    reference: 'https://docs.github.com/en/actions/tutorials/authenticate-with-github_token',
  },
  {
    id: 'SPS-020',
    title: 'Untrusted context is interpolated into a script',
    severity: 'critical',
    rationale:
      'Issue titles, pull request bodies, comment bodies, head refs, and commit messages are attacker-controlled. GitHub substitutes ${{ }} before the shell or github-script runs, so a crafted title can break out of quotes and run commands.',
    remediation: 'Pass the value through an environment variable and use the shell variable inside run. Do not place the expression directly in the script.',
    reference: `${HARDENING}#understanding-the-risk-of-script-injections`,
  },
  {
    id: 'SPS-030',
    title: 'pull_request_target runs code the pull request controls',
    severity: 'critical',
    rationale:
      'pull_request_target runs in the base repository and receives its secrets. Checking out the pull request head, or executing a script from that tree, lets a fork run code with those secrets.',
    remediation: 'Check out the base ref only, or switch the trigger to pull_request, which does not expose repository secrets to fork code.',
    reference: 'https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target',
  },
  {
    id: 'SPS-031',
    title: 'workflow_run consumes artifacts without validation',
    severity: 'high',
    rationale:
      'workflow_run can run with the base repository privileges after a workflow that a fork started. Artifacts from that run are attacker-controlled until you check the source repository and verify a digest or signature.',
    remediation: 'Require head_repository.full_name == github.repository before download, and verify a checksum or signature before use.',
    reference: `${HARDENING}#preventing-pwn-requests`,
  },
  {
    id: 'SPS-040',
    title: 'Hardcoded secret or token',
    severity: 'critical',
    rationale:
      'A token or private key in a workflow file is copied into git history, logs, and forks. Anyone who can read the file can use it.',
    remediation: 'Remove the value, rotate it, and read it from GitHub Actions secrets. Never print secrets.',
    reference: 'https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions',
  },
  {
    id: 'SPS-041',
    title: 'Secrets are inherited or exposed to every job',
    severity: 'medium',
    rationale:
      'secrets: inherit forwards every secret to a called workflow, including ones that workflow does not need. A workflow-level env entry that reads a secret exposes it to every job.',
    remediation: 'Pass a named secret map into reusable workflows. Keep secret environment variables on the job or step that uses them.',
    reference: 'https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions',
  },
  {
    id: 'SPS-050',
    title: 'A download is piped into a shell',
    severity: 'high',
    rationale:
      'curl or wget piped to bash or sh runs remote code with no review and no pin. The URL can change or be redirected.',
    remediation: 'Commit the script, or download a pinned release and verify its checksum before executing it.',
    reference: `${HARDENING}#using-third-party-actions`,
  },
  {
    id: 'SPS-060',
    title: 'Checkout keeps credentials for later third-party code',
    severity: 'medium',
    rationale:
      'actions/checkout persists a credential by default. A later third-party action or script can read it and push to the repository or call the API.',
    remediation: 'Set persist-credentials: false on checkout before any third-party code runs. Pass a short-lived token only to the step that needs it.',
    reference: `${HARDENING}#using-third-party-actions`,
  },
  {
    id: 'SPS-070',
    title: 'Self-hosted runner is reachable from a public event',
    severity: 'high',
    rationale:
      'A self-hosted runner is a machine you operate. A pull request or issue event can schedule work on it, and a malicious job can stay resident or read other jobs files.',
    remediation: 'Use a GitHub-hosted runner for pull requests and other untrusted events. Keep self-hosted runners on push to protected branches or workflow_dispatch.',
    reference: `${HARDENING}#hardening-for-self-hosted-runners`,
  },
  {
    id: 'SPS-080',
    title: 'Unsecure workflow commands are enabled',
    severity: 'high',
    rationale:
      'ACTIONS_ALLOW_UNSECURE_COMMANDS restores the old set-env and add-path stdout commands. Untrusted output can then change the environment or PATH of later steps.',
    remediation: 'Remove ACTIONS_ALLOW_UNSECURE_COMMANDS. Use environment files and $GITHUB_ENV only with trusted values.',
    reference: `${HARDENING}#understanding-the-risk-of-script-injections`,
  },
  {
    id: 'SPS-090',
    title: 'Timeout or concurrency is missing',
    severity: 'low',
    rationale:
      'A job without timeout-minutes can run until the host limit. A workflow without concurrency can pile up duplicate runs and waste runners or race a deploy.',
    remediation: 'Set timeout-minutes on every job and a concurrency group on the workflow, cancelling outdated runs when that is safe.',
    reference: 'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes',
  },
  {
    id: 'SPS-091',
    title: 'Long-lived cloud credential is used where OIDC exists',
    severity: 'low',
    rationale:
      'Static cloud keys live in secret storage and are valid until someone rotates them. GitHub OpenID Connect can mint a short-lived credential for the job instead.',
    remediation: 'Remove static cloud keys and assume a role with the cloud provider OIDC action. Grant id-token: write only on that job.',
    reference: `${HARDENING}#using-openid-connect-to-access-cloud-resources`,
  },
  {
    id: 'SPS-100',
    title: 'GitHub-hosted runner has no harden-runner step',
    severity: 'info',
    rationale:
      'step-security/harden-runner audits or blocks outbound traffic from a GitHub-hosted job. It does not fix an injection by itself, and this advisory never changes the grade.',
    remediation: 'Add a pinned step-security/harden-runner step with egress-policy: audit, then tighten the policy once the expected hosts are known.',
    reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
  },
]

const BY_ID = new Map(RULES.map((rule) => [rule.id, rule]))

export function ruleById(id: string): RuleDefinition {
  const rule = BY_ID.get(id)
  if (!rule) throw new Error('Unknown rule')
  return rule
}
