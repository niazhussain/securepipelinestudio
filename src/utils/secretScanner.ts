export interface SecretMatch {
  kind: string
  line: number
  column: number
}

const PATTERNS: { kind: string; source: string }[] = [
  { kind: 'GitHub token', source: String.raw`\bgh[pousr]_[A-Za-z0-9]{36}\b` },
  { kind: 'GitHub fine-grained token', source: String.raw`\bgithub_pat_[A-Za-z0-9_]{22,}\b` },
  { kind: 'AWS access key ID', source: String.raw`\bAKIA[0-9A-Z]{16}\b` },
  { kind: 'private key', source: String.raw`-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----` },
  { kind: 'Slack token', source: String.raw`\bxox[baprs]-[A-Za-z0-9-]{10,}` },
  { kind: 'Google API key', source: String.raw`\bAIza[0-9A-Za-z\-_]{35}\b` },
  { kind: 'npm token', source: String.raw`\bnpm_[A-Za-z0-9]{36}\b` },
  { kind: 'PyPI token', source: String.raw`\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{20,}` },
]

function positionAt(text: string, index: number): { line: number; column: number } {
  let line = 1
  let column = 1
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }
  return { line, column }
}

export function scanSecrets(source: string): SecretMatch[] {
  const matches: SecretMatch[] = []
  for (const pattern of PATTERNS) {
    const expression = new RegExp(pattern.source, 'g')
    let found: RegExpExecArray | null
    while ((found = expression.exec(source))) {
      const index = found.index
      const pos = positionAt(source, index)
      matches.push({ kind: pattern.kind, line: pos.line, column: pos.column })
      if (found[0].length === 0) expression.lastIndex += 1
    }
  }
  matches.sort((a, b) => a.line - b.line || a.column - b.column || a.kind.localeCompare(b.kind))
  return matches
}

export function hasSecrets(source: string): boolean {
  return scanSecrets(source).length > 0
}
