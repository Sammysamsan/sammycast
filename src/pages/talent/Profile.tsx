import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { CoverBanner } from '../../components/CoverBanner'
import {
  prepareImageUpload,
  updateTalentProfile,
  uploadTalentAvatar,
  uploadTalentCover,
} from '../../lib/api'

export function TalentProfile() {
  const { user, refresh } = useAuth()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: user?.name || '',
    city: user?.city || '',
    languages: user?.languages || '',
    bio: user?.bio || '',
    skills: user?.skills || '',
  })
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  if (!user) return null

  const openEdit = () => {
    setForm({
      name: user.name || '',
      city: user.city || '',
      languages: user.languages || '',
      bio: user.bio || '',
      skills: user.skills || '',
    })
    setEditing(true)
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateTalentProfile(form)
      await refresh()
      setEditing(false)
      setMsg('Profile saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const onCoverChange = async (file: File) => {
    setBusy(true)
    setError(null)
    setMsg(null)
    const localUrl = URL.createObjectURL(file)
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return localUrl
    })
    try {
      const prepared = await prepareImageUpload(file, 1920)
      const updated = await uploadTalentCover(prepared)
      await refresh()
      if (updated.coverUrl) {
        setCoverPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
      }
      setMsg('Cover photo updated. Tap Adjust to reposition.')
    } catch (err) {
      setCoverPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setError(err instanceof Error ? err.message : 'Cover upload failed')
    } finally {
      setBusy(false)
    }
  }

  const onSaveCoverPosition = async (coverPosition: string) => {
    setError(null)
    try {
      await updateTalentProfile({ coverPosition })
      await refresh()
      setMsg('Cover position saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save cover position')
      throw err
    }
  }

  const onAvatarChange = async (file?: File | null) => {
    if (!file) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const prepared = await prepareImageUpload(file, 800)
      await uploadTalentAvatar(prepared)
      await refresh()
      setMsg('Profile photo updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed')
    } finally {
      setBusy(false)
      if (avatarRef.current) avatarRef.current.value = ''
    }
  }

  const coverSrc = coverPreview || user.coverUrl || null

  return (
    <main className="rise">
      <div className="page-head">
        <div>
          <p className="kicker">Talent dashboard</p>
          <h1 className="h1">Your public profile</h1>
          <p className="lead">Portfolio, Sammy Score, and the story casting teams read first.</p>
        </div>
        <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={openEdit}>
          Edit profile
        </button>
      </div>

      <section className="li-profile">
        <CoverBanner
          src={coverSrc}
          position={user.coverPosition}
          fallbackClassName="talent"
          busy={busy}
          onUpload={onCoverChange}
          onSavePosition={onSaveCoverPosition}
        />
        <div className="li-body">
          <label className="li-logo round" aria-label="Upload photo">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{user.name.slice(0, 1)}</span>}
            <em>Photo</em>
            <input
              ref={avatarRef}
              className="li-file-input"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => void onAvatarChange(e.target.files?.[0])}
            />
          </label>
          <div className="li-meta">
            <div className="chip-row">
              <span className="chip">{user.city}</span>
              <span className="chip">{user.languages}</span>
              <span className="chip verified">Sammy Score {user.sammyScore}</span>
            </div>
            <h2 className="h1" style={{ marginTop: 10 }}>{user.name}</h2>
            <p className="muted">{user.bio}</p>
            <p className="faint">{user.skills} · {user.followers} followers</p>
          </div>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="faint">{msg}</p> : null}
      <p className="faint">Tip: use JPG or PNG for cover photos (HEIC from iPhone may fail).</p>

      <div className="bento">
        <article className="bento-tile bento-feature">
          <p className="kicker">Sammy Score</p>
          <div className="stat-num">{user.sammyScore}</div>
          <p className="muted">Range 300–900 · earned across auditions</p>
          <Link className="text-link" to="/talent/more">View leaderboard →</Link>
        </article>
        <article className="bento-tile">
          <p className="kicker">Skills</p>
          <p className="muted">{user.skills || 'Add skills in Edit profile'}</p>
        </article>
        <article className="bento-tile">
          <p className="kicker">Next step</p>
          <Link className="text-link" to="/talent/feed">Browse open threads →</Link>
        </article>
      </div>

      {editing ? (
        <div className="sheet-modal" role="dialog" aria-modal="true">
          <form className="sheet-panel" onSubmit={onSave}>
            <div className="row-top">
              <h2 className="h2">Edit talent profile</h2>
              <button type="button" className="chip" onClick={() => setEditing(false)}>Close</button>
            </div>
            <div className="field"><label>Display name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="field"><label>Languages</label><input value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} /></div>
            <div className="field"><label>Bio</label><textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
            <div className="field"><label>Skills</label><input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  )
}
