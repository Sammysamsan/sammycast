import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { CoverBanner } from '../../components/CoverBanner'
import {
  prepareImageUpload,
  updateCompanyProfile,
  uploadCompanyCover,
  uploadCompanyLogo,
} from '../../lib/api'

type ShowreelItem = {
  id: string
  title: string
  url: string
  note?: string
}

type Section = 'profile' | 'about' | 'website' | 'showreel' | 'showreel-edit' | null

function newId() {
  return `reel_${Math.random().toString(36).slice(2, 9)}`
}

export function parseShowreels(raw?: string | null): ShowreelItem[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      const items: ShowreelItem[] = []
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i]
        if (!item || typeof item !== 'object') continue
        const row = item as Record<string, unknown>
        const title = String(row.title || row.name || `Clip ${i + 1}`).trim()
        const url = String(row.url || row.link || '').trim()
        if (!title && !url) continue
        const showreel: ShowreelItem = {
          id: String(row.id || newId()),
          title: title || 'Untitled clip',
          url,
        }
        if (row.note) {
          showreel.note = String(row.note)
        }
        items.push(showreel)
      }
      return items
    }
  } catch {
    // legacy plain text / line list
  }

  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length > 1 || /https?:\/\//i.test(raw)) {
    return lines.map((line) => {
      const [titlePart, urlPart] = line.split('|').map((s) => s.trim())
      if (urlPart) return { id: newId(), title: titlePart || 'Clip', url: urlPart }
      if (/^https?:\/\//i.test(line)) return { id: newId(), title: 'Showreel clip', url: line }
      return { id: newId(), title: line, url: '' }
    })
  }
  return [{ id: newId(), title: raw.trim(), url: '' }]
}

export function serializeShowreels(items: ShowreelItem[]) {
  return JSON.stringify(items)
}

function normalizeUrl(value: string) {
  const v = value.trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  return `https://${v}`
}

