import { handleAnalysisMessage } from '../utils/workerProtocol'

self.onmessage = (event: MessageEvent<unknown>) => {
  self.postMessage(handleAnalysisMessage(event.data))
}
