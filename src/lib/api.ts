export type Role = 'production' | 'talent'

export type User = {
  id: string
  email: string
  role: Role
  name: string
  city?: string
  languages?: string
  bio?: string
  skills?: string
  sammyScore: number
  verified: boolean
  companyId?: string | null
  followers: number
  avatarUrl?: string | null
  coverUrl?: string | null
  coverPosition?: string | null
}

export type Company = {
  id: string
  name: string
  city: string
  genres: string
  banner: string
  logo: string
  logoUrl?: string | null
  coverUrl?: string | null
  coverPosition?: string | null
  about?: string | null
  website?: string | null
  verified: boolean
  followers: number
  showreel: string
  plan: string
  openThreads: number
}

export type PricingPlan = {
  id: string
  name: string
  price: string
  period: string
  blurb: string
  features: string[]
  popular?: boolean
  enterprise?: boolean
}

export type Thread = {
  id: string
  companyId: string
  roleTitle: string
  characterBrief: string
  scriptText: string
  language: string
  city: string
  genre: string
  deadline: string
  visibilityDefault: string
  status: string
  createdAt: string
  companyName?: string
  companyVerified?: boolean
  replyCount?: number
  publicReplies?: Submission[]
}

export type Dimension = { key: string; label: string; score: number; note: string }

export type Report = {
  overall: number
  summary: string
  writtenFeedback?: string
  dimensions: Dimension[]
  metrics?: Dimension[]
  transcript?: string
  findings?: { title: string; detail: string }[]
  highlights?: string[]
  improvements?: string[]
  engine?: Record<string, string>
}

export type Submission = {
  id: string
  threadId: string
  talentId: string
  visibility: string
  status: string
  decision: string
  fileName?: string
  progress: number
  stage: string
  error?: string | null
  overall?: number | null
  createdAt: string
  report?: Report | null
  talentName?: string
  talentCity?: string
  talentLanguages?: string
  talentScore?: number
  roleTitle?: string
}

export type Message = {
  id: string
  companyId: string
  talentId: string
  threadId?: string | null
  direction: string
  body: string
  createdAt: string
  read: boolean
  talentName?: string
  companyName?: string
}

const USER_KEY = 'sammy_user_id'
const ROLE_KEY = 'sammy_role'

export function saveSession(userId: string, role: Role) {
  localStorage.setItem(USER_KEY, userId)
  localStorage.setItem(ROLE_KEY, role)
}

export function clearSession() {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(ROLE_KEY)
}

export function getSession() {
  return {
    userId: localStorage.getItem(USER_KEY),
    role: localStorage.getItem(ROLE_KEY) as Role | null,
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    try {
      const body = JSON.parse(text) as { detail?: unknown }
      if (typeof body.detail === 'string') throw new Error(body.detail)
      if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        throw new Error(String(body.detail[0].msg))
      }
    } catch (err) {
      if (err instanceof Error && err.message !== text) throw err
    }
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

/** Resize/compress phone photos so cover uploads succeed on mobile. */
export async function prepareImageUpload(file: File, maxEdge = 1920): Promise<File> {
  const type = (file.type || '').toLowerCase()
  if (type && !type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG or PNG).')
  }
  if (type.includes('heic') || type.includes('heif') || /\.heic$/i.test(file.name)) {
    throw new Error('HEIC photos are not supported. In iPhone Photos, tap Share → Options → Most Compatible, or export as JPG.')
  }

  // Small JPEGs/PNGs can upload as-is.
  if (file.size < 1.5 * 1024 * 1024 && (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp')) {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) return file
    const base = file.name.replace(/\.[^.]+$/, '') || 'cover'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    // If the browser can't decode (e.g. HEIC), fall through with original — server will validate.
    return file
  }
}

function headers(extra?: HeadersInit): HeadersInit {
  const { userId } = getSession()
  return {
    ...(extra || {}),
    ...(userId ? { 'X-User-Id': userId } : {}),
  }
}

export async function login(email: string, password: string, role: Role) {
  return parse<{ user: User; company: Company | null }>(
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    }),
  )
}

export async function fetchMe() {
  return parse<{ user: User; company: Company | null }>(
    await fetch('/api/me', { headers: headers() }),
  )
}

