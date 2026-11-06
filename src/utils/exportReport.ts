import { TOOL_NAME, TOOL_VERSION } from '../version'
import { ANALYSIS_NOTE, PINNING_NOTE } from './limits'
import type { AnalysisResult, Grade } from './model'

export const EXPORT_SCHEMA_VERSION = 1

export interface JsonSummary {
  schemaVersion: number
  tool: string
  toolVersion: string
  generatedAt: string
  grade: Grade
  score: number
  findings: {
    ruleId: string
    severity: string
    jobId?: string
    step?: number
    line: number
    column: number
  }[]
  workflow?: string
}

export function buildJsonSummary(input: {
  result: AnalysisResult
  now: string
  source?: string
}): JsonSummary {
  const summary: JsonSummary = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    tool: TOOL_NAME,
    toolVersion: TOOL_VERSION,
    generatedAt: input.now,
    grade: input.result.grade,
    score: input.result.score,
    findings: input.result.findings.map((finding) => ({
      ruleId: finding.ruleId,
      severity: finding.severity,
      ...(finding.jobId ? { jobId: finding.jobId } : {}),
      ...(finding.step ? { step: finding.step } : {}),
      line: finding.line,
      column: finding.column,
    })),
  }
  if (input.source !== undefined) summary.workflow = input.source
  return summary
}

export function buildMarkdownReport(input: {
  result: AnalysisResult
  now: string
  source?: string
}): string {
  const lines: string[] = [
    `# ${TOOL_NAME} report`,
    '',
    `- Grade: ${input.result.grade}`,
    `- Score: ${input.result.score} / 100`,
    `- Generated: ${input.now}`,
    `- Tool version: ${TOOL_VERSION}`,
    '',
    ANALYSIS_NOTE,
    PINNING_NOTE,
    '',
    '## Findings',
    '',
  ]
  if (input.result.findings.length === 0) {
    lines.push('No findings.')
  }
  for (const finding of input.result.findings) {
    const where = [
      finding.jobId ? `job ${finding.jobId}` : '',
      finding.step ? `step ${finding.step}` : '',
      `line ${finding.line}`,
    ]
      .filter(Boolean)
      .join(', ')
    lines.push(`### ${finding.ruleId} ${finding.title}`, '', `- Severity: ${finding.severity}`, `- Location: ${where}`, `- ${finding.message}`, '', finding.remediation, '', '```yaml', finding.fix, '```', '')
  }
  if (input.source !== undefined) {
    lines.push('## Workflow source', '', '```yaml', input.source, '```', '')
  }
  return lines.join('\n')
}

const BADGE_COLORS: Record<Grade, string> = {
  A: '2da44e',
  B: '1f6feb',
  C: 'bf8700',
  D: 'bc4c00',
  F: 'cf222e',
}

export function badgeSnippet(grade: Grade): string {
  const color = BADGE_COLORS[grade]
  return `![SecurePipeline grade ${grade}](https://img.shields.io/badge/SecurePipeline-${grade}-${color})`
}

export function badgeSvg(grade: Grade): string {
  const fill = grade === 'C' ? '#7a4e00' : `#${BADGE_COLORS[grade]}`
  const text = '#ffffff'
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="168" height="20" role="img" aria-label="SecurePipeline grade ${grade}">
  <title>SecurePipeline grade ${grade}</title>
  <rect width="168" height="20" rx="3" fill="#1f2328"/>
  <rect x="112" width="56" height="20" fill="${fill}"/>
  <text x="56" y="14" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="11" fill="#ffffff">SecurePipeline</text>
  <text x="140" y="14" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="11" fill="${text}">${grade}</text>
</svg>`
}
