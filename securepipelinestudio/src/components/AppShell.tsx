import { Moon, Sun } from 'lucide-react'
import { Suspense, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { TOOL_NAME } from '../version'
import { useSettings } from '../hooks/useTheme'
import { ErrorBoundary } from './ErrorBoundary'

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/vault', label: 'Vault', end: false },
  { to: '/threat-modeler', label: 'Threat modeler', end: false },
  { to: '/about', label: 'About', end: false },
]

export function AppShell() {
  const { settings, update } = useSettings()
  const navigate = useNavigate()
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next')
    if (next === 'vault') navigate('/vault', { replace: true })
  }, [navigate])
  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <NavLink className="brand" to="/" end>
          <span className="mark" aria-hidden="true">SP</span>
          <span>
            {TOOL_NAME}
            <small>Workflow static analysis</small>
          </span>
        </NavLink>
        <nav className="nav" aria-label="Primary">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="icon-button"
          type="button"
          aria-label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => update({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        >
          {settings.theme === 'dark' ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
        </button>
      </header>
      <ErrorBoundary>
        <Suspense fallback={<main id="main" className="page">Loading…</main>}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
      <footer className="footer">Analysis stays in this browser unless you publish a template or sign in.</footer>
    </div>
  )
}
