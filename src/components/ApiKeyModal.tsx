import React, { useState } from 'react'

interface Props {
  currentKey: string
  onSave: (key: string) => void
  onClose: () => void
}

export default function ApiKeyModal({ currentKey, onSave, onClose }: Props) {
  const [value, setValue] = useState(currentKey)
  const [show, setShow] = useState(false)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '440px', borderRadius: '12px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
            }}>✦</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>Anthropic API Key</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Stored locally in your browser</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '4px' }}
          >
            ×
          </button>
        </div>

        <div style={{
          padding: '12px', borderRadius: '8px',
          background: 'var(--ai-dim)', border: '1px solid var(--ai-glow)',
          fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5',
        }}>
          Your API key is used directly from your browser to call claude-sonnet-4-6.
          It's never sent to any server other than Anthropic.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
            API Key
          </label>
          <div style={{
            display: 'flex', gap: '8px', alignItems: 'center',
            background: 'var(--surface2)', borderRadius: '8px',
            border: '1px solid var(--border)', padding: '8px 12px',
          }}>
            <input
              type={show ? 'text' : 'password'}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="sk-ant-..."
              style={{
                flex: 1, background: 'none', border: 'none', color: 'var(--text)',
                fontSize: '13px', fontFamily: "'JetBrains Mono', monospace",
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && value.trim()) onSave(value.trim())
              }}
            />
            <button
              onClick={() => setShow(s => !s)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '12px', padding: '2px',
              }}
            >
              {show ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: '13px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => value.trim() && onSave(value.trim())}
            disabled={!value.trim()}
            style={{
              flex: 2, padding: '10px', borderRadius: '8px', cursor: 'pointer',
              background: value.trim() ? 'var(--primary)' : 'var(--surface3)',
              border: 'none', color: value.trim() ? '#0d1117' : 'var(--text-faint)',
              fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            Save & Enable AI
          </button>
        </div>
      </div>
    </div>
  )
}