export async function fetchCompany(id: string) {
  return parse<Company>(await fetch(`/api/companies/${id}`))
}

export async function fetchThreads(params?: { status?: string; mine?: boolean }) {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.mine) q.set('mine', 'true')
  const suffix = q.toString() ? `?${q}` : ''
  return parse<Thread[]>(await fetch(`/api/threads${suffix}`, { headers: headers() }))
}

export async function fetchThread(id: string) {
  return parse<Thread>(await fetch(`/api/threads/${id}`))
}

export async function createThread(body: Record<string, string>) {
  return parse<Thread>(
    await fetch('/api/threads', {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }),
  )
}

export async function closeThread(id: string) {
  return parse<{ status: string }>(
    await fetch(`/api/threads/${id}/close`, { method: 'POST', headers: headers() }),
  )
}

export async function fetchThreadSubmissions(threadId: string) {
  return parse<Submission[]>(
    await fetch(`/api/threads/${threadId}/submissions`, { headers: headers() }),
  )
}

export async function fetchMySubmissions() {
  return parse<Submission[]>(await fetch('/api/submissions/mine', { headers: headers() }))
}

export async function fetchSubmission(id: string) {
  return parse<Submission>(await fetch(`/api/submissions/${id}`))
}

export async function submitTape(threadId: string, file: File, visibility: 'public' | 'private') {
  const body = new FormData()
  body.append('video', file)
  body.append('visibility', visibility)
  return parse<{ id: string; status: string }>(
    await fetch(`/api/threads/${threadId}/submit`, {
      method: 'POST',
      headers: headers(),
      body,
    }),
  )
}

export async function setDecision(subId: string, decision: 'shortlist' | 'pass' | 'pending') {
  return parse<Submission>(
    await fetch(`/api/submissions/${subId}/decision`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ decision }),
    }),
  )
}

export async function fetchMessages() {
  return parse<Message[]>(await fetch('/api/messages', { headers: headers() }))
}

export async function sendInvite(talentId: string, threadId: string | null, body: string) {
  return parse<Message>(
    await fetch('/api/messages/invite', {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ talentId, threadId, body }),
    }),
  )
}

export async function fetchLeaderboard() {
  return parse<
    { id: string; name: string; city: string; languages: string; sammyScore: number; followers: number; verified: boolean }[]
  >(await fetch('/api/leaderboard'))
}

export async function fetchTalent(id: string) {
  return parse<{ profile: User; auditions: Submission[] }>(await fetch(`/api/talent/${id}`))
}

export function daysLeft(deadline: string) {
  const d = deadlineDays(deadline)
  if (d <= 0) return 'Closing soon'
  if (d === 1) return '1 day left'
  return `${d} days left`
}

export function deadlineDays(deadline: string) {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function parseLanguages(value?: string | null) {
  return (value || '')
    .split(/[,/|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function updateCompanyProfile(body: Partial<Company>) {
  return parse<Company>(
    await fetch('/api/company/me', {
      method: 'PATCH',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }),
  )
}

export async function uploadCompanyLogo(file: File) {
  const body = new FormData()
  body.append('file', file)
  return parse<Company>(await fetch('/api/company/me/logo', { method: 'POST', headers: headers(), body }))
}

export async function uploadCompanyCover(file: File) {
  const body = new FormData()
  body.append('file', file)
  return parse<Company>(await fetch('/api/company/me/cover', { method: 'POST', headers: headers(), body }))
}

export async function updateTalentProfile(body: Partial<User>) {
  return parse<User>(
    await fetch('/api/talent/me', {
      method: 'PATCH',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }),
  )
}

export async function uploadTalentAvatar(file: File) {
  const body = new FormData()
  body.append('file', file)
  return parse<User>(await fetch('/api/talent/me/avatar', { method: 'POST', headers: headers(), body }))
}

export async function uploadTalentCover(file: File) {
  const body = new FormData()
  body.append('file', file)
  return parse<User>(await fetch('/api/talent/me/cover', { method: 'POST', headers: headers(), body }))
}

export async function fetchPricing() {
  return parse<{ talent: PricingPlan[]; production: PricingPlan[] }>(await fetch('/api/pricing'))
}
