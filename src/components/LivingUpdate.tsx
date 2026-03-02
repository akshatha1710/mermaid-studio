import React from 'react'

interface Props {
  source: string
  description: string
  onAccept: () => void
  onDismiss: () => void
}

export default function LivingUpdate({ source, description, onAccept, onDismiss }: Props) {
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px',
      width: '360px', borderRadius: '12px',
      background: 'var(--surface)', border: '1px solid var(--primary)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--primary-glow)',
      padding: '16px', zIndex: 100,
      animation: 'slideDown 0.3s ease',
    }}>
      {/* Ping indicator */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'var(--primary)', opacity: 0.2,
          }} className="ping" />
          <div style={{
            position: 'relative', width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--primary-dim)', border: '1px solid var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
          }}>
            📡
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>
            Living Diagram Update
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '4px' }}>
            {description}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            {source}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button
          onClick={onDismiss}
          style={{
            flex: 1, padding: '6px', borderRadius: '6px', cursor: 'pointer',
            background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: '12px',
          }}
        >
          Dismiss
        </button>
        <button
          onClick={onAccept}
          style={{
            flex: 2, padding: '6px', borderRadius: '6px', cursor: 'pointer',
            background: 'var(--primary)', border: 'none',
            color: '#0d1117', fontSize: '12px', fontWeight: 600,
          }}
        >
          Pull into diagram →
        </button>
      </div>
    </div>
  )
}
