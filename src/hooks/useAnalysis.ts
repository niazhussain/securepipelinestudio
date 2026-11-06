import { useEffect, useState } from 'react'
import { byteLength } from '../utils/analyze'
import { ANALYSIS_DEBOUNCE_MS, MAX_WORKFLOW_BYTES } from '../utils/limits'
import type { AnalysisResult } from '../utils/model'
import type { WorkerResponse } from '../utils/workerProtocol'

const emptyResult = (bytes: number): AnalysisResult => ({
  status: 'empty',
  bytes,
  parseError: null,
  warnings: [],
  findings: [],
  score: 0,
  grade: 'F',
})

let sharedWorker: Worker | null = null

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL('../workers/analyze.worker.ts', import.meta.url), { type: 'module' })
  }
  return sharedWorker
}

export function useAnalysis(yaml: string): { pending: boolean; result: AnalysisResult } {
  const [result, setResult] = useState<AnalysisResult>(() => emptyResult(byteLength(yaml)))
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const bytes = byteLength(yaml)
    if (yaml.trim() === '') {
      setPending(false)
      setResult(emptyResult(bytes))
      return
    }
    if (bytes > MAX_WORKFLOW_BYTES) {
      setPending(false)
      setResult({ ...emptyResult(bytes), status: 'too-large' })
      return
    }
    const worker = getWorker()
    if (!worker) {
      setResult({ ...emptyResult(bytes), status: 'error', parseError: { message: 'The workflow could not be analysed.', line: 1, column: 1 } })
      return
    }
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setPending(true)
    const timer = window.setTimeout(() => {
      worker.postMessage({ id, yaml })
    }, ANALYSIS_DEBOUNCE_MS)
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return
      if (event.data.ok) setResult(event.data.result)
      else {
        setResult({
          ...emptyResult(bytes),
          status: 'error',
          parseError: { message: 'The workflow could not be analysed.', line: 1, column: 1 },
        })
      }
      setPending(false)
    }
    worker.addEventListener('message', onMessage)
    return () => {
      window.clearTimeout(timer)
      worker.removeEventListener('message', onMessage)
    }
  }, [yaml])

  return { pending, result }
}
