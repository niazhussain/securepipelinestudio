export interface DiffLine {
  kind: 'context' | 'remove' | 'add'
  text: string
}

export function diffLines(before: string, after: string): DiffLine[] {
  const left = before.replace(/\n$/, '').split('\n')
  const right = after.replace(/\n$/, '').split('\n')
  const dp: number[][] = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0))
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      lines.push({ kind: 'context', text: left[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ kind: 'remove', text: left[i] })
      i += 1
    } else {
      lines.push({ kind: 'add', text: right[j] })
      j += 1
    }
  }
  while (i < left.length) {
    lines.push({ kind: 'remove', text: left[i] })
    i += 1
  }
  while (j < right.length) {
    lines.push({ kind: 'add', text: right[j] })
    j += 1
  }
  return lines
}
