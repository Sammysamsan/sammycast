import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  daysLeft,
  deadlineDays,
  fetchLeaderboard,
  fetchMySubmissions,
  fetchThreads,
  parseLanguages,
  type Submission,
  type Thread,
} from '../../lib/api'

type SortKey = 'match' | 'deadline' | 'active' | 'newest'

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function matchScore(thread: Thread, userLangs: string[], userCity?: string | null) {
  let score = 0
  if (userLangs.some((l) => l.toLowerCase() === thread.language.toLowerCase())) score += 3
  if (userCity && thread.city && userCity.toLowerCase() === thread.city.toLowerCase()) score += 2
  if (thread.companyVerified) score += 1
  if (deadlineDays(thread.deadline) <= 2) score += 1
  return score
}

export function TalentFeed() {
  const { user } = useAuth()
  const [threads, setThreads] = useState<Thread[]>([])
  const [subs, setSubs] = useState<Submission[]>([])
  const [boardRank, setBoardRank] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [lang, setLang] = useState('All')
  const [city, setCity] = useState('All')
  const [genre, setGenre] = useState('All')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [closingSoon, setClosingSoon] = useState(false)
  const [publicOnly, setPublicOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('match')

  useEffect(() => {
    void Promise.all([
      fetchThreads({ status: 'open' }),
      fetchMySubmissions(),
      fetchLeaderboard(),
    ]).then(([openThreads, mine, board]) => {
      setThreads(openThreads)
      setSubs(mine)
      if (user) {
        const idx = board.findIndex((b) => b.id === user.id)
        setBoardRank(idx >= 0 ? idx + 1 : null)
      }
    })
  }, [user])

  const userLangs = useMemo(() => parseLanguages(user?.languages), [user?.languages])
  const appliedIds = useMemo(() => new Set(subs.map((s) => s.threadId)), [subs])

  const facets = useMemo(() => {
    return {
      languages: uniqueSorted(threads.map((t) => t.language)),
      cities: uniqueSorted(threads.map((t) => t.city || '')),
      genres: uniqueSorted(threads.map((t) => t.genre)),
    }
  }, [threads])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = threads.filter((t) => {
      if (lang !== 'All' && t.language !== lang) return false
      if (city !== 'All' && t.city !== city) return false
      if (genre !== 'All' && t.genre !== genre) return false
      if (verifiedOnly && !t.companyVerified) return false
      if (closingSoon && deadlineDays(t.deadline) > 2) return false
      if (publicOnly && t.visibilityDefault !== 'public') return false
      if (q) {
        const hay = `${t.roleTitle} ${t.characterBrief} ${t.companyName} ${t.genre} ${t.city}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sort === 'deadline') return deadlineDays(a.deadline) - deadlineDays(b.deadline)
      if (sort === 'active') return (b.replyCount || 0) - (a.replyCount || 0)
      if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return matchScore(b, userLangs, user?.city) - matchScore(a, userLangs, user?.city)
    })
    return sorted
  }, [threads, lang, city, genre, verifiedOnly, closingSoon, publicOnly, query, sort, userLangs, user?.city])

  const insights = useMemo(() => {
    const closing = threads.filter((t) => deadlineDays(t.deadline) <= 2)
    const verified = threads.filter((t) => t.companyVerified)
    const matched = threads.filter((t) => matchScore(t, userLangs, user?.city) >= 3)
    const totalReplies = threads.reduce((n, t) => n + (t.replyCount || 0), 0)
    const avgCompetition = threads.length ? Math.round(totalReplies / threads.length) : 0
    const genreCounts = threads.reduce<Record<string, number>>((acc, t) => {
      acc[t.genre] = (acc[t.genre] || 0) + 1
      return acc
    }, {})
    const hotGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Drama'
    const cityCounts = threads.reduce<Record<string, number>>((acc, t) => {
      if (!t.city) return acc
      acc[t.city] = (acc[t.city] || 0) + 1
      return acc
    }, {})
    const hotCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'India'
    const completed = subs.filter((s) => s.status === 'complete')
    const avgScore = completed.length
      ? Math.round(completed.reduce((n, s) => n + (s.overall || 0), 0) / completed.length)
      : null
    const bestScore = completed.reduce<number | null>((best, s) => {
      if (s.overall == null) return best
      return best == null ? s.overall : Math.max(best, s.overall)
    }, null)
    const featured = [...threads].sort((a, b) => {
      const urg = Number(deadlineDays(a.deadline) <= 2) - Number(deadlineDays(b.deadline) <= 2)
      if (urg !== 0) return urg > 0 ? -1 : 1
      return matchScore(b, userLangs, user?.city) - matchScore(a, userLangs, user?.city)
    })[0]

    return {
      open: threads.length,
      closing: closing.length,
      verified: verified.length,
      matched: matched.length,
      avgCompetition,
      hotGenre,
      hotCity,
      applied: appliedIds.size,
      avgScore,
      bestScore,
      featured,
    }
  }, [threads, userLangs, user?.city, subs, appliedIds])

  const clearFilters = () => {
    setQuery('')
    setLang('All')
    setCity('All')
    setGenre('All')
    setVerifiedOnly(false)
    setClosingSoon(false)
    setPublicOnly(false)
    setSort('match')
  }

  const filtersActive =
    query.trim() !== '' ||
    lang !== 'All' ||
    city !== 'All' ||
    genre !== 'All' ||
    verifiedOnly ||
    closingSoon ||
    publicOnly ||
    sort !== 'match'

  return (
    <main className="rise discover">
      <div className="page-head">
        <div>
          <p className="kicker">Discover</p>
          <h1 className="h1">Casting board</h1>
          <p className="lead">
            Live studio calls across India — filter by craft fit, then tape with a teleprompter and Sammy Intelligence score.
          </p>
        </div>
        <Link className="btn btn-primary" style={{ width: 'auto' }} to="/talent/record">
          Start recording
        </Link>
      </div>

      <section className="bento discover-insights" aria-label="Casting insights">
        <article className="bento-tile insight insight-accent">
          <p className="kicker">Open now</p>
          <div className="stat-num">{insights.open}</div>
          <p className="muted">Active casting threads</p>
        </article>
        <article className="bento-tile insight">
          <p className="kicker">Closing soon</p>
          <div className="stat-num">{insights.closing}</div>
          <p className="muted">Deadlines inside 48 hours</p>
          {insights.closing > 0 ? (
            <button type="button" className="text-link" onClick={() => setClosingSoon(true)}>
              Show urgent →
            </button>
          ) : null}
        </article>
        <article className="bento-tile insight">
          <p className="kicker">Your fit</p>
          <div className="stat-num">{insights.matched}</div>
          <p className="muted">
            Roles matching {userLangs.slice(0, 2).join(' / ') || 'your languages'}
            {user?.city ? ` · ${user.city}` : ''}
          </p>
        </article>
        <article className="bento-tile insight">
          <p className="kicker">Sammy Score</p>
          <div className="stat-num">{user?.sammyScore ?? '—'}</div>
          <p className="muted">
            {boardRank ? `Board rank #${boardRank}` : 'Climb the board with scored takes'}
            {insights.bestScore != null ? ` · best tape ${insights.bestScore}` : ''}
          </p>
        </article>
        <article className="bento-tile insight bento-wide">
          <p className="kicker">Board pulse</p>
          <h3 className="h2">{insights.hotGenre} leads · {insights.hotCity} is busiest</h3>
          <p className="muted">
            {insights.verified} verified studios · avg {insights.avgCompetition} tapes per call · you&apos;ve applied to{' '}
            {insights.applied}
            {insights.avgScore != null ? ` · your avg score ${insights.avgScore}` : ''}
          </p>
        </article>
        {insights.featured ? (
          <Link className="bento-tile insight bento-feature featured-call" to={`/talent/thread/${insights.featured.id}`}>
            <p className="kicker">
              Spotlight{deadlineDays(insights.featured.deadline) <= 2 ? ' · Urgent' : ''}
              {insights.featured.companyVerified ? ' · Verified' : ''}
            </p>
            <h3 className="h2">{insights.featured.roleTitle}</h3>
            <p className="muted clamp-2">{insights.featured.characterBrief}</p>
            <div className="chip-row" style={{ marginTop: 12 }}>
              <span className="chip">{insights.featured.companyName}</span>
              <span className="chip">{insights.featured.language}</span>
              <span className="chip">{insights.featured.genre}</span>
              <span className="chip">{daysLeft(insights.featured.deadline)}</span>
            </div>
          </Link>
        ) : null}
      </section>

      <section className="filter-panel" aria-label="Discover filters">
        <div className="filter-search">
          <label className="filter-label" htmlFor="discover-q">Search</label>
          <input
            id="discover-q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Role, studio, city, vibe…"
          />
        </div>

        <div className="filter-group">
          <p className="filter-label">Language</p>
          <div className="chip-row">
            {['All', ...facets.languages].map((l) => (
              <button key={l} type="button" className={`chip ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>
                {l === 'All' ? 'All languages' : l}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <p className="filter-label">City</p>
          <div className="chip-row">
            {['All', ...facets.cities].map((c) => (
              <button key={c} type="button" className={`chip ${city === c ? 'active' : ''}`} onClick={() => setCity(c)}>
                {c === 'All' ? 'All cities' : c}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <p className="filter-label">Genre</p>
          <div className="chip-row">
            {['All', ...facets.genres].map((g) => (
              <button key={g} type="button" className={`chip ${genre === g ? 'active' : ''}`} onClick={() => setGenre(g)}>
                {g === 'All' ? 'All genres' : g}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <p className="filter-label">Refine</p>
          <div className="chip-row">
            <button type="button" className={`chip ${verifiedOnly ? 'active' : ''}`} onClick={() => setVerifiedOnly((v) => !v)}>
              Verified studios
            </button>
            <button type="button" className={`chip ${closingSoon ? 'active' : ''}`} onClick={() => setClosingSoon((v) => !v)}>
              Closing soon
            </button>
            <button type="button" className={`chip ${publicOnly ? 'active' : ''}`} onClick={() => setPublicOnly((v) => !v)}>
              Public tapes
            </button>
          </div>
        </div>

        <div className="filter-group">
          <p className="filter-label">Sort</p>
          <div className="chip-row">
            {(
              [
                ['match', 'Best match'],
                ['deadline', 'Deadline'],
                ['active', 'Most active'],
                ['newest', 'Newest'],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" className={`chip ${sort === key ? 'active' : ''}`} onClick={() => setSort(key)}>
                {label}
              </button>
            ))}
            {filtersActive ? (
              <button type="button" className="chip" onClick={clearFilters}>
                Clear all
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="discover-results-head">
        <h2 className="h2">{filtered.length} open call{filtered.length === 1 ? '' : 's'}</h2>
        <p className="faint">
          {sort === 'match' ? 'Sorted by language, city, and urgency fit' : null}
          {sort === 'deadline' ? 'Soonest deadlines first' : null}
          {sort === 'active' ? 'Most submitted tapes first' : null}
          {sort === 'newest' ? 'Freshest posts first' : null}
        </p>
      </div>

      <div className="bento discover-grid">
        {filtered.map((t, i) => {
          const days = deadlineDays(t.deadline)
          const fit = matchScore(t, userLangs, user?.city)
          const applied = appliedIds.has(t.id)
          const feature = i === 0 || days <= 1
          return (
            <Link
              key={t.id}
              className={`bento-tile thread-tile${feature ? ' bento-feature' : ''}${days <= 2 ? ' is-urgent' : ''}`}
              to={`/talent/thread/${t.id}`}
            >
              <div className="thread-tile-top">
                <p className="kicker">
                  {t.companyName}
                  {t.companyVerified ? ' · Verified' : ''}
                </p>
                <div className="chip-row">
                  {fit >= 3 ? <span className="chip match">Fit</span> : null}
                  {applied ? <span className="chip">Applied</span> : null}
                  {days <= 2 ? <span className="chip urgent-chip">Urgent</span> : null}
                </div>
              </div>
              <h3 className="h2">{t.roleTitle}</h3>
              <p className="muted clamp-2">{t.characterBrief}</p>
              <div className="thread-meta">
                <span>{t.language}</span>
                <span>{t.genre}</span>
                <span>{t.city || 'Remote'}</span>
                <span>{daysLeft(t.deadline)}</span>
                <span>{t.replyCount || 0} tapes in</span>
                <span>{t.visibilityDefault === 'public' ? 'Public' : 'Private'}</span>
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-panel">
          <h3 className="h2">No calls match these filters</h3>
          <p className="muted">Widen language or city, or clear filters to see the full board.</p>
          <button type="button" className="btn btn-secondary" style={{ width: 'auto', marginTop: 12 }} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : null}
    </main>
  )
}
