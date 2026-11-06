import { compressToEncodedURIComponent } from 'lz-string'
import { describe, expect, it } from 'vitest'
import { analyzeWorkflow } from '../utils/analyze'
import { buildSharePayload, decodeShare, encodeShare, shareFragment } from './shareCodec'

const analyzed = analyzeWorkflow('name: demo\non: push\npermissions: {}\njobs: {}\n')

describe('share codec', () => {
  it('round-trips a payload and uses the HashRouter fragment', () => {
    const payload = buildSharePayload(analyzed, '2026-11-06T00:00:00.000Z', 'name: demo\n')
    const encoded = encodeShare(payload, 'https://example.github.io/securepipelinestudio/')
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    expect(encoded.fragment.startsWith('#/s?d=')).toBe(true)
    expect(shareFragment(encoded.encoded)).toBe(encoded.fragment)
    const decoded = decodeShare(encoded.encoded)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.data.workflow).toBe('name: demo\n')
    expect(decoded.data.grade).toBe(payload.grade)
  })

  it('refuses an oversized link and a huge decompressed body', () => {
    const expanded = compressToEncodedURIComponent(JSON.stringify({ blob: 'A'.repeat(300 * 1024) }))
    expect(decodeShare(expanded).ok).toBe(false)
    expect(decodeShare('a'.repeat(32_001)).ok).toBe(false)
    const tooBig = buildSharePayload(analyzed, '2026-11-06T00:00:00.000Z', 'A'.repeat(300 * 1024))
    expect(encodeShare(tooBig).ok).toBe(false)
  })

  it('rejects malformed and schema-invalid input without throwing', () => {
    expect(decodeShare('').ok).toBe(false)
    expect(decodeShare('%%%not-a-link%%%').ok).toBe(false)
    const payload = buildSharePayload(analyzed, '2026-11-06T00:00:00.000Z')
    const encoded = encodeShare({ ...payload, grade: 'Z' as 'A' })
    expect(encoded.ok).toBe(false)
  })
})
