import React, { useState } from 'react'

interface Props {
  mainCode: string
  draftCode: string
  onApprove: () => void
  onReject: () => void
}

function computeDiff(a: string, b: string) {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const maxLen = Math.max(aLines.length, bLines.length)
  const diff: Array<{ type: 'same' | 'removed' | 'added'; line: string }> = []

  // Simple line-level diff (LCS-lite)
  const aSet = new Set(aLines)
  const bSet = new Set(bLines)

  const processed = new Set<string>()
  for (let i = 0; i < maxLen; i++) {
    const aLine = aLines[i]
    const bLine = bLines[i]

    if (aLine === bLine) {
      diff.push({ type: 'same', line: aLine ?? '' })
    } else {
      if (aLine !== undefined && !bSet.has(aLine)) {
        diff.push({ type: 'removed', line: aLine })
      } else if (aLine !== undefined) {
        diff.push({ type: 'removed', line: aLine })
      }
      if (bLine !== undefined && !aSet.has(bLine)) {
        diff.push({ type: 'added', line: bLine })
      } else if (bLine !== undefined) {
        diff.push({ type: 'added', line: bLine })
      }
    }
  }

  return diff
}

export default function ReviewBanner({ mainCode, draftCode, onApprove, onReject }: Props) {
  const [showDiff, setShowDiff] = useState(false)
  const diff = computeDiff(mainCode, draftCode)
  const addedCount = diff.filter(d => d.type === 'added').length
  const removedCount = diff.filter(d => d.type === 'removed').length

  return (
    <div style={{ flexShrink: 0, animation: 'slideDown 0.2s ease' }}>
      {/* Banner bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '8px 16px',
        background: 'linear-gradient(90deg, var(--warning-dim), transparent)',
        borderBottom: '1px solid var(--warning)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          color: 'var(--warning)', fontSize: '12px', fontWeight: 600,
        }}>
          <span style={{ fontSize: '14px' }}>⬡</span>
          AI proposed changes
        </div>

        <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
          {addedCount > 0 && (
            <span style={{
              padding: '1px 6px', borderRadius: '4px',
              background: 'var(--success-dim)', color: 'var(--success)',
              border: '1px solid rgba(63,185,80,0.3)',
            }}>
              +{addedCount}
            </span>
          )}
          {removedCount > 0 && (
            <span style={{
              padding: '1px 6px', borderRadius: '4px',
              background: 'var(--danger-dim)', color: 'var(--danger)',
              border: '1px solid rgba(248,81,73,0.3)',
            }}>
              −{removedCount}
            </span>
          )}
        </div>

        <button
          onClick={() => setShowDiff(s => !s)}
          style={{
            padding: '3px 10px', borderRadius: '5px', cursor: 'pointer',
            background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: '11px',
          }}
        >
          {showDiff ? 'Hide diff' : 'View diff'}
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={onReject}
          style={{
            padding: '5px 14px', borderRadius: '6px', cursor: 'pointer',
            background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500,
          }}
        >
          ✕ Discard
        </button>
        <button
          onClick={onApprove}
          style={{
            padding: '5px 14px', borderRadius: '6px', cursor: 'pointer',
            background: 'var(--success)', border: 'none',
            color: '#0d1117', fontSize: '12px', fontWeight: 600,
            boxShadow: '0 0 12px var(--success-dim)',
          }}
        >
          ✓ Approve & merge
        </button>
      </div>

      {/* Diff view */}
      {showDiff && (
        <div style={{
          maxHeight: '200px', overflowY: 'auto',
          background: 'var(--bg)', borderBottom: '1px solid var(--border)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', lineHeight: '1.6',
        }}>
          {diff.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: '1px 16px',
                background: entry.type === 'added' ? 'rgba(63,185,80,0.08)'
                  : entry.type === 'removed' ? 'rgba(248,81,73,0.08)'
                  : 'transparent',
                color: entry.type === 'added' ? 'var(--success)'
                  : entry.type === 'removed' ? 'var(--danger)'
                  : 'var(--text-muted)',
                display: 'flex', gap: '12px',
              }}
            >
              <span style={{ width: '12px', flexShrink: 0, userSelect: 'none' }}>
                {entry.type === 'added' ? '+' : entry.type === 'removed' ? '−' : ' '}
              </span>
              <span>{entry.line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
