import { isAlias, isScalar, type Document, type Pair, type YAMLMap } from 'yaml'
import type { LineCounter } from 'yaml'

export function resolveNode(node: unknown, doc: Document): unknown {
  if (!isAlias(node)) return node
  try {
    return node.resolve(doc)
  } catch {
    return undefined
  }
}

export function pairKey(pair: Pair): string | null {
  if (isScalar(pair.key)) {
    if (pair.key.value === true) return 'on'
    if (pair.key.value == null) return null
    return String(pair.key.value)
  }
  return null
}

export function findPair(map: YAMLMap, key: string): Pair | undefined {
  return map.items.find((item) => pairKey(item) === key)
}

export function scalarText(node: unknown, doc: Document): string | null {
  const resolved = resolveNode(node, doc)
  if (!isScalar(resolved) || resolved.value == null) return null
  return String(resolved.value)
}

export function nodePosition(
  node: unknown,
  lineCounter: LineCounter,
): { line: number; column: number } {
  if (node && typeof node === 'object' && 'range' in node) {
    const range = (node as { range?: readonly number[] | null }).range
    const offset = range?.[0]
    if (typeof offset === 'number') {
      const pos = lineCounter.linePos(offset)
      return { line: pos.line, column: pos.col }
    }
  }
  return { line: 1, column: 1 }
}

export function errorPosition(error: { linePos?: unknown }): { line: number; column: number } {
  const linePos = error.linePos
  const point = Array.isArray(linePos) ? linePos[0] : linePos
  if (point && typeof point === 'object' && 'line' in point && 'col' in point) {
    const line = Number((point as { line: unknown }).line)
    const column = Number((point as { col: unknown }).col)
    if (Number.isFinite(line) && Number.isFinite(column) && line > 0 && column > 0) {
      return { line, column }
    }
  }
  return { line: 1, column: 1 }
}
