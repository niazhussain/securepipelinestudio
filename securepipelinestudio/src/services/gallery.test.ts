import { describe, expect, it, vi } from 'vitest'
import { loadGallery, parseTemplateRow } from './gallery'

describe('gallery loading', () => {
  it('uses starters and does not call the network when Supabase is not configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const result = await loadGallery()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.source).toBe('starter')
    expect(result.templates.length).toBeGreaterThanOrEqual(6)
    expect(result.notice).toMatch(/not configured/)
  })

  it('drops a row that fails validation', () => {
    expect(parseTemplateRow({ title: 'short' })).toBeNull()
    const parsed = parseTemplateRow({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Pinned checkout',
      description: 'A community example.',
      tags: ['ci'],
      license: 'MIT',
      yaml: 'name: ci\n',
      created_at: '2026-11-01T00:00:00.000Z',
      author_handle: 'octocat',
    })
    expect(parsed?.source).toBe('community')
    expect(parsed?.author).toBe('octocat')
  })
})