export function ProductionDashboard() {
  const { company, refresh } = useAuth()
  const [section, setSection] = useState<Section>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    city: '',
    genres: '',
    banner: '',
    about: '',
    website: '',
    logo: '',
  })
  const [reelForm, setReelForm] = useState({ id: '', title: '', url: '', note: '' })
  const logoRef = useRef<HTMLInputElement>(null)

  const reels = useMemo(() => parseShowreels(company?.showreel), [company?.showreel])

  if (!company) return <p className="muted">Loading studio dashboard…</p>

  const openProfile = () => {
    setForm({
      name: company.name || '',
      city: company.city || '',
      genres: company.genres || '',
      banner: company.banner || '',
      about: company.about || '',
      website: company.website || '',
      logo: company.logo || '',
    })
    setSection('profile')
    setMsg(null)
    setError(null)
  }

  const openAbout = () => {
    setForm((f) => ({ ...f, about: company.about || '' }))
    setSection('about')
    setMsg(null)
    setError(null)
  }

  const openWebsite = () => {
    setForm((f) => ({ ...f, website: company.website || '' }))
    setSection('website')
    setMsg(null)
    setError(null)
  }

  const openAddReel = () => {
    setReelForm({ id: '', title: '', url: '', note: '' })
    setSection('showreel')
    setMsg(null)
    setError(null)
  }

  const openEditReel = (item: ShowreelItem) => {
    setReelForm({
      id: item.id,
      title: item.title,
      url: item.url,
      note: item.note || '',
    })
    setSection('showreel-edit')
    setMsg(null)
    setError(null)
  }

  const savePatch = async (patch: Record<string, string>) => {
    setBusy(true)
    setMsg(null)
    setError(null)
    try {
      await updateCompanyProfile(patch)
      await refresh()
      setSection(null)
      setMsg('Saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    await savePatch({
      name: form.name,
      city: form.city,
      genres: form.genres,
      banner: form.banner,
      about: form.about,
      website: normalizeUrl(form.website),
      logo: form.logo,
    })
  }

  const onSaveAbout = async (e: FormEvent) => {
    e.preventDefault()
    await savePatch({ about: form.about.trim() })
  }

  const onSaveWebsite = async (e: FormEvent) => {
    e.preventDefault()
    await savePatch({ website: normalizeUrl(form.website) })
  }

  const onSaveReel = async (e: FormEvent) => {
    e.preventDefault()
    const title = reelForm.title.trim() || 'Untitled clip'
    const url = normalizeUrl(reelForm.url)
    if (!url) {
      setError('Add a showreel link (YouTube, Vimeo, Drive, etc.)')
      return
    }
    const next = [...reels]
    if (reelForm.id) {
      const idx = next.findIndex((r) => r.id === reelForm.id)
      if (idx >= 0) {
        next[idx] = {
          id: reelForm.id,
          title,
          url,
          note: reelForm.note.trim() || undefined,
        }
      }
    } else {
      next.push({
        id: newId(),
        title,
        url,
        note: reelForm.note.trim() || undefined,
      })
    }
    await savePatch({ showreel: serializeShowreels(next) })
  }

  const onDeleteReel = async (id: string) => {
    const next = reels.filter((r) => r.id !== id)
    await savePatch({ showreel: serializeShowreels(next) })
  }

  const onLogo = async (file?: File | null) => {
    if (!file) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const prepared = await prepareImageUpload(file, 800)
      await uploadCompanyLogo(prepared)
      await refresh()
      setMsg('Logo updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed')
    } finally {
      setBusy(false)
      if (logoRef.current) logoRef.current.value = ''
    }
  }

  const onCover = async (file: File) => {
    setBusy(true)
    setError(null)
    setMsg(null)
    const localUrl = URL.createObjectURL(file)
    setCoverPreview(localUrl)
    try {
      const prepared = await prepareImageUpload(file, 1920)
      const updated = await uploadCompanyCover(prepared)
      await refresh()
      if (updated.coverUrl) {
        URL.revokeObjectURL(localUrl)
        setCoverPreview(null)
      }
      setMsg('Cover photo updated. Tap Adjust to reposition.')
    } catch (err) {
      URL.revokeObjectURL(localUrl)
      setCoverPreview(null)
      setError(err instanceof Error ? err.message : 'Cover upload failed')
    } finally {
      setBusy(false)
    }
  }

  const onSaveCoverPosition = async (coverPosition: string) => {
    setError(null)
    try {
      await updateCompanyProfile({ coverPosition })
      await refresh()
      setMsg('Cover position saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save cover position')
      throw err
    }
  }

  const coverSrc = coverPreview || company.coverUrl || null
  const websiteHref = company.website ? normalizeUrl(company.website) : ''

  return (
    <main className="rise">
      <div className="page-head">
        <div>
          <p className="kicker">Studio dashboard</p>
          <h1 className="h1">Your casting home</h1>
          <p className="lead">Write your studio story, add a website, and list showreel clips talent can watch.</p>
        </div>
        <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={openProfile}>
          Edit profile
        </button>
      </div>

      <section className="li-profile">
        <CoverBanner
          src={coverSrc}
          position={company.coverPosition}
          busy={busy}
          onUpload={onCover}
          onSavePosition={onSaveCoverPosition}
        />
        <div className="li-body">
          <label className="li-logo" aria-label="Upload logo">
            {company.logoUrl ? <img src={company.logoUrl} alt="" /> : <span>{company.logo || company.name.slice(0, 2)}</span>}
            <em>Upload</em>
            <input
              ref={logoRef}
              className="li-file-input"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => void onLogo(e.target.files?.[0])}
            />
          </label>
          <div className="li-meta">
            <div className="chip-row">
              {company.verified ? <span className="chip verified">Verified studio</span> : null}
              <span className="chip">{company.plan} plan</span>
              <span className="chip">{company.followers} followers</span>
            </div>
            <h2 className="h1" style={{ marginTop: 10 }}>{company.name}</h2>
            <p className="muted">{company.banner}</p>
            <p className="faint">{company.city} · {company.genres}</p>
          </div>
        </div>
      </section>

      <div className="bento">
        <article className="bento-tile bento-wide dash-card">
          <div className="dash-card-top">
            <p className="kicker">About</p>
            <button type="button" className="chip" onClick={openAbout}>
              {company.about ? 'Edit story' : 'Add story'}
            </button>
          </div>
          <h3 className="h2">Studio story</h3>
          {company.about ? (
            <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{company.about}</p>
          ) : (
            <div className="dash-empty">
              <p className="muted">Tell talent what you cast, your tone, and what a good tape looks like for your house.</p>
              <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={openAbout}>
                Write studio story
              </button>
            </div>
          )}
        </article>

        <article className="bento-tile">
          <p className="kicker">Open roles</p>
          <div className="stat-num">{company.openThreads}</div>
          <p className="muted">Live audition threads</p>
          <Link className="text-link" to="/production/threads">Manage threads →</Link>
        </article>

        <article className="bento-tile dash-card">
          <div className="dash-card-top">
            <p className="kicker">Website</p>
            <button type="button" className="chip" onClick={openWebsite}>
              {websiteHref ? 'Edit' : 'Add site'}
            </button>
          </div>
          <h3 className="h2">Studio site</h3>
          {websiteHref ? (
            <>
              <p className="muted clamp-2">{websiteHref.replace(/^https?:\/\//i, '')}</p>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <a className="text-link" href={websiteHref} target="_blank" rel="noreferrer">
                  Visit site →
                </a>
                <Link className="text-link" to="/production/review">AI review →</Link>
              </div>
            </>
          ) : (
            <div className="dash-empty">
              <p className="muted">Add your studio website so talent can learn more about your slate.</p>
              <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={openWebsite}>
                Add website
              </button>
            </div>
          )}
        </article>
      </div>

      <section className="dash-section">
        <div className="discover-results-head">
          <div>
            <p className="kicker">Showreels</p>
            <h2 className="h2">Featured clips</h2>
            <p className="faint">List sample reels as cards — title + link for each.</p>
          </div>
          <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={openAddReel}>
            Add clip
          </button>
        </div>

        {reels.length > 0 ? (
          <div className="bento discover-grid">
            {reels.map((reel, i) => (
              <article key={reel.id} className={`bento-tile reel-tile${i === 0 ? ' bento-feature' : ''}`}>
                <div className="dash-card-top">
                  <p className="kicker">Clip {i + 1}</p>
                  <div className="chip-row">
                    <button type="button" className="chip" onClick={() => openEditReel(reel)}>Edit</button>
                    <button type="button" className="chip" onClick={() => void onDeleteReel(reel.id)} disabled={busy}>
                      Remove
                    </button>
                  </div>
                </div>
                <h3 className="h2">{reel.title}</h3>
                {reel.note ? <p className="muted clamp-2">{reel.note}</p> : null}
                <div className="thread-meta">
                  {reel.url ? (
                    <a className="text-link" href={normalizeUrl(reel.url)} target="_blank" rel="noreferrer">
                      Watch clip →
                    </a>
                  ) : (
                    <span>No link yet</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <h3 className="h2">No showreel clips yet</h3>
            <p className="muted">Add YouTube, Vimeo, or Drive links as individual cards for talent to browse.</p>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto', marginTop: 12 }} onClick={openAddReel}>
              Add your first clip
            </button>
          </div>
        )}
      </section>

      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="faint" style={{ marginTop: 14 }}>{msg}</p> : null}

      {section === 'profile' ? (
        <div className="sheet-modal" role="dialog" aria-modal="true">
          <form className="sheet-panel" onSubmit={onSaveProfile}>
            <div className="row-top">
              <h2 className="h2">Edit studio profile</h2>
              <button type="button" className="chip" onClick={() => setSection(null)}>Close</button>
            </div>
            <div className="field"><label>Studio name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Logo initials (fallback)</label><input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} maxLength={3} /></div>
            <div className="field"><label>Tagline</label><input value={form.banner} onChange={(e) => setForm({ ...form, banner: e.target.value })} /></div>
            <div className="field"><label>Studio story</label><textarea value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} placeholder="What you cast, tone, what you look for in a first take…" /></div>
            <div className="field"><label>City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="field"><label>Genres</label><input value={form.genres} onChange={(e) => setForm({ ...form, genres: e.target.value })} /></div>
            <div className="field"><label>Website</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yourstudio.com" /></div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setSection(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}

      {section === 'about' ? (
        <div className="sheet-modal" role="dialog" aria-modal="true">
          <form className="sheet-panel" onSubmit={onSaveAbout}>
            <div className="row-top">
              <h2 className="h2">Studio story</h2>
              <button type="button" className="chip" onClick={() => setSection(null)}>Close</button>
            </div>
            <p className="muted" style={{ marginBottom: 12 }}>This sits on your public casting home so talent know your slate and tone.</p>
            <div className="field">
              <label>About</label>
              <textarea
                value={form.about}
                onChange={(e) => setForm({ ...form, about: e.target.value })}
                placeholder="Southlight casts intimate coastal dramas and OTT pilots. We want tapes that hold silence — not volume."
                required
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save story'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setSection(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}

      {section === 'website' ? (
        <div className="sheet-modal" role="dialog" aria-modal="true">
          <form className="sheet-panel" onSubmit={onSaveWebsite}>
            <div className="row-top">
              <h2 className="h2">Studio website</h2>
              <button type="button" className="chip" onClick={() => setSection(null)}>Close</button>
            </div>
            <p className="muted" style={{ marginBottom: 12 }}>Paste your studio URL. We’ll open it for talent from this card.</p>
            <div className="field">
              <label>Website URL</label>
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://southlight.example"
                required
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save website'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setSection(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}

      {section === 'showreel' || section === 'showreel-edit' ? (
        <div className="sheet-modal" role="dialog" aria-modal="true">
          <form className="sheet-panel" onSubmit={onSaveReel}>
            <div className="row-top">
              <h2 className="h2">{section === 'showreel-edit' ? 'Edit clip' : 'Add showreel clip'}</h2>
              <button type="button" className="chip" onClick={() => setSection(null)}>Close</button>
            </div>
            <div className="field">
              <label>Title</label>
              <input
                value={reelForm.title}
                onChange={(e) => setReelForm({ ...reelForm, title: e.target.value })}
                placeholder="Night Cafe teaser"
                required
              />
            </div>
            <div className="field">
              <label>Link</label>
              <input
                value={reelForm.url}
                onChange={(e) => setReelForm({ ...reelForm, url: e.target.value })}
                placeholder="https://youtube.com/…"
                required
              />
            </div>
            <div className="field">
              <label>Note (optional)</label>
              <input
                value={reelForm.note}
                onChange={(e) => setReelForm({ ...reelForm, note: e.target.value })}
                placeholder="30s tone reference"
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : section === 'showreel-edit' ? 'Save clip' : 'Add clip'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setSection(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  )
}
