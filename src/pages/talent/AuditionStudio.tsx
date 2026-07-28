import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchThread, submitTape, type Thread } from '../../lib/api'

type RecState = 'idle' | 'ready' | 'recording' | 'review'

function pickRecorderMime() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export function AuditionStudio() {
  const { threadId = '' } = useParams()
  const navigate = useNavigate()
  const [thread, setThread] = useState<Thread | null>(null)
  const [speed, setSpeed] = useState(1)
  const [visibility, setVisibility] = useState<'public' | 'private' | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [retakes, setRetakes] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [recState, setRecState] = useState<RecState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [promptOn, setPromptOn] = useState(true)

  const liveRef = useRef<HTMLVideoElement>(null)
  const reviewRef = useRef<HTMLVideoElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)

  useEffect(() => {
    fetchThread(threadId).then(setThread)
  }, [threadId])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      stopTracks()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl, stopTracks])

  const attachLive = async (stream: MediaStream) => {
    streamRef.current = stream
    if (liveRef.current) {
      liveRef.current.srcObject = stream
      liveRef.current.muted = true
      await liveRef.current.play().catch(() => undefined)
    }
  }

  const enableCamera = async () => {
    setCamError(null)
    setError(null)
    if (!window.isSecureContext) {
      setCamError('Camera needs HTTPS (or localhost). Use the secure preview link, or upload a tape below.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('This browser cannot access the camera. Upload a tape instead.')
      return
    }
    try {
      stopTracks()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      await attachLive(stream)
      setRecState('ready')
      setFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCamError('Camera permission blocked — allow camera + mic in the browser, then tap Enable camera again.')
      } else if (name === 'NotFoundError') {
        setCamError('No camera found on this device. You can still upload a tape.')
      } else {
        setCamError('Camera unavailable — you can still upload a tape.')
      }
      setRecState('idle')
    }
  }

  // Auto-try camera once on mount (non-blocking)
  useEffect(() => {
    void enableCamera()
    // intentionally once on mount
  }, [])

  // Teleprompter scroll — only while recording (or when user leaves prompt on in ready/review for practice)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !promptOn) return
    if (recState !== 'recording' && recState !== 'ready') return
    let raf = 0
    let y = el.scrollTop
    const tick = () => {
      if (recState === 'recording') {
        y += 0.4 * speed
        if (y > el.scrollHeight - el.clientHeight) y = 0
        el.scrollTop = y
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speed, thread, recState, promptOn])

  const lines = useMemo(() => thread?.scriptText || '', [thread])

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startRecording = async () => {
    setError(null)
    let stream = streamRef.current
    if (!stream) {
      await enableCamera()
      stream = streamRef.current
    }
    if (!stream) {
      setError('Enable the camera first, then tap Start recording.')
      return
    }
    if (retakes >= 3) {
      setError('Retake limit reached (3/3). Upload a file instead, or go back and open the role again.')
      return
    }
    if (recState === 'recording') return
    const mime = pickRecorderMime()
    if (!mime && typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported in this browser. Upload a video file instead.')
      return
    }
    chunksRef.current = []
    try {
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        clearTimer()
        const type = recorder.mimeType || mime || 'video/webm'
        const blob = new Blob(chunksRef.current, { type })
        const ext = type.includes('mp4') ? 'mp4' : 'webm'
        const recorded = new File([blob], `sammy-take-${Date.now()}.${ext}`, { type })
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setFile(recorded)
        setRecState('review')
        setRetakes((r) => Math.min(3, r + 1))
        if (liveRef.current) liveRef.current.srcObject = stream
      }
      recorder.start(250)
      setRecState('recording')
      startedAtRef.current = Date.now()
      setElapsed(0)
      if (scrollRef.current) scrollRef.current.scrollTop = 0
      clearTimer()
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 250)
    } catch {
      setError('Could not start recorder. Try Chrome/Safari, or upload a tape.')
    }
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    } else {
      setRecState(streamRef.current ? 'ready' : 'idle')
    }
  }

  const retake = async () => {
    if (retakes >= 3) {
      setError('Retake limit reached (3/3).')
      return
    }
    setError(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setFile(null)
    setElapsed(0)
    if (!streamRef.current) {
      await enableCamera()
    } else {
      await attachLive(streamRef.current)
      setRecState('ready')
    }
  }

  const onUploadFile = (next?: File | null) => {
    if (!next) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(next)
    setPreviewUrl(url)
    setFile(next)
    setRecState('review')
    setCamError(null)
    setError(null)
  }

  const onSubmit = async () => {
    if (!visibility) {
      setError('Choose public or private visibility — no default.')
      return
    }
    if (!file) {
      setError('Record a take or upload a video to submit.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await submitTape(threadId, file, visibility)
      stopTracks()
      navigate(`/talent/score/${res.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  if (!thread) return <p className="muted">Loading studio…</p>

  return (
    <main className="rise studio-page">
      <p className="kicker">Recording studio</p>
      <h1 className="h1">{thread.roleTitle}</h1>
      <p className="faint">
        {recState === 'recording' ? `Recording ${mm}:${ss}` : `Retakes used ${retakes}/3`}
        {' · '}Teleprompter over camera
      </p>

      <div className={`tele-wrap${recState === 'recording' ? ' is-recording' : ''}`}>
        {recState === 'review' && previewUrl ? (
          <video ref={reviewRef} className="tele-cam" src={previewUrl} controls playsInline />
        ) : (
          <video ref={liveRef} className="tele-cam" muted playsInline autoPlay />
        )}
        {promptOn && recState !== 'review' ? (
          <div className="tele-overlay" ref={scrollRef}>
            {lines}
          </div>
        ) : null}
        {recState === 'recording' ? <div className="rec-badge" aria-live="polite">● REC {mm}:{ss}</div> : null}
        {recState === 'idle' && !previewUrl ? (
          <div className="tele-empty">
            <p>Camera off</p>
            <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={() => void enableCamera()}>
              Enable camera
            </button>
          </div>
        ) : null}
      </div>

      {camError ? <p className="faint">{camError}</p> : null}

      <div className="record-bar">
        {recState === 'idle' || recState === 'ready' ? (
          <button type="button" className="btn btn-record" onClick={() => void startRecording()} disabled={retakes >= 3}>
            ● Start recording
          </button>
        ) : null}
        {recState === 'recording' ? (
          <button type="button" className="btn btn-stop" onClick={stopRecording}>
            ■ Stop recording
          </button>
        ) : null}
        {recState === 'review' ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => void retake()} disabled={retakes >= 3}>
              Retake ({retakes}/3)
            </button>
            <button type="button" className="btn btn-teal" style={{ width: 'auto' }} onClick={() => void enableCamera()}>
              Re-enable camera
            </button>
          </>
        ) : null}
        {recState === 'ready' ? (
          <button type="button" className="btn btn-secondary" onClick={() => void enableCamera()}>
            Refresh camera
          </button>
        ) : null}
      </div>

      <div className="studio-tools">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="prompt-speed">Teleprompter speed</label>
          <input
            id="prompt-speed"
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            disabled={recState === 'review'}
          />
        </div>
        <label className="prompt-toggle">
          <input type="checkbox" checked={promptOn} onChange={(e) => setPromptOn(e.target.checked)} />
          Show teleprompter
        </label>
      </div>

      <div className="field">
        <label htmlFor="tape-upload">Or upload a take (MP4 / MOV / WebM · max 100 MB)</label>
        <input
          id="tape-upload"
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          onChange={(e) => onUploadFile(e.target.files?.[0] || null)}
        />
        {file ? <p className="faint" style={{ marginTop: 6 }}>Ready: {file.name}</p> : null}
      </div>

      <p className="kicker">Visibility — required</p>
      <div className="vis-choice">
        <button type="button" className={visibility === 'public' ? 'active' : ''} onClick={() => setVisibility('public')}>
          <strong>Public reply</strong>
          <span>Comment-style on the thread</span>
        </button>
        <button type="button" className={visibility === 'private' ? 'active' : ''} onClick={() => setVisibility('private')}>
          <strong>Private to production</strong>
          <span>Only the studio team sees it</span>
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      <button type="button" className="btn btn-primary" disabled={busy || !file} onClick={() => void onSubmit()}>
        {busy ? 'Uploading…' : file ? 'Submit for Sammy Intelligence' : 'Record or upload a take to submit'}
      </button>
      <p className="faint" style={{ marginTop: 10 }}>
        <Link to={`/talent/thread/${threadId}`}>← Back to brief</Link>
      </p>
    </main>
  )
}
