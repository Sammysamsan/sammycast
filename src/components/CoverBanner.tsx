import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export type CoverPoint = { x: number; y: number }

export function parseCoverPosition(value?: string | null): CoverPoint {
  if (!value) return { x: 50, y: 50 }
  const parts = value.trim().split(/[\s,]+/).map(Number)
  const x = Number.isFinite(parts[0]) ? Math.min(100, Math.max(0, parts[0])) : 50
  const y = Number.isFinite(parts[1]) ? Math.min(100, Math.max(0, parts[1])) : 50
  return { x, y }
}

export function formatCoverPosition(point: CoverPoint): string {
  return `${Math.round(point.x)} ${Math.round(point.y)}`
}

type Props = {
  src: string | null
  position?: string | null
  fallbackClassName?: string
  busy?: boolean
  onUpload: (file: File) => void | Promise<void>
  onSavePosition: (position: string) => void | Promise<void>
}

export function CoverBanner({
  src,
  position,
  fallbackClassName = '',
  busy = false,
  onUpload,
  onSavePosition,
}: Props) {
  const coverRef = useRef<HTMLInputElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origin: CoverPoint
  } | null>(null)

  const saved = parseCoverPosition(position)
  const [repositioning, setRepositioning] = useState(false)
  const [draft, setDraft] = useState<CoverPoint>(saved)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!repositioning) setDraft(parseCoverPosition(position))
  }, [position, repositioning])

  const startReposition = () => {
    setDraft(parseCoverPosition(position))
    setRepositioning(true)
  }

  const cancelReposition = () => {
    setDraft(parseCoverPosition(position))
    setRepositioning(false)
    dragRef.current = null
  }

  const saveReposition = async () => {
    setSaving(true)
    try {
      await onSavePosition(formatCoverPosition(draft))
      setRepositioning(false)
    } finally {
      setSaving(false)
      dragRef.current = null
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!repositioning || !src) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: draft,
    }
  }

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      const rect = frameRef.current?.getBoundingClientRect()
      if (!rect || rect.width < 1 || rect.height < 1) return
      // Dragging the image: move focal point opposite to pointer travel.
      const dx = ((e.clientX - drag.startX) / rect.width) * 100
      const dy = ((e.clientY - drag.startY) / rect.height) * 100
      setDraft({
        x: Math.min(100, Math.max(0, drag.origin.x - dx)),
        y: Math.min(100, Math.max(0, drag.origin.y - dy)),
      })
    },
    [],
  )

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  const objectPosition = `${draft.x}% ${draft.y}%`

  return (
    <div
      ref={frameRef}
      className={`li-cover${repositioning ? ' is-repositioning' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {src ? (
        <img src={src} alt="" style={{ objectPosition }} draggable={false} />
      ) : (
        <div className={`li-cover-fallback ${fallbackClassName}`.trim()} />
      )}

      {repositioning ? (
        <>
          <div className="li-cover-hint">Drag to reposition</div>
          <div className="li-cover-actions" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="li-edit-cover solid" onClick={cancelReposition} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="li-edit-cover accent" onClick={() => void saveReposition()} disabled={saving}>
              {saving ? 'Saving…' : 'Save position'}
            </button>
          </div>
        </>
      ) : (
        <div className="li-cover-actions" onPointerDown={(e) => e.stopPropagation()}>
          {src ? (
            <button type="button" className="li-edit-cover" onClick={startReposition} disabled={busy}>
              Adjust
            </button>
          ) : null}
          <label className={`li-edit-cover${busy ? ' is-busy' : ''}`}>
            {busy ? 'Uploading…' : 'Change cover'}
            <input
              ref={coverRef}
              className="li-file-input"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onUpload(file)
                if (coverRef.current) coverRef.current.value = ''
              }}
            />
          </label>
        </div>
      )}
    </div>
  )
}
