import React, { useEffect, useRef, useState, useId } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  darkMode: true,
  themeVariables: {
    background: '#0d1117',
    mainBkg: '#161b22',
    nodeBorder: '#30363d',
    clusterBkg: '#1c2128',
    titleColor: '#e6edf3',
    edgeLabelBackground: '#161b22',
    lineColor: '#8b949e',
    primaryColor: '#1c2128',
    primaryTextColor: '#e6edf3',
    primaryBorderColor: '#30363d',
    secondaryColor: '#21262d',
    tertiaryColor: '#161b22',
    fontFamily: 'Inter, sans-serif',
  },
  flowchart: { curve: 'basis', padding: 20 },
  sequence: { actorFontFamily: 'Inter, sans-serif', messageFontFamily: 'Inter, sans-serif' },
})

let renderCount = 0

interface Props {
  code: string
}

export default function MermaidPreview({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const render = async () => {
      // Small debounce to avoid thrashing while typing
      await new Promise(r => setTimeout(r, 200))
      if (cancelled) return

      try {
        const id = `mermaid-${++renderCount}`
        const { svg } = await mermaid.render(id, code.trim())
        if (cancelled) return
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          // Make SVG responsive
          const svgEl = containerRef.current.querySelector('svg')
          if (svgEl) {
            svgEl.style.maxWidth = '100%'
            svgEl.style.height = 'auto'
            svgEl.removeAttribute('width')
            svgEl.removeAttribute('height')
          }
        }
        setError(null)
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setError(message.replace(/\n/g, ' ').substring(0, 200))
        if (containerRef.current) containerRef.current.innerHTML = ''
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    render()
    return () => { cancelled = true }
  }, [code])

  return (
    <div style={{ width: '100%', maxWidth: '800px' }}>
      {loading && !error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <span key={i} className="loading-dot" style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--primary)', display: 'inline-block',
              }} />
            ))}
          </div>
        </div>
      )}
      {error && (
        <div style={{
          padding: '16px', borderRadius: '8px',
          background: 'var(--danger-dim)', border: '1px solid var(--danger)',
          color: 'var(--danger)', fontSize: '12px',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Syntax error</div>
          <div style={{ opacity: 0.8 }}>{error}</div>
        </div>
      )}
      <div
        ref={containerRef}
        className="mermaid-container"
        style={{ opacity: loading ? 0 : 1, transition: 'opacity 0.2s ease' }}
      />
    </div>
  )
}
