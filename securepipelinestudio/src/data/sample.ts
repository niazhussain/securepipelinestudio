export const DEMO_WORKFLOW = `name: demo
on:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: example-org/deploy@v1
      - name: Print title
        run: echo "\${{ github.event.pull_request.title }}"
`

export const SECURE_WORKFLOW = `name: ci
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
