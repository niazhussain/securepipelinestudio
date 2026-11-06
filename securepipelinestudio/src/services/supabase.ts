import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let loading: Promise<SupabaseClient | null> | null = null

export function supabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  if (!url || !anonKey) return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured()) return null
  if (client) return client
  if (!loading) {
    loading = import('@supabase/supabase-js').then(({ createClient }) => {
      const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
      client = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      })
      return client
    })
  }
  return loading
}

export async function signInWithGitHub(): Promise<void> {
  const supabase = await getSupabase()
  if (!supabase) return
  const redirectTo = `${window.location.origin}${window.location.pathname}?next=vault`
  await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } })
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabase()
  if (!supabase) return
  await supabase.auth.signOut()
}
