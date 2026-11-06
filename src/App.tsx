import { lazy } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })))
const About = lazy(() => import('./pages/About').then((module) => ({ default: module.About })))
const SharedReport = lazy(() => import('./pages/SharedReport').then((module) => ({ default: module.SharedReport })))
const Vault = lazy(() => import('./pages/Vault').then((module) => ({ default: module.Vault })))
const ThreatModeler = lazy(() => import('./pages/ThreatModeler').then((module) => ({ default: module.ThreatModeler })))
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })))

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/vault" element={<Vault />} />
              <Route path="/vault/:templateId" element={<Vault />} />
              <Route path="/threat-modeler" element={<ThreatModeler />} />
              <Route path="/threat-modeler/:scenarioId" element={<ThreatModeler />} />
              <Route path="/about" element={<About />} />
              <Route path="/s" element={<SharedReport />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}
