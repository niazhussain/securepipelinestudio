import { isAlias, isMap, isScalar, isSeq, LineCounter, parseAllDocuments, YAMLMap, type Document } from 'yaml'
import { MISSING_PERMISSIONS, type EnvEntry, type JobModel, type ParseResult, type PermissionModel, type StepModel, type WorkflowModel } from './model'
import { errorPosition, findPair, nodePosition, pairKey, resolveNode, scalarText } from './yamlNodes'

const PARSE_MESSAGE = 'Invalid YAML at this line.'

function emptyModel(): WorkflowModel {
  return {
    triggers: [],
    triggerLine: 1,
    permissions: { ...MISSING_PERMISSIONS },
    env: [],
    concurrency: false,
    jobs: [],
  }
}

function readStringMap(node: unknown, doc: Document, lineCounter: LineCounter): EnvEntry[] {
  const resolved = resolveNode(node, doc)
  if (!isMap(resolved)) return []
  const entries: EnvEntry[] = []
  for (const item of resolved.items) {
    const key = pairKey(item)
    if (!key) continue
    const value = scalarText(item.value, doc) ?? ''
    const pos = nodePosition(item.key, lineCounter)
    entries.push({ key, value, line: pos.line, column: pos.column })
  }
  return entries
}

function readPermissions(node: unknown, doc: Document, lineCounter: LineCounter, keyNode: unknown): PermissionModel {
  const pos = nodePosition(keyNode, lineCounter)
  if (node == null) {
    return { present: true, kind: 'empty', scopes: {}, ...pos }
  }
  const resolved = resolveNode(node, doc)
  if (isScalar(resolved)) {
    const scalar = resolved.value == null ? '' : String(resolved.value)
    if (scalar === 'read-all' || scalar === 'write-all') {
      return { present: true, kind: scalar, scalar, scopes: {}, ...pos }
    }
    return { present: true, kind: 'scalar', scalar, scopes: {}, ...pos }
  }
  if (isMap(resolved)) {
    const scopes: Record<string, string> = {}
    for (const item of resolved.items) {
      const key = pairKey(item)
      if (!key || key === '<<') continue
      const value = scalarText(item.value, doc)
      if (value != null) scopes[key] = value
    }
    if (Object.keys(scopes).length === 0) {
      return { present: true, kind: 'empty', scopes, ...pos }
    }
    return { present: true, kind: 'map', scopes, ...pos }
  }
  return { present: true, kind: 'empty', scopes: {}, ...pos }
}

function readRunsOn(node: unknown, doc: Document): string[] {
  const resolved = resolveNode(node, doc)
  if (isScalar(resolved) && resolved.value != null) return [String(resolved.value)]
  if (isSeq(resolved)) {
    return resolved.items.flatMap((item) => {
      const text = scalarText(item, doc)
      return text == null ? [] : [text]
    })
  }
  return []
}

function readTriggers(node: unknown, doc: Document): string[] {
  const resolved = resolveNode(node, doc)
  if (isScalar(resolved) && resolved.value != null) return [String(resolved.value)]
  if (isSeq(resolved)) {
    return resolved.items.flatMap((item) => {
      const text = scalarText(item, doc)
      return text == null ? [] : [text]
    })
  }
  if (isMap(resolved)) {
    return resolved.items.flatMap((item) => {
      const key = pairKey(item)
      return key ? [key] : []
    })
  }
  return []
}

function mergedMap(map: YAMLMap, doc: Document): YAMLMap {
  const merge = map.items.find((item) => pairKey(item) === '<<')
  if (!merge) return map
  const combined = new YAMLMap()
  const sources = isSeq(merge.value) ? merge.value.items : [merge.value]
  for (const source of sources) {
    const resolved = resolveNode(source, doc)
    if (!isMap(resolved)) continue
    const nested = mergedMap(resolved, doc)
    for (const item of nested.items) {
      const key = pairKey(item)
      if (!key || key === '<<') continue
      const index = combined.items.findIndex((existing) => pairKey(existing) === key)
      if (index >= 0) combined.items[index] = item
      else combined.items.push(item)
    }
  }
  for (const item of map.items) {
    const key = pairKey(item)
    if (!key || key === '<<') continue
    const index = combined.items.findIndex((existing) => pairKey(existing) === key)
    if (index >= 0) combined.items[index] = item
    else combined.items.push(item)
  }
  return combined
}

function asMap(node: unknown, doc: Document): YAMLMap | null {
  const resolved = resolveNode(node, doc)
  if (!isMap(resolved)) return null
  return mergedMap(resolved, doc)
}

function readSteps(node: unknown, doc: Document, lineCounter: LineCounter): StepModel[] {
  const resolved = resolveNode(node, doc)
  if (!isSeq(resolved)) return []
  const steps: StepModel[] = []
  resolved.items.forEach((item, index) => {
    const map = asMap(item, doc)
    if (!map) return
    const pos = nodePosition(isAlias(item) ? item : map, lineCounter)
    const usesPair = findPair(map, 'uses')
    const runPair = findPair(map, 'run')
    const name = scalarText(findPair(map, 'name')?.value, doc) ?? undefined
    steps.push({
      index: index + 1,
      name: name ?? undefined,
      uses: usesPair ? (scalarText(usesPair.value, doc) ?? undefined) : undefined,
      run: runPair ? (scalarText(runPair.value, doc) ?? undefined) : undefined,
      with: Object.fromEntries(readStringMap(findPair(map, 'with')?.value, doc, lineCounter).map((entry) => [entry.key, entry.value])),
      env: readStringMap(findPair(map, 'env')?.value, doc, lineCounter),
      line: pos.line,
      column: pos.column,
    })
  })
  return steps
}

