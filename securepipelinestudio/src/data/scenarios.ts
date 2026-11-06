const SHA = '0123456789abcdef0123456789abcdef01234567'

export interface AttackStep {
  attacker: string
  effect: string
  exposed: string
  brokenBy: string
}

export interface Scenario {
  id: string
  title: string
  summary: string
  vulnerable: string
  fixed: string
  riskyLines: number[]
  steps: AttackStep[]
  ruleIds: string[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'script-injection',
    title: 'Script injection from an issue title',
    summary: 'An issue title is untrusted text. Placing it inside a run script gives the author of the issue a chance to change what the shell command means.',
    riskyLines: [11],
    ruleIds: ['SPS-020'],
    vulnerable: `name: label-issue
on:
  issues:
    types: [opened]
permissions: {}
jobs:
  reply:
    runs-on: ubuntu-latest
    steps:
      - name: Echo the title
        run: echo "\${{ github.event.issue.title }}"
`,
    fixed: `name: label-issue
on:
  issues:
    types: [opened]
permissions: {}
jobs:
  reply:
    runs-on: ubuntu-latest
    steps:
      - name: Echo the title
        env:
          TITLE: \${{ github.event.issue.title }}
        run: echo "$TITLE"
`,
    steps: [
      {
        attacker: 'Opens an issue whose title is the placeholder attacker.example.',
        effect: 'GitHub expands the title into the run script before the shell starts.',
        exposed: 'Whatever the workflow could already read with its token, including the job token if the title changes the script.',
        brokenBy: 'The fixed workflow passes the title as an environment variable, so it is data rather than part of the script.',
      },
      {
        attacker: 'Relies on the shell treating the title as code.',
        effect: 'The runner executes the expanded script with the job token in the environment.',
        exposed: 'The job token and any secret mapped into that job.',
        brokenBy: 'Quoting "$TITLE" prints the text. It does not parse the title as a command.',
      },
    ],
  },
  {
    id: 'pull-request-target',
    title: 'pull_request_target checks out pull request code',
    summary: 'pull_request_target runs in the base repository and can receive secrets. Checking out the pull request head runs the contributor code in that privileged job.',
    riskyLines: [2, 12],
    ruleIds: ['SPS-030'],
    vulnerable: `name: review
on: pull_request_target
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${SHA}
        with:
          ref: \${{ github.event.pull_request.head.sha }}
          persist-credentials: false
      - run: npm test
`,
    fixed: `name: review
on: pull_request
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${SHA}
        with:
          persist-credentials: false
      - run: npm test
`,
    steps: [
      {
        attacker: 'Opens a pull request that changes a file the workflow will execute, and names the change attacker.example.',
        effect: 'pull_request_target checks out that commit inside a workflow that belongs to the base repository.',
        exposed: 'Secrets and the base repository token available to the job.',
        brokenBy: 'The fixed workflow uses pull_request, which does not receive the base repository secrets for a fork.',
      },
      {
        attacker: 'Waits for the privileged job to run the changed file.',
        effect: 'The job follows the contributor code.',
        exposed: 'Any secret passed into the job.',
        brokenBy: 'The checkout no longer selects the pull request head. It stays on the commit that triggered a same-repository review.',
      },
    ],
  },
  {
    id: 'mutable-tag',
    title: 'A third-party tag moves',
    summary: 'A marketplace action referenced by a moving tag can be changed by the publisher after you wrote the workflow. Pinning to a full commit SHA makes the reference immutable.',
    riskyLines: [9],
    ruleIds: ['SPS-001'],
    vulnerable: `name: deploy
on: push
permissions:
  contents: read
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: example-org/deploy@v1
`,
    fixed: `name: deploy
on: push
permissions:
  contents: read
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: example-org/deploy@${SHA}
`,
    steps: [
      {
        attacker: 'Publishes example-org/deploy and later moves the v1 tag to a different commit.',
        effect: 'The next run of this workflow fetches the new commit because the tag is not a commit SHA.',
        exposed: 'The token the job passes to the action.',
        brokenBy: 'A 40-character SHA does not move when the tag moves. The format check cannot prove the SHA is a release you trust.',
      },
      {
        attacker: 'The replacement commit reads the token and would send it to attacker.example.',
        effect: 'The action runs with the credentials of the job.',
        exposed: 'The job token.',
        brokenBy: 'The pinned SHA keeps the previously reviewed commit. Review that SHA out of band before trusting it.',
      },
    ],
  },
  {
    id: 'over-permissive-token',
    title: 'A write-all token',
    summary: 'permissions: write-all gives the job token every write scope, including contents and pull requests. A compromised step can use that token for more than the job needs.',
    riskyLines: [4],
    ruleIds: ['SPS-011'],
    vulnerable: `name: package
on: push
permissions: write-all
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`,
    fixed: `name: package
on: push
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`,
    steps: [
      {
        attacker: 'Finds a step that runs code they can influence. The lesson uses the placeholder attacker.example for that step.',
        effect: 'The job token is present in the environment with every write permission.',
        exposed: 'Permission to change repository contents, releases, and other write scopes.',
        brokenBy: 'The fixed workflow sets the default token to contents: read.',
      },
      {
        attacker: 'Uses the token to push a commit or edit a release.',
        effect: 'GitHub accepts the call because the token was granted write-all.',
        exposed: 'The contents of the repository and its release history.',
        brokenBy: 'A read token cannot push. Grant a write scope only on the job that needs it.',
      },
    ],
  },
  {
    id: 'artifact-poisoning',
    title: 'An artifact crosses a privilege boundary',
    summary: 'workflow_run runs in the base repository after another workflow finishes. An artifact from a fork is untrusted until the workflow checks the source repository and a digest.',
    riskyLines: [12],
    ruleIds: ['SPS-031'],
    vulnerable: `name: promote
on:
  workflow_run:
    workflows: ["ci.yml"]
    types: [completed]
permissions: {}
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@${SHA}
        with:
          name: build
`,
    fixed: `name: promote
on:
  workflow_run:
    workflows: ["ci.yml"]
    types: [completed]
permissions: {}
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Download only after the source is this repository
        if: github.event.workflow_run.head_repository.full_name == github.repository
        uses: actions/download-artifact@${SHA}
        with:
          name: build
      - name: Check the recorded digest
        run: sha256sum -c checksums.txt
`,
    steps: [
      {
        attacker: 'Runs the triggering workflow from a fork and uploads an artifact whose contents are the placeholder attacker.example.',
        effect: 'workflow_run starts in the base repository and downloads that artifact.',
        exposed: 'The base job can be influenced by the artifact, including secrets available to the privileged workflow.',
        brokenBy: 'The condition compares head_repository.full_name with github.repository and skips a fork.',
      },
      {
        attacker: 'Gives the artifact the same name the privileged job expects.',
        effect: 'The job treats the bytes as its own build output.',
        exposed: 'Any later step that executes or publishes those bytes.',
        brokenBy: 'sha256sum -c checksums.txt rejects bytes that do not match a digest recorded by the trusted workflow.',
      },
    ],
  },
]
