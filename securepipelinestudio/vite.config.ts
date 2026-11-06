import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

function normalizeBase(value: string): string {
  const trimmed = value.trim() || '/securepipelinestudio/'
  if (trimmed === './') return './'
  const withLead = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLead.endsWith('/') ? withLead : `${withLead}/`
}

export function contentSecurityPolicy(supabaseUrl: string | undefined, dev: boolean): string {
  const connect = new Set(["'self'"])
  if (dev) {
    connect.add('ws:')
    connect.add('wss:')
    connect.add('http://localhost:*')
    connect.add('http://127.0.0.1:*')
  }
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl)
      if (url.protocol === 'https:') connect.add(url.origin)
    } catch {
      // An unusable URL does not widen the policy.
    }
  }
  const script = dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'"
  return [
    "default-src 'self'",
    script,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${Array.from(connect).join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

function cspPlugin(policy: string): Plugin {
  return {
    name: 'sps-csp',
    transformIndexHtml(html) {
      return html.replaceAll('__CSP__', policy)
    },
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '')
  const dev = command === 'serve'
  return {
    base: normalizeBase(env.VITE_BASE_PATH || '/securepipelinestudio/'),
    plugins: [react(), tailwindcss(), cspPlugin(contentSecurityPolicy(env.VITE_SUPABASE_URL, dev))],
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 700,
    },
    worker: {
      format: 'es',
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      restoreMocks: true,
    },
  }
})
