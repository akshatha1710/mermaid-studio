import React, { useState, useEffect } from 'react'

const PINK = '#e0095f'
const PINK_BG = 'rgba(224, 9, 95, 0.06)'
const PINK_BORDER = 'rgba(224, 9, 95, 0.25)'

export interface Template {
  id: string
  name: string
  description: string
  category: string
  emoji: string
  code: string
  diagramType: string
}

const TEMPLATES: Template[] = [
  // ── Flow ──────────────────────────────────────────────
  {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'Processes, decisions, and workflows',
    category: 'Flow',
    emoji: '→',
    diagramType: 'flowchart',
    code: `flowchart LR
    A([Start]) --> B[Process]
    B --> C{Decision?}
    C -->|Yes| D[Action A]
    C -->|No| E[Action B]
    D --> F([End])
    E --> F`,
  },
  {
    id: 'sequence',
    name: 'Sequence',
    description: 'Service interactions and API calls',
    category: 'Flow',
    emoji: '↕',
    diagramType: 'sequence',
    code: `sequenceDiagram
    participant C as Client
    participant A as API
    participant D as Database
    C->>A: GET /resource
    A->>D: Query
    D-->>A: Result
    A-->>C: 200 OK`,
  },
  {
    id: 'state',
    name: 'State Diagram',
    description: 'State machines and transitions',
    category: 'Flow',
    emoji: '◎',
    diagramType: 'state',
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: start
    Processing --> Success: done
    Processing --> Error: fail
    Success --> [*]
    Error --> Idle: retry`,
  },
  {
    id: 'journey',
    name: 'User Journey',
    description: 'UX flows and experience maps',
    category: 'Flow',
    emoji: '🧭',
    diagramType: 'journey',
    code: `journey
    title User Onboarding
    section Sign Up
      Visit landing page: 5: User
      Fill form: 3: User
      Email verify: 4: User, System
    section First Use
      Dashboard tour: 5: System
      Create first item: 4: User`,
  },
  // ── Architecture ──────────────────────────────────────
  {
    id: 'architecture',
    name: 'Architecture',
    description: 'Cloud and system infrastructure',
    category: 'Architecture',
    emoji: '☁',
    diagramType: 'architecture',
    code: `architecture-beta
    group api(cloud)[API Layer]
    service gateway(internet)[Gateway] in api
    service server(server)[App Server] in api
    service db(database)[Database] in api
    gateway:R --> L:server
    server:R --> L:db`,
  },
  {
    id: 'c4',
    name: 'C4 Context',
    description: 'System context and container diagrams',
    category: 'Architecture',
    emoji: '⬡',
    diagramType: 'c4',
    code: `C4Context
    title System Context
    Person(user, "User", "A customer")
    System(app, "Application", "Main system")
    System_Ext(email, "Email Service", "Sends emails")
    Rel(user, app, "Uses", "HTTPS")
    Rel(app, email, "Sends email via")`,
  },
  {
    id: 'class',
    name: 'Class Diagram',
    description: 'OOP models and data structures',
    category: 'Architecture',
    emoji: '⬜',
    diagramType: 'class',
    code: `classDiagram
    class User {
      +String id
      +String email
      +login()
    }
    class Order {
      +String id
      +Date createdAt
      +getTotal()
    }
    User "1" --> "many" Order : places`,
  },
  // ── Data ──────────────────────────────────────────────
  {
    id: 'er',
    name: 'ER Diagram',
    description: 'Database schemas and relationships',
    category: 'Data',
    emoji: '🗄',
    diagramType: 'er',
    code: `erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ITEM : contains
    USER {
      string id
      string email
    }
    ORDER {
      string id
      date created_at
    }`,
  },
  {
    id: 'pie',
    name: 'Pie Chart',
    description: 'Proportional data distribution',
    category: 'Data',
    emoji: '◔',
    diagramType: 'pie',
    code: `pie title Traffic Sources
    "Organic Search" : 45
    "Direct" : 25
    "Social Media" : 20
    "Referral" : 10`,
  },
  {
    id: 'quadrant',
    name: 'Quadrant Chart',
    description: '2×2 prioritisation and analysis',
    category: 'Data',
    emoji: '⊞',
    diagramType: 'quadrant',
    code: `quadrantChart
    title Feature Priority Matrix
    x-axis Low Effort --> High Effort
    y-axis Low Impact --> High Impact
    Quick wins: [0.2, 0.8]
    Big bets: [0.8, 0.85]
    Fill-ins: [0.25, 0.3]
    Thankless: [0.75, 0.25]`,
  },
  {
    id: 'xychart',
    name: 'XY Chart',
    description: 'Bar and line charts over axes',
    category: 'Data',
    emoji: '📈',
    diagramType: 'xychart',
    code: `xychart-beta
    title "Monthly Revenue"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "Revenue ($k)" 0 --> 100
    bar [42, 55, 61, 78, 83, 91]
    line [42, 55, 61, 78, 83, 91]`,
  },
  // ── Planning ──────────────────────────────────────────
  {
    id: 'gantt',
    name: 'Gantt Chart',
    description: 'Project timelines and schedules',
    category: 'Planning',
    emoji: '▬',
    diagramType: 'gantt',
    code: `gantt
    title Project Roadmap
    dateFormat YYYY-MM-DD
    section Phase 1
      Research      :a1, 2024-01-01, 14d
      Design        :a2, after a1, 14d
    section Phase 2
      Development   :a3, after a2, 30d
      Testing       :a4, after a3, 10d`,
  },
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'Task boards and sprint planning',
    category: 'Planning',
    emoji: '▦',
    diagramType: 'kanban',
    code: `kanban
    column todo[To Do]
      task1[Set up CI/CD]
      task2[Write docs]
    column progress[In Progress]
      task3[Build API]@{ ticket: ENG-101 }
    column done[Done]
      task4[Initial setup]`,
  },
  {
    id: 'timeline',
    name: 'Timeline',
    description: 'Historical events and milestones',
    category: 'Planning',
    emoji: '⏱',
    diagramType: 'timeline',
    code: `timeline
    title Product Launch Timeline
    2023 : Ideation
         : Market research
    2024 : MVP built
         : Beta launched
    2025 : v1.0 released
         : 10k users`,
  },
  {
    id: 'mindmap',
    name: 'Mindmap',
    description: 'Brainstorming and concept maps',
    category: 'Planning',
    emoji: '🧠',
    diagramType: 'mindmap',
    code: `mindmap
  root((Product))
    Features
      Core
      Premium
    Users
      B2B
      B2C
    Tech
      Frontend
      Backend
      Infra`,
  },
  // ── Dev ───────────────────────────────────────────────
  {
    id: 'gitgraph',
    name: 'Git Graph',
    description: 'Branch strategies and release flows',
    category: 'Dev',
    emoji: '⎇',
    diagramType: 'gitgraph',
    code: `gitGraph
    commit id: "init"
    branch develop
    checkout develop
    commit id: "feat: auth"
    commit id: "feat: api"
    checkout main
    merge develop id: "v1.0" tag: "v1.0"
    branch hotfix
    checkout hotfix
    commit id: "fix: login"
    checkout main
    merge hotfix tag: "v1.0.1"`,
  },
]

const CATEGORIES = ['All', 'Flow', 'Architecture', 'Data', 'Planning', 'Dev']

const CATEGORY_COLORS: Record<string, string> = {
  Flow: '#3b82f6',
  Architecture: '#8b5cf6',
  Data: '#f59e0b',
  Planning: '#10b981',
  Dev: '#f97316',
}

interface Props {
  mode: 'diagram' | 'presentation'
  onSelect: (template: Template | null, mode: 'diagram' | 'presentation') => void
  onClose: () => void
}

export default function TemplateModal({ mode, onSelect, onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Template | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && selected) onSelect(selected, mode)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, mode, onClose, onSelect])

  const filtered = TEMPLATES.filter(t => {
    const matchCat = activeCategory === 'All' || t.category === activeCategory
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, fontFamily: "'Inter', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '820px', maxWidth: '95vw', maxHeight: '85vh',
          background: '#fff', borderRadius: '14px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                {mode === 'presentation' ? '🖥 New Presentation' : '📊 New Diagram'}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#6b7280' }}>
                {mode === 'presentation'
                  ? 'Choose a diagram type to start your presentation'
                  : 'Start from a template or create a blank diagram'}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '20px', padding: '4px', lineHeight: 1 }}
            >×</button>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            border: '1px solid #e5e7eb', borderRadius: '8px',
            padding: '7px 12px', background: '#f9fafb',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#9ca3af">
              <path d="M10.68 11.74a6 6 0 01-7.922-8.982 6 6 0 018.982 7.922l3.04 3.04a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215l-3.04-3.04zM11.5 7a4.499 4.499 0 11-8.997 0A4.499 4.499 0 0111.5 7z"/>
            </svg>
            <input
              autoFocus
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: '13.5px', color: '#374151', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Category sidebar */}
          <div style={{
            width: '140px', minWidth: '140px', padding: '12px 8px',
            borderRight: '1px solid #f3f4f6', overflowY: 'auto',
          }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  width: '100%', textAlign: 'left', padding: '6px 10px',
                  borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: activeCategory === cat ? PINK_BG : 'none',
                  color: activeCategory === cat ? PINK : '#374151',
                  fontSize: '13px', fontWeight: activeCategory === cat ? 600 : 400,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {cat !== 'All' && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: CATEGORY_COLORS[cat], flexShrink: 0, display: 'inline-block' }} />
                )}
                {cat}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
              gap: '10px',
            }}>
              {/* Blank card */}
              {(activeCategory === 'All' && !search) && (
                <div
                  onClick={() => setSelected(null)}
                  style={{
                    border: `2px solid ${selected === null ? PINK : '#e5e7eb'}`,
                    borderRadius: '10px', padding: '14px', cursor: 'pointer',
                    background: selected === null ? PINK_BG : '#fff',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    height: '60px', borderRadius: '6px', background: '#f9fafb',
                    border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '22px', marginBottom: '10px', color: '#9ca3af',
                  }}>+</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>Blank</div>
                  <div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Start from scratch</div>
                </div>
              )}

              {filtered.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelected(t)}
                  style={{
                    border: `2px solid ${selected?.id === t.id ? PINK : '#e5e7eb'}`,
                    borderRadius: '10px', padding: '14px', cursor: 'pointer',
                    background: selected?.id === t.id ? PINK_BG : '#fff',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (selected?.id !== t.id) (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db' }}
                  onMouseLeave={e => { if (selected?.id !== t.id) (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb' }}
                >
                  {/* Preview area */}
                  <div style={{
                    height: '60px', borderRadius: '6px',
                    background: `${CATEGORY_COLORS[t.category]}12`,
                    border: `1px solid ${CATEGORY_COLORS[t.category]}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '26px', marginBottom: '10px',
                  }}>
                    {t.emoji}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>{t.name}</div>
                  <div style={{ fontSize: '11.5px', color: '#6b7280', lineHeight: '1.4' }}>{t.description}</div>
                  {/* Category pill */}
                  <div style={{
                    marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 7px', borderRadius: '10px',
                    background: `${CATEGORY_COLORS[t.category]}15`,
                    fontSize: '10.5px', fontWeight: 500,
                    color: CATEGORY_COLORS[t.category],
                  }}>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: CATEGORY_COLORS[t.category], display: 'inline-block' }} />
                    {t.category}
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px', fontSize: '13.5px' }}>
                No templates match "{search}"
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fafafa',
        }}>
          <span style={{ fontSize: '12.5px', color: '#9ca3af' }}>
            {selected ? `Selected: ${selected.name}` : 'No template selected — will start blank'}
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px', borderRadius: '7px', cursor: 'pointer',
                background: 'none', border: '1px solid #e5e7eb',
                color: '#374151', fontSize: '13px', fontFamily: 'inherit',
              }}
            >Cancel</button>
            <button
              onClick={() => onSelect(selected, mode)}
              style={{
                padding: '8px 18px', borderRadius: '7px', cursor: 'pointer',
                background: PINK, border: 'none', color: '#fff',
                fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              {mode === 'presentation' ? 'Create Presentation →' : 'Create Diagram →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
