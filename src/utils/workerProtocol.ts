import { z } from 'zod'
import { analyzeWorkflow } from './analyze'
import type { AnalysisResult } from './model'

const requestSchema = z.object({
  id: z.number(),
  yaml: z.string(),
})

export interface WorkerSuccess {
  id: number
  ok: true
  result: AnalysisResult
}

export interface WorkerFailure {
  id: number
  ok: false
  error: string
}

export type WorkerResponse = WorkerSuccess | WorkerFailure

export function handleAnalysisMessage(data: unknown): WorkerResponse {
  const parsed = requestSchema.safeParse(data)
  if (!parsed.success) return { id: 0, ok: false, error: 'Analysis failed.' }
  try {
    return { id: parsed.data.id, ok: true, result: analyzeWorkflow(parsed.data.yaml) }
  } catch {
    return { id: parsed.data.id, ok: false, error: 'Analysis failed.' }
  }
}
