import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import { Vault } from './Vault'

vi.mock('../services/gallery', () => ({
  loadGallery: vi.fn(),
  galleryCopy: {
    OFFLINE_NOTICE: 'Supabase is not configured. These are bundled starter templates.',
    FAILURE_NOTICE: 'The gallery could not be loaded, so bundled starter templates are shown instead.',
  },
}))

vi.mock('../services/supabase', () => ({
  supabaseConfigured: () => false,
  getSupabase: async () => null,
  signInWithGitHub: async () => {},
  signOut: async () => {},
}))

import { loadGallery } from '../services/gallery'

const mockedLoad = vi.mocked(loadGallery)

function renderVault() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/vault']}>
        <Routes>
          <Route path="/vault/:templateId?" element={<Vault />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('Vault', () => {
  beforeEach(() => {
    mockedLoad.mockReset()
  })

  it('shows an empty gallery', async () => {
    mockedLoad.mockResolvedValue({ source: 'community', notice: null, templates: [] })
    renderVault()
    expect(await screen.findByText('No community templates have been published yet.')).toBeInTheDocument()
    expect(screen.getByText(/Publishing is turned off/)).toBeInTheDocument()
  })

  it('shows the fallback banner when the gallery request fails', async () => {
    mockedLoad.mockResolvedValue({
      source: 'starter',
      notice: 'The gallery could not be loaded, so bundled starter templates are shown instead.',
      templates: [
        {
          id: 'starter-node-ci',
          title: 'Node test workflow',
          description: 'Least privilege CI.',
          tags: ['ci'],
          license: 'MIT',
          author: 'SecurePipeline',
          createdAt: '2026-10-02T00:00:00.000Z',
          yaml: 'name: ci\non: push\npermissions: {}\njobs: {}\n',
          source: 'starter',
        },
      ],
    })
    renderVault()
    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument()
    expect(screen.getByText('Node test workflow')).toBeInTheDocument()
  })

  it('shows an empty filter result', async () => {
    const user = userEvent.setup()
    mockedLoad.mockResolvedValue({
      source: 'starter',
      notice: null,
      templates: [
        {
          id: 'starter-node-ci',
          title: 'Node test workflow',
          description: 'Least privilege CI.',
          tags: ['ci'],
          license: 'MIT',
          author: 'SecurePipeline',
          createdAt: '2026-10-02T00:00:00.000Z',
          yaml: 'name: ci\non: push\npermissions: {}\njobs: {}\n',
          source: 'starter',
        },
      ],
    })
    renderVault()
    await screen.findByText('Node test workflow')
    await user.type(screen.getByLabelText('Search'), 'missing-tag')
    expect(screen.getByText('No templates match these filters.')).toBeInTheDocument()
  })
})
