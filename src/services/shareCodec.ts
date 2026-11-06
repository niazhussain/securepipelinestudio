import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { z } from 'zod'
import { TOOL_VERSION } from '../version'
import { byteLength } from '../utils/analyze'
import { MAX_DECOMPRESSED_BYTES, MAX_WORKFLOW_BYTES, SHARE_MAX_CHARS, SHARE_WARN_CHARS } from '../utils/limits'
import type { AnalysisResult, Grade } from '../utils/model'

export const SHARE_SCHEMA_VERSION = 1

export const sharePayloadSchema = z.object({
  schemaVersion: z.literal(SHARE_SCHEMA_VERSION),
  toolVersion: z.string().min(1).max(32),
  generatedAt: z.string().min(1).max(40),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  score: z.number().int().min(0).max(100),
  findings: z
    .array(
      z.object({
        ruleId: z.string().min(1).max(32),
        severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
        jobId: z.string().max(200).optional(),
        step: z.number().int().min(1).max(10_000).optional(),
        line: z.number().int().min(1).max(100_000),
        column: z.number().int().min(1).max(10_000),
        title: z.string().max(200),
        message: z.string().max(500),
      }),
    )
    .max(500),
  workflow: z.string().max(MAX_WORKFLOW_BYTES).optional(),
})

export type SharePayload = z.infer<typeof sharePayloadSchema>

const INVALID = 'This share link is invalid or incomplete.'
const TOO_LARGE = 'This share link is too large to open.'

export function buildSharePayload(result: AnalysisResult, now: string, source?: string): SharePayload {
  return {
    schemaVersion: SHARE_SCHEMA_VERSION,
    toolVersion: TOOL_VERSION,
    generatedAt: now,
    grade: result.grade,
    score: result.score,
    findings: result.findings.slice(0, 500).map((finding) => ({
      ruleId: finding.ruleId,
      severity: finding.severity,
      ...(finding.jobId ? { jobId: finding.jobId } : {}),
      ...(finding.step ? { step: finding.step } : {}),
      line: finding.line,
      column: finding.column,
      title: finding.title.slice(0, 200),
      message: finding.message.slice(0, 500),
    })),
    ...(source !== undefined ? { workflow: source } : {}),
  }
}

export function shareFragment(encoded: string): string {
  return `#/s?d=${encoded}`
}

export interface EncodedShare {
  ok: true
  encoded: string
  fragment: string
  length: number
  warning?: string
}

export function encodeShare(payload: SharePayload, prefix = ''): EncodedShare | { ok: false; error: string } {
  const parsed = sharePayloadSchema.safeParse(payload)
  if (!parsed.success) return { ok: false, error: 'This report could not be shared.' }
  let encoded = ''
  try {
    encoded = compressToEncodedURIComponent(JSON.stringify(parsed.data))
  } catch {
    return { ok: false, error: 'This report could not be shared.' }
  }
  if (!encoded) return { ok: false, error: 'This report could not be shared.' }
  const fragment = shareFragment(encoded)
  const length = `${prefix}${fragment}`.length
  if (length > SHARE_MAX_CHARS) {
    return { ok: false, error: 'This report is too large to share. Leave the workflow source out, or shorten the file.' }
  }
  return {
    ok: true,
    encoded,
    fragment,
    length,
    ...(length > SHARE_WARN_CHARS
      ? { warning: 'This link is long and may not open in every browser or chat app.' }
      : {}),
  }
}

export function decodeShare(param: string): { ok: true; data: SharePayload } | { ok: false; error: string } {
  if (typeof param !== 'string' || param.length === 0 || param.length > SHARE_MAX_CHARS) {
    return { ok: false, error: param.length > SHARE_MAX_CHARS ? TOO_LARGE : INVALID }
  }
  let text: string | null
  try {
    text = decompressFromEncodedURIComponent(param)
  } catch {
    return { ok: false, error: INVALID }
  }
  if (text == null) return { ok: false, error: INVALID }
  if (byteLength(text) > MAX_DECOMPRESSED_BYTES) return { ok: false, error: TOO_LARGE }
  try {
    const json: unknown = JSON.parse(text)
    const parsed = sharePayloadSchema.safeParse(json)
    if (!parsed.success) return { ok: false, error: INVALID }
    return { ok: true, data: parsed.data }
  } catch {
    return { ok: false, error: INVALID }
  }
}

export function claimedGrade(data: SharePayload): Grade {
  return data.grade
}
