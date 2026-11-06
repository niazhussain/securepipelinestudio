import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { GradeBadge } from '../components/GradeBadge'
import { useToast } from '../components/toast-context'
import { COMMUNITY_NOTE, VAULT_PAGE_SIZE } from '../utils/limits'
import { analyzeWorkflow } from '../utils/analyze'
import type { Grade } from '../utils/model'
import { evaluatePublishGate, PUBLISH_LICENSES } from '../utils/publishGate'
import { galleryCopy, loadGallery, type GalleryTemplate } from '../services/gallery'
import { getSupabase, signInWithGitHub, supabaseConfigured } from '../services/supabase'

const GRADE_RANK: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 }

function meetsGrade(grade: Grade | null, minimum: 'any' | Grade): boolean {
  if (minimum === 'any') return true
  if (!grade) return false
  return GRADE_RANK[grade] >= GRADE_RANK[minimum]
}

export function Vault() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const configured = supabaseConfigured()
  const [load, setLoad] = useState<Awaited<ReturnType<typeof loadGallery>> | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('all')
  const [minimum, setMinimum] = useState<'any' | Grade>('any')
  const [page, setPage] = useState(1)
  const [signedIn, setSignedIn] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [license, setLicense] = useState<string>(PUBLISH_LICENSES[0])
  const [yaml, setYaml] = useState('')
  const [consent, setConsent] = useState(false)
  const [publishErrors, setPublishErrors] = useState<string[]>([])
  const [reason, setReason] = useState('')

  useEffect(() => {
    let active = true
    setFailed(false)
    void loadGallery()
      .then((result) => {
        if (active) setLoad(result)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!configured) return
    let active = true
    let subscription: { unsubscribe: () => void } | null = null
    void (async () => {
      const client = await getSupabase()
      if (!client || !active) return
      const { data } = await client.auth.getSession()
      if (active) setSignedIn(Boolean(data.session))
      const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
        if (active) setSignedIn(Boolean(session))
      })
      subscription = listener.subscription
      if (!active) subscription.unsubscribe()
    })()
    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [configured])

  const scored = useMemo(
    () =>
      (load?.templates ?? []).map((template) => {
        const analysis = analyzeWorkflow(template.yaml)
        return { template, grade: analysis.status === 'ok' ? analysis.grade : null }
      }),
    [load],
  )

  const tagsInUse = useMemo(() => {
    const values = new Set<string>()
    for (const item of scored) for (const value of item.template.tags) values.add(value)
    return [...values].sort()
  }, [scored])

  const filtered = scored.filter((item) => {
    const haystack = `${item.template.title} ${item.template.description} ${item.template.tags.join(' ')}`.toLowerCase()
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false
    if (tag !== 'all' && !item.template.tags.includes(tag)) return false
    return meetsGrade(item.grade, minimum)
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / VAULT_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * VAULT_PAGE_SIZE, currentPage * VAULT_PAGE_SIZE)
  const selected = scored.find((item) => item.template.id === templateId) ?? null

  async function publish(event: FormEvent) {
    event.preventDefault()
    const decision = evaluatePublishGate({
      yaml,
      title,
      description,
      tags: tags.split(',').map((item) => item.trim()).filter(Boolean),
      license,
      consent,
    })
    if (!decision.ok) {
      setPublishErrors(decision.errors)
      return
    }
    const client = await getSupabase()
    if (!client) {
      setPublishErrors(['Publishing is turned off because Supabase is not configured.'])
      return
    }
    const { data } = await client.auth.getUser()
    const handle = data.user?.user_metadata?.user_name
    if (typeof handle !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(handle)) {
      setPublishErrors(['GitHub did not provide a username that can be stored with this template.'])
      return
    }
    const { error } = await client.from('templates').insert({
      author_handle: handle,
      title: title.trim(),
      description: description.trim(),
      tags: tags.split(',').map((item) => item.trim()).filter(Boolean),
      license,
      yaml,
    })
    if (error) {
      setPublishErrors(['The template could not be published.'])
      return
    }
    setPublishErrors([])
    setTitle('')
    setDescription('')
    setTags('')
    setYaml('')
    setConsent(false)
    toast('Template published. It is labeled community-submitted and unverified.')
    const next = await loadGallery()
    setLoad(next)
  }

  async function report(template: GalleryTemplate) {
    const client = await getSupabase()
    if (!client) return
    const { error } = await client.from('reports').insert({
      template_id: template.id,
      reason: reason.trim(),
    })
    if (error) {
      toast('The report could not be saved.')
      return
    }
    setReason('')
    toast('Report saved. One report is kept per person per template.')
  }

  return (
    <main id="main" className="page">
      <h1>Community Vault</h1>
      <p>Secure workflow templates. Every grade is calculated in this browser.</p>
      {load?.notice ? <p className="callout" role="status">{load.notice}</p> : null}
      {failed ? <p className="callout danger" role="alert">The gallery could not be shown.</p> : null}
      {!load && !failed ? <p role="status">Loading templates…</p> : null}

      {selected ? (
        <Detail
          item={selected}
          reason={reason}
          signedIn={signedIn}
          onReason={setReason}
          onReport={() => void report(selected.template)}
          onLoad={() => navigate('/', { state: { yaml: selected.template.yaml } })}
        />
      ) : (
        <>
          <div className="row">
            <label>
              Search
              <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
            </label>
            <label>
              Tag
              <select value={tag} onChange={(event) => { setTag(event.target.value); setPage(1) }}>
                <option value="all">All tags</option>
                {tagsInUse.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Minimum grade
              <select value={minimum} onChange={(event) => { setMinimum(event.target.value as 'any' | Grade); setPage(1) }}>
                <option value="any">Any</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </label>
            <p className="meta">Sorted by newest</p>
          </div>
          {load && visible.length === 0 ? (
            <p className="callout" role="status">
              {load.templates.length === 0 ? 'No community templates have been published yet.' : 'No templates match these filters.'}
            </p>
          ) : (
            <div className="cards">
              {visible.map((item) => (
                <Link className="panel card" key={item.template.id} to={`/vault/${item.template.id}`}>
                  <h2>{item.template.title}</h2>
                  <p>{item.template.description}</p>
                  <div className="tags">{item.template.tags.map((value) => <span className="tag" key={value}>{value}</span>)}</div>
                  {item.grade ? <GradeBadge grade={item.grade} /> : <span className="meta">Unscored</span>}
                  {item.template.source === 'community' ? <span className="meta">{COMMUNITY_NOTE}</span> : <span className="meta">Bundled starter</span>}
                </Link>
              ))}
            </div>
          )}
          <div className="row">
            <button className="button" type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous page</button>
            <span className="meta">Page {currentPage} of {pageCount}</span>
            <button className="button" type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next page</button>
          </div>
        </>
      )}

      <section className="panel card" aria-labelledby="publish-heading">
        <h2 id="publish-heading">Publish to the gallery</h2>
        {!configured || load?.source === 'starter' ? (
          <p>
            Publishing is turned off.
            {' '}
            {configured ? 'The gallery could not be reached, so a template cannot be submitted from this page.' : galleryCopy.OFFLINE_NOTICE}
          </p>
        ) : !signedIn ? (
          <button className="button button-primary" type="button" onClick={() => void signInWithGitHub()}>Sign in with GitHub</button>
        ) : (
          <form className="form-grid" onSubmit={(event) => void publish(event)}>
            <label>Title<input type="text" maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
            <label>Description<textarea maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} required /></label>
            <label>Tags, comma separated<input type="text" value={tags} onChange={(event) => setTags(event.target.value)} required /></label>
            <label>
              License
              <select value={license} onChange={(event) => setLicense(event.target.value)}>
                {PUBLISH_LICENSES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>Workflow YAML<textarea value={yaml} onChange={(event) => setYaml(event.target.value)} required spellCheck={false} /></label>
            <label className="row">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              I confirm this template has no secrets and may be shown publicly.
            </label>
            {publishErrors.length > 0 ? (
              <ul role="alert">{publishErrors.map((error) => <li key={error}>{error}</li>)}</ul>
            ) : null}
            <button className="button button-primary" type="submit">Publish</button>
          </form>
        )}
      </section>
    </main>
  )
}

function Detail({
  item,
  reason,
  signedIn,
  onReason,
  onReport,
  onLoad,
}: {
  item: { template: GalleryTemplate; grade: Grade | null }
  reason: string
  signedIn: boolean
  onReason: (value: string) => void
  onReport: () => void
  onLoad: () => void
}) {
  const { template, grade } = item
  return (
    <article className="panel card">
      <p><Link to="/vault">Back to the gallery</Link></p>
      <h2>{template.title}</h2>
      <p>{template.description}</p>
      <p className="meta">Author {template.author} · {template.createdAt.slice(0, 10)} · {template.license}</p>
      <div className="tags">{template.tags.map((value) => <span className="tag" key={value}>{value}</span>)}</div>
      {template.source === 'community' ? <p className="callout">{COMMUNITY_NOTE}</p> : <p className="meta">Bundled starter template.</p>}
      {grade ? <GradeBadge grade={grade} /> : <p className="meta">This YAML could not be scored.</p>}
      <pre className="fix">{template.yaml}</pre>
      <div className="row">
        <button className="button button-primary" type="button" onClick={onLoad}>Load into editor</button>
      </div>
      {template.source === 'community' ? (
        signedIn ? (
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onReport() }}>
            <label>Report this template<textarea maxLength={500} value={reason} onChange={(event) => onReason(event.target.value)} required /></label>
            <button className="button" type="submit">Report</button>
          </form>
        ) : <p>Sign in to report this template.</p>
      ) : null}
    </article>
  )
}