function readJobs(node: unknown, doc: Document, lineCounter: LineCounter): JobModel[] {
  const map = asMap(node, doc)
  if (!map) return []
  const jobs: JobModel[] = []
  for (const item of map.items) {
    const id = pairKey(item)
    if (!id || id === '<<') continue
    const jobMap = asMap(item.value, doc)
    if (!jobMap) continue
    const pos = nodePosition(item.key, lineCounter)
    const runsPair = findPair(jobMap, 'runs-on')
    const runsPos = nodePosition(runsPair?.key ?? item.key, lineCounter)
    const permissionsPair = findPair(jobMap, 'permissions')
    const secretsPair = findPair(jobMap, 'secrets')
    const secretsText = secretsPair ? scalarText(secretsPair.value, doc) : null
    const usesPair = findPair(jobMap, 'uses')
    const usesPos = nodePosition(usesPair?.key ?? item.key, lineCounter)
    jobs.push({
      id,
      name: scalarText(findPair(jobMap, 'name')?.value, doc) ?? undefined,
      runsOn: runsPair ? readRunsOn(runsPair.value, doc) : [],
      runsOnLine: runsPos.line,
      runsOnColumn: runsPos.column,
      permissions: permissionsPair
        ? readPermissions(permissionsPair.value, doc, lineCounter, permissionsPair.key)
        : { ...MISSING_PERMISSIONS },
      timeoutSet: !!findPair(jobMap, 'timeout-minutes'),
      steps: readSteps(findPair(jobMap, 'steps')?.value, doc, lineCounter),
      env: readStringMap(findPair(jobMap, 'env')?.value, doc, lineCounter),
      secretsInherit: secretsText === 'inherit',
      secretsLine: nodePosition(secretsPair?.key ?? item.key, lineCounter).line,
      secretsColumn: nodePosition(secretsPair?.key ?? item.key, lineCounter).column,
      uses: usesPair ? (scalarText(usesPair.value, doc) ?? undefined) : undefined,
      usesLine: usesPos.line,
      usesColumn: usesPos.column,
      line: pos.line,
      column: pos.column,
    })
  }
  return jobs
}

function readDocument(doc: Document, lineCounter: LineCounter): WorkflowModel | null {
  if (!isMap(doc.contents)) return null
  const root = doc.contents
  const model = emptyModel()
  const namePair = findPair(root, 'name')
  if (namePair) {
    const name = scalarText(namePair.value, doc)
    if (name != null) model.name = name
  }
  const onPair = root.items.find((item) => pairKey(item) === 'on')
  if (onPair) {
    const pos = nodePosition(onPair.key, lineCounter)
    model.triggers = readTriggers(onPair.value, doc)
    model.triggerLine = pos.line
  }
  const permissionsPair = findPair(root, 'permissions')
  if (permissionsPair) {
    model.permissions = readPermissions(permissionsPair.value, doc, lineCounter, permissionsPair.key)
  }
  model.env = readStringMap(findPair(root, 'env')?.value, doc, lineCounter)
  model.concurrency = !!findPair(root, 'concurrency')
  model.jobs = readJobs(findPair(root, 'jobs')?.value, doc, lineCounter)
  return model
}

export function parseWorkflow(source: string): ParseResult {
  const warnings: string[] = []
  let docs: Document[]
  const lineCounter = new LineCounter()
  try {
    docs = parseAllDocuments(source, {
      version: '1.2',
      lineCounter,
    }) as Document[]
  } catch {
    return {
      model: null,
      parseError: { message: PARSE_MESSAGE, line: 1, column: 1 },
      warnings,
    }
  }
  if (docs.length === 0) {
    return { model: null, parseError: { message: PARSE_MESSAGE, line: 1, column: 1 }, warnings }
  }
  if (docs.length > 1) {
    warnings.push('This file contains more than one YAML document. Only the first document was analysed.')
  }
  const doc = docs[0]
  if (!doc) {
    return { model: null, parseError: { message: PARSE_MESSAGE, line: 1, column: 1 }, warnings }
  }
  if (doc.errors.length > 0) {
    const pos = errorPosition(doc.errors[0]!)
    return { model: null, parseError: { message: PARSE_MESSAGE, ...pos }, warnings }
  }
  if (!isMap(doc.contents)) {
    return {
      model: null,
      parseError: { message: 'A workflow file has to be a YAML mapping.', line: 1, column: 1 },
      warnings,
    }
  }
  try {
    const model = readDocument(doc, lineCounter)
    if (!model) {
      return {
        model: null,
        parseError: { message: 'A workflow file has to be a YAML mapping.', line: 1, column: 1 },
        warnings,
      }
    }
    return { model, parseError: null, warnings }
  } catch {
    return {
      model: null,
      parseError: { message: PARSE_MESSAGE, line: 1, column: 1 },
      warnings,
    }
  }
}

export function documentRoot(source: string): { doc: Document; root: YAMLMap } | null {
  try {
    const doc = parseAllDocuments(source, { version: '1.2' })[0]
    if (!doc || doc.errors.length > 0 || !isMap(doc.contents)) return null
    return { doc, root: doc.contents }
  } catch {
    return null
  }
}
