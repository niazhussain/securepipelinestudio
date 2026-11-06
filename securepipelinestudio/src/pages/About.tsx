import { useState } from 'react'
import { clearAllLocalData } from '../services/storage'
import { signOut } from '../services/supabase'
import { ANALYSIS_NOTE, PINNING_NOTE } from '../utils/limits'

export function About() {
  const [cleared, setCleared] = useState(false)
  return (
    <main id="main" className="page">
      <h1>About, privacy, and limits</h1>
      <p>{ANALYSIS_NOTE} {PINNING_NOTE}</p>
      <section className="panel card">
        <h2>What stays on this browser</h2>
        <p>Drafts, the theme, the export preference, the editor width, and a short history of grades are stored in localStorage under keys that start with <span className="mono">sps:v1:</span>. The history stores the grade, score, finding count, and workflow name. It does not store the workflow. A draft that matches the secret scanner is not written, and an older draft is removed.</p>
        <p>There is no telemetry and no cookie set by this app. If you sign in on the Vault page, Supabase Auth stores its own session in the browser. Clearing local data removes the keys this app owns and signs that session out.</p>
        <button
          className="button"
          type="button"
          onClick={() => {
            clearAllLocalData()
            void signOut()
            setCleared(true)
          }}
        >
          Clear all local data
        </button>
        {cleared ? <p role="status">Local SecurePipeline data was cleared. Reload the page to start from the demo workflow.</p> : null}
      </section>
      <section className="panel card">
        <h2>What can be sent</h2>
        <p>Analysis, scoring, badges, and share links are built locally. A share link puts a compressed report in the URL fragment (<span className="mono">#/s?d=</span>). Fragments are not sent to a host by the browser. Publishing a template is a separate action and only happens after you sign in, and only when Supabase is configured. If the Supabase variables are missing, the app does not create a client and does not call the network for the vault.</p>
      </section>
      <section className="panel card">
        <h2>Limits of static analysis</h2>
        <ul>
          <li>A passing grade does not mean the workflow is safe. The engine matches structure and patterns. It does not run the workflow.</li>
          <li>A full commit SHA is checked as 40 hexadecimal characters. The app cannot prove that SHA is a release you trust.</li>
          <li>Script injection inside expressions is detected. Data that reaches a shell through an environment variable is not executed here, and unsafe use of that variable can still be a bug.</li>
          <li>Matrix values and reusable workflows in other repositories are not fetched.</li>
          <li>The secret scanner looks for known token shapes and private-key headers. It will miss invented formats and can flag examples.</li>
        </ul>
      </section>
    </main>
  )
}
