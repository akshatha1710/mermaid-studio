import React, { useState } from 'react'
import type { Diagram } from '../App'

interface Props {
  diagrams: Diagram[]
  selectedId: string
  onSelect: (id: string) => void
  onNew: (folder?: string) => void
  onRename: (id: string, name: string) => void
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const DIAGRAM_ICONS: Record<string, string> = {
  '1': '⚙️',
  '2': '🔐',
  '3': '🕸️',
}

export default function DiagramList({ diagrams, selectedId, onSelect, onNew, onRename }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (diagram: Diagram, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(diagram.id)
    setEditValue(diagram.name)
  }

  const commitEdit = (id: string) => {
    if (editValue.trim()) onRename(id, editValue.trim())
    setEditingId(null)
  }

  return (
    <div style={{
      width: '220px', minWidth: '220px', display: 'flex', flexDirection: 'column',
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Diagrams
        </span>
        <button
          onClick={() => onNew()}
          title="New diagram"
          style={{
            width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer',
            background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)',
            color: 'var(--primary)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 300, lineHeight: 1,
          }}
        >
          +
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {diagrams.map(diagram => (
          <div
            key={diagram.id}
            onClick={() => onSelect(diagram.id)}
            style={{
              padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
              background: selectedId === diagram.id ? 'var(--primary-dim)' : 'none',
              border: `1px solid ${selectedId === diagram.id ? 'var(--primary-glow)' : 'transparent'}`,
              marginBottom: '2px', transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', gap: '3px',
            }}
            onMouseEnter={e => {
              if (diagram.id !== selectedId) {
                (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)'
              }
            }}
            onMouseLeave={e => {
              if (diagram.id !== selectedId) {
                (e.currentTarget as HTMLDivElement).style.background = 'none'
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>{DIAGRAM_ICONS[diagram.id] || '📊'}</span>
              {editingId === diagram.id ? (
                <input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(diagram.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit(diagram.id)
                    if (e.key === 'Escape') setEditingId(null)
                    e.stopPropagation()
                  }}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  style={{
                    flex: 1, background: 'var(--surface3)', border: '1px solid var(--primary)',
                    color: 'var(--text)', borderRadius: '3px', padding: '1px 4px',
                    fontSize: '12px', fontFamily: 'inherit',
                  }}
                />
              ) : (
                <span style={{
                  flex: 1, fontSize: '11px', fontWeight: selectedId === diagram.id ? 600 : 400,
                  color: selectedId === diagram.id ? 'var(--primary)' : 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {diagram.path}
                </span>
              )}
              <button
                onClick={e => startEdit(diagram, e)}
                title="Rename"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-faint)', padding: '2px', borderRadius: '3px',
                  opacity: editingId === diagram.id ? 0 : undefined,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z" />
                </svg>
              </button>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-faint)', paddingLeft: '20px' }}>
              {timeAgo(diagram.updatedAt)}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: levels hint */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
          Levels
        </div>
        {[
          { color: 'var(--primary)', label: 'Refinement' },
          { color: '#60a5fa', label: 'Collaboration' },
          { color: '#a78bfa', label: 'Living Diagrams' },
          { color: 'var(--warning)', label: 'Orchestration' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
