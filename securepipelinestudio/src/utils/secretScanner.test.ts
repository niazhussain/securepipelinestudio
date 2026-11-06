import { describe, expect, it } from 'vitest'
import { scanSecrets } from './secretScanner'

describe('secret scanner', () => {
  it('finds known token shapes and private key headers', () => {
    const source = [
      'token: ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
      'aws: AKIAIOSFODNN7EXAMPLE',
      '-----BEGIN PRIVATE KEY-----',
      'fine: github_pat_11AAAAAAA0aaaaaaaaaaaaaaaaaaaa',
    ].join('\n')
    const kinds = scanSecrets(source).map((match) => match.kind)
    expect(kinds).toContain('GitHub token')
    expect(kinds).toContain('AWS access key ID')
    expect(kinds).toContain('private key')
    expect(kinds).toContain('GitHub fine-grained token')
  })

  it('does not treat a secret reference or a short prefix as a credential', () => {
    const source = 'run: echo ${{ secrets.GITHUB_TOKEN }}\n# ghp_short\n'
    expect(scanSecrets(source)).toEqual([])
  })

  it('returns a location and not the matched text', () => {
    const match = scanSecrets('name: x\nrun: ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789\n')[0]
    expect(match?.line).toBe(2)
    expect(JSON.stringify(match)).not.toContain('ghp_')
  })
})
