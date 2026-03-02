import React, { useState, useEffect, useRef, useCallback } from 'react'
import MermaidPreview from './components/MermaidPreview'
import AIPanel from './components/AIPanel'
import DiagramList from './components/DiagramList'
import ReviewBanner from './components/ReviewBanner'
import ApiKeyModal from './components/ApiKeyModal'
import LivingUpdate from './components/LivingUpdate'
import Dashboard from './components/Dashboard'
import type { Template } from './components/TemplateModal'

export interface PendingReview {
  source: 'github' | 'jira' | string  // where the change came from
  author: string                       // who authored the change
  description: string                  // summary of the change
  proposedCode: string                 // full updated diagram code
  proposedAt: Date                     // when the change was detected
}

export interface Diagram {
  id: string
  name: string
  path: string        // e.g. 'my-flows/cicd-pipeline'
  description: string
  code: string
  updatedAt: Date
  diagramType?: string // 'flowchart' | 'sequence' | 'class' etc.
  pendingReview?: PendingReview
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'code' | 'message'
  proposedCode?: string
}

const CICD_CODE = `flowchart LR
    A([Code Push]) --> B{Tests Pass?}
    B -->|Yes| C[Build Docker Image]
    B -->|No| D[❌ Notify Dev]
    C --> E[Push to Registry]
    E --> F[Deploy to Staging]
    F --> G{QA Approved?}
    G -->|Yes| H([🚀 Production])
    G -->|No| I[🔄 Roll Back]
    style A fill:#2dd4bf,color:#0d1117,stroke:none
    style H fill:#3fb950,color:#0d1117,stroke:none
    style D fill:#f85149,color:#fff,stroke:none
    style I fill:#f0883e,color:#fff,stroke:none`

const AUTH_CODE = `sequenceDiagram
    participant U as 👤 User
    participant F as Frontend
    participant A as Auth Service
    participant D as Database

    U->>F: Login (email, password)
    F->>A: POST /auth/login
    A->>D: Validate credentials
    D-->>A: User record + roles
    A-->>F: JWT Token (15min) + Refresh (7d)
    F-->>U: Redirect to Dashboard

    Note over F,A: Token auto-refreshes before expiry`

const MICROSERVICES_CODE = `flowchart TD
    GW[🌐 API Gateway]
    GW --> US[Users Service]
    GW --> OS[Orders Service]
    GW --> PS[Payments Service]
    GW --> NS[Notifications]
    US --> UD[(Users DB)]
    OS --> OD[(Orders DB)]
    PS --> PD[(Payments DB)]
    OS --> PS
    PS --> NS
    OS --> NS
    style GW fill:#2dd4bf,color:#0d1117,stroke:none`

// Proposed code variants — simulating external PRs/tickets
const CICD_CODE_V2 = `flowchart LR
    A([Code Push]) --> B{Tests Pass?}
    B -->|Yes| C[Build Docker Image]
    B -->|No| D[❌ Notify Dev]
    C --> E[Push to Registry]
    E --> F[Deploy to Staging]
    F --> SH[🔍 Staging Health Check]
    SH -->|Pass| G{QA Approved?}
    SH -->|Fail| I[🔄 Roll Back]
    G -->|Yes| H([🚀 Production])
    G -->|No| I
    style A fill:#2dd4bf,color:#0d1117,stroke:none
    style H fill:#3fb950,color:#0d1117,stroke:none
    style D fill:#f85149,color:#fff,stroke:none
    style I fill:#f0883e,color:#fff,stroke:none
    style SH fill:#f59e0b,color:#0d1117,stroke:none`

const AUTH_CODE_V2 = `sequenceDiagram
    participant U as 👤 User
    participant F as Frontend
    participant A as Auth Service
    participant M as MFA Service
    participant D as Database

    U->>F: Login (email, password)
    F->>A: POST /auth/login
    A->>D: Validate credentials
    D-->>A: User record + roles
    A->>M: Request MFA code
    M-->>U: Send code via SMS/Email
    U->>F: Enter MFA code
    F->>A: POST /auth/mfa/verify
    A-->>F: JWT Token (15min) + Refresh (7d)
    F-->>U: Redirect to Dashboard

    Note over F,A: Token auto-refreshes before expiry
    Note over A,M: MFA enforced for all admin roles`

