import { z } from 'zod'
import { byteLength } from '../utils/analyze'
import { MAX_WORKFLOW_BYTES } from '../utils/limits'
import type { Grade } from '../utils/model'
import { hasSecrets } from '../utils/secretScanner'

const DRAFT_KEY = 'sps:v1:draft'
const SETTINGS_KEY = 'sps:v1:settings'
const HISTORY_KEY = 'sps:v1:history'
const LEGACY_KEYS = ['sps:v0:draft', 'sps:v0:settings', 'sps:v0:history']
const MAX_VALUE_CHARS = 300_000

const draftSchema = z.object({
  schemaVersion: z.literal(1),
  yaml: z.string().max(MAX_WORKFLOW_BYTES),
  updatedAt: z.string().max(40),
})

const settingsSchema = z.object({
  schemaVersion: z.literal(1),
  theme: z.enum(['dark', 'light']),
  includeSource: z.boolean(),
  editorWidth: z.number().min(30).max(70),
})

const historyItemSchema = z.object({
  id: z.string().max(40),
  at: z.string().max(40),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  score: z.number().min(0).max(100),
  findingCount: z.number().int().min(0).max(10_000),
  workflowName: z.string().max(120),
})

const historySchema = z.object({
  schemaVersion: z.literal(1),
  items: z.array(historyItemSchema).max(20),
})

export type DraftRecord = z.infer<typeof draftSchema>
export type SettingsRecord = z.infer<typeof settingsSchema>
export type HistoryRecord = z.infer<typeof historySchema>

export const DEFAULT_SETTINGS: SettingsRecord = {
  schemaVersion: 1,
  theme: 'dark',
  includeSource: false,
  editorWidth: 56,
}

function readRaw(key: string): unknown {
  try {
    const text = localStorage.getItem(key)
    if (text == null) return null
    if (text.length > MAX_VALUE_CHARS) {
      localStorage.removeItem(key)
      return null
    }
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function writeRaw(key: string, value: unknown): { ok: true } | { ok: false; reason: 'quota' | 'unavailable' } {
  try {
    const text = JSON.stringify(value)
    if (text.length > MAX_VALUE_CHARS) return { ok: false, reason: 'quota' }
    localStorage.setItem(key, text)
    return { ok: true }
  } catch (error) {
    const name = error instanceof DOMException ? error.name : ''
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return { ok: false, reason: 'quota' }
    }
    return { ok: false, reason: 'unavailable' }
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage can throw in private mode. There is nothing useful to surface.
  }
}

export function migrateDraft(raw: unknown): DraftRecord | null {
  const current = draftSchema.safeParse(raw)
  if (current.success) return current.data
  const legacy = z
    .object({
      yaml: z.string().max(MAX_WORKFLOW_BYTES),
      updatedAt: z.string().max(40).optional(),
    })
    .safeParse(raw)
  if (!legacy.success) return null
  if (legacy.data.yaml.includes('\u0000')) return null
  return {
    schemaVersion: 1,
    yaml: legacy.data.yaml,
    updatedAt: legacy.data.updatedAt ?? '1970-01-01T00:00:00.000Z',
  }
}

export function migrateSettings(raw: unknown): SettingsRecord | null {
  const current = settingsSchema.safeParse(raw)
  if (current.success) return current.data
  const legacy = z
    .object({
      theme: z.enum(['dark', 'light']).optional(),
      includeSource: z.boolean().optional(),
    })
    .safeParse(raw)
  if (!legacy.success) return null
  return {
    ...DEFAULT_SETTINGS,
    theme: legacy.data.theme ?? 'dark',
    includeSource: legacy.data.includeSource ?? false,
  }
}

export function migrateHistory(raw: unknown): HistoryRecord | null {
  const current = historySchema.safeParse(raw)
  if (current.success) return current.data
  const legacy = z.array(historyItemSchema).max(20).safeParse(raw)
  if (!legacy.success) return null
  return { schemaVersion: 1, items: legacy.data }
}

export function readDraft(): DraftRecord | null {
  const migrated = migrateDraft(readRaw(DRAFT_KEY))
  if (!migrated) {
    if (readRaw(DRAFT_KEY) != null) removeKey(DRAFT_KEY)
    return null
  }
  if (migrated.schemaVersion === 1 && draftSchema.safeParse(readRaw(DRAFT_KEY)).success) return migrated
  writeRaw(DRAFT_KEY, migrated)
  return migrated
}

export function writeDraft(yaml: string, now: string): { ok: true } | { ok: false; reason: string } {
  if (byteLength(yaml) > MAX_WORKFLOW_BYTES) return { ok: false, reason: 'size' }
  if (hasSecrets(yaml)) {
    removeKey(DRAFT_KEY)
    return { ok: false, reason: 'secret' }
  }
  const record: DraftRecord = { schemaVersion: 1, yaml, updatedAt: now }
  const parsed = draftSchema.safeParse(record)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return writeRaw(DRAFT_KEY, parsed.data)
}

export function readSettings(): SettingsRecord {
  const migrated = migrateSettings(readRaw(SETTINGS_KEY)) ?? DEFAULT_SETTINGS
  return migrated
}

export function writeSettings(settings: SettingsRecord): { ok: true } | { ok: false; reason: string } {
  const parsed = settingsSchema.safeParse(settings)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return writeRaw(SETTINGS_KEY, parsed.data)
}

export function readHistory(): HistoryRecord {
  return migrateHistory(readRaw(HISTORY_KEY)) ?? { schemaVersion: 1, items: [] }
}

export function pushHistory(item: {
  at: string
  grade: Grade
  score: number
  findingCount: number
  workflowName: string
}): void {
  const current = readHistory()
  const name = hasSecrets(item.workflowName) ? 'workflow' : item.workflowName.slice(0, 120)
  const next = {
    schemaVersion: 1 as const,
    items: [
      {
        id: item.at,
        at: item.at,
        grade: item.grade,
        score: item.score,
        findingCount: item.findingCount,
        workflowName: name || 'workflow',
      },
      ...current.items,
    ].slice(0, 20),
  }
  const parsed = historySchema.safeParse(next)
  if (parsed.success) writeRaw(HISTORY_KEY, parsed.data)
}

export function clearAllLocalData(): void {
  for (const key of [DRAFT_KEY, SETTINGS_KEY, HISTORY_KEY, ...LEGACY_KEYS]) removeKey(key)
}
