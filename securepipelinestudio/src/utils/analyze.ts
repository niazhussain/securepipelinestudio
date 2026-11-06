import { MAX_WORKFLOW_BYTES } from './limits'
import type { AnalysisResult } from './model'
import { parseWorkflow } from './parser'
import { runRules } from './ruleEngine'
import { scoreFindings } from './scoring'

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function base(bytes: number, status: AnalysisResult['status']): AnalysisResult {
  return {
    status,
    bytes,
    parseError: null,
    warnings: [],
    findings: [],
    score: 0,
    grade: 'F',
  }
}

export function analyzeWorkflow(source: string): AnalysisResult {
  const bytes = byteLength(source)
  if (source.trim() === '') return base(bytes, 'empty')
  if (bytes > MAX_WORKFLOW_BYTES) return base(bytes, 'too-large')
  try {
    const parsed = parseWorkflow(source)
    if (!parsed.model || parsed.parseError) {
      return {
        ...base(bytes, 'invalid'),
        parseError: parsed.parseError,
        warnings: parsed.warnings,
      }
    }
    const findings = runRules(parsed.model, source)
    const scored = scoreFindings(findings)
    return {
      status: 'ok',
      bytes,
      parseError: null,
      warnings: parsed.warnings,
      findings,
      score: scored.score,
      grade: scored.grade,
      workflowName: parsed.model.name,
    }
  } catch {
    return {
      ...base(bytes, 'error'),
      parseError: { message: 'The workflow could not be analysed.', line: 1, column: 1 },
    }
  }
}
