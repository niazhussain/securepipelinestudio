import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAllLocalData, migrateDraft, migrateHistory, migrateSettings, readDraft, writeDraft } from './storage'

afterEach(() => {
  localStorage.clear()
})

describe('storage', () => {
  it('migrates an unversioned draft, settings object, and history array', () => {
    expect(migrateDraft({ yaml: 'name: old\n', updatedAt: '2020-01-01T00:00:00.000Z' })?.schemaVersion).toBe(1)
    expect(migrateSettings({ theme: 'light' })?.theme).toBe('light')
    expect(migrateSettings({ theme: 'light' })?.schemaVersion).toBe(1)
    const history = migrateHistory([
      { id: '1', at: '2020-01-01T00:00:00.000Z', grade: 'A', score: 100, findingCount: 0, workflowName: 'ci' },
    ])
    expect(history?.schemaVersion).toBe(1)
    expect(history?.items).toHaveLength(1)
  })

  it('reads a migrated draft back through the versioned key', () => {
    localStorage.setItem('sps:v1:draft', JSON.stringify({ yaml: 'name: legacy\n' }))
    expect(readDraft()?.yaml).toBe('name: legacy\n')
    expect(readDraft()?.schemaVersion).toBe(1)
  })

  it('refuses to persist a draft that contains a detected secret', () => {
    const result = writeDraft('token: ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789\n', '2026-11-06T00:00:00.000Z')
    expect(result.ok).toBe(false)
    expect(localStorage.getItem('sps:v1:draft')).toBeNull()
  })

  it('reports a quota failure and clears every namespaced key', () => {
    localStorage.setItem('sps:v1:settings', '{"schemaVersion":1}')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    const result = writeDraft('name: plain\n', '2026-11-06T00:00:00.000Z')
    spy.mockRestore()
    expect(result).toEqual({ ok: false, reason: 'quota' })
    clearAllLocalData()
    expect(localStorage.getItem('sps:v1:settings')).toBeNull()
  })

  it('drops a draft that does not match the schema', () => {
    localStorage.setItem('sps:v1:draft', JSON.stringify({ schemaVersion: 1, yaml: 12 }))
    expect(readDraft()).toBeNull()
  })
})
