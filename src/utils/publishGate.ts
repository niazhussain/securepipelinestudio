import { analyzeWorkflow, byteLength } from './analyze'
import { MAX_TEMPLATE_BYTES, PUBLISH_DESCRIPTION_MAX, PUBLISH_TAG_LENGTH, PUBLISH_TAG_MAX, PUBLISH_TITLE_MAX } from './limits'
import type { Grade } from './model'

export const PUBLISH_LICENSES = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'CC0-1.0', 'Unlicense'] as const

export interface PublishInput {
  yaml: string
  title: string
  description: string
  tags: string[]
  license: string
  consent: boolean
}

export interface PublishDecision {
  ok: boolean
  errors: string[]
  grade: Grade | null
}

const TAG = /^[a-z0-9][a-z0-9-]*$/

export function evaluatePublishGate(input: PublishInput): PublishDecision {
  const errors: string[] = []
  const title = input.title.trim()
  const description = input.description.trim()
  const tags = input.tags.map((tag) => tag.trim()).filter(Boolean)
  if (title.length < 1 || title.length > PUBLISH_TITLE_MAX) errors.push('Title must be 1 to 80 characters.')
  if (description.length < 1 || description.length > PUBLISH_DESCRIPTION_MAX) {
    errors.push('Description must be 1 to 500 characters.')
  }
  if (tags.length < 1 || tags.length > PUBLISH_TAG_MAX) errors.push('Add between 1 and 8 tags.')
  if (tags.some((tag) => tag.length > PUBLISH_TAG_LENGTH || !TAG.test(tag))) {
    errors.push('Tags use lowercase letters, numbers, and hyphens, up to 24 characters.')
  }
  if (!PUBLISH_LICENSES.includes(input.license as (typeof PUBLISH_LICENSES)[number])) {
    errors.push('Choose a license from the list.')
  }
  if (!input.consent) errors.push('Confirm that the template contains no secrets and can be shown publicly.')
  if (byteLength(input.yaml) > MAX_TEMPLATE_BYTES) errors.push('Templates must be 64 KB or smaller.')

  const analysis = analyzeWorkflow(input.yaml)
  if (analysis.status !== 'ok') errors.push('The template must be valid YAML.')
  if (analysis.findings.some((finding) => finding.ruleId === 'SPS-040')) {
    errors.push('A possible secret was found. Remove it before publishing.')
  }
  if (analysis.findings.some((finding) => finding.severity === 'critical')) {
    errors.push('Critical findings must be fixed before publishing.')
  }
  if (analysis.status === 'ok' && analysis.grade !== 'A' && analysis.grade !== 'B') {
    errors.push('The template must grade A or B.')
  }
  return {
    ok: errors.length === 0,
    errors,
    grade: analysis.status === 'ok' ? analysis.grade : null,
  }
}
