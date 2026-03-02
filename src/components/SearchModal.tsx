import React, { useState, useEffect, useRef, useMemo } from 'react'
import type { Diagram } from '../App'

const PINK = '#e0095f'

interface Props {
  diagrams: Diagram[]
  onOpen: (id: string) => void
  onClose: () => void
}

const TYPE_LABEL: Record<string, string> = {
  flowchart: 'Flowchart',
  sequence: 'Sequence',
  state: 'State',
  journey: 'Journey',
  architecture: 'Architecture',
  c4: 'C4',
  class: 'Class',
  er: 'ER',
  pie: 'Pie',
  quadrant: 'Quadrant',
  xychart: 'XY Chart',
  gantt: 'Gantt',
  kanban: 'Kanban',
  timeline: 'Timeline',
  mindmap: 'Mindmap',
  gitgraph: 'Git Graph',
  presentation: 'Presentation',
}

const TYPE_COLOR: Record<string, string> = {
  flowchart: '#3b82f6',
  sequence: '#3b82f6',
  state: '#3b82f6',
  journey: '#3b82f6',
  architecture: '#8b5cf6',
  c4: '#8b5cf6',
  class: '#8b5cf6',
  er: '#f59e0b',
  pie: '#f59e0b',
  quadrant: '#f59e0b',
  xychart: '#f59e0b',
  gantt: '#10b981',
  kanban: '#10b981',
  timeline: '#10b981',
  mindmap: '#10b981',
  gitgraph: '#f97316',
  presentation: PINK,
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function SearchModal({ diagrams, onOpen, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (!query.trim()) return diagrams
    const q = query.toLowerCase()
    return diagrams.filter(d =>
      d.path.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      (d.diagramType ?? '').toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q)
    )
  }, [query, diagrams])

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0) }, [results.length])

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && results[activeIdx]) {
        onOpen(results[activeIdx].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [results, activeIdx, onClose, onOpen])

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // Highlight matching text
  function highlight(text: string, q: string) {
    if (!q.trim()) return <span>{text}</span>
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return <span>{text}</span>
    return (
      <span>
        {text.slice(0, idx)}
        <mark style={{ background: `${PINK}20`, color: PINK, borderRadius: '2px', padding: '0 1px' }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </span>
    )
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh', zIndex: 400, fontFamily: "'Inter', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '560px', maxWidth: '92vw',
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 16px', borderBottom: '1px solid #f3f4f6',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#9ca3af" style={{ flexShrink: 0 }}>
            <path d="M10.68 11.74a6 6 0 01-7.922-8.982 6 6 0 018.982 7.922l3.04 3.04a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215l-3.04-3.04zM11.5 7a4.499 4.499 0 11-8.997 0A4.499 4.499 0 0111.5 7z"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search diagrams..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: '15px',
              color: '#111827', background: 'none', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', lineHeight: 1, padding: '2px' }}
            >×</button>
          )}
          <kbd style={{
            padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
            background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280',
            fontFamily: 'inherit',
          }}>esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: '360px', overflowY: 'auto' }}>
          {results.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '13.5px' }}>
              No diagrams found for "{query}"
            </div>
          )}

          {!query && results.length > 0 && (
            <div style={{ padding: '8px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              All diagrams
            </div>
          )}
          {query && results.length > 0 && (
            <div style={{ padding: '8px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
          )}

          {results.map((diagram, idx) => {
            const isActive = idx === activeIdx
            const type = diagram.diagramType ?? 'flowchart'
            const color = TYPE_COLOR[type] ?? '#6b7280'
            const folder = diagram.path.split('/')[0]
            const name = diagram.path.split('/').slice(1).join('/')

            return (
              <div
                key={diagram.id}
                data-idx={idx}
                onClick={() => onOpen(diagram.id)}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 16px', cursor: 'pointer',
                  background: isActive ? '#f9fafb' : '#fff',
                  borderLeft: `3px solid ${isActive ? PINK : 'transparent'}`,
                  transition: 'all 0.1s',
                }}
              >
                {/* Type badge */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '7px', flexShrink: 0,
                  background: `${color}15`, border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, color, fontFamily: 'monospace',
                }}>
                  {type === 'presentation' ? '🖥' : type.slice(0, 2).toUpperCase()}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1px' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {highlight(folder, query)}/
                    </span>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>
                      {highlight(name || diagram.name, query)}
                    </span>
                  </div>
                  {diagram.description && (
                    <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {highlight(diagram.description, query)}
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{
                    fontSize: '10.5px', fontWeight: 500, padding: '2px 7px',
                    borderRadius: '10px', background: `${color}12`,
                    color, marginBottom: '3px',
                  }}>
                    {TYPE_LABEL[type] ?? type}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                    {timeAgo(diagram.updatedAt)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer hints */}
        <div style={{
          padding: '8px 16px', borderTop: '1px solid #f3f4f6', background: '#fafafa',
          display: 'flex', gap: '16px', fontSize: '11.5px', color: '#9ca3af',
        }}>
          {[['↑↓', 'navigate'], ['↵', 'open'], ['esc', 'close']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <kbd style={{
                padding: '1px 5px', borderRadius: '3px', fontSize: '10px',
                background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151', fontFamily: 'inherit',
              }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
