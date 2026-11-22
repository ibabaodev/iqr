import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import './App.css'

type OutputFormat = 'image/jpeg' | 'image/webp'
type ProcessedImage = { url: string; blob: Blob; width: number; height: number; keptOriginal: boolean }


function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(3)} MB`
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef<HTMLImageElement | null>(null)
  const comparisonStageRef = useRef<HTMLDivElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [processed, setProcessed] = useState<ProcessedImage | null>(null)
  const [quality, setQuality] = useState(100)
  const [format, setFormat] = useState<OutputFormat>('image/jpeg')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [comparison, setComparison] = useState(50)
  const [sourceLoaded, setSourceLoaded] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dividerHovered, setDividerHovered] = useState(false)
  const panDragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null)
  const dividerDragRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
  }, [sourceUrl])

  useEffect(() => () => {
    if (processed) URL.revokeObjectURL(processed.url)
  }, [processed])

  useEffect(() => {
    const stage = comparisonStageRef.current
    if (!stage || !file) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setZoom((current) => {
        const next = Math.min(4, Math.max(1, Number((current + (event.deltaY < 0 ? 0.15 : -0.15)).toFixed(2))))
        if (next === 1) setPan({ x: 0, y: 0 })
        return next
      })
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [file])

  useEffect(() => {
    const image = sourceRef.current
    if (!image || !file || !sourceLoaded || !image.complete || !image.naturalWidth) return

    let cancelled = false
    const width = image.naturalWidth
    const height = image.naturalHeight
    if (quality === 100) {
      setProcessed({ url: URL.createObjectURL(file), blob: file, width, height, keptOriginal: true })
      setProcessing(false)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    setProcessing(true)
    canvas.toBlob((blob) => {
      if (cancelled) return
      if (!blob) {
        setProcessing(false)
        return
      }
      const keptOriginal = blob.size >= file.size
      const outputBlob = keptOriginal ? file : blob
      setProcessed({ url: URL.createObjectURL(outputBlob), blob: outputBlob, width, height, keptOriginal })
      setProcessing(false)
    }, format, quality / 100)

    return () => { cancelled = true }
  }, [file, sourceUrl, sourceLoaded, quality, format])

  function selectFile(selected: File | undefined) {
    if (!selected) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      setError('Choose a JPG, PNG, or WebP image.')
      return
    }
    setError('')
    setProcessed(null)
    setProcessing(false)
    setSourceLoaded(false)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setFile(selected)
    setSourceUrl(URL.createObjectURL(selected))
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0])
    event.target.value = ''
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDragging(false)
    selectFile(event.dataTransfer.files[0])
  }

  const extension = processed?.blob.type === 'image/webp' ? 'webp' : processed?.blob.type === 'image/png' ? 'png' : 'jpg'

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="IQR home">
          <img className="brand-logo" src="/iqr_logo-iqr.webp" alt="" />
          <span>IQR</span>
        </a>
        <span className="header-caption">Image Quality Reducer</span>
      </header>

      <main id="top" className="main-content">
        <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} />
        {!file ? (
          <section
            className={`upload-card${dragging ? ' is-dragging' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            aria-label="Image upload area"
          >
            <button className="upload-icon" type="button" aria-label="Choose an image" onClick={() => inputRef.current?.click()}>
              <svg viewBox="0 0 48 48" fill="none"><path d="M24 31V9m0 0-8 8m8-8 8 8M10 29v8a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3v-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <h2>Drop your image here</h2>
            <p>or <button className="text-button" onClick={() => inputRef.current?.click()}>browse files</button> from your device</p>
            <div className="file-types"><span>JPG</span><span>PNG</span><span>WEBP</span></div>
            {error && <p className="error-message" role="alert">{error}</p>}
          </section>
        ) : (
          <section className="workspace" onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <div className="editor-grid">
              <div className="preview-column">
                <article className="comparison-card">
                  <div className="comparison-heading">
                    <span>Image comparison</span>
                    <div className="comparison-heading-actions">
                      <div className="comparison-sizes"><span><i className="original-key" />Original {formatBytes(file.size)}</span><span><i className="reduced-key" />{processed?.keptOriginal ? 'Original kept' : 'Reduced'} {processed ? formatBytes(processed.blob.size) : 'Preparing...'}</span></div>
                      <button className="change-image-button" type="button" onClick={() => inputRef.current?.click()}>
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="3.5" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M10 13V6m0 0L7.5 8.5M10 6l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Change image
                      </button>
                    </div>
                  </div>
                  <div ref={comparisonStageRef} className={`comparison-stage${zoom > 1 ? ' is-zoomed' : ' is-zoomable'}${dividerHovered ? ' is-divider-hovered' : ''}${panDragRef.current ? ' is-panning' : ''}`} style={{ '--comparison': `${comparison}%`, '--zoom': zoom, '--pan-x': `${pan.x}px`, '--pan-y': `${pan.y}px` } as React.CSSProperties} onPointerDown={(event) => {
                    if ((event.target as HTMLElement).closest('.comparison-divider-hit')) {
                      event.preventDefault()
                      dividerDragRef.current = event.pointerId
                      event.currentTarget.setPointerCapture(event.pointerId)
                      return
                    }
                    if ((event.target as HTMLElement).closest('.zoom-controls')) return
                    panDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
                    event.currentTarget.classList.add('is-panning')
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }} onPointerMove={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect()
                    const dividerX = bounds.left + bounds.width * comparison / 100
                    setDividerHovered(Math.abs(event.clientX - dividerX) <= 40)
                    if (dividerDragRef.current === event.pointerId) {
                      setComparison(Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)))
                      return
                    }
                    const drag = panDragRef.current
                    if (drag?.pointerId === event.pointerId) setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y })
                  }} onPointerUp={(event) => {
                    if (dividerDragRef.current === event.pointerId) dividerDragRef.current = null
                    if (panDragRef.current?.pointerId === event.pointerId) {
                      panDragRef.current = null
                      event.currentTarget.classList.remove('is-panning')
                    }
                  }} onPointerCancel={(event) => { panDragRef.current = null; dividerDragRef.current = null; event.currentTarget.classList.remove('is-panning') }} onPointerLeave={() => setDividerHovered(false)}>
                    {processed && <img className="comparison-image" src={processed.url} alt={processed.keptOriginal ? 'Original image kept because compression was larger' : 'Reduced image'} draggable={false} />}
                    <div className="comparison-original" style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)` }}>
                      <img className="comparison-image" src={sourceUrl} alt={`Original ${file.name}`} draggable={false} onLoad={(event) => { sourceRef.current = event.currentTarget; setSourceLoaded(true) }} />
                    </div>
                    <span className="comparison-tag original-tag">Original</span>
                    <span className="comparison-tag reduced-tag">{processed?.keptOriginal ? 'Original kept' : 'Reduced'}</span>
                    <div className="comparison-divider" aria-hidden="true"><span><svg viewBox="0 0 24 24" fill="none"><path d="M7 12h10m-10 0 3-3m-3 3 3 3m7-3-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span></div>
                    <div className="comparison-divider-hit" onPointerDown={(event) => event.preventDefault()} aria-hidden="true" />
                    {!processed && (processing || !sourceLoaded) && <span className="processing-indicator">Preparing reduced preview...</span>}
                    {processed && processing && <span className="processing-indicator">Updating preview...</span>}
                    <div className="zoom-controls" onPointerDown={(event) => event.stopPropagation()}>
                      <button type="button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((current) => {
                        const next = Math.max(1, Number((current - 0.25).toFixed(2)))
                        if (next === 1) setPan({ x: 0, y: 0 })
                        return next
                      })}>−</button>
                      <button type="button" className="zoom-level" aria-label="Reset zoom" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>{Math.round(zoom * 100)}%</button>
                      <button type="button" aria-label="Zoom in" disabled={zoom >= 4} onClick={() => setZoom((current) => Math.min(4, Number((current + 0.25).toFixed(2))))}>+</button>
                    </div>
                    <input className="comparison-slider" type="range" min="0" max="100" value={comparison} aria-label="Slide to compare original and reduced image" onChange={(event) => setComparison(Number(event.target.value))} />
                  </div>
                  <div className="comparison-meta"><span>{file.name}</span><span>{sourceRef.current?.naturalWidth || '—'} × {sourceRef.current?.naturalHeight || '—'} · {format.toUpperCase().replace('IMAGE/', '')}</span></div>
                </article>
              </div>

              <aside className="controls-card">
                <div className="control-heading"><div className="control-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="15" cy="7" r="2" fill="white" stroke="currentColor" strokeWidth="1.8"/><circle cx="9" cy="17" r="2" fill="white" stroke="currentColor" strokeWidth="1.8"/></svg></div><div><h3>Settings</h3></div></div>
                <div className="control-group">
                  <div className="control-label"><label htmlFor="quality">Image quality</label><span className="value-badge">{quality}%</span></div>
                  <input id="quality" className="quality-slider" type="range" min="1" max="100" value={quality} style={{ '--range-progress': `${quality}%` } as React.CSSProperties} onChange={(event) => setQuality(Number(event.target.value))} />
                </div>
                <div className="control-group format-group">
                  <div className="control-label"><label htmlFor="format">Output format</label></div>
                  <div className="select-wrap"><select id="format" value={format} onChange={(event) => setFormat(event.target.value as OutputFormat)}><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                </div>
                <a className={`download-button${processed ? '' : ' disabled'}`} href={processed ? processed.url : undefined} download={processed ? `${file.name.replace(/\.[^.]+$/, '')}-iqr.${extension}` : undefined} aria-disabled={!processed} onClick={(event) => { if (!processed) event.preventDefault() }}>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3.5v8m0 0 3-3m-3 3-3-3M4 13v2.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Download image
                </a>
              </aside>
            </div>
          </section>
        )}

      </main>

    </div>
  )
}

export default App
