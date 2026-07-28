import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createThread } from '../../lib/api'

const LANGUAGES = ['English', 'Hindi', 'Tamil'] as const

const GENRES = [
  'Drama',
  'Comedy',
  'Romance',
  'Thriller',
  'Crime',
  'Period',
  'Horror',
  'Action',
  'Musical',
  'OTT',
] as const

/** Major Indian casting cities — pills + searchable list */
const INDIA_CITIES = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Surat',
  'Lucknow',
  'Kanpur',
  'Nagpur',
  'Indore',
  'Thane',
  'Bhopal',
  'Visakhapatnam',
  'Patna',
  'Vadodara',
  'Ghaziabad',
  'Ludhiana',
  'Agra',
  'Nashik',
  'Faridabad',
  'Meerut',
  'Rajkot',
  'Varanasi',
  'Srinagar',
  'Amritsar',
  'Chandigarh',
  'Coimbatore',
  'Kochi',
  'Thiruvananthapuram',
  'Madurai',
  'Tiruchirappalli',
  'Mysuru',
  'Mangaluru',
  'Hubballi',
  'Guwahati',
  'Bhubaneswar',
  'Ranchi',
  'Raipur',
  'Dehradun',
  'Shimla',
  'Goa',
  'Pondicherry',
  'Noida',
  'Gurugram',
  'Navi Mumbai',
  'Secunderabad',
] as const

const POPULAR_CITIES = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Kochi',
  'Coimbatore',
  'Jaipur',
  'Ahmedabad',
  'Goa',
] as const

export function NewThread() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cityQuery, setCityQuery] = useState('')
  const [form, setForm] = useState({
    roleTitle: '',
    characterBrief: '',
    scriptText: '',
    language: 'English',
    city: 'Chennai',
    genre: 'Drama',
    deadline: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    visibilityDefault: 'public' as 'public' | 'private',
  })

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const cityOptions = useMemo(() => {
    const q = cityQuery.trim().toLowerCase()
    if (!q) return INDIA_CITIES.slice(0, 16)
    return INDIA_CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 20)
  }, [cityQuery])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.visibilityDefault) {
      setError('Choose public or private replies before publishing.')
      return
    }
    if (!form.city.trim()) {
      setError('Pick a city for this casting call.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const thread = await createThread({
        ...form,
        deadline: new Date(form.deadline).toISOString(),
      })
      navigate(`/production/review?thread=${thread.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="rise post-role">
      <div className="post-role-intro">
        <p className="kicker">New audition thread</p>
        <h1 className="h1">Post a role</h1>
        <p className="lead">Brief, script, deadline, language, and an explicit public/private choice.</p>
      </div>

      <form className="post-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="role-title">Role title</label>
          <input
            id="role-title"
            required
            value={form.roleTitle}
            onChange={(e) => set('roleTitle', e.target.value)}
            placeholder="e.g. Alex — The Last Train"
          />
        </div>

        <div className="field">
          <label htmlFor="character-brief">Character brief</label>
          <textarea
            id="character-brief"
            required
            value={form.characterBrief}
            onChange={(e) => set('characterBrief', e.target.value)}
            placeholder="Age range, tone, what you want to see in the take…"
          />
        </div>

        <div className="field">
          <label htmlFor="script-text">Script / scene</label>
          <textarea
            id="script-text"
            required
            value={form.scriptText}
            onChange={(e) => set('scriptText', e.target.value)}
            className="post-script"
            placeholder="Paste the sides talent should perform…"
          />
        </div>

        <div className="field">
          <label htmlFor="deadline">Deadline</label>
          <input
            id="deadline"
            type="date"
            required
            value={form.deadline}
            onChange={(e) => set('deadline', e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field-label">Language</span>
          <div className="chip-row option-pills" role="group" aria-label="Language">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                className={`chip ${form.language === lang ? 'active' : ''}`}
                onClick={() => set('language', lang)}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">City</span>
          <div className="chip-row option-pills" role="group" aria-label="Popular cities">
            {POPULAR_CITIES.map((city) => (
              <button
                key={city}
                type="button"
                className={`chip ${form.city === city ? 'active' : ''}`}
                onClick={() => {
                  set('city', city)
                  setCityQuery('')
                }}
              >
                {city}
              </button>
            ))}
          </div>
          <input
            className="city-search"
            value={cityQuery || (POPULAR_CITIES.includes(form.city as (typeof POPULAR_CITIES)[number]) ? '' : form.city)}
            onChange={(e) => {
              setCityQuery(e.target.value)
              set('city', e.target.value)
            }}
            placeholder="Search all Indian cities…"
            list="india-cities"
            aria-label="Search Indian cities"
          />
          <datalist id="india-cities">
            {INDIA_CITIES.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
          {cityQuery.trim() ? (
            <div className="chip-row option-pills city-suggest" role="listbox" aria-label="City matches">
              {cityOptions.map((city) => (
                <button
                  key={city}
                  type="button"
                  className={`chip ${form.city === city ? 'active' : ''}`}
                  onClick={() => {
                    set('city', city)
                    setCityQuery('')
                  }}
                >
                  {city}
                </button>
              ))}
              {cityOptions.length === 0 ? <span className="faint">No city match — keep typing a custom city.</span> : null}
            </div>
          ) : null}
        </div>

        <div className="field">
          <span className="field-label">Genre</span>
          <div className="chip-row option-pills" role="group" aria-label="Genre">
            {GENRES.map((genre) => (
              <button
                key={genre}
                type="button"
                className={`chip ${form.genre === genre ? 'active' : ''}`}
                onClick={() => set('genre', genre)}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        <p className="kicker">Visibility</p>
        <div className="vis-choice vis-choice-stack">
          <button
            type="button"
            className={form.visibilityDefault === 'public' ? 'active' : ''}
            onClick={() => set('visibilityDefault', 'public')}
          >
            <strong>Public replies</strong>
            <span>Talent can see each other&apos;s tapes</span>
          </button>
          <button
            type="button"
            className={form.visibilityDefault === 'private' ? 'active' : ''}
            onClick={() => set('visibilityDefault', 'private')}
          >
            <strong>Private only</strong>
            <span>Only your team reviews tapes</span>
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary post-submit" type="submit" disabled={busy}>
          {busy ? 'Publishing…' : 'Publish thread'}
        </button>
      </form>
    </main>
  )
}
