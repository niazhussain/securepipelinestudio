const SHA40 = /^[0-9a-f]{40}$/i
const DIGEST = /@sha256:[0-9a-f]{64}\b/i

export const FIRST_PARTY_OWNERS = new Set(['actions', 'github'])

export type UsesKind = 'local' | 'docker' | 'reusable' | 'first-party' | 'third-party'

export interface ClassifiedUses {
  kind: UsesKind
  name: string
  ref?: string
  pinnedSha: boolean
  hasDigest: boolean
}

export function classifyUses(uses: string): ClassifiedUses {
  const trimmed = uses.trim()
  if (trimmed.startsWith('./') || trimmed.startsWith('.\\')) {
    return { kind: 'local', name: trimmed, pinnedSha: true, hasDigest: false }
  }
  if (trimmed.startsWith('docker://')) {
    const image = trimmed.slice('docker://'.length)
    const hasDigest = DIGEST.test(trimmed)
    return { kind: 'docker', name: image, pinnedSha: hasDigest, hasDigest }
  }

  const at = trimmed.lastIndexOf('@')
  const name = at > 0 ? trimmed.slice(0, at) : trimmed
  const ref = at > 0 ? trimmed.slice(at + 1) : undefined
  const pinnedSha = !!ref && SHA40.test(ref)
  if (/(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i.test(name)) {
    return { kind: 'reusable', name, ref, pinnedSha, hasDigest: false }
  }
  const owner = name.split('/')[0]?.toLowerCase() ?? ''
  const kind = FIRST_PARTY_OWNERS.has(owner) ? 'first-party' : 'third-party'
  return { kind, name, ref, pinnedSha, hasDigest: false }
}

export function isGitHubHostedLabel(label: string): boolean {
  return /^(ubuntu|windows|macos)(-|$)/i.test(label.trim())
}

export function runnerIsSelfHosted(labels: string[]): boolean {
  if (labels.length === 0) return false
  return labels.some((label) => {
    const value = label.trim()
    if (value.includes('${{')) return /self-hosted/i.test(value)
    if (/self-hosted/i.test(value)) return true
    return !isGitHubHostedLabel(value)
  })
}

export function runnerIsGitHubHosted(labels: string[]): boolean {
  if (labels.length === 0) return false
  if (labels.every((label) => label.includes('${{'))) return false
  return labels.some((label) => isGitHubHostedLabel(label)) && !runnerIsSelfHosted(labels)
}
