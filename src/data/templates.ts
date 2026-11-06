import type { GalleryTemplate } from '../services/gallery'

const checkout = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1'
const setupNode = 'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0'
const harden = 'step-security/harden-runner@1d88384fd173af6ecb012dfd0264a306b711241a # v2.22.4'
const uploadPages = 'actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0'
const deployPages = 'actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1'

function starter(partial: Omit<GalleryTemplate, 'source' | 'author'> & { author?: string }): GalleryTemplate {
  return { source: 'starter', author: partial.author ?? 'SecurePipeline', ...partial }
}

export const STARTER_TEMPLATES: GalleryTemplate[] = [
  starter({
    id: 'starter-node-ci',
    title: 'Node test workflow',
    description: 'Least-privilege CI for a Node project. Actions are pinned to commit SHAs, the token starts at empty, and checkout does not keep credentials.',
    tags: ['ci', 'node', 'least-privilege'],
    license: 'MIT',
    createdAt: '2026-10-02T00:00:00.000Z',
    yaml: `name: ci
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
        uses: ${harden}
        with:
          egress-policy: audit
      - name: Checkout
        uses: ${checkout}
        with:
          persist-credentials: false
      - name: Setup Node
        uses: ${setupNode}
        with:
          node-version: 24
      - name: Test
        run: npm test
`,
  }),
  starter({
    id: 'starter-pages',
    title: 'Pages deploy with OIDC',
    description: 'Publishes a static site with GitHub Pages OpenID Connect. id-token and pages write are granted only on the deploy job.',
    tags: ['pages', 'oidc', 'deploy'],
    license: 'MIT',
    createdAt: '2026-10-08T00:00:00.000Z',
    yaml: `name: pages
on:
  push:
    branches: [main]
permissions: {}
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      pages: write
      id-token: write
    steps:
      - name: Harden the runner
        uses: ${harden}
        with:
          egress-policy: audit
      - name: Checkout
        uses: ${checkout}
        with:
          persist-credentials: false
      - name: Setup Node
        uses: ${setupNode}
        with:
          node-version: 24
      - name: Build
        run: npm ci && npm run build
      - name: Upload Pages artifact
        uses: ${uploadPages}
        with:
          path: dist
      - name: Deploy Pages
        uses: ${deployPages}
`,
  }),
  starter({
    id: 'starter-docker',
    title: 'Pinned container step',
    description: 'Runs a container step addressed by image digest rather than a moving tag.',
    tags: ['docker', 'digest'],
    license: 'Apache-2.0',
    createdAt: '2026-10-12T00:00:00.000Z',
    yaml: `name: container
on:
  push:
permissions: {}
concurrency:
  group: container-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  scan:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - name: Harden the runner
        uses: ${harden}
        with:
          egress-policy: audit
      - name: Checkout
        uses: ${checkout}
        with:
          persist-credentials: false
      - name: Echo from a pinned image
        uses: docker://ghcr.io/example/app@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
`,
  }),
  starter({
    id: 'starter-reusable',
    title: 'Call a pinned reusable workflow',
    description: 'Calls a reusable workflow by full commit SHA and passes one named secret instead of secrets: inherit.',
    tags: ['reusable', 'secrets'],
    license: 'MIT',
    createdAt: '2026-10-18T00:00:00.000Z',
    yaml: `name: call-reusable
on:
  workflow_dispatch:
permissions: {}
concurrency:
  group: reusable-\${{ github.ref }}
  cancel-in-progress: false
jobs:
  call:
    timeout-minutes: 20
    permissions:
      contents: read
    uses: example-org/secure-workflows/.github/workflows/ci.yml@0123456789abcdef0123456789abcdef01234567
    secrets:
      TOKEN: \${{ secrets.TOKEN }}
`,
  }),
  starter({
    id: 'starter-schedule',
    title: 'Scheduled maintenance',
    description: 'A weekly job on a GitHub-hosted runner with a timeout, concurrency, and no pull request trigger.',
    tags: ['schedule', 'maintenance'],
    license: 'ISC',
    createdAt: '2026-10-22T00:00:00.000Z',
    yaml: `name: weekly
on:
  schedule:
    - cron: '0 6 * * 1'
permissions: {}
concurrency:
  group: weekly
  cancel-in-progress: false
jobs:
  tidy:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - name: Harden the runner
        uses: ${harden}
        with:
          egress-policy: audit
      - name: Checkout
        uses: ${checkout}
        with:
          persist-credentials: false
      - name: Check formatting
        run: npm test
`,
  }),
  starter({
    id: 'starter-release-read',
    title: 'Read-only release check',
    description: 'Runs on published releases but only reads the repository. It does not grant write scopes or long-lived cloud keys.',
    tags: ['release', 'least-privilege'],
    license: 'MIT',
    createdAt: '2026-10-28T00:00:00.000Z',
    yaml: `name: release-check
on:
  release:
    types: [published]
permissions: {}
concurrency:
  group: release-\${{ github.ref }}
  cancel-in-progress: false
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - name: Harden the runner
        uses: ${harden}
        with:
          egress-policy: audit
      - name: Checkout
        uses: ${checkout}
        with:
          persist-credentials: false
      - name: Setup Node
        uses: ${setupNode}
        with:
          node-version: 24
      - name: Verify
        run: npm test
`,
  }),
]
