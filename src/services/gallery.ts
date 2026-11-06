import { z } from 'zod'
import { STARTER_TEMPLATES } from '../data/templates'
import { MAX_TEMPLATE_BYTES, REQUEST_TIMEOUT_MS, VAULT_FETCH_LIMIT } from '../utils/limits'
import { getSupabase, supabaseConfigured } from './supabase'

export interface GalleryTemplate {
  id: string
  title: string
  description: string
  tags: string[]
  license: string
  author: string
  createdAt: string
  yaml: string
  source: 'starter' | 'community'
}

export interface GalleryLoad {
  source: 'starter' | 'community'
  notice: string | null
  templates: GalleryTemplate[]
}

const rowSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(80),
  description: z.string().max(500),
  tags: z.array(z.string().max(24)).max(8),
  license: z.string().max(64),
  yaml: z.string().max(MAX_TEMPLATE_BYTES),
  created_at: z.string().min(1).max(40),
  author_handle: z.string().min(1).max(39),
})

const OFFLINE_NOTICE =
  'Supabase is not configured. These are bundled starter templates. Publishing is off, and this page does not contact a server.'

const FAILURE_NOTICE =
  'The gallery could not be loaded, so bundled starter templates are shown instead. Publishing stays available only when the gallery is reachable.'

export function parseTemplateRow(row: unknown): GalleryTemplate | null {
  const parsed = rowSchema.safeParse(row)
  if (!parsed.success) return null
  return {
    id: parsed.data.id,
    title: parsed.data.title,
    description: parsed.data.description,
    tags: parsed.data.tags,
    license: parsed.data.license,
    author: parsed.data.author_handle,
    createdAt: parsed.data.created_at,
    yaml: parsed.data.yaml,
    source: 'community',
  }
}

function starters(notice: string): GalleryLoad {
  return {
    source: 'starter',
    notice,
    templates: [...STARTER_TEMPLATES].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
}

async function once(load: (signal: AbortSignal) => Promise<GalleryTemplate[]>): Promise<GalleryTemplate[]> {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  return load(signal)
}

export async function loadGallery(): Promise<GalleryLoad> {
  if (!supabaseConfigured()) return starters(OFFLINE_NOTICE)
  const client = await getSupabase()
  if (!client) return starters(OFFLINE_NOTICE)

  const read = async (signal: AbortSignal): Promise<GalleryTemplate[]> => {
    const { data, error } = await client
      .from('templates')
      .select('id, title, description, tags, license, yaml, created_at, author_handle')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(VAULT_FETCH_LIMIT)
      .abortSignal(signal)
    if (error) throw new Error('gallery request failed')
    return (data ?? []).flatMap((row) => {
      const template = parseTemplateRow(row)
      return template ? [template] : []
    })
  }

  try {
    const templates = await once(read)
    return { source: 'community', notice: null, templates }
  } catch {
    try {
      const templates = await once(read)
      return { source: 'community', notice: null, templates }
    } catch {
      return starters(FAILURE_NOTICE)
    }
  }
}

export const galleryCopy = { OFFLINE_NOTICE, FAILURE_NOTICE }
