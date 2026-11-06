import { Link } from 'react-router'

export function NotFound() {
  return (
    <main id="main" className="page">
      <h1>Page not found</h1>
      <p className="muted">That route is not part of SecurePipeline Studio.</p>
      <Link className="button" to="/">Back to the dashboard</Link>
    </main>
  )
}