export const SAMPLE_DIAGRAMS: Diagram[] = [
  {
    id: '1',
    name: 'cicd-pipeline',
    path: 'my-flows/cicd-pipeline',
    description: 'Automated deployment pipeline for the main service.',
    code: CICD_CODE,
    updatedAt: new Date(Date.now() - 3600000),
    diagramType: 'flowchart',
    pendingReview: {
      source: 'github',
      author: 'jay-infra',
      description: 'Add staging health-check gate before QA sign-off (PR #284)',
      proposedCode: CICD_CODE_V2,
      proposedAt: new Date(Date.now() - 1800000), // 30 min ago
    },
  },
  {
    id: '2',
    name: 'auth-flow',
    path: 'my-flows/auth-flow',
    description: 'OAuth 2.0 authentication sequence with JWT refresh.',
    code: AUTH_CODE,
    updatedAt: new Date(Date.now() - 86400000),
    diagramType: 'sequence',
    pendingReview: {
      source: 'jira',
      author: 'priya-security',
      description: 'ACME-412 — Enforce MFA step for admin role logins',
      proposedCode: AUTH_CODE_V2,
      proposedAt: new Date(Date.now() - 7200000), // 2 hrs ago
    },
  },
  {
    id: '3',
    name: 'microservices',
    path: 'architecture/microservices',
    description: 'Service boundaries and database ownership map.',
    code: MICROSERVICES_CODE,
    updatedAt: new Date(Date.now() - 172800000),
    diagramType: 'flowchart',
  },
]

type ViewTab = 'split' | 'code' | 'preview'

export default function App() {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard')
  const [diagrams, setDiagrams] = useState<Diagram[]>(SAMPLE_DIAGRAMS)
  const [selectedId, setSelectedId] = useState('1')
  const [editedCode, setEditedCode] = useState(SAMPLE_DIAGRAMS[0].code)
  const [draftCode, setDraftCode] = useState<string | null>(null)
  const [viewTab, setViewTab] = useState<ViewTab>('split')
  const [previewDraft, setPreviewDraft] = useState(false)
  const [codeOpen, setCodeOpen] = useState(true)
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to Mermaid Studio. I can generate, refine, or explain diagrams. Try: "Add a rollback step" or "Explain this diagram".',
      type: 'message',
    }
  ])
  const [apiKey, setApiKey] = useState(localStorage.getItem('ms-anthropic-key') || '')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [livingUpdate, setLivingUpdate] = useState<{ source: string; description: string } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const selectedDiagram = diagrams.find(d => d.id === selectedId)!

  // Simulate a "living diagram" update arriving after 20s
  useEffect(() => {
    const t = setTimeout(() => {
      setLivingUpdate({
        source: 'github.com/acme/infra · pipeline.yml',
        description: 'New staging environment detected in CI/CD config',
      })
    }, 20000)
    return () => clearTimeout(t)
  }, [])

  const handleSelectDiagram = useCallback((id: string) => {
    const diagram = diagrams.find(d => d.id === id)!
    setSelectedId(id)
    setEditedCode(diagram.code)
    setDraftCode(null)
    setPreviewDraft(false)
    setView('editor')
    setMessages([{
      id: `load-${id}`,
      role: 'assistant',
      content: `Loaded "${diagram.path}". Ask me to modify it or describe what you need.`,
      type: 'message',
    }])
  }, [diagrams])

  const handleNewDiagram = useCallback((
    folder?: string,
    template?: Template | null,
    mode?: 'diagram' | 'presentation'
  ) => {
    const newId = `new-${Date.now()}`
    const folderPath = folder ?? (mode === 'presentation' ? 'presentations' : 'untitled')
    const diagType = mode === 'presentation' ? 'presentation' : (template?.diagramType ?? 'flowchart')
    const diagName = mode === 'presentation' ? 'new-presentation' : (template?.name.toLowerCase().replace(/\s+/g, '-') ?? 'new-diagram')
    const starterCode = mode === 'presentation'
      ? `flowchart LR\n    S1[Slide 1] --> S2[Slide 2]\n    S2 --> S3[Slide 3]`
      : (template?.code ?? `flowchart LR\n    A[Start] --> B[End]`)

    const newDiagram: Diagram = {
      id: newId,
      name: diagName,
      path: `${folderPath}/${diagName}`,
      description: template?.description ?? '',
      code: starterCode,
      updatedAt: new Date(),
      diagramType: diagType,
    }
    setDiagrams(prev => [...prev, newDiagram])
    setSelectedId(newId)
    setEditedCode(newDiagram.code)
    setDraftCode(null)
    setView('editor')
    setMessages([{
      id: `new-${newId}`,
      role: 'assistant',
      content: template
        ? `Started from the "${template.name}" template. Ask me to modify it or describe what you need.`
        : 'New diagram created. Tell me what to build — describe your system, workflow, or process.',
      type: 'message',
    }])
  }, [])

  const handleRenameD = useCallback((id: string, name: string) => {
    setDiagrams(prev => prev.map(d => d.id === id ? { ...d, name } : d))
  }, [])

  const handleApprove = useCallback(() => {
    if (!draftCode) return
    setEditedCode(draftCode)
    setDiagrams(prev => prev.map(d =>
      d.id === selectedId ? { ...d, code: draftCode, updatedAt: new Date() } : d
    ))
    setDraftCode(null)
    setPreviewDraft(false)
    setMessages(prev => [...prev, {
      id: `approve-${Date.now()}`,
      role: 'assistant',
      content: '✓ Changes approved and merged to main.',
      type: 'message',
    }])
  }, [draftCode, selectedId])

  const handleReject = useCallback(() => {
    setDraftCode(null)
    setPreviewDraft(false)
    setMessages(prev => [...prev, {
      id: `reject-${Date.now()}`,
      role: 'assistant',
      content: 'Changes discarded. Original diagram preserved.',
      type: 'message',
    }])
  }, [])

  const handleProposedCode = useCallback((code: string) => {
    setDraftCode(code)
    setPreviewDraft(true)
  }, [])

  const handleAcceptLivingUpdate = useCallback(() => {
    if (!livingUpdate || selectedId !== '1') return
    const updatedCode = editedCode.replace(
      'F --> G{QA Approved?}',
      'F --> ST[🆕 Staging Env]\n    ST --> G{QA Approved?}'
    )
    setDraftCode(updatedCode)
    setPreviewDraft(true)
    setLivingUpdate(null)
    setMessages(prev => [...prev, {
      id: `live-${Date.now()}`,
      role: 'assistant',
      content: `📡 Pulled update from ${livingUpdate.source}. A new staging environment node has been proposed. Review and approve.`,
      type: 'message',
    }])
  }, [livingUpdate, selectedId, editedCode])

  // Open a diagram in the editor with its pending review loaded as a draft
  const handleOpenPendingReview = useCallback((id: string) => {
    const diagram = diagrams.find(d => d.id === id)
    if (!diagram?.pendingReview) return
    setSelectedId(id)
    setEditedCode(diagram.code)
    setDraftCode(diagram.pendingReview.proposedCode)
    setPreviewDraft(true)
    setView('editor')
    setMessages([{
      id: `review-${id}-${Date.now()}`,
      role: 'assistant',
      content: `📋 Pending review from **${diagram.pendingReview.source === 'github' ? 'GitHub' : diagram.pendingReview.source === 'jira' ? 'JIRA' : diagram.pendingReview.source}** by @${diagram.pendingReview.author}: "${diagram.pendingReview.description}". Review the diff above and Approve or Discard.`,
      type: 'message',
    }])
  }, [diagrams])

  const handleSaveApiKey = useCallback((key: string) => {
    localStorage.setItem('ms-anthropic-key', key)
    setApiKey(key)
    setShowKeyModal(false)
  }, [])

  const displayCode = previewDraft && draftCode ? draftCode : editedCode

  // Show dashboard home screen
  if (view === 'dashboard') {
    return (
      <Dashboard
        diagrams={diagrams}
        onOpenDiagram={handleSelectDiagram}
        onNewDiagram={handleNewDiagram}
        onReviewDiagram={handleOpenPendingReview}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', overflow: 'hidden' }}>
      {/* ── Top header bar ─────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '0 16px', height: '48px', minHeight: '48px',
        background: '#fff', borderBottom: '1px solid #e8edf2',
        flexShrink: 0, zIndex: 10,
      }}>
        {/* Back */}
        <button
          onClick={() => setView('dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6b7280', fontSize: '12px', padding: '4px 8px',
            borderRadius: '8px', fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f2f9f9')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z"/>
          </svg>
          Diagrams
        </button>

        <span style={{ color: '#ddedf0', fontSize: '14px' }}>/</span>

        {/* Mermaid logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '6px',
            background: '#427f8f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 491 491" fill="white">
              <path d="M407.48,111.18C335.587,108.103 269.573,152.338 245.08,220C220.587,152.338 154.573,108.103 82.68,111.18C80.285,168.229 107.577,222.632 154.74,254.82C178.908,271.419 193.35,298.951 193.27,328.27L193.27,379.13L296.9,379.13L296.9,328.27C296.816,298.953 311.255,271.42 335.42,254.82C382.596,222.644 409.892,168.233 407.48,111.18Z" />
            </svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', letterSpacing: '-0.01em' }}>
            {selectedDiagram.name}
          </span>
          {selectedDiagram.diagramType && (
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 7px',
              background: '#ddedf0', color: '#427f8f',
              borderRadius: '6px', letterSpacing: '0.03em', textTransform: 'uppercase',
            }}>
              {selectedDiagram.diagramType}
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Branch indicator */}
        {draftCode && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '8px',
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
            fontSize: '12px', color: '#d97706',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
            draft branch
          </div>
        )}

        {/* Share button */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
          background: '#f2f9f9', border: '1px solid #ddedf0',
          color: '#427f8f', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
        }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 2.5a2.5 2.5 0 11-.603 1.644l-4.46 2.23a2.5 2.5 0 010 3.252l4.46 2.23a2.5 2.5 0 11-.671 1.342l-4.46-2.23a2.5 2.5 0 110-5.936l4.46-2.23A2.5 2.5 0 0111 2.5z"/>
          </svg>
          Share
        </button>

        {/* API key button */}
        <button
          onClick={() => setShowKeyModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
            background: apiKey ? 'rgba(34,197,94,0.06)' : '#f9fafb',
            border: `1px solid ${apiKey ? 'rgba(34,197,94,0.25)' : '#e5e7eb'}`,
            color: apiKey ? '#16a34a' : '#6b7280',
            fontSize: '12px', fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M6.5 5.5a4 4 0 112.731 3.795.75.75 0 00-.768.18L7.44 10.5H6.25a.75.75 0 00-.75.75v1.19l-.06.06H4.25a.75.75 0 00-.75.75v1.19l-.06.061H1.75a.25.25 0 01-.25-.25v-1.69l5.024-5.023a.75.75 0 00.181-.768A3.995 3.995 0 016.5 5.5zm4-5.5a5.5 5.5 0 00-5.28 7.15L.22 12.13A.75.75 0 000 12.66v2.59C0 15.664.336 16 .75 16h2.59a.75.75 0 00.53-.22l.5-.5a.75.75 0 00.22-.53V14h.75a.75.75 0 00.53-.22l.5-.5a.75.75 0 00.22-.53V12h.75a.75.75 0 00.53-.22l.487-.486A5.5 5.5 0 1010.5 0z" />
          </svg>
          {apiKey ? 'API key set' : 'Add API key'}
        </button>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <DiagramList
            diagrams={diagrams}
            selectedId={selectedId}
            onSelect={handleSelectDiagram}
            onNew={handleNewDiagram}
            onRename={handleRenameD}
          />
        )}

        {/* ── Main editor area ─────────────────────────────────────────── */}
        <main style={{ display: 'flex', flex: 1, overflow: 'hidden', background: '#f8fafb', padding: '6px', gap: '6px' }}>

          {/* ── Left: Code Panel ────────────────────────────────────────── */}
          {codeOpen && (
            <div style={{
              width: '35%', minWidth: '280px', maxWidth: '480px',
              display: 'flex', flexDirection: 'column',
              background: '#fff', borderRadius: '12px',
              border: '2px solid #ddedf0',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {/* Code panel header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px',
                background: '#f2f9f9', borderBottom: '1px solid #ddedf0',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="#427f8f">
                  <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.97 9.03a1.5 1.5 0 010-2.12L4.72 3.22zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l3.75-3.69a1.5 1.5 0 000-2.12L11.28 3.22z"/>
                </svg>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#427f8f' }}>Code</span>

                {/* Auto-Update toggle */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>Auto-Update</span>
                  <button
                    onClick={() => setAutoUpdate(v => !v)}
                    style={{
                      width: '32px', height: '18px', borderRadius: '9px',
                      background: autoUpdate ? '#427f8f' : '#d1d5db',
                      border: 'none', cursor: 'pointer', position: 'relative',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: '2px',
                      left: autoUpdate ? '16px' : '2px',
                      width: '14px', height: '14px', borderRadius: '50%',
                      background: '#fff', transition: 'left 0.15s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }} />
                  </button>
                </div>

                {/* Close code panel */}
                <button
                  onClick={() => setCodeOpen(false)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9ca3af', padding: '2px', borderRadius: '4px',
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                  </svg>
                </button>
              </div>

              {/* Review banner */}
              {draftCode && (
                <ReviewBanner
                  mainCode={editedCode}
                  draftCode={draftCode}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              )}

              {/* Branch / draft toggle */}
              {draftCode && (
                <div style={{
                  padding: '6px 12px', display: 'flex', gap: '4px',
                  borderBottom: '1px solid #f3f4f6', flexShrink: 0,
                }}>
                  {(['main', 'draft'] as const).map(b => (
                    <button
                      key={b}
                      onClick={() => setPreviewDraft(b === 'draft')}
                      style={{
                        padding: '3px 10px', borderRadius: '6px', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: '11px', fontWeight: 500, border: 'none',
                        background: (b === 'draft' ? previewDraft : !previewDraft) ? '#ddedf0' : 'transparent',
                        color: (b === 'draft' ? previewDraft : !previewDraft) ? '#427f8f' : '#9ca3af',
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}

              {/* Code editor */}
              <textarea
                value={previewDraft && draftCode ? draftCode : editedCode}
                onChange={e => {
                  if (previewDraft && draftCode) {
                    setDraftCode(e.target.value)
                  } else {
                    setEditedCode(e.target.value)
                  }
                }}
                spellCheck={false}
                style={{
                  flex: 1, width: '100%', background: '#fff', color: '#1e293b',
                  border: 'none', resize: 'none', padding: '14px 16px',
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: '13px', lineHeight: '1.7',
                  overflowY: 'auto', outline: 'none',
                }}
              />
            </div>
          )}

          {/* ── Right: Preview Pane ──────────────────────────────────────── */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', position: 'relative',
            borderRadius: '12px', border: '2px solid #ddedf0',
            background: '#fff',
          }}>
            {/* Grid background pattern */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 0,
              backgroundImage: `
                linear-gradient(#f0f4f8 1px, transparent 1px),
                linear-gradient(90deg, #f0f4f8 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px',
              opacity: 0.6,
            }} />

            {/* "Edit Code" pill when code panel is closed */}
            {!codeOpen && (
              <button
                onClick={() => setCodeOpen(true)}
                style={{
                  position: 'absolute', left: '16px', bottom: '16px', zIndex: 5,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '16px',
                  background: '#f2f9f9', border: '2px solid #ddedf0',
                  color: '#427f8f', fontSize: '12.5px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.97 9.03a1.5 1.5 0 010-2.12L4.72 3.22zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l3.75-3.69a1.5 1.5 0 000-2.12L11.28 3.22z"/>
                </svg>
                Edit Code
                {selectedDiagram.diagramType && (
                  <span style={{
                    fontSize: '10px', fontWeight: 600, padding: '1px 6px',
                    borderRadius: '5px', background: '#ddedf0', color: '#427f8f',
                  }}>
                    {selectedDiagram.diagramType}
                  </span>
                )}
              </button>
            )}

            {/* Pan / Zoom controls */}
            <div style={{
              position: 'absolute', right: '16px', bottom: '16px', zIndex: 5,
              display: 'flex', alignItems: 'center', gap: '2px',
              padding: '4px', borderRadius: '16px',
              background: '#f2f9f9', border: '2px solid #ddedf0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              <button
                onClick={() => setZoom(z => Math.max(25, z - 25))}
                style={{
                  width: '30px', height: '30px', borderRadius: '8px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#427f8f', fontSize: '16px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#ddedf0')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >−</button>
              <span style={{
                padding: '0 6px', fontSize: '11px', fontWeight: 600,
                color: '#427f8f', minWidth: '40px', textAlign: 'center',
              }}>{zoom}%</span>
              <button
                onClick={() => setZoom(z => Math.min(200, z + 25))}
                style={{
                  width: '30px', height: '30px', borderRadius: '8px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#427f8f', fontSize: '16px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#ddedf0')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >+</button>
              <div style={{ width: '1px', height: '20px', background: '#ddedf0', margin: '0 2px' }} />
              <button
                onClick={() => setZoom(100)}
                style={{
                  width: '30px', height: '30px', borderRadius: '8px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#427f8f', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="Reset zoom"
                onMouseEnter={e => (e.currentTarget.style.background = '#ddedf0')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25H1.75z"/>
                </svg>
              </button>
            </div>

            {/* Toggle sidebar button */}
            <button
              onClick={() => setSidebarOpen(s => !s)}
              style={{
                position: 'absolute', left: '16px', top: '12px', zIndex: 5,
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '10px',
                background: '#f2f9f9', border: '2px solid #ddedf0',
                color: '#427f8f', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              }}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 2.75A.75.75 0 011.75 2h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 2.75zm0 5A.75.75 0 011.75 7h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 7.75zM1.75 12a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75z" />
              </svg>
            </button>

            {/* Diagram preview */}
            <div style={{
              flex: 1, overflow: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '40px',
              position: 'relative', zIndex: 1,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease',
            }}>
              <MermaidPreview code={displayCode} />
            </div>
          </div>
        </main>

        {/* AI Panel */}
        <AIPanel
          messages={messages}
          setMessages={setMessages}
          currentCode={editedCode}
          apiKey={apiKey}
          onRequestKey={() => setShowKeyModal(true)}
          onProposedCode={handleProposedCode}
        />
      </div>

      {/* Living update toast */}
      {livingUpdate && (
        <LivingUpdate
          source={livingUpdate.source}
          description={livingUpdate.description}
          onAccept={handleAcceptLivingUpdate}
          onDismiss={() => setLivingUpdate(null)}
        />
      )}

      {/* API key modal */}
      {showKeyModal && (
        <ApiKeyModal
          currentKey={apiKey}
          onSave={handleSaveApiKey}
          onClose={() => setShowKeyModal(false)}
        />
      )}
    </div>
  )
}
