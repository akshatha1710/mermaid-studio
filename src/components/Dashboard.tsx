import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { Diagram } from '../App'
import TemplateModal, { type Template } from './TemplateModal'
import SearchModal from './SearchModal'

// Mermaid brand colors (from packages/mermaid/src/docs/.vitepress/theme/custom.css)
const PINK = '#e0095f'
const PINK_HOVER = '#b0134a'
const PINK_BG = 'rgba(224, 9, 95, 0.06)'
const PINK_BORDER = 'rgba(224, 9, 95, 0.2)'

interface Props {
  diagrams: Diagram[]
  onOpenDiagram: (id: string) => void
  onNewDiagram: (folder?: string, template?: Template | null, mode?: 'diagram' | 'presentation') => void
  onReviewDiagram?: (id: string) => void
}

type ActiveTab = 'dashboard' | 'documents' | 'tags' | 'databases' | 'activity' | 'merge-requests'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'documents', label: 'Diagrams' },
  { id: 'tags', label: 'Tags' },
  { id: 'databases', label: 'Databases' },
  { id: 'activity', label: 'Activity' },
  { id: 'merge-requests', label: 'Merge Requests' },
]

// MCP integration configs — official Mermaid Chart MCP server (mcp.mermaidchart.com)
interface McpIntegration {
  id: string
  label: string
  icon: string
  lang: 'json' | 'bash'
  filename: string
  code: string
  note: string
}

const MCP_INTEGRATIONS: McpIntegration[] = [
  {
    id: 'cli',
    label: 'CLI',
    icon: '⌨',
    lang: 'bash',
    filename: 'Terminal',
    code: `claude mcp add --transport http mermaid-chart \\
  https://mcp.mermaidchart.com/mcp \\
  --header "Authorization: Bearer YOUR_API_KEY"`,
    note: 'Add directly via the Claude Code CLI — no config file edits needed. Get your API key at mermaidchart.com.',
  },
  {
    id: 'claude-web',
    label: 'Claude Web',
    icon: '◆',
    lang: 'json',
    filename: 'Claude Web · MCP settings',
    code: `{
  "mcpServers": {
    "mermaid-chart": {
      "type": "http",
      "url": "https://mcp.mermaidchart.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`,
    note: 'Connects directly to Mermaid Chart — no local install needed. Get your API key at mermaidchart.com.',
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    icon: '◆',
    lang: 'json',
    filename: '~/.claude/mcp.json',
    code: `{
  "mcpServers": {
    "mermaid-chart": {
      "type": "http",
      "url": "https://mcp.mermaidchart.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`,
    note: 'Add to ~/.claude/mcp.json or your project .mcp.json. Supports file uploads and agentic workflows.',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    icon: '▶',
    lang: 'json',
    filename: '~/.cursor/mcp.json',
    code: `{
  "mcpServers": {
    "mermaid-chart": {
      "url": "https://mcp.mermaidchart.com/sse",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`,
    note: 'Add to ~/.cursor/mcp.json or via Cursor Settings → Tools & Integrations → New MCP Server.',
  },
  {
    id: 'vscode',
    label: 'VS Code',
    icon: '❯',
    lang: 'json',
    filename: '.vscode/mcp.json',
    code: `{
  "servers": {
    "mermaid-chart": {
      "type": "http",
      "url": "https://mcp.mermaidchart.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`,
    note: 'Add to .vscode/mcp.json in your project, or open VS Code → Command Palette → "MCP: Add Server". Get your API key at mermaidchart.com.',
  },
  {
    id: 'mcp',
    label: 'MCP',
    icon: '⬡',
    lang: 'json',
    filename: 'Any MCP client',
    code: `{
  "mcpServers": {
    "mermaid-chart": {
      "type": "streamable-http",
      "url": "https://mcp.mermaidchart.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`,
    note: 'Works with any MCP client that supports streamable HTTP. SSE endpoint available at /sse.',
  },
]

// Human-readable labels for each diagram type
const TYPE_LABEL: Record<string, string> = {
  flowchart:    'Flowchart',
  sequence:     'Sequence',
  class:        'Class',
  er:           'ER',
  gantt:        'Gantt',
  state:        'State',
  journey:      'Journey',
  architecture: 'Arch.',
  c4:           'C4',
  pie:          'Pie',
  quadrant:     'Quadrant',
  xychart:      'XY Chart',
  kanban:       'Kanban',
  timeline:     'Timeline',
  mindmap:      'Mindmap',
  gitgraph:     'Git Graph',
  presentation: 'Slides',
}

// Colour per diagram category (matches TemplateModal)
const TYPE_COLOR: Record<string, string> = {
  flowchart:    '#3b82f6',
  sequence:     '#3b82f6',
  state:        '#3b82f6',
  journey:      '#3b82f6',
  architecture: '#8b5cf6',
  c4:           '#8b5cf6',
  class:        '#8b5cf6',
  er:           '#f59e0b',
  pie:          '#f59e0b',
  quadrant:     '#f59e0b',
  xychart:      '#f59e0b',
  gantt:        '#10b981',
  kanban:       '#10b981',
  timeline:     '#10b981',
  mindmap:      '#10b981',
  gitgraph:     '#f97316',
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

/** Group diagrams by their top-level folder */
function groupByFolder(diagrams: Diagram[]): Map<string, Diagram[]> {
  const map = new Map<string, Diagram[]>()
  for (const d of diagrams) {
    const folder = d.path.split('/')[0]
    if (!map.has(folder)) map.set(folder, [])
    map.get(folder)!.push(d)
  }
  return map
}

export default function Dashboard({ diagrams, onOpenDiagram, onNewDiagram, onReviewDiagram }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard')
  const [filter, setFilter] = useState('')
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null)

  // MCP panel
  const [selectedIntegId, setSelectedIntegId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Modals
  const [showSearch, setShowSearch] = useState(false)
  const [templateMode, setTemplateMode] = useState<'diagram' | 'presentation' | null>(null)
  const [showNewDropdown, setShowNewDropdown] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const newDropdownRef = useRef<HTMLDivElement>(null)

  // ⌘K / Ctrl+K → open search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) {
        setShowNewDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleTemplateSelect = (template: Template | null, mode: 'diagram' | 'presentation') => {
    setTemplateMode(null)
    onNewDiagram(undefined, template, mode)
  }

  const filtered = useMemo(() => {
    if (!filter.trim()) return diagrams
    const q = filter.toLowerCase()
    return diagrams.filter(d =>
      d.path.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    )
  }, [diagrams, filter])

  const folders = useMemo(() => groupByFolder(filtered), [filtered])

  const toggleFolder = (folder: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev)
      next.has(folder) ? next.delete(folder) : next.add(folder)
      return next
    })
  }

  return (
    <div style={{
      display: 'flex', height: '100vh',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: '14px', background: '#fff', color: '#111827',
    }}>
      {/* ── Left Sidebar ── */}
      <aside style={{
        width: '200px', minWidth: '200px',
        background: '#fafafa',
        borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column',
        padding: '16px 0',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '0 16px 20px',
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '8px',
        }}>
          {/* Mermaid logo — white trident on pink bg */}
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px',
            background: PINK,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 491 491" fill="white">
              <path d="M407.48,111.18C335.587,108.103 269.573,152.338 245.08,220C220.587,152.338 154.573,108.103 82.68,111.18C80.285,168.229 107.577,222.632 154.74,254.82C178.908,271.419 193.35,298.951 193.27,328.27L193.27,379.13L296.9,379.13L296.9,328.27C296.816,298.953 311.255,271.42 335.42,254.82C382.596,222.644 409.892,168.233 407.48,111.18Z" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em', color: '#111827' }}>
            Mermaid
          </span>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[
            { icon: BookIcon, label: 'Diagram Hub', active: true },
            { icon: SettingsIcon, label: 'Settings', active: false },
            { icon: DocsIcon, label: 'Docs', active: false, external: true },
          ].map(({ icon: Icon, label, active, external }) => (
            <button
              key={label}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '7px 10px', borderRadius: '7px',
                background: active ? PINK_BG : 'none',
                border: 'none', cursor: 'pointer',
                color: active ? PINK : '#374151',
                fontWeight: active ? 600 : 400,
                fontSize: '13.5px', textAlign: 'left', width: '100%',
                transition: 'background 0.1s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget.style.background = '#f3f4f6') }}
              onMouseLeave={e => { if (!active) (e.currentTarget.style.background = 'none') }}
            >
              <Icon size={15} color={active ? PINK : '#6b7280'} />
              <span>{label}</span>
              {external && <ExternalIcon size={10} color="#9ca3af" />}
            </button>
          ))}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User avatar placeholder */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #e0095f, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '11px', fontWeight: 700, flexShrink: 0,
          }}>
            M
          </div>
          <div style={{ fontSize: '12px', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            My Workspace
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Page header */}
        <div style={{ padding: '32px 40px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BookIcon size={24} color="#111827" />
              <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                Diagrams
              </h1>
            </div>
          </div>
          <p style={{ color: '#6b7280', fontSize: '13.5px', margin: '0 0 16px 36px' }}>
            Collaborate on diagrams with your team — right from your AI tools
          </p>

          {/* MCP Integration pills + expandable config panel */}
          <div style={{ marginBottom: '20px', marginLeft: '36px' }}>
            {/* Pill row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500, marginRight: '2px' }}>MCP:</span>
              {MCP_INTEGRATIONS.map(integ => {
                const isActive = selectedIntegId === integ.id
                return (
                  <button
                    key={integ.id}
                    onClick={() => {
                      setSelectedIntegId(isActive ? null : integ.id)
                      setCopied(false)
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '3px 11px', borderRadius: '20px', cursor: 'pointer',
                      border: `1px solid ${isActive ? PINK_BORDER : '#e5e7eb'}`,
                      background: isActive ? PINK_BG : '#fff',
                      fontSize: '11.5px', color: isActive ? PINK : '#374151',
                      fontWeight: isActive ? 600 : 400,
                      fontFamily: 'inherit',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = PINK_BORDER
                        e.currentTarget.style.color = PINK
                        e.currentTarget.style.background = PINK_BG
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = '#e5e7eb'
                        e.currentTarget.style.color = '#374151'
                        e.currentTarget.style.background = '#fff'
                      }
                    }}
                  >
                    <span style={{ fontSize: '10px' }}>{integ.icon}</span>
                    {integ.label}
                    {isActive && (
                      <span style={{ marginLeft: '2px', fontSize: '9px', opacity: 0.7 }}>▾</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Expandable config panel */}
            {selectedIntegId && (() => {
              const integ = MCP_INTEGRATIONS.find(i => i.id === selectedIntegId)!
              return (
                <div style={{
                  marginTop: '10px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  animation: 'fadeIn 0.15s ease',
                  maxWidth: '560px',
                }}>
                  {/* Code block header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 14px',
                    background: '#1e2433',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>
                        {integ.lang === 'bash' ? '⌨' : '{ }'}
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace" }}>
                        {integ.filename}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(integ.code)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '3px 10px', borderRadius: '5px', cursor: 'pointer',
                        background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.12)'}`,
                        color: copied ? '#34d399' : '#9ca3af',
                        fontSize: '11px', fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}
                    >
                      {copied ? (
                        <>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path fillRule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  {/* Code block body */}
                  <pre
                    style={{
                      margin: 0, padding: '14px 16px',
                      background: '#0d1117',
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      fontSize: '12px', lineHeight: '1.65',
                      color: '#e6edf3',
                      overflowX: 'auto',
                      whiteSpace: 'pre',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: integ.lang === 'json'
                        ? integ.code
                            // JSON keys → blue
                            .replace(/"([^"]+)"(\s*:)/g, '<span style="color:#79c0ff">"$1"</span>$2')
                            // JSON string values → light blue
                            .replace(/(:)\s*"([^"]+)"/g, '$1 <span style="color:#a5d6ff">"$2"</span>')
                            // braces → grey
                            .replace(/([{}])/g, '<span style="color:#8b949e">$1</span>')
                        : // bash: highlight flags and URLs
                          integ.code
                            .replace(/(--[\w-]+)/g, '<span style="color:#79c0ff">$1</span>')
                            .replace(/(https?:\/\/[^\s\\]+)/g, '<span style="color:#a5d6ff">$1</span>')
                            .replace(/(YOUR_API_KEY)/g, '<span style="color:#ffa657">$1</span>')
                    }}
                  />

                  {/* Note footer */}
                  <div style={{
                    padding: '9px 14px',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '12px', color: '#6b7280',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="#9ca3af">
                      <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm6.5-.25A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 100-2 1 1 0 000 2z"/>
                    </svg>
                    {integ.note}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Tabs + action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: '0' }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 16px', border: 'none', cursor: 'pointer',
                    background: 'none', fontFamily: 'inherit',
                    fontSize: '13.5px', fontWeight: activeTab === tab.id ? 600 : 400,
                    color: activeTab === tab.id ? '#111827' : '#6b7280',
                    borderBottom: `2px solid ${activeTab === tab.id ? PINK : 'transparent'}`,
                    marginBottom: '-1px', transition: 'color 0.15s',
                  }}
                >
                  {tab.label}
                  {tab.id === 'merge-requests' && (() => {
                    const n = diagrams.filter(d => d.pendingReview).length
                    return (
                      <span style={{
                        marginLeft: '6px', padding: '1px 6px', borderRadius: '10px',
                        background: n > 0 ? 'rgba(245,158,11,0.13)' : '#f3f4f6',
                        color: n > 0 ? '#d97706' : '#6b7280',
                        fontSize: '11px', fontWeight: n > 0 ? 700 : 400,
                      }}>{n}</span>
                    )
                  })()}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', paddingBottom: '4px', alignItems: 'center' }}>
              {/* Global search trigger */}
              <button
                onClick={() => setShowSearch(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 12px', borderRadius: '7px', cursor: 'pointer',
                  background: '#f9fafb', border: '1px solid #e5e7eb',
                  color: '#9ca3af', fontSize: '13px', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#d1d5db')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M10.68 11.74a6 6 0 01-7.922-8.982 6 6 0 018.982 7.922l3.04 3.04a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215l-3.04-3.04zM11.5 7a4.499 4.499 0 11-8.997 0A4.499 4.499 0 0111.5 7z"/>
                </svg>
                <span style={{ color: '#9ca3af' }}>Search...</span>
                <kbd style={{
                  marginLeft: '4px', padding: '1px 5px', borderRadius: '4px',
                  fontSize: '10.5px', background: '#f3f4f6', border: '1px solid #e5e7eb',
                  color: '#6b7280', fontFamily: 'inherit',
                }}>⌘K</kbd>
              </button>

              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '7px', cursor: 'pointer',
                  background: '#fff', border: '1px solid #e5e7eb',
                  color: '#374151', fontSize: '13px', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#d1d5db')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
              >
                <span style={{ fontSize: '12px' }}>↓</span> Import
              </button>

              {/* New button with dropdown */}
              <div ref={newDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowNewDropdown(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', borderRadius: '7px', cursor: 'pointer',
                    background: '#111827', border: 'none',
                    color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#111827')}
                >
                  + New
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.7 }}>
                    <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
                  </svg>
                </button>

                {showNewDropdown && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    width: '190px', background: '#fff', borderRadius: '9px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.07)',
                    zIndex: 50, overflow: 'hidden',
                    animation: 'fadeIn 0.1s ease',
                  }}>
                    <div style={{ padding: '4px' }}>
                      {[
                        { mode: 'diagram' as const, icon: '📊', label: 'Diagram', desc: 'Flowchart, sequence, ER…' },
                        { mode: 'presentation' as const, icon: '🖥', label: 'Presentation', desc: 'Slideshow of diagrams' },
                      ].map(item => (
                        <button
                          key={item.mode}
                          onClick={() => { setShowNewDropdown(false); setTemplateMode(item.mode) }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '9px 12px',
                            borderRadius: '6px', border: 'none', cursor: 'pointer',
                            background: 'none', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'flex-start', gap: '10px',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{item.icon}</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{item.label}</div>
                            <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '1px' }}>{item.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 'dashboard' && (
            <RecentDashboardTab diagrams={diagrams} onOpenDiagram={onOpenDiagram} onNewDiagram={onNewDiagram} />
          )}
          {activeTab === 'documents' && (
            <DiagramsTab
              diagrams={diagrams}
              onOpenDiagram={onOpenDiagram}
              onNewDiagram={onNewDiagram}
            />
          )}

          {activeTab === 'merge-requests' && (
            <MergeRequestsTab
              diagrams={diagrams}
              onReviewDiagram={onReviewDiagram}
            />
          )}

          {activeTab === 'activity' && <ActivityTab />}
          {activeTab === 'databases' && (
            <DatabasesTab diagrams={diagrams} onOpenDiagram={onOpenDiagram} />
          )}
          {activeTab !== 'dashboard' && activeTab !== 'documents' && activeTab !== 'merge-requests' && activeTab !== 'activity' && activeTab !== 'databases' && (
            <EmptyTab label={TABS.find(t => t.id === activeTab)?.label ?? ''} />
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      {showSearch && (
        <SearchModal
          diagrams={diagrams}
          onOpen={(id) => { setShowSearch(false); onOpenDiagram(id) }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {templateMode && (
        <TemplateModal
          mode={templateMode}
          onSelect={handleTemplateSelect}
          onClose={() => setTemplateMode(null)}
        />
      )}

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  )
}

// ── Databases tab ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  'Draft':     { color: '#6b7280', bg: '#f3f4f6',              border: '#e5e7eb' },
  'In Review': { color: '#d97706', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  'Published': { color: '#16a34a', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)' },
  'Archived':  { color: '#9ca3af', bg: '#f9fafb',              border: '#e5e7eb' },
}

const BOARD_STATUSES = ['Draft', 'In Review', 'Published']

function getDiagramStatus(d: Diagram): string {
  if (d.pendingReview) return 'In Review'
  const age = Date.now() - d.updatedAt.getTime()
  if (age < 7 * 24 * 60 * 60 * 1000) return 'Published'
  return 'Draft'
}

function getDiagramOwner(d: Diagram): string {
  if (d.pendingReview) return d.pendingReview.author
  const ownerMap: Record<string, string> = {
    'microservices-arch': 'alex-dev',
  }
  return ownerMap[d.id] ?? 'akshat'
}

// ── Recent Dashboard Tab ──────────────────────────────────────────────────

// ── Agent context feed mock data ───────────────────────────────────────────

const AGENT_DEFS: {
  id: string; name: string; icon: string; color: string; bg: string; border: string
}[] = [
  { id: 'claude',  name: 'Claude Code',    icon: '◆', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)', border: 'rgba(124,58,237,0.2)' },
  { id: 'cursor',  name: 'Cursor',         icon: '▶', color: '#2563eb', bg: 'rgba(37,99,235,0.07)',  border: 'rgba(37,99,235,0.2)' },
  { id: 'github',  name: 'GitHub Actions', icon: '⊙', color: '#374151', bg: 'rgba(55,65,81,0.07)',   border: 'rgba(55,65,81,0.2)' },
  { id: 'jira',    name: 'Jira Sync',      icon: '◇', color: '#0052cc', bg: 'rgba(0,82,204,0.07)',   border: 'rgba(0,82,204,0.2)' },
  { id: 'vercel',  name: 'Vercel Deploy',  icon: '▲', color: '#111827', bg: 'rgba(17,24,39,0.07)',   border: 'rgba(17,24,39,0.2)' },
]

interface ContextEvent {
  id: string
  agentId: string
  diagramName: string
  diagramPath: string
  action: 'read' | 'write' | 'validate' | 'synthesize'
  description: string
  timestamp: Date
}

const ACTION_STYLE: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  read:       { label: 'Read context',  color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', icon: '↗' },
  write:      { label: 'Wrote update',  color: '#16a34a', bg: 'rgba(34,197,94,0.08)',   icon: '↙' },
  validate:   { label: 'Validated',     color: '#d97706', bg: 'rgba(245,158,11,0.08)',  icon: '✓' },
  synthesize: { label: 'Synthesized',   color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   icon: '⊕' },
}

const MOCK_EVENTS: ContextEvent[] = [
  { id: 'e1', agentId: 'claude',  diagramName: 'cicd-pipeline',  diagramPath: 'my-flows/cicd-pipeline',  action: 'read',       description: 'Used pipeline topology as context for PR #247 code review',                  timestamp: new Date(Date.now() - 1000*60*3) },
  { id: 'e2', agentId: 'cursor',  diagramName: 'auth-flow',      diagramPath: 'my-flows/auth-flow',      action: 'read',       description: 'Referenced auth sequence to generate JWT middleware scaffolding',              timestamp: new Date(Date.now() - 1000*60*8) },
  { id: 'e3', agentId: 'github',  diagramName: 'cicd-pipeline',  diagramPath: 'my-flows/cicd-pipeline',  action: 'validate',   description: 'Validated diagram against deployed infra — 2 drift warnings',                 timestamp: new Date(Date.now() - 1000*60*14) },
  { id: 'e4', agentId: 'claude',  diagramName: 'microservices',   diagramPath: 'architecture/microservices', action: 'synthesize', description: 'Cross-referenced service boundaries with auth-flow to detect coupling risk',  timestamp: new Date(Date.now() - 1000*60*22) },
  { id: 'e5', agentId: 'jira',    diagramName: 'auth-flow',      diagramPath: 'my-flows/auth-flow',      action: 'write',      description: 'Synced Sprint 12 ticket SEC-341 as new participant node',                     timestamp: new Date(Date.now() - 1000*60*35) },
  { id: 'e6', agentId: 'vercel',  diagramName: 'microservices',   diagramPath: 'architecture/microservices', action: 'read',       description: 'Consumed service map to configure preview deployment routing rules',          timestamp: new Date(Date.now() - 1000*60*48) },
  { id: 'e7', agentId: 'cursor',  diagramName: 'cicd-pipeline',  diagramPath: 'my-flows/cicd-pipeline',  action: 'read',       description: 'Loaded pipeline steps as context for Terraform module generation',            timestamp: new Date(Date.now() - 1000*60*60) },
  { id: 'e8', agentId: 'claude',  diagramName: 'auth-flow',      diagramPath: 'my-flows/auth-flow',      action: 'write',      description: 'Proposed adding rate-limit step after credential validation',                 timestamp: new Date(Date.now() - 1000*60*90) },
]

// ── Diagram cross-references mock data ────────────────────────────────────

interface DiagramRef {
  fromId: string      // source diagram id
  fromName: string
  toId: string        // target diagram id
  toName: string
  refType: 'uses' | 'extends' | 'validates' | 'feeds'
  description: string
}

const DIAGRAM_REFS: DiagramRef[] = [
  { fromId: '1', fromName: 'cicd-pipeline', toId: '3', toName: 'microservices',
    refType: 'uses', description: 'Pipeline deploys each service defined in microservices map' },
  { fromId: '2', fromName: 'auth-flow', toId: '3', toName: 'microservices',
    refType: 'feeds', description: 'Auth service is a dependency in the service boundary map' },
  { fromId: '1', fromName: 'cicd-pipeline', toId: '2', toName: 'auth-flow',
    refType: 'validates', description: 'Pipeline runs auth integration tests before deploy' },
  { fromId: '3', fromName: 'microservices', toId: '2', toName: 'auth-flow',
    refType: 'extends', description: 'Microservices gateway routes through auth-flow sequence' },
]

const REF_TYPE_STYLE: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  uses:      { label: 'Uses',      color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', icon: '→' },
  extends:   { label: 'Extends',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', icon: '⊃' },
  validates: { label: 'Validates', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '✓' },
  feeds:     { label: 'Feeds',     color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: '⇢' },
}

// Quick-prompt suggestions (like Mermaid Chart inspo)
const QUICK_PROMPTS = [
  { icon: '✦', label: 'Onboarding process flow' },
  { icon: '✦', label: 'Feature prioritization matrix' },
  { icon: '✦', label: 'Incident response plan' },
  { icon: '✦', label: 'Team collaboration mind map' },
]

// ── Folder Tree Node (recursive) ──────────────────────────────────────────

interface FolderNodeShape {
  name: string
  path: string
  children: FolderNodeShape[]
  diagrams: Diagram[]
}

function FolderTreeNode({
  node, depth, expandedFolders, toggleFolderExpand, onOpenDiagram,
  diagramRefMap, creatingIn, createType, createName, setCreateName,
  createInputRef, confirmCreate, startCreate, setCreatingIn,
}: {
  node: FolderNodeShape
  depth: number
  expandedFolders: Set<string>
  toggleFolderExpand: (path: string) => void
  onOpenDiagram: (id: string) => void
  diagramRefMap: Record<string, { outgoing: { fromId: string; toId: string; refType: string; description: string }[]; incoming: { fromId: string; toId: string; refType: string; description: string }[] }>
  creatingIn: string | null
  createType: 'folder' | 'diagram'
  createName: string
  setCreateName: (v: string) => void
  createInputRef: React.RefObject<HTMLInputElement>
  confirmCreate: () => void
  startCreate: (path: string, type: 'folder' | 'diagram') => void
  setCreatingIn: (v: string | null) => void
}) {
  const isExpanded = expandedFolders.has(node.path)
  const totalItems = node.children.length + node.diagrams.length
  const indent = 16 + depth * 20
  const [hovered, setHovered] = useState(false)

  return (
    <div>
      {/* Folder row */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: `5px 12px 5px ${indent}px`,
          cursor: 'pointer', transition: 'background 0.1s',
          background: hovered ? '#f9fafb' : 'transparent',
        }}
        onClick={() => toggleFolderExpand(node.path)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expand chevron */}
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="#9ca3af"
          style={{ transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>

        {/* Folder icon */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill={isExpanded ? '#f59e0b' : '#9ca3af'} style={{ flexShrink: 0 }}>
          <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2c-.33-.44-.85-.7-1.4-.7H1.75z" />
        </svg>

        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', flex: 1 }}>
          {node.name}
        </span>

        <span style={{ fontSize: '10.5px', color: '#b0b8c4' }}>
          {totalItems}
        </span>

        {/* Actions on hover */}
        {hovered && (
          <div style={{ display: 'flex', gap: '2px' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => startCreate(node.path, 'folder')}
              title="New subfolder"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9ca3af', fontSize: '13px', padding: '0 3px', lineHeight: 1,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2c-.33-.44-.85-.7-1.4-.7H1.75zM8 7a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 018 7z" />
              </svg>
            </button>
            <button
              onClick={() => startCreate(node.path, 'diagram')}
              title="New diagram here"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: PINK, fontSize: '11px', padding: '0 3px', fontWeight: 700, lineHeight: 1,
              }}
            >+</button>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div>
          {/* Create input inside this folder */}
          {creatingIn === node.path && (
            <div style={{
              padding: `4px 12px 4px ${indent + 20}px`,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{ fontSize: '11px', color: createType === 'folder' ? '#f59e0b' : PINK }}>
                {createType === 'folder' ? '📁' : '◇'}
              </span>
              <input
                ref={createInputRef}
                type="text"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmCreate()
                  if (e.key === 'Escape') { setCreatingIn(null); setCreateName('') }
                }}
                onBlur={() => { if (!createName.trim()) { setCreatingIn(null); setCreateName('') } }}
                placeholder={createType === 'folder' ? 'Folder name...' : 'Diagram name...'}
                autoFocus
                style={{
                  flex: 1, border: 'none', outline: 'none', fontSize: '12.5px',
                  color: '#111827', background: '#f9fafb', padding: '3px 8px',
                  borderRadius: '4px', fontFamily: 'inherit',
                }}
              />
            </div>
          )}

          {/* Sub-folders */}
          {node.children.map(child => (
            <FolderTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              toggleFolderExpand={toggleFolderExpand}
              onOpenDiagram={onOpenDiagram}
              diagramRefMap={diagramRefMap}
              creatingIn={creatingIn}
              createType={createType}
              createName={createName}
              setCreateName={setCreateName}
              createInputRef={createInputRef}
              confirmCreate={confirmCreate}
              startCreate={startCreate}
              setCreatingIn={setCreatingIn}
            />
          ))}

          {/* Diagrams in this folder */}
          {node.diagrams.map(d => {
            const type = d.diagramType ?? 'flowchart'
            const color = TYPE_COLOR[type] ?? '#6b7280'
            const refCount = (diagramRefMap[d.id]?.outgoing.length ?? 0) + (diagramRefMap[d.id]?.incoming.length ?? 0)
            return (
              <div
                key={d.id}
                onClick={() => onOpenDiagram(d.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: `5px 12px 5px ${indent + 20}px`,
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '11px', color }}>
                  {type === 'presentation' ? '🖥' : '◇'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827', flex: 1 }}>{d.name}</span>
                {d.diagramType && (
                  <span style={{
                    fontSize: '9.5px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px',
                    background: `${color}10`, color, textTransform: 'uppercase',
                  }}>
                    {TYPE_LABEL[d.diagramType] ?? d.diagramType}
                  </span>
                )}
                {refCount > 0 && (
                  <span style={{
                    fontSize: '9px', fontWeight: 600, padding: '1px 5px', borderRadius: '8px',
                    background: 'rgba(139,92,246,0.08)', color: '#8b5cf6',
                  }}>⊙ {refCount}</span>
                )}
                <span style={{ fontSize: '10.5px', color: '#b0b8c4' }}>{timeAgo(d.updatedAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── DiagramsTab — nested folder tree with create ─────────────────────────

function DiagramsTab({
  diagrams, onOpenDiagram, onNewDiagram,
}: {
  diagrams: Diagram[]
  onOpenDiagram: (id: string) => void
  onNewDiagram: (folder?: string, template?: Template | null, mode?: 'diagram' | 'presentation') => void
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['my-flows', 'architecture']))
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [createType, setCreateType] = useState<'folder' | 'diagram'>('diagram')
  const [createName, setCreateName] = useState('')
  const createInputRef = useRef<HTMLInputElement>(null)

  const diagramRefMap = useMemo(() => {
    const map: Record<string, { outgoing: DiagramRef[]; incoming: DiagramRef[] }> = {}
    for (const d of diagrams) {
      map[d.id] = { outgoing: [], incoming: [] }
    }
    for (const ref of DIAGRAM_REFS) {
      if (map[ref.fromId]) map[ref.fromId].outgoing.push(ref)
      if (map[ref.toId]) map[ref.toId].incoming.push(ref)
    }
    return map
  }, [diagrams])

  interface FolderNode {
    name: string
    path: string
    children: FolderNode[]
    diagrams: Diagram[]
  }

  const folderTree = useMemo(() => {
    const root: FolderNode = { name: '', path: '', children: [], diagrams: [] }
    for (const d of diagrams) {
      const parts = d.path.split('/')
      let current = root
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i]
        const folderPath = parts.slice(0, i + 1).join('/')
        let child = current.children.find(c => c.name === folderName)
        if (!child) {
          child = { name: folderName, path: folderPath, children: [], diagrams: [] }
          current.children.push(child)
        }
        current = child
      }
      current.diagrams.push(d)
    }
    const sortNode = (node: FolderNode) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name))
      node.diagrams.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      node.children.forEach(sortNode)
    }
    sortNode(root)
    return root
  }, [diagrams])

  const toggleFolderExpand = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const startCreate = (folderPath: string, type: 'folder' | 'diagram') => {
    setCreatingIn(folderPath)
    setCreateType(type)
    setCreateName('')
    setTimeout(() => createInputRef.current?.focus(), 50)
  }

  const confirmCreate = () => {
    if (!createName.trim() || creatingIn === null) return
    if (createType === 'diagram') {
      const folder = creatingIn || 'untitled'
      onNewDiagram(folder, null, 'diagram')
    }
    if (createType === 'folder' && creatingIn !== null) {
      const newFolderPath = creatingIn ? `${creatingIn}/${createName.trim()}` : createName.trim()
      setExpandedFolders(prev => new Set([...prev, newFolderPath]))
      onNewDiagram(newFolderPath, null, 'diagram')
    }
    setCreatingIn(null)
    setCreateName('')
  }

  return (
    <div style={{ padding: '16px 40px' }}>
      <div style={{
        borderRadius: '14px', border: '1px solid #e5e7eb', background: '#fff',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
            All Diagrams
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => startCreate('', 'folder')}
              title="New folder"
              style={{
                background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px',
                padding: '4px 8px', fontSize: '11px', color: '#6b7280',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="#6b7280">
                <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2c-.33-.44-.85-.7-1.4-.7H1.75z" />
              </svg>
              Folder
            </button>
            <button
              onClick={() => startCreate('', 'diagram')}
              title="New diagram"
              style={{
                background: PINK_BG, border: `1px solid ${PINK_BORDER}`, borderRadius: '6px',
                padding: '4px 8px', fontSize: '11px', color: PINK,
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              + Diagram
            </button>
          </div>
        </div>

        {/* Tree content */}
        <div style={{ padding: '4px 0' }}>
          {/* Root-level create input */}
          {creatingIn === '' && (
            <div style={{ padding: '4px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: createType === 'folder' ? '#6b7280' : PINK }}>
                {createType === 'folder' ? '📁' : '◇'}
              </span>
              <input
                ref={createInputRef}
                type="text"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmCreate()
                  if (e.key === 'Escape') { setCreatingIn(null); setCreateName('') }
                }}
                onBlur={() => { if (!createName.trim()) { setCreatingIn(null); setCreateName('') } }}
                placeholder={createType === 'folder' ? 'Folder name...' : 'Diagram name...'}
                autoFocus
                style={{
                  flex: 1, border: 'none', outline: 'none', fontSize: '13px',
                  color: '#111827', background: '#f9fafb', padding: '4px 8px',
                  borderRadius: '4px', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={confirmCreate}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: PINK, fontSize: '11px', fontWeight: 600, fontFamily: 'inherit',
                }}
              >Create</button>
            </div>
          )}

          {/* Render folder tree recursively */}
          {folderTree.children.map(folder => (
            <FolderTreeNode
              key={folder.path}
              node={folder}
              depth={0}
              expandedFolders={expandedFolders}
              toggleFolderExpand={toggleFolderExpand}
              onOpenDiagram={onOpenDiagram}
              diagramRefMap={diagramRefMap}
              creatingIn={creatingIn}
              createType={createType}
              createName={createName}
              setCreateName={setCreateName}
              createInputRef={createInputRef}
              confirmCreate={confirmCreate}
              startCreate={startCreate}
              setCreatingIn={setCreatingIn}
            />
          ))}

          {/* Root-level diagrams (no folder) */}
          {folderTree.diagrams.map(d => {
            const type = d.diagramType ?? 'flowchart'
            const color = TYPE_COLOR[type] ?? '#6b7280'
            const refCount = (diagramRefMap[d.id]?.outgoing.length ?? 0) + (diagramRefMap[d.id]?.incoming.length ?? 0)
            return (
              <div
                key={d.id}
                onClick={() => onOpenDiagram(d.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 16px', cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '12px', color }}>{type === 'presentation' ? '🖥' : '◇'}</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827', flex: 1 }}>{d.name}</span>
                {refCount > 0 && (
                  <span style={{
                    fontSize: '9px', fontWeight: 600, padding: '1px 5px', borderRadius: '8px',
                    background: 'rgba(139,92,246,0.08)', color: '#8b5cf6',
                  }}>⊙ {refCount}</span>
                )}
                <span style={{ fontSize: '10.5px', color: '#b0b8c4' }}>{timeAgo(d.updatedAt)}</span>
              </div>
            )
          })}

          {diagrams.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
              No diagrams yet. Create one above or use the search box.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RecentDashboardTab({
  diagrams,
  onOpenDiagram,
  onNewDiagram,
}: {
  diagrams: Diagram[]
  onOpenDiagram: (id: string) => void
  onNewDiagram: (folder?: string, template?: Template | null, mode?: 'diagram' | 'presentation') => void
}) {
  const sorted = [...diagrams].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  const recent = sorted.slice(0, 4)

  // ── Search / Chat state ─────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'idle' | 'search' | 'create'>('idle')
  const [focusedIdx, setFocusedIdx] = useState(0)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionIdx, setMentionIdx] = useState(0)
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]) // diagram ids referenced with @
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputFocused, setInputFocused] = useState(false)

  const [selectedDbRefs, setSelectedDbRefs] = useState<string[]>([]) // database ids referenced with /db
  const [mentionType, setMentionType] = useState<'diagram' | 'database'>('diagram')

  // ── LLM config state ──────────────────────────────────────────────────
  const [showLlmConfig, setShowLlmConfig] = useState(false)
  const [llmProvider, setLlmProvider] = useState<string>(localStorage.getItem('ms-llm-provider') || 'anthropic')
  const [llmKey, setLlmKey] = useState<string>(localStorage.getItem('ms-anthropic-key') || '')
  const [llmKeySaved, setLlmKeySaved] = useState(!!localStorage.getItem('ms-anthropic-key'))

  // ── Reference graph state ───────────────────────────────────────────────
  const [hoveredRefDiagram, setHoveredRefDiagram] = useState<string | null>(null)
  const [refViewExpanded, setRefViewExpanded] = useState(false)
  const [refsCollapsed, setRefsCollapsed] = useState(false)

  // Determine mode from query
  useEffect(() => {
    if (!query.trim()) { setMode('idle'); return }
    // If query starts with common create phrases, or has @mention → create mode
    const createPhrases = ['create ', 'make ', 'build ', 'generate ', 'design ', 'draw ']
    const isCreate = createPhrases.some(p => query.toLowerCase().startsWith(p)) ||
                     selectedRefs.length > 0 ||
                     selectedDbRefs.length > 0 ||
                     query.toLowerCase().includes('diagram')
    setMode(isCreate ? 'create' : 'search')
  }, [query, selectedRefs])

  // Search results
  const searchResults = useMemo(() => {
    if (!query.trim() || mode === 'create') return []
    const q = query.toLowerCase()
    return diagrams.filter(d =>
      d.path.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      (d.diagramType ?? '').toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q)
    ).slice(0, 5)
  }, [query, diagrams, mode])

  // Mention autocomplete — diagrams
  const diagramMentionMatches = useMemo(() => {
    if (!mentionOpen || mentionType !== 'diagram') return []
    const q = mentionFilter.toLowerCase()
    return diagrams.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.path.toLowerCase().includes(q)
    ).slice(0, 5)
  }, [mentionOpen, mentionFilter, diagrams, mentionType])

  // Mention autocomplete — databases
  const dbMentionMatches = useMemo(() => {
    if (!mentionOpen || mentionType !== 'database') return []
    const q = mentionFilter.toLowerCase()
    return DB_DEFS.filter(db =>
      db.name.toLowerCase().includes(q) ||
      db.description.toLowerCase().includes(q)
    ).slice(0, 5)
  }, [mentionOpen, mentionFilter, mentionType])

  // Combined mention matches for keyboard nav
  const mentionMatches = mentionType === 'database' ? dbMentionMatches : diagramMentionMatches

  // Handle @ mention and /db detection
  const handleQueryChange = (val: string) => {
    setQuery(val)

    // Check for /db trigger
    const lastSlashDb = val.lastIndexOf('/db')
    if (lastSlashDb !== -1 && (lastSlashDb === 0 || val[lastSlashDb - 1] === ' ')) {
      const afterSlashDb = val.slice(lastSlashDb + 3)
      if (!afterSlashDb.includes(' ')) {
        setMentionOpen(true)
        setMentionType('database')
        setMentionFilter(afterSlashDb)
        setMentionIdx(0)
        return
      }
    }

    // Check for @ trigger (diagrams)
    const lastAt = val.lastIndexOf('@')
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
      const afterAt = val.slice(lastAt + 1)
      if (!afterAt.includes(' ')) {
        setMentionOpen(true)
        setMentionType('diagram')
        setMentionFilter(afterAt)
        setMentionIdx(0)
        return
      }
    }
    setMentionOpen(false)
  }

  // Insert diagram mention
  const insertMention = (d: Diagram) => {
    const lastAt = query.lastIndexOf('@')
    const before = query.slice(0, lastAt)
    setQuery(before + '@' + d.name + ' ')
    setSelectedRefs(prev => prev.includes(d.id) ? prev : [...prev, d.id])
    setMentionOpen(false)
    inputRef.current?.focus()
  }

  // Insert database mention
  const insertDbMention = (db: typeof DB_DEFS[number]) => {
    const lastSlashDb = query.lastIndexOf('/db')
    const before = query.slice(0, lastSlashDb)
    setQuery(before + '/db:' + db.name + ' ')
    setSelectedDbRefs(prev => prev.includes(db.id) ? prev : [...prev, db.id])
    setMentionOpen(false)
    inputRef.current?.focus()
  }

  // Save LLM key
  const saveLlmKey = () => {
    localStorage.setItem('ms-anthropic-key', llmKey)
    localStorage.setItem('ms-llm-provider', llmProvider)
    setLlmKeySaved(true)
    setTimeout(() => setShowLlmConfig(false), 600)
  }

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionOpen && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionMatches.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (mentionType === 'database') {
          insertDbMention(dbMentionMatches[mentionIdx])
        } else {
          insertMention(diagramMentionMatches[mentionIdx])
        }
        return
      }
      if (e.key === 'Escape') { setMentionOpen(false); return }
    }
    if (mode === 'search' && searchResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx(i => Math.min(i + 1, searchResults.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter') { e.preventDefault(); onOpenDiagram(searchResults[focusedIdx].id); return }
    }
    if (mode === 'create' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Create diagram from natural language
      onNewDiagram(undefined, null, 'diagram')
    }
  }

  // Highlight match
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

  // References for the graph visualization
  const diagramRefMap = useMemo(() => {
    const map: Record<string, { outgoing: DiagramRef[]; incoming: DiagramRef[] }> = {}
    for (const d of diagrams) {
      map[d.id] = { outgoing: [], incoming: [] }
    }
    for (const ref of DIAGRAM_REFS) {
      if (map[ref.fromId]) map[ref.fromId].outgoing.push(ref)
      if (map[ref.toId]) map[ref.toId].incoming.push(ref)
    }
    return map
  }, [diagrams])

  // Only diagrams that participate in at least one reference
  const connectedDiagrams = useMemo(() => {
    const connectedIds = new Set<string>()
    for (const ref of DIAGRAM_REFS) {
      connectedIds.add(ref.fromId)
      connectedIds.add(ref.toId)
    }
    return diagrams.filter(d => connectedIds.has(d.id))
  }, [diagrams])

  return (
    <div style={{ padding: '24px 40px' }}>

      {/* ═══════════════════════════════════════════════════════════════════
          UNIFIED SEARCH / CREATE BOX — Mermaid Chart inspired
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        marginBottom: '28px', borderRadius: '16px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%)',
        border: `2px solid ${inputFocused ? PINK : '#e5e7eb'}`,
        boxShadow: inputFocused ? `0 0 0 4px ${PINK_BG}, 0 8px 32px rgba(0,0,0,0.06)` : '0 4px 16px rgba(0,0,0,0.04)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        overflow: 'visible', position: 'relative',
      }}>
        {/* Main input area */}
        <div style={{ padding: '20px 24px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            {/* Mode icon */}
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: mode === 'create' ? PINK_BG : mode === 'search' ? 'rgba(59,130,246,0.08)' : '#f3f4f6',
              border: `1px solid ${mode === 'create' ? PINK_BORDER : mode === 'search' ? 'rgba(59,130,246,0.2)' : '#e5e7eb'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}>
              {mode === 'create' ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill={PINK}><path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill={mode === 'search' ? '#3b82f6' : '#9ca3af'}>
                  <path d="M10.68 11.74a6 6 0 01-7.922-8.982 6 6 0 018.982 7.922l3.04 3.04a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215l-3.04-3.04zM11.5 7a4.499 4.499 0 11-8.997 0A4.499 4.499 0 0111.5 7z"/>
                </svg>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Referenced diagrams + database chips */}
              {(selectedRefs.length > 0 || selectedDbRefs.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {selectedRefs.map(refId => {
                    const d = diagrams.find(x => x.id === refId)
                    if (!d) return null
                    return (
                      <span
                        key={refId}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '11.5px', fontWeight: 600, padding: '2px 8px 2px 6px',
                          borderRadius: '6px', background: PINK_BG, color: PINK,
                          border: `1px solid ${PINK_BORDER}`,
                        }}
                      >
                        <span style={{ fontSize: '10px' }}>@</span>
                        {d.name}
                        <button
                          onClick={() => setSelectedRefs(prev => prev.filter(x => x !== refId))}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: PINK, fontSize: '12px', lineHeight: 1, padding: 0, marginLeft: '2px',
                          }}
                        >×</button>
                      </span>
                    )
                  })}
                  {selectedDbRefs.map(dbId => {
                    const db = DB_DEFS.find(x => x.id === dbId)
                    if (!db) return null
                    return (
                      <span
                        key={dbId}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '11.5px', fontWeight: 600, padding: '2px 8px 2px 6px',
                          borderRadius: '6px', background: 'rgba(16,185,129,0.08)', color: '#059669',
                          border: '1px solid rgba(16,185,129,0.25)',
                        }}
                      >
                        <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" }}>/db</span>
                        {db.name}
                        <button
                          onClick={() => setSelectedDbRefs(prev => prev.filter(x => x !== dbId))}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#059669', fontSize: '12px', lineHeight: 1, padding: 0, marginLeft: '2px',
                          }}
                        >×</button>
                      </span>
                    )
                  })}
                </div>
              )}

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => { setTimeout(() => { setInputFocused(false); setMentionOpen(false) }, 200) }}
                placeholder="Describe what you want to visualize, search diagrams, or type @ to reference..."
                style={{
                  width: '100%', border: 'none', outline: 'none',
                  fontSize: '15px', color: '#111827', background: 'none',
                  fontFamily: 'inherit', lineHeight: '1.6',
                }}
              />
            </div>

            {/* Submit + LLM config */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* LLM provider button */}
              <button
                onClick={() => setShowLlmConfig(!showLlmConfig)}
                title="Configure AI model"
                style={{
                  width: '34px', height: '34px', borderRadius: '9px',
                  background: llmKeySaved ? 'rgba(34,197,94,0.06)' : '#f9fafb',
                  border: `1px solid ${llmKeySaved ? 'rgba(34,197,94,0.25)' : '#e5e7eb'}`,
                  color: llmKeySaved ? '#16a34a' : '#9ca3af',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', transition: 'all 0.15s',
                }}
              >
                {llmKeySaved ? '◆' : '⚙'}
              </button>

              {query.trim() && mode === 'create' && (
                <button
                  onClick={() => onNewDiagram(undefined, null, 'diagram')}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: PINK, color: '#fff', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 2px 8px ${PINK}40`,
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="#fff">
                    <path d="M1.5 1.75a.75.75 0 00-.75.75v10.5c0 .414.336.75.75.75h2.19l3.724-3.724a.75.75 0 01.53-.22h3.306l1.25-1.25V2.5a.75.75 0 00-.75-.75H1.5zm13 7.94l-1.72 1.72a.75.75 0 01-.53.22H9.06L6.28 14.41a.75.75 0 01-.53.22H1.5A2.25 2.25 0 01-.75 12.38V2.5A2.25 2.25 0 011.5.25h10.25A2.25 2.25 0 0114 2.5l.5 7.19z"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Mode indicator */}
          {query.trim() && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              marginTop: '8px', paddingLeft: '48px',
            }}>
              <span style={{
                fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em',
                padding: '2px 7px', borderRadius: '5px',
                background: mode === 'create' ? PINK_BG : 'rgba(59,130,246,0.08)',
                color: mode === 'create' ? PINK : '#3b82f6',
                border: `1px solid ${mode === 'create' ? PINK_BORDER : 'rgba(59,130,246,0.2)'}`,
                textTransform: 'uppercase',
              }}>
                {mode === 'create' ? '✦ Creating' : '⌕ Searching'}
              </span>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {mode === 'create'
                  ? 'Press Enter to generate · Use @diagram or /db to reference context'
                  : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} · ↑↓ to navigate · Enter to open`}
              </span>
            </div>
          )}
        </div>

        {/* Mention dropdown — diagrams */}
        {mentionOpen && mentionType === 'diagram' && diagramMentionMatches.length > 0 && (
          <div style={{
            position: 'absolute', left: '68px', top: '70px', zIndex: 50,
            width: '320px', background: '#fff', borderRadius: '10px',
            border: '1px solid #e5e7eb', boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '6px 10px 4px', fontSize: '10.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Reference a diagram
            </div>
            {diagramMentionMatches.map((d, idx) => (
              <div
                key={d.id}
                onClick={() => insertMention(d)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', cursor: 'pointer',
                  background: idx === mentionIdx ? '#f9fafb' : '#fff',
                  borderLeft: `3px solid ${idx === mentionIdx ? PINK : 'transparent'}`,
                }}
                onMouseEnter={() => setMentionIdx(idx)}
              >
                <div style={{
                  width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
                  background: `${TYPE_COLOR[d.diagramType ?? 'flowchart'] ?? '#6b7280'}12`,
                  border: `1px solid ${TYPE_COLOR[d.diagramType ?? 'flowchart'] ?? '#6b7280'}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, color: TYPE_COLOR[d.diagramType ?? 'flowchart'] ?? '#6b7280',
                }}>
                  {(d.diagramType ?? 'fl').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{d.name}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.path}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mention dropdown — databases */}
        {mentionOpen && mentionType === 'database' && dbMentionMatches.length > 0 && (
          <div style={{
            position: 'absolute', left: '68px', top: '70px', zIndex: 50,
            width: '340px', background: '#fff', borderRadius: '10px',
            border: '1px solid #e5e7eb', boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '6px 10px 4px', fontSize: '10.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Reference a database
            </div>
            {dbMentionMatches.map((db, idx) => (
              <div
                key={db.id}
                onClick={() => insertDbMention(db)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', cursor: 'pointer',
                  background: idx === mentionIdx ? 'rgba(16,185,129,0.04)' : '#fff',
                  borderLeft: `3px solid ${idx === mentionIdx ? '#10b981' : 'transparent'}`,
                }}
                onMouseEnter={() => setMentionIdx(idx)}
              >
                <div style={{
                  width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, color: '#059669',
                }}>
                  {db.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{db.name}</span>
                    {db.source === 'notion' && (
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: '#f5f5f5', color: '#6b7280' }}>
                        NOTION
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {db.columns.join(' · ')} — {db.notionDocs?.length ?? 0} rows
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LLM Configuration panel */}
        {showLlmConfig && (
          <div style={{
            position: 'absolute', right: '16px', top: '64px', zIndex: 50,
            width: '360px', background: '#fff', borderRadius: '12px',
            border: '1px solid #e5e7eb', boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 16px', borderBottom: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>AI Model Configuration</div>
                <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '2px' }}>Connect an LLM to power diagram generation</div>
              </div>
              <button
                onClick={() => setShowLlmConfig(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: '2px' }}
              >×</button>
            </div>

            <div style={{ padding: '16px' }}>
              {/* Provider select */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                  Provider
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'anthropic', label: 'Anthropic', icon: '◆', color: '#7c3aed' },
                    { id: 'openai', label: 'OpenAI', icon: '●', color: '#10b981' },
                    { id: 'google', label: 'Google', icon: '▲', color: '#3b82f6' },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setLlmProvider(p.id)}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: '8px',
                        background: llmProvider === p.id ? `${p.color}08` : '#fafafa',
                        border: `1.5px solid ${llmProvider === p.id ? `${p.color}40` : '#e5e7eb'}`,
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        transition: 'all 0.12s',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: p.color }}>{p.icon}</span>
                      <span style={{ fontSize: '12px', fontWeight: llmProvider === p.id ? 600 : 400, color: llmProvider === p.id ? '#111827' : '#6b7280' }}>
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model display */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                  Model
                </label>
                <div style={{
                  padding: '8px 12px', borderRadius: '8px',
                  background: '#f9fafb', border: '1px solid #e5e7eb',
                  fontSize: '13px', color: '#374151',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {llmProvider === 'anthropic' ? 'claude-sonnet-4-6' : llmProvider === 'openai' ? 'gpt-4o' : 'gemini-2.0-flash'}
                </div>
              </div>

              {/* API Key input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                  API Key
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={llmKey}
                    onChange={e => { setLlmKey(e.target.value); setLlmKeySaved(false) }}
                    placeholder={`Enter your ${llmProvider === 'anthropic' ? 'Anthropic' : llmProvider === 'openai' ? 'OpenAI' : 'Google AI'} API key...`}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '8px',
                      border: `1.5px solid ${llmKeySaved ? 'rgba(34,197,94,0.4)' : '#e5e7eb'}`,
                      fontSize: '13px', color: '#111827', background: '#fff',
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: 'none',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = PINK }}
                    onBlur={e => { e.currentTarget.style.borderColor = llmKeySaved ? 'rgba(34,197,94,0.4)' : '#e5e7eb' }}
                  />
                  {llmKeySaved && (
                    <span style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      fontSize: '12px', color: '#16a34a',
                    }}>
                      ✓
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  {llmProvider === 'anthropic' && 'Get your key at console.anthropic.com'}
                  {llmProvider === 'openai' && 'Get your key at platform.openai.com/api-keys'}
                  {llmProvider === 'google' && 'Get your key at aistudio.google.com/apikey'}
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={saveLlmKey}
                disabled={!llmKey.trim()}
                style={{
                  width: '100%', padding: '9px', borderRadius: '8px',
                  background: llmKey.trim() ? PINK : '#f3f4f6',
                  color: llmKey.trim() ? '#fff' : '#9ca3af',
                  border: 'none', cursor: llmKey.trim() ? 'pointer' : 'default',
                  fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {llmKeySaved ? '✓ Saved' : 'Save & Connect'}
              </button>
            </div>

            {/* Footer note */}
            <div style={{
              padding: '10px 16px', borderTop: '1px solid #f3f4f6', background: '#fafbfc',
              fontSize: '11px', color: '#9ca3af', lineHeight: '1.5',
            }}>
              Your API key is stored locally in your browser and never sent to our servers.
            </div>
          </div>
        )}

        {/* Search results dropdown */}
        {mode === 'search' && searchResults.length > 0 && (
          <div style={{ borderTop: '1px solid #e5e7eb' }}>
            {searchResults.map((d, idx) => {
              const type = d.diagramType ?? 'flowchart'
              const color = TYPE_COLOR[type] ?? '#6b7280'
              const isActive = idx === focusedIdx

              // Find code match preview
              const q = query.toLowerCase()
              const codeLower = d.code.toLowerCase()
              const matchIdx = codeLower.indexOf(q)
              let codePreview = ''
              if (matchIdx !== -1) {
                const start = Math.max(0, matchIdx - 30)
                const end = Math.min(d.code.length, matchIdx + q.length + 40)
                codePreview = (start > 0 ? '...' : '') + d.code.slice(start, end) + (end < d.code.length ? '...' : '')
              }

              return (
                <div
                  key={d.id}
                  onClick={() => onOpenDiagram(d.id)}
                  onMouseEnter={() => setFocusedIdx(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 24px', cursor: 'pointer',
                    background: isActive ? '#f9fafb' : 'transparent',
                    borderLeft: `3px solid ${isActive ? PINK : 'transparent'}`,
                    transition: 'all 0.08s',
                  }}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                    background: `${color}12`, border: `1px solid ${color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color,
                  }}>
                    {type.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>
                        {highlight(d.name, query)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {highlight(d.path, query)}
                      </span>
                    </div>
                    {codePreview ? (
                      <div style={{
                        fontSize: '11.5px', color: '#6b7280', marginTop: '2px',
                        fontFamily: "'JetBrains Mono', monospace",
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        background: '#f8f9fa', padding: '2px 6px', borderRadius: '4px',
                      }}>
                        {highlight(codePreview, query)}
                      </div>
                    ) : d.description ? (
                      <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {highlight(d.description, query)}
                      </div>
                    ) : null}
                  </div>
                  <span style={{ fontSize: '10.5px', color: '#b0b8c4', flexShrink: 0 }}>
                    {timeAgo(d.updatedAt)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick prompt suggestions (shown when idle) */}
        {mode === 'idle' && (
          <div style={{ padding: '4px 24px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {QUICK_PROMPTS.map(p => (
              <button
                key={p.label}
                onClick={() => { setQuery(`Create a ${p.label.toLowerCase()}`); inputRef.current?.focus() }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '20px',
                  background: '#fff', border: '1px solid #e5e7eb',
                  fontSize: '13px', color: '#374151', cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = PINK_BORDER; e.currentTarget.style.boxShadow = `0 0 0 2px ${PINK_BG}` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <span style={{ color: '#a78bfa', fontSize: '12px' }}>{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Bottom bar: hints */}
        <div style={{
          padding: '8px 24px', borderTop: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', gap: '16px',
          background: 'rgba(249,250,251,0.6)', borderRadius: '0 0 14px 14px',
        }}>
          <span style={{ fontSize: '11px', color: '#b0b8c4', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <kbd style={{ padding: '1px 5px', borderRadius: '3px', fontSize: '10px', background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontFamily: 'inherit' }}>@</kbd>
            diagram
          </span>
          <span style={{ fontSize: '11px', color: '#b0b8c4', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <kbd style={{ padding: '1px 5px', borderRadius: '3px', fontSize: '10px', background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontFamily: 'inherit' }}>/db</kbd>
            database
          </span>
          <span style={{ fontSize: '11px', color: '#b0b8c4' }}>·</span>
          <span style={{ fontSize: '11px', color: '#b0b8c4' }}>
            Type to search · Describe to create
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '11px', color: '#b0b8c4', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <kbd style={{ padding: '1px 5px', borderRadius: '3px', fontSize: '10px', background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontFamily: 'inherit' }}>⌘K</kbd>
            full search
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DIAGRAM REFERENCE GRAPH — Visual cross-references
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: refsCollapsed ? '0' : '14px',
            padding: refsCollapsed ? '12px 16px' : '0',
            borderRadius: refsCollapsed ? '12px' : '0',
            border: refsCollapsed ? '1px solid #e5e7eb' : 'none',
            background: refsCollapsed ? '#fff' : 'none',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onClick={() => setRefsCollapsed(!refsCollapsed)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Collapse chevron */}
            <svg
              width="14" height="14" viewBox="0 0 16 16" fill="#9ca3af"
              style={{
                transition: 'transform 0.2s',
                transform: refsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              }}
            >
              <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" />
            </svg>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
              Diagram References
            </div>
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
              background: 'rgba(139,92,246,0.08)', color: '#8b5cf6',
              border: '1px solid rgba(139,92,246,0.2)',
            }}>
              {DIAGRAM_REFS.length} connections
            </span>
          </div>
          {!refsCollapsed && (
            <button
              onClick={e => { e.stopPropagation(); setRefViewExpanded(!refViewExpanded) }}
              style={{
                background: 'none', border: '1px solid #e5e7eb', borderRadius: '7px',
                padding: '4px 10px', fontSize: '11.5px', color: '#6b7280',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {refViewExpanded ? 'Compact' : 'Expand'}
            </button>
          )}
        </div>

        {/* Reference graph visualization — collapsible */}
        <div style={{
          borderRadius: '14px', border: refsCollapsed ? 'none' : '1px solid #e5e7eb', background: '#fff',
          overflow: 'hidden',
          maxHeight: refsCollapsed ? '0px' : '800px',
          opacity: refsCollapsed ? 0 : 1,
          transition: 'max-height 0.3s ease, opacity 0.2s ease',
        }}>
          {/* Graph area with SVG connections */}
          <div style={{
            padding: refViewExpanded ? '32px' : '24px',
            position: 'relative', minHeight: refViewExpanded ? '300px' : '200px',
            background: 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.02) 0%, transparent 70%)',
          }}>
            {/* Grid background */}
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.4,
              backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }} />

            {/* Diagram nodes in a horizontal layout */}
            <div style={{
              position: 'relative', zIndex: 1,
              display: 'flex', justifyContent: 'center', gap: refViewExpanded ? '80px' : '60px',
              alignItems: 'center', flexWrap: 'wrap',
            }}>
              {connectedDiagrams.map(d => {
                const refs = diagramRefMap[d.id]
                const totalRefs = (refs?.outgoing.length ?? 0) + (refs?.incoming.length ?? 0)
                const isHovered = hoveredRefDiagram === d.id
                const isConnected = hoveredRefDiagram
                  ? DIAGRAM_REFS.some(r => (r.fromId === hoveredRefDiagram && r.toId === d.id) || (r.toId === hoveredRefDiagram && r.fromId === d.id))
                  : false
                const dimmed = hoveredRefDiagram !== null && !isHovered && !isConnected
                const type = d.diagramType ?? 'flowchart'
                const color = TYPE_COLOR[type] ?? '#6b7280'

                return (
                  <div
                    key={d.id}
                    onMouseEnter={() => setHoveredRefDiagram(d.id)}
                    onMouseLeave={() => setHoveredRefDiagram(null)}
                    onClick={() => onOpenDiagram(d.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                      cursor: 'pointer', transition: 'all 0.2s',
                      opacity: dimmed ? 0.3 : 1,
                      transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                    }}
                  >
                    {/* Node circle */}
                    <div style={{
                      width: refViewExpanded ? '72px' : '60px',
                      height: refViewExpanded ? '72px' : '60px',
                      borderRadius: '16px', position: 'relative',
                      background: isHovered ? `${color}18` : '#fff',
                      border: `2px solid ${isHovered ? color : isConnected ? `${color}80` : '#e5e7eb'}`,
                      boxShadow: isHovered ? `0 0 0 4px ${color}15, 0 4px 16px ${color}20` : isConnected ? `0 0 0 3px ${color}10` : 'none',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      <span style={{ fontSize: refViewExpanded ? '14px' : '12px', fontWeight: 700, color }}>
                        {TYPE_LABEL[type] ?? type}
                      </span>

                      {/* Ref count badge */}
                      {totalRefs > 0 && (
                        <div style={{
                          position: 'absolute', top: '-6px', right: '-6px',
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: '#8b5cf6', color: '#fff',
                          fontSize: '10px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '2px solid #fff',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }}>
                          {totalRefs}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div style={{
                      fontSize: '12.5px', fontWeight: 600, color: isHovered ? '#111827' : '#374151',
                      textAlign: 'center', maxWidth: '100px', lineHeight: '1.3',
                    }}>
                      {d.name}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* SVG connection lines between nodes */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: 0,
              }}
            >
              <defs>
                {Object.entries(REF_TYPE_STYLE).map(([key, style]) => (
                  <marker key={key} id={`arrow-${key}`} viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={style.color} opacity="0.7" />
                  </marker>
                ))}
              </defs>
              {/* Connection lines rendered in viewBox coordinate space (0-100) */}
              {(() => {
                const nodeCount = connectedDiagrams.length
                const nodePositions: Record<string, { x: number; y: number }> = {}
                connectedDiagrams.forEach((d, i) => {
                  const spacing = 100 / (nodeCount + 1)
                  nodePositions[d.id] = { x: spacing * (i + 1), y: 50 }
                })

                return DIAGRAM_REFS.map((ref, idx) => {
                  const from = nodePositions[ref.fromId]
                  const to = nodePositions[ref.toId]
                  if (!from || !to) return null
                  const style = REF_TYPE_STYLE[ref.refType]
                  const isHighlighted = hoveredRefDiagram === ref.fromId || hoveredRefDiagram === ref.toId
                  const isDimmed = hoveredRefDiagram !== null && !isHighlighted

                  // Curved path — offset arcs above or below to avoid overlap
                  const midX = (from.x + to.x) / 2
                  const curveDir = idx % 2 === 0 ? -1 : 1
                  const curveOffset = (12 + idx * 6) * curveDir
                  const midY = 50 + curveOffset

                  return (
                    <path
                      key={`ref-${idx}`}
                      d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                      fill="none"
                      stroke={style.color}
                      strokeWidth={isHighlighted ? 0.6 : 0.4}
                      strokeDasharray={isHighlighted ? 'none' : '1.5 1'}
                      opacity={isDimmed ? 0.12 : isHighlighted ? 0.9 : 0.55}
                      markerEnd={`url(#arrow-${ref.refType})`}
                      style={{
                        transition: 'all 0.2s',
                        animation: isHighlighted ? 'none' : 'flowDash 1.5s linear infinite',
                      }}
                    />
                  )
                })
              })()}
            </svg>
          </div>

          {/* Hovered reference details */}
          {hoveredRefDiagram && (
            <div style={{
              borderTop: '1px solid #f3f4f6', padding: '14px 24px',
              background: '#fafbfc',
              animation: 'feedSlideIn 0.15s ease',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                References for {diagrams.find(d => d.id === hoveredRefDiagram)?.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Outgoing refs */}
                {(diagramRefMap[hoveredRefDiagram]?.outgoing ?? []).map((ref, i) => {
                  const style = REF_TYPE_STYLE[ref.refType]
                  return (
                    <div key={`out-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '5px',
                        background: style.bg, color: style.color, minWidth: '60px', textAlign: 'center',
                      }}>
                        {style.icon} {style.label}
                      </span>
                      <span style={{ fontSize: '12px', color: '#374151' }}>
                        <strong>{ref.fromName}</strong>
                        <span style={{ color: '#9ca3af', margin: '0 6px' }}>→</span>
                        <strong>{ref.toName}</strong>
                      </span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                        — {ref.description}
                      </span>
                    </div>
                  )
                })}
                {/* Incoming refs */}
                {(diagramRefMap[hoveredRefDiagram]?.incoming ?? []).map((ref, i) => {
                  const style = REF_TYPE_STYLE[ref.refType]
                  return (
                    <div key={`in-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '5px',
                        background: style.bg, color: style.color, minWidth: '60px', textAlign: 'center',
                      }}>
                        {style.icon} {style.label}
                      </span>
                      <span style={{ fontSize: '12px', color: '#374151' }}>
                        <strong>{ref.fromName}</strong>
                        <span style={{ color: '#9ca3af', margin: '0 6px' }}>→</span>
                        <strong>{ref.toName}</strong>
                      </span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                        — {ref.description}
                      </span>
                    </div>
                  )
                })}
                {(diagramRefMap[hoveredRefDiagram]?.outgoing.length === 0 && diagramRefMap[hoveredRefDiagram]?.incoming.length === 0) && (
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>No references for this diagram</span>
                )}
              </div>
            </div>
          )}

          {/* Reference legend */}
          <div style={{
            borderTop: '1px solid #f3f4f6', padding: '10px 24px',
            display: 'flex', alignItems: 'center', gap: '16px',
            background: '#fafbfc',
          }}>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Legend</span>
            {Object.entries(REF_TYPE_STYLE).map(([key, style]) => (
              <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                <span style={{
                  width: '16px', height: '2px', background: style.color, borderRadius: '1px',
                  display: 'inline-block',
                }} />
                <span style={{ color: style.color, fontWeight: 600 }}>{style.label}</span>
              </span>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: '10.5px', color: '#b0b8c4' }}>Hover to explore · Click to open</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          AGENT CONTEXT FEED + RECENTLY UPDATED — two-column grid
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Agent Context Feed */}
        <div style={{
          borderRadius: '14px', border: '1px solid #e5e7eb', background: '#fff',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Agent Context Feed</span>
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px',
              background: 'rgba(124,58,237,0.08)', color: '#7c3aed',
            }}>Live</span>
          </div>
          <div style={{ maxHeight: '320px', overflow: 'auto' }}>
            {MOCK_EVENTS.map(ev => {
              const agent = AGENT_DEFS.find(a => a.id === ev.agentId)!
              const action = ACTION_STYLE[ev.action]
              return (
                <div key={ev.id} style={{
                  padding: '10px 16px', borderBottom: '1px solid #f9fafb',
                  animation: 'feedSlideIn 0.15s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '5px',
                      background: agent.bg, color: agent.color, border: `1px solid ${agent.border}`,
                    }}>
                      {agent.icon} {agent.name}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px',
                      background: action.bg, color: action.color,
                    }}>
                      {action.icon} {action.label}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#b0b8c4', marginLeft: 'auto' }}>
                      {timeAgo(ev.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.4 }}>
                    <strong style={{ color: PINK }}>{ev.diagramName}</strong>
                    <span style={{ color: '#9ca3af' }}> · </span>
                    {ev.description}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recently Updated */}
        <div style={{
          borderRadius: '14px', border: '1px solid #e5e7eb', background: '#fff',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Recently Updated</span>
          </div>
          <div style={{ maxHeight: '320px', overflow: 'auto' }}>
            {[...diagrams].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).map(d => {
              const type = d.diagramType ?? 'flowchart'
              const color = TYPE_COLOR[type] ?? '#6b7280'
              return (
                <div
                  key={d.id}
                  onClick={() => onOpenDiagram(d.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f9fafb',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '12px', color }}>{type === 'presentation' ? '🖥' : '◇'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{d.name}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{d.path}</div>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px',
                    background: `${color}12`, color, border: `1px solid ${color}25`,
                  }}>
                    {TYPE_LABEL[type] ?? type}
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#b0b8c4' }}>{timeAgo(d.updatedAt)}</span>
                </div>
              )
            })}
            {diagrams.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                No diagrams yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Notion-imported mock data ──────────────────────────────────────────────

interface NotionDoc {
  id: string
  name: string
  path: string
  status: 'done' | 'in-progress' | 'todo'
  priority: 'high' | 'medium' | 'low'
  tags: string[]
  sprint?: string
  updatedAt: Date
}

const NOTION_STATUS: Record<string, { label: string; color: string; bg: string; border: string; tagPath: string }> = {
  'done':        { label: 'Done',        color: '#16a34a', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)',  tagPath: '/imported/task-tracker/status/done' },
  'in-progress': { label: 'In Progress', color: '#d97706', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', tagPath: '/imported/task-tracker/status/in-progress' },
  'todo':        { label: 'Todo',        color: '#6b7280', bg: '#f3f4f6',              border: '#e5e7eb',               tagPath: '/imported/task-tracker/status/todo' },
}
const NOTION_PRIORITY: Record<string, { label: string; color: string; bg: string }> = {
  'high':   { label: '↑ High',   color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  'medium': { label: '→ Medium', color: '#d97706', bg: 'rgba(245,158,11,0.08)' },
  'low':    { label: '↓ Low',    color: '#6b7280', bg: '#f3f4f6' },
}

const TASK_TRACKER_DOCS: NotionDoc[] = [
  { id: 'nt-1', name: 'API Architecture',   path: 'imported/api-architecture',   status: 'done',        priority: 'high',   tags: ['backend', 'infra'],            sprint: 'Sprint 12', updatedAt: new Date(Date.now() - 1000*60*30) },
  { id: 'nt-2', name: 'Database Schema',    path: 'imported/database-schema',    status: 'in-progress', priority: 'high',   tags: ['backend'],                     sprint: 'Sprint 12', updatedAt: new Date(Date.now() - 1000*60*60*2) },
  { id: 'nt-3', name: 'Roadmap 2026',       path: 'imported/roadmap-2026',       status: 'todo',        priority: 'medium', tags: ['frontend', 'product'],         sprint: 'Sprint 13', updatedAt: new Date(Date.now() - 1000*60*60*5) },
  { id: 'nt-4', name: 'Feature Specs',      path: 'imported/feature-specs',      status: 'in-progress', priority: 'medium', tags: ['frontend'],                    sprint: 'Sprint 12', updatedAt: new Date(Date.now() - 1000*60*60*8) },
  { id: 'nt-5', name: 'Component Library',  path: 'imported/component-library',  status: 'done',        priority: 'low',    tags: ['frontend', 'design'],          sprint: 'Sprint 11', updatedAt: new Date(Date.now() - 1000*60*60*24) },
  { id: 'nt-6', name: 'Deployment Guide',   path: 'imported/deployment-guide',   status: 'todo',        priority: 'high',   tags: ['infra'],                       sprint: 'Sprint 13', updatedAt: new Date(Date.now() - 1000*60*60*30) },
  { id: 'nt-7', name: 'Brand Guidelines',   path: 'imported/brand-guidelines',   status: 'done',        priority: 'low',    tags: ['design'],                      sprint: 'Sprint 11', updatedAt: new Date(Date.now() - 1000*60*60*48) },
]
const SPRINT_BOARD_DOCS: NotionDoc[] = TASK_TRACKER_DOCS.map(d => ({ ...d }))

const TAG_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
function tagColor(tag: string) { return TAG_COLORS[tag.charCodeAt(0) % TAG_COLORS.length] }

const DB_DEFS: {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  columns: string[]
  filterFn: (d: Diagram) => boolean
  source?: 'notion'
  notionDocs?: NotionDoc[]
}[] = [
  {
    id: 'db-task-tracker',
    name: 'Task Tracker',
    description: 'Imported from Notion — Status, Priority, and Tags as typed KB columns',
    icon: <span style={{ fontWeight: 900, fontFamily: 'Georgia, serif', fontSize: '14px' }}>N</span>,
    columns: ['Status', 'Priority', 'Tags', 'Path'],
    filterFn: () => false,
    source: 'notion' as const,
    notionDocs: TASK_TRACKER_DOCS,
  },
  {
    id: 'db-sprint-board',
    name: 'Sprint Board',
    description: 'Imported from Notion — Sprint and Status columns from the Sprint Board database',
    icon: <span style={{ fontWeight: 900, fontFamily: 'Georgia, serif', fontSize: '14px' }}>N</span>,
    columns: ['Status', 'Sprint', 'Tags', 'Path'],
    filterFn: () => false,
    source: 'notion' as const,
    notionDocs: SPRINT_BOARD_DOCS,
  },
]

function DatabasesTab({
  diagrams,
  onOpenDiagram,
}: {
  diagrams: Diagram[]
  onOpenDiagram: (id: string) => void
}) {
  const [selectedDbId, setSelectedDbId] = useState<string | null>(null)
  const [view, setView] = useState<'table' | 'board'>('table')

  const selectedDb = selectedDbId ? DB_DEFS.find(db => db.id === selectedDbId) ?? null : null

  // ── Database list ──────────────────────────────────────────────────────────
  if (!selectedDb) {
    return (
      <div style={{ padding: '24px 40px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Databases</div>
            <div style={{ fontSize: '12.5px', color: '#9ca3af', marginTop: '3px' }}>
              Structured views of your diagrams with typed properties and columns
            </div>
          </div>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 13px', borderRadius: '7px', cursor: 'pointer',
              background: PINK, border: 'none', color: '#fff',
              fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            + New Database
          </button>
        </div>

        {/* DB cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {DB_DEFS.map(db => {
            const rowCount = db.source === 'notion'
              ? (db.notionDocs?.length ?? 0)
              : diagrams.filter(db.filterFn).length
            const isNotion = db.source === 'notion'
            return (
              <div
                key={db.id}
                onClick={() => setSelectedDbId(db.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '16px 20px', borderRadius: '10px',
                  border: '1px solid #e5e7eb', background: '#fff',
                  cursor: 'pointer', transition: 'box-shadow 0.12s, border-color 0.12s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = PINK_BORDER
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${PINK_BG}`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '38px', height: '38px', borderRadius: '8px', flexShrink: 0,
                  background: isNotion ? '#f5f5f5' : PINK_BG,
                  color: isNotion ? '#111' : PINK,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: isNotion ? '1px solid #e5e7eb' : 'none',
                }}>
                  {db.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {db.name}
                    </div>
                    {isNotion && (
                      <span style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
                        padding: '1px 6px', borderRadius: '5px',
                        background: '#f0f0ef', color: '#787774',
                        border: '1px solid #e8e8e7',
                      }}>
                        Notion
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '8px' }}>
                    {db.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11.5px', color: '#6b7280', fontWeight: 500 }}>
                      {rowCount} document{rowCount !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: '#e5e7eb' }}>·</span>
                    {db.columns.map(col => (
                      <span key={col} style={{
                        fontSize: '11px', fontWeight: 600,
                        padding: '1px 7px', borderRadius: '8px',
                        background: '#f3f4f6', color: '#6b7280',
                        border: '1px solid #e5e7eb',
                      }}>
                        {col}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Arrow */}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="#d1d5db">
                  <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/>
                </svg>
              </div>
            )
          })}

          {/* Empty new DB placeholder */}
          <div style={{
            padding: '16px 20px', borderRadius: '10px',
            border: '1.5px dashed #e5e7eb', color: '#d1d5db',
            fontSize: '13px', textAlign: 'center', cursor: 'pointer',
          }}>
            + Create a new database from a tag or template
          </div>
        </div>
      </div>
    )
  }

  // ── Database detail (table / board) ────────────────────────────────────────
  const isNotionDb = selectedDb.source === 'notion'
  const notionRows = selectedDb.notionDocs ?? []
  const rows = isNotionDb ? [] : diagrams.filter(selectedDb.filterFn)
  const rowCount = isNotionDb ? notionRows.length : rows.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        padding: '12px 40px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'center', gap: '12px',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setSelectedDbId(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12.5px', color: '#6b7280', fontFamily: 'inherit',
            padding: '3px 6px', borderRadius: '5px',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z"/>
          </svg>
          Databases
        </button>
        <span style={{ color: '#e5e7eb' }}>/</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: isNotionDb ? '#111' : PINK, display: 'flex' }}>{selectedDb.icon}</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{selectedDb.name}</span>
          {isNotionDb && (
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
              padding: '1px 6px', borderRadius: '5px',
              background: '#f0f0ef', color: '#787774',
              border: '1px solid #e8e8e7',
            }}>
              Notion
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', color: '#d1d5db', marginLeft: '4px' }}>
          {rowCount} row{rowCount !== 1 ? 's' : ''}
        </span>

        {/* View toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', background: '#f3f4f6', borderRadius: '7px', padding: '2px' }}>
          {(['table', 'board'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '4px 12px', borderRadius: '5px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '12px', fontWeight: 500, border: 'none',
                background: view === v ? '#fff' : 'transparent',
                color: view === v ? '#111827' : '#6b7280',
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.1s',
              }}
            >
              {v === 'table' ? '⊟ Table' : '⊡ Board'}
            </button>
          ))}
        </div>
      </div>

      {/* ── NOTION TABLE VIEW ─────────────────────────────────────────────── */}
      {isNotionDb && view === 'table' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                {['Name', 'Status', 'Priority', 'Tags', 'Path', 'Updated'].map(col => (
                  <th key={col} style={{
                    padding: '8px 16px', textAlign: 'left',
                    fontSize: '11px', fontWeight: 700, color: '#9ca3af',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notionRows.map((doc, idx) => {
                const stCfg = NOTION_STATUS[doc.status]
                const prCfg = NOTION_PRIORITY[doc.priority]
                return (
                  <tr
                    key={doc.id}
                    style={{
                      borderBottom: idx < notionRows.length - 1 ? '1px solid #f3f4f6' : 'none',
                      transition: 'background 0.08s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {/* Name */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '4px', flexShrink: 0,
                          background: '#f5f5f5', border: '1px solid #e5e7eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 900, fontFamily: 'Georgia, serif', color: '#111',
                        }}>
                          N
                        </div>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>
                          {doc.name}
                        </span>
                      </div>
                    </td>

                    {/* Status – pill + tagPath tooltip */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{
                          fontSize: '11.5px', fontWeight: 600, padding: '2px 8px',
                          borderRadius: '10px', background: stCfg.bg,
                          color: stCfg.color, border: `1px solid ${stCfg.border}`,
                          width: 'fit-content',
                        }}>
                          {stCfg.label}
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '9.5px', color: '#b0b8c4',
                          letterSpacing: '-0.01em',
                        }}>
                          {stCfg.tagPath}
                        </span>
                      </div>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: '11.5px', fontWeight: 600, padding: '2px 8px',
                        borderRadius: '10px', background: prCfg.bg, color: prCfg.color,
                        border: '1px solid transparent',
                      }}>
                        {prCfg.label}
                      </span>
                    </td>

                    {/* Tags – colored multi-select chips */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {doc.tags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              fontSize: '10.5px', fontWeight: 600, padding: '1px 7px',
                              borderRadius: '8px',
                              background: `${tagColor(tag)}18`,
                              color: tagColor(tag),
                              border: `1px solid ${tagColor(tag)}35`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Path */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px', color: '#6b7280',
                        background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px',
                      }}>
                        /{doc.path}
                      </span>
                    </td>

                    {/* Updated */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '12.5px', color: '#9ca3af' }}>
                        {timeAgo(doc.updatedAt)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div
            style={{
              padding: '10px 16px', fontSize: '12.5px', color: '#d1d5db',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              borderTop: '1px solid #f9fafb',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
            onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
          >
            + Add a row
          </div>
        </div>
      )}

      {/* ── NOTION BOARD VIEW ─────────────────────────────────────────────── */}
      {isNotionDb && view === 'board' && (
        <div style={{
          flex: 1, display: 'flex', gap: '14px',
          padding: '20px 40px', overflowX: 'auto', alignItems: 'flex-start',
        }}>
          {(['done', 'in-progress', 'todo'] as const).map(statusKey => {
            const stCfg = NOTION_STATUS[statusKey]
            const colDocs = notionRows.filter(d => d.status === statusKey)
            return (
              <div key={statusKey} style={{ width: '260px', flexShrink: 0 }}>
                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '10px', padding: '0 4px',
                }}>
                  <span style={{
                    fontSize: '11.5px', fontWeight: 700, padding: '2px 9px',
                    borderRadius: '10px', background: stCfg.bg,
                    color: stCfg.color, border: `1px solid ${stCfg.border}`,
                  }}>
                    {stCfg.label}
                  </span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
                    {colDocs.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {colDocs.map(doc => {
                    const prCfg = NOTION_PRIORITY[doc.priority]
                    return (
                      <div
                        key={doc.id}
                        style={{
                          background: '#fff', border: '1px solid #e5e7eb',
                          borderRadius: '9px', padding: '13px 14px',
                          cursor: 'default', transition: 'box-shadow 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                      >
                        {/* Title */}
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
                          {doc.name}
                        </div>

                        {/* Priority */}
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{
                            fontSize: '10.5px', fontWeight: 600, padding: '1px 7px',
                            borderRadius: '8px', background: prCfg.bg, color: prCfg.color,
                          }}>
                            {prCfg.label}
                          </span>
                        </div>

                        {/* Tags */}
                        {doc.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            {doc.tags.map(tag => (
                              <span key={tag} style={{
                                fontSize: '10px', fontWeight: 600, padding: '1px 6px',
                                borderRadius: '6px',
                                background: `${tagColor(tag)}18`,
                                color: tagColor(tag),
                                border: `1px solid ${tagColor(tag)}30`,
                              }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Footer: sprint + time */}
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid #f3f4f6', paddingTop: '8px', marginTop: '2px',
                        }}>
                          {doc.sprint ? (
                            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
                              {doc.sprint}
                            </span>
                          ) : <span />}
                          <span style={{ fontSize: '11px', color: '#b0b8c4' }}>{timeAgo(doc.updatedAt)}</span>
                        </div>
                      </div>
                    )
                  })}

                  {colDocs.length === 0 && (
                    <div style={{
                      border: '1.5px dashed #e5e7eb', borderRadius: '9px',
                      padding: '20px', textAlign: 'center',
                      fontSize: '12px', color: '#d1d5db',
                    }}>
                      No documents
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── STANDARD TABLE VIEW ───────────────────────────────────────────── */}
      {!isNotionDb && view === 'table' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                {['Name', 'Status', 'Type', 'Owner', 'Path', 'Updated'].map(col => (
                  <th key={col} style={{
                    padding: '8px 16px', textAlign: 'left',
                    fontSize: '11px', fontWeight: 700, color: '#9ca3af',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((doc, idx) => {
                const status = getDiagramStatus(doc)
                const owner = getDiagramOwner(doc)
                const cfg = STATUS_CONFIG[status]
                return (
                  <tr
                    key={doc.id}
                    onClick={() => onOpenDiagram(doc.id)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: idx < rows.length - 1 ? '1px solid #f3f4f6' : 'none',
                      transition: 'background 0.08s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {/* Name */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '4px',
                          background: '#f3f4f6', border: '1px solid #e5e7eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="#9ca3af">
                            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V6h-2.75A1.75 1.75 0 019 4.25V1.5H3.75zm6.75.062V4.25c0 .138.112.25.25.25h2.688a.252.252 0 00-.011-.013L10.513 1.573a.248.248 0 00-.013-.011z"/>
                          </svg>
                        </div>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>
                          {doc.name}
                        </span>
                      </div>
                    </td>
                    {/* Status */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: '11.5px', fontWeight: 600, padding: '2px 8px',
                        borderRadius: '10px', background: cfg.bg,
                        color: cfg.color, border: `1px solid ${cfg.border}`,
                      }}>
                        {status}
                      </span>
                    </td>
                    {/* Type */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {doc.diagramType && (
                        <span style={{
                          fontSize: '11.5px', fontWeight: 600, padding: '2px 8px',
                          borderRadius: '10px',
                          background: `${TYPE_COLOR[doc.diagramType] ?? '#6b7280'}12`,
                          color: TYPE_COLOR[doc.diagramType] ?? '#6b7280',
                          border: `1px solid ${TYPE_COLOR[doc.diagramType] ?? '#6b7280'}30`,
                        }}>
                          {TYPE_LABEL[doc.diagramType] ?? doc.diagramType}
                        </span>
                      )}
                    </td>
                    {/* Owner */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: '#e0095f22', color: PINK, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 700,
                        }}>
                          {owner.substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '12.5px', color: '#374151' }}>@{owner}</span>
                      </div>
                    </td>
                    {/* Path */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11.5px', color: '#6b7280',
                        background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px',
                      }}>
                        {doc.path}
                      </span>
                    </td>
                    {/* Updated */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '12.5px', color: '#9ca3af' }}>
                        {timeAgo(doc.updatedAt)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* Add row hint */}
          <div
            style={{
              padding: '10px 16px', fontSize: '12.5px', color: '#d1d5db',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              borderTop: '1px solid #f9fafb',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
            onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
          >
            + Add a row
          </div>
        </div>
      )}

      {/* ── STANDARD BOARD VIEW ───────────────────────────────────────────── */}
      {!isNotionDb && view === 'board' && (
        <div style={{
          flex: 1, display: 'flex', gap: '14px',
          padding: '20px 40px', overflowX: 'auto', alignItems: 'flex-start',
        }}>
          {BOARD_STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status]
            const colRows = rows.filter(d => getDiagramStatus(d) === status)
            return (
              <div key={status} style={{ width: '260px', flexShrink: 0 }}>
                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '10px', padding: '0 4px',
                }}>
                  <span style={{
                    fontSize: '11.5px', fontWeight: 700, padding: '2px 9px',
                    borderRadius: '10px', background: cfg.bg,
                    color: cfg.color, border: `1px solid ${cfg.border}`,
                  }}>
                    {status}
                  </span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
                    {colRows.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {colRows.map(doc => {
                    const owner = getDiagramOwner(doc)
                    return (
                      <div
                        key={doc.id}
                        onClick={() => onOpenDiagram(doc.id)}
                        style={{
                          background: '#fff', border: '1px solid #e5e7eb',
                          borderRadius: '9px', padding: '13px 14px',
                          cursor: 'pointer', transition: 'box-shadow 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                      >
                        {/* Card title */}
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
                          {doc.name}
                        </div>

                        {/* Type badge */}
                        {doc.diagramType && (
                          <div style={{ marginBottom: '8px' }}>
                            <span style={{
                              fontSize: '10.5px', fontWeight: 600, padding: '1px 7px',
                              borderRadius: '8px',
                              background: `${TYPE_COLOR[doc.diagramType] ?? '#6b7280'}12`,
                              color: TYPE_COLOR[doc.diagramType] ?? '#6b7280',
                              border: `1px solid ${TYPE_COLOR[doc.diagramType] ?? '#6b7280'}25`,
                            }}>
                              {TYPE_LABEL[doc.diagramType] ?? doc.diagramType}
                            </span>
                          </div>
                        )}

                        {/* Footer: owner + time */}
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid #f3f4f6', paddingTop: '8px', marginTop: '4px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '50%',
                              background: '#e0095f22', color: PINK,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '8px', fontWeight: 700,
                            }}>
                              {owner.substring(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '11.5px', color: '#6b7280' }}>@{owner}</span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#b0b8c4' }}>{timeAgo(doc.updatedAt)}</span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Empty state per column */}
                  {colRows.length === 0 && (
                    <div style={{
                      border: '1.5px dashed #e5e7eb', borderRadius: '9px',
                      padding: '20px', textAlign: 'center',
                      fontSize: '12px', color: '#d1d5db',
                    }}>
                      No diagrams
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MergeRequestsTab({
  diagrams,
  onReviewDiagram,
}: {
  diagrams: Diagram[]
  onReviewDiagram?: (id: string) => void
}) {
  const pending = diagrams.filter(d => d.pendingReview)

  if (pending.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: '10px', color: '#9ca3af',
      }}>
        <svg width="32" height="32" viewBox="0 0 16 16" fill="#d1d5db">
          <path fillRule="evenodd" d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zm5.677-.177L9.573.677A.25.25 0 0110 .854V2.5h1A2.5 2.5 0 0113.5 5v5.628a2.251 2.251 0 11-1.5 0V5a1 1 0 00-1-1h-1v1.646a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354z"/>
        </svg>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280' }}>No open merge requests</div>
        <div style={{ fontSize: '13px' }}>External changes will appear here for review</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 40px', display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '16px',
      }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="#6b7280">
          <path fillRule="evenodd" d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zm5.677-.177L9.573.677A.25.25 0 0110 .854V2.5h1A2.5 2.5 0 0113.5 5v5.628a2.251 2.251 0 11-1.5 0V5a1 1 0 00-1-1h-1v1.646a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354z"/>
        </svg>
        <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#374151' }}>
          {pending.length} open
        </span>
        <span style={{ fontSize: '13.5px', color: '#9ca3af' }}>·</span>
        <span style={{ fontSize: '13.5px', color: '#9ca3af' }}>0 merged</span>
      </div>

      {/* MR list */}
      <div style={{
        border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden',
      }}>
        {pending.map((doc, idx) => {
          const pr = doc.pendingReview!
          const isGitHub = pr.source === 'github'
          const isJira = pr.source === 'jira'
          const sourceColor = isGitHub ? '#374151' : isJira ? '#0052cc' : '#6b7280'
          const sourceBg = isGitHub ? '#f3f4f6' : isJira ? '#e8f0fe' : '#f3f4f6'

          // Count diff lines (rough estimate from proposed vs current code)
          const currentLines = doc.code.split('\n').length
          const proposedLines = pr.proposedCode.split('\n').length
          const added = Math.max(0, proposedLines - currentLines + 2)
          const removed = Math.max(0, currentLines - proposedLines + 1)

          return (
            <div
              key={doc.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                padding: '16px 20px',
                borderBottom: idx < pending.length - 1 ? '1px solid #e5e7eb' : 'none',
                background: '#fff',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              {/* Status icon — open = green */}
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'rgba(34,197,94,0.12)',
                border: '1.5px solid #22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: '2px',
              }}>
                <svg width="9" height="9" viewBox="0 0 16 16" fill="#22c55e">
                  <path fillRule="evenodd" d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zm5.677-.177L9.573.677A.25.25 0 0110 .854V2.5h1A2.5 2.5 0 0113.5 5v5.628a2.251 2.251 0 11-1.5 0V5a1 1 0 00-1-1h-1v1.646a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354z"/>
                </svg>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    {pr.description}
                  </span>
                  {/* Open badge */}
                  <span style={{
                    fontSize: '10.5px', fontWeight: 600, padding: '1px 7px',
                    borderRadius: '10px', border: '1px solid #22c55e',
                    color: '#16a34a', background: 'rgba(34,197,94,0.08)',
                    flexShrink: 0,
                  }}>Open</span>
                </div>

                {/* Meta row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Source badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', fontWeight: 600,
                    padding: '1px 7px', borderRadius: '8px',
                    background: sourceBg, color: sourceColor,
                    border: `1px solid ${isJira ? '#c2d4f0' : '#e5e7eb'}`,
                  }}>
                    {isGitHub && <GitHubIcon size={10} />}
                    {isJira && <JiraIcon size={10} />}
                    {isGitHub ? 'GitHub' : isJira ? 'JIRA' : pr.source}
                  </span>

                  {/* Diagram path */}
                  <span style={{ fontSize: '11.5px', color: '#6b7280' }}>
                    in{' '}
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '11px', color: '#374151',
                      background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px',
                    }}>
                      {doc.path}
                    </span>
                  </span>

                  {/* Author */}
                  <span style={{ fontSize: '11.5px', color: '#9ca3af' }}>
                    by{' '}
                    <span style={{ color: '#374151', fontWeight: 500 }}>@{pr.author}</span>
                  </span>

                  {/* Time */}
                  <span style={{ fontSize: '11.5px', color: '#9ca3af' }}>
                    {timeAgo(pr.proposedAt)}
                  </span>
                </div>

                {/* Diff pill row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  {/* Type badge */}
                  {doc.diagramType && (
                    <span style={{
                      fontSize: '10.5px', fontWeight: 600,
                      padding: '1px 6px', borderRadius: '8px',
                      background: `${TYPE_COLOR[doc.diagramType] ?? '#6b7280'}12`,
                      color: TYPE_COLOR[doc.diagramType] ?? '#6b7280',
                      border: `1px solid ${TYPE_COLOR[doc.diagramType] ?? '#6b7280'}25`,
                    }}>
                      {TYPE_LABEL[doc.diagramType] ?? doc.diagramType}
                    </span>
                  )}
                  {/* Diff stats */}
                  <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600, fontFamily: 'monospace' }}>
                    +{added}
                  </span>
                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, fontFamily: 'monospace' }}>
                    −{removed}
                  </span>
                </div>
              </div>

              {/* Review button */}
              <button
                onClick={() => onReviewDiagram?.(doc.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', borderRadius: '7px', cursor: 'pointer',
                  background: '#111827', border: 'none',
                  color: '#fff', fontSize: '12.5px', fontWeight: 600,
                  fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#374151')}
                onMouseLeave={e => (e.currentTarget.style.background = '#111827')}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25h-6.5a.75.75 0 00-.53.22L4.5 14.44v-2.19a.75.75 0 00-.75-.75h-2a.25.25 0 01-.25-.25v-8.5zM1.75 1A1.75 1.75 0 000 2.75v8.5C0 12.216.784 13 1.75 13H3v1.543a1.457 1.457 0 002.487 1.03L7.061 14H13.25A1.75 1.75 0 0015 12.25v-8.5A1.75 1.75 0 0013.25 1H1.75zm5 3.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm-2.5 4a.75.75 0 000 1.5h7a.75.75 0 000-1.5h-7z"/>
                </svg>
                Review
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Activity tab ─────────────────────────────────────────────────────────────

interface ActivityPanel {
  meta?: { label: string; value: string }[]
  list?: string[]
  actions: { label: string; primary?: boolean }[]
}

interface ActivityEvent {
  id: string
  actor: { name: string; initials: string; color: string }
  iconType: 'pr' | 'comment' | 'ai' | 'check' | 'plus' | 'mention' | 'export' | 'eye' | 'tag' | 'merge'
  iconBg: string
  iconColor: string
  title: React.ReactNode
  detail?: string
  source?: 'github' | 'jira' | 'ai'
  minsAgo: number
  panel: ActivityPanel
}

const FEED: ActivityEvent[] = [
  {
    id: 'a1',
    actor: { name: 'Jay Infra', initials: 'JI', color: '#2563eb' },
    iconType: 'pr', iconBg: 'rgba(34,197,94,0.12)', iconColor: '#22c55e',
    title: <>opened a pull request on <strong>cicd-pipeline</strong></>,
    detail: 'feat: add parallel deploy stages for staging & prod',
    source: 'github', minsAgo: 8,
    panel: {
      meta: [
        { label: 'PR', value: '#284 · feat/parallel-deploy → main' },
        { label: 'Diagram', value: 'my-flows/cicd-pipeline' },
        { label: 'Diff', value: '+14 lines  −3 lines  ·  2 files' },
        { label: 'Status', value: '🟢 Open · awaiting review' },
      ],
      actions: [{ label: 'Review Changes', primary: true }, { label: 'Open Diagram' }],
    },
  },
  {
    id: 'a2',
    actor: { name: 'Alex Dev', initials: 'AD', color: '#7c3aed' },
    iconType: 'comment', iconBg: 'rgba(99,102,241,0.12)', iconColor: '#6366f1',
    title: <>commented on node <strong>"API Gateway"</strong> in <strong>microservices-arch</strong></>,
    detail: '"Should we add a rate-limiting layer before hitting the auth service?"',
    minsAgo: 22,
    panel: {
      meta: [
        { label: 'Node', value: 'API Gateway' },
        { label: 'Diagram', value: 'architecture/microservices-arch' },
        { label: 'Thread', value: '1 comment · 0 replies' },
      ],
      actions: [{ label: 'Reply', primary: true }, { label: 'Go to Diagram' }],
    },
  },
  {
    id: 'a3',
    actor: { name: 'Claude AI', initials: '✦', color: '#e0095f' },
    iconType: 'ai', iconBg: 'rgba(224,9,95,0.1)', iconColor: '#e0095f',
    title: <>suggested <strong>3 improvements</strong> to <strong>auth-flow</strong></>,
    detail: 'Simplified OAuth2 handshake · Added token rotation · Removed deprecated endpoint',
    source: 'ai', minsAgo: 35,
    panel: {
      meta: [
        { label: 'Diagram', value: 'my-flows/auth-flow' },
        { label: 'Model', value: 'claude-sonnet-4-6' },
        { label: 'Status', value: 'Pending review' },
      ],
      list: [
        'Simplified the OAuth2 handshake — removed redundant redirect hop',
        'Added refresh token rotation with 7-day expiry',
        'Removed deprecated /oauth/token/legacy endpoint',
      ],
      actions: [{ label: 'View in Editor', primary: true }, { label: 'Dismiss' }],
    },
  },
  {
    id: 'a4',
    actor: { name: 'Priya Security', initials: 'PS', color: '#d97706' },
    iconType: 'check', iconBg: 'rgba(34,197,94,0.12)', iconColor: '#22c55e',
    title: <>approved merge request on <strong>auth-flow</strong></>,
    source: 'jira', minsAgo: 47,
    panel: {
      meta: [
        { label: 'JIRA', value: 'ACME-412' },
        { label: 'Diagram', value: 'my-flows/auth-flow' },
        { label: 'Verdict', value: '✅ Approved — LGTM' },
        { label: 'Reviewers', value: 'priya-security ✓ · akshat (pending)' },
      ],
      actions: [{ label: 'View Merge Request', primary: true }, { label: 'Open Diagram' }],
    },
  },
  {
    id: 'a5',
    actor: { name: 'Sarah UX', initials: 'SU', color: '#0ea5e9' },
    iconType: 'ai', iconBg: 'rgba(224,9,95,0.1)', iconColor: '#e0095f',
    title: <>accepted an AI suggestion in <strong>user-journey</strong></>,
    detail: 'Added "Empty State" and "Error State" branches to the onboarding flow',
    minsAgo: 63,
    panel: {
      meta: [
        { label: 'Diagram', value: 'my-flows/user-journey' },
        { label: 'Change', value: '+2 branches · 4 new nodes' },
      ],
      list: [
        'New branch: "Empty State" — shown when user has no data yet',
        'New branch: "Error State" — catches network failures gracefully',
      ],
      actions: [{ label: 'Open Diagram', primary: true }],
    },
  },
  {
    id: 'a6',
    actor: { name: 'Marcus PM', initials: 'MP', color: '#059669' },
    iconType: 'plus', iconBg: 'rgba(5,150,105,0.12)', iconColor: '#059669',
    title: <>created <strong>Q2 Roadmap</strong> from the Timeline template</>,
    minsAgo: 130,
    panel: {
      meta: [
        { label: 'Diagram', value: 'Q2 Roadmap' },
        { label: 'Template', value: 'Timeline (Gantt)' },
        { label: 'Type', value: 'Gantt chart' },
        { label: 'Folder', value: 'my-flows/' },
      ],
      actions: [{ label: 'Open Diagram', primary: true }],
    },
  },
  {
    id: 'a7',
    actor: { name: 'Jay Infra', initials: 'JI', color: '#2563eb' },
    iconType: 'mention', iconBg: 'rgba(99,102,241,0.12)', iconColor: '#6366f1',
    title: <>mentioned <strong>you</strong> in a comment on <strong>cicd-pipeline</strong></>,
    detail: '"@akshat can you review the deploy sequencing before we merge?"',
    source: 'github', minsAgo: 161,
    panel: {
      meta: [
        { label: 'PR', value: '#284 · feat/parallel-deploy → main' },
        { label: 'Diagram', value: 'my-flows/cicd-pipeline' },
      ],
      actions: [{ label: 'Reply', primary: true }, { label: 'Review PR' }, { label: 'Open Diagram' }],
    },
  },
  {
    id: 'a8',
    actor: { name: 'Alex Dev', initials: 'AD', color: '#7c3aed' },
    iconType: 'export', iconBg: 'rgba(107,114,128,0.1)', iconColor: '#6b7280',
    title: <>exported <strong>microservices-arch</strong> to PNG</>,
    minsAgo: 185,
    panel: {
      meta: [
        { label: 'Diagram', value: 'architecture/microservices-arch' },
        { label: 'Format', value: 'PNG · 2400 × 1600 px' },
        { label: 'Size', value: '1.2 MB' },
        { label: 'Background', value: 'Transparent' },
      ],
      actions: [{ label: 'Open Diagram', primary: true }],
    },
  },
  {
    id: 'a9',
    actor: { name: 'Priya Security', initials: 'PS', color: '#d97706' },
    iconType: 'merge', iconBg: 'rgba(139,92,246,0.12)', iconColor: '#8b5cf6',
    title: <>merged <strong>JIRA-1042</strong> into <strong>auth-flow</strong></>,
    detail: 'Enforce MFA for admin routes across all services',
    source: 'jira', minsAgo: 258,
    panel: {
      meta: [
        { label: 'JIRA', value: 'JIRA-1042 · Enforce MFA for admin routes' },
        { label: 'Diagram', value: 'my-flows/auth-flow' },
        { label: 'Merged into', value: 'main' },
        { label: 'Strategy', value: 'Squash & merge · +9 −2' },
      ],
      actions: [{ label: 'View Diagram', primary: true }, { label: 'View on JIRA' }],
    },
  },
  {
    id: 'a10',
    actor: { name: 'Taylor Design', initials: 'TD', color: '#f59e0b' },
    iconType: 'eye', iconBg: 'rgba(107,114,128,0.08)', iconColor: '#9ca3af',
    title: <><strong>architecture-overview</strong> received <strong>5 views</strong> today</>,
    minsAgo: 300,
    panel: {
      meta: [
        { label: 'Diagram', value: 'architecture/architecture-overview' },
        { label: 'Views today', value: '5  (↑ 2 from yesterday)' },
      ],
      list: [
        'Taylor Design — 2h ago',
        'Marcus PM — 3h ago',
        'Priya Security — 4h ago',
        'Jay Infra — 4h ago',
        'Alex Dev — 5h ago',
      ],
      actions: [{ label: 'Open Diagram', primary: true }],
    },
  },
  {
    id: 'a11',
    actor: { name: 'Marcus PM', initials: 'MP', color: '#059669' },
    iconType: 'tag', iconBg: 'rgba(5,150,105,0.1)', iconColor: '#059669',
    title: <>tagged <strong>cicd-pipeline</strong> as{' '}
      <span style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px', color: '#374151' }}>
        production-ready
      </span>
    </>,
    minsAgo: 390,
    panel: {
      meta: [
        { label: 'Diagram', value: 'my-flows/cicd-pipeline' },
        { label: 'Tag added', value: 'production-ready' },
        { label: 'All tags', value: 'production-ready · ci-cd · infra' },
      ],
      actions: [{ label: 'Open Diagram', primary: true }],
    },
  },
  {
    id: 'a12',
    actor: { name: 'Sarah UX', initials: 'SU', color: '#0ea5e9' },
    iconType: 'check', iconBg: 'rgba(34,197,94,0.12)', iconColor: '#22c55e',
    title: <>resolved a discussion thread in <strong>user-journey</strong></>,
    detail: '"Closing — updated to match the new design system specs ✓"',
    minsAgo: 480,
    panel: {
      meta: [
        { label: 'Diagram', value: 'my-flows/user-journey' },
        { label: 'Thread', value: '3 comments · resolved' },
        { label: 'Participants', value: 'sarah-ux, taylor-design' },
      ],
      actions: [{ label: 'View Thread', primary: true }, { label: 'Open Diagram' }],
    },
  },
]

function activityTimeAgo(minsAgo: number): string {
  if (minsAgo < 60) return `${minsAgo}m ago`
  const h = Math.floor(minsAgo / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function ActivityIconSvg({ type, color }: { type: ActivityEvent['iconType']; color: string }) {
  switch (type) {
    case 'pr':
      return (
        <svg width="9" height="9" viewBox="0 0 16 16" fill={color}>
          <path fillRule="evenodd" d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zm5.677-.177L9.573.677A.25.25 0 0110 .854V2.5h1A2.5 2.5 0 0113.5 5v5.628a2.251 2.251 0 11-1.5 0V5a1 1 0 00-1-1h-1v1.646a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354z"/>
        </svg>
      )
    case 'comment':
      return (
        <svg width="9" height="9" viewBox="0 0 16 16" fill={color}>
          <path d="M1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25h-6.5a.75.75 0 00-.53.22L4.5 14.44v-2.19a.75.75 0 00-.75-.75h-2a.25.25 0 01-.25-.25v-8.5zM1.75 1A1.75 1.75 0 000 2.75v8.5C0 12.216.784 13 1.75 13H3v1.543a1.457 1.457 0 002.487 1.03L7.061 14H13.25A1.75 1.75 0 0015 12.25v-8.5A1.75 1.75 0 0013.25 1H1.75z"/>
        </svg>
      )
    case 'ai':
      return (
        <svg width="9" height="9" viewBox="0 0 16 16" fill={color}>
          <path d="M8 0a.5.5 0 01.5.5v1a.5.5 0 01-1 0V.5A.5.5 0 018 0zm0 13a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 13zM0 8a.5.5 0 01.5-.5h1a.5.5 0 010 1H.5A.5.5 0 010 8zm13 0a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1A.5.5 0 0113 8zm-1.757-4.95a.5.5 0 010 .707L10.536 4.46a.5.5 0 01-.707-.707l.707-.707a.5.5 0 01.707 0zM5.464 10.536a.5.5 0 010 .707l-.707.707a.5.5 0 01-.707-.707l.707-.707a.5.5 0 01.707 0zM11.243 10.536l.707.707a.5.5 0 01-.707.707l-.707-.707a.5.5 0 01.707-.707zM4.757 4.757l-.707-.707a.5.5 0 01.707-.707l.707.707a.5.5 0 01-.707.707zM8 5.5A2.5 2.5 0 118 10.5 2.5 2.5 0 018 5.5z"/>
        </svg>
      )
    case 'check':
      return (
        <svg width="9" height="9" viewBox="0 0 16 16" fill={color}>
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
        </svg>
      )
    case 'plus':
      return (
        <svg width="9" height="9" viewBox="0 0 16 16" fill={color}>
          <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z"/>
        </svg>
      )
    case 'mention':
      return (
        <svg width="9" height="9" viewBox="0 0 16 16" fill={color}>
          <path d="M10.5 5A5.5 5.5 0 105.5 10.5c.661 0 1.3-.12 1.89-.34l.97 1.31a7 7 0 111.52-1.52l1.31.97A5.47 5.47 0 0010.5 5zM8 5.5A2.5 2.5 0 115.5 8 2.5 2.5 0 018 5.5z"/>
        </svg>
      )
    case 'export':
      return (
        <svg width="9" height="9" viewBox="0 0 16 16" fill={color}>
          <path d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14H2.75zM7.25 7.689V2a.75.75 0 011.5 0v5.689l1.97-1.97a.749.749 0 111.06 1.06l-3.25 3.25a.749.749 0 01-1.06 0L4.22 6.78a.749.749 0 111.06-1.06l1.97 1.97z"/>
        </svg>
      )
    case 'eye':
      return (
        <svg width="9" height="9" viewBox="0 0 16 16" fill={color}>
          <path d="M8 2c-1.981 0-3.671.992-4.933 2.078C1.797 5.169.88 6.328.43 7.368a.73.73 0 000 .264c.448 1.04 1.367 2.2 2.637 3.29C4.329 12.008 6.019 13 8 13s3.671-.992 4.933-2.078c1.27-1.09 2.188-2.25 2.637-3.29a.73.73 0 000-.264c-.448-1.04-1.367-2.2-2.637-3.29C11.671 2.992 9.981 2 8 2zm0 9.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/>
          <path d="M8 6.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
        </svg>
      )
    case 'tag':
      return (
        <svg width="9" height="9" viewBox="0 0 16 16" fill={color}>
          <path d="M2.5 7.775V2.75a.25.25 0 01.25-.25h5.025a.25.25 0 01.177.073l6.25 6.25a.25.25 0 010 .354l-5.025 5.025a.25.25 0 01-.354 0l-6.25-6.25a.25.25 0 01-.073-.177zm-1.5 0V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 010 2.474l-5.026 5.026a1.75 1.75 0 01-2.474 0l-6.25-6.25A1.75 1.75 0 011 7.775zM6 5a1 1 0 100 2 1 1 0 000-2z"/>
        </svg>
      )
    case 'merge':
      return (
        <svg width="9" height="9" viewBox="0 0 16 16" fill={color}>
          <path fillRule="evenodd" d="M5.45 5.154A4.25 4.25 0 009.25 7.5h1.378a2.251 2.251 0 110 1.5H9.25A5.734 5.734 0 015 7.123v3.505a2.25 2.25 0 11-1.5 0V5.372a2.25 2.25 0 111.95-.218z"/>
        </svg>
      )
    default:
      return null
  }
}

function ActivityRow({ ev, onClick, isSelected }: { ev: ActivityEvent; onClick: () => void; isSelected: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '10px 14px', borderRadius: '8px',
        background: isSelected ? PINK_BG : hovered ? '#f9fafb' : 'transparent',
        border: `1px solid ${isSelected ? PINK_BORDER : 'transparent'}`,
        transition: 'background 0.1s, border-color 0.1s', cursor: 'pointer',
      }}
    >
      {/* Avatar + icon badge */}
      <div style={{ position: 'relative', flexShrink: 0, marginTop: '1px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%',
          background: ev.actor.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11.5px', fontWeight: 700, letterSpacing: '-0.5px',
          userSelect: 'none',
        }}>
          {ev.actor.initials}
        </div>
        <div style={{
          position: 'absolute', bottom: '-3px', right: '-4px',
          width: '16px', height: '16px', borderRadius: '50%',
          background: ev.iconBg,
          border: '2px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ActivityIconSvg type={ev.iconType} color={ev.iconColor} />
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', color: '#374151', lineHeight: '1.5' }}>
          <span style={{ fontWeight: 600, color: '#111827' }}>{ev.actor.name}</span>{' '}
          {ev.title}
        </div>

        {ev.detail && (
          <div style={{
            marginTop: '5px', fontSize: '12px', color: '#6b7280',
            background: '#f9fafb', border: '1px solid #f0f0f0',
            borderRadius: '6px', padding: '5px 10px',
            fontStyle: ev.detail.startsWith('"') ? 'italic' : 'normal',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '520px',
          }}>
            {ev.detail}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '5px' }}>
          {ev.source === 'github' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              fontSize: '10.5px', fontWeight: 600,
              padding: '1px 6px', borderRadius: '8px',
              background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb',
            }}>
              <GitHubIcon size={9} /> GitHub
            </span>
          )}
          {ev.source === 'jira' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              fontSize: '10.5px', fontWeight: 600,
              padding: '1px 6px', borderRadius: '8px',
              background: '#e8f0fe', color: '#0052cc', border: '1px solid #c2d4f0',
            }}>
              <JiraIcon size={9} /> JIRA
            </span>
          )}
          {ev.source === 'ai' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              fontSize: '10.5px', fontWeight: 600,
              padding: '1px 6px', borderRadius: '8px',
              background: 'rgba(224,9,95,0.07)', color: PINK,
              border: `1px solid ${PINK_BORDER}`,
            }}>
              ✦ AI
            </span>
          )}
          <span style={{ fontSize: '11.5px', color: '#b0b8c4' }}>
            {activityTimeAgo(ev.minsAgo)}
          </span>
        </div>
      </div>
    </div>
  )
}

function ActivityDetailPanel({ ev, onClose }: { ev: ActivityEvent; onClose: () => void }) {
  return (
    <div style={{
      width: '300px', flexShrink: 0,
      borderLeft: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      background: '#fff',
      overflowY: 'auto',
    }}>
      {/* Header: actor + close */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'center', gap: '10px',
        position: 'sticky', top: 0, background: '#fff', zIndex: 1,
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: ev.actor.color, color: '#fff', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700, userSelect: 'none',
        }}>
          {ev.actor.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{ev.actor.name}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{activityTimeAgo(ev.minsAgo)}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: '24px', height: '24px', borderRadius: '6px', border: 'none',
            background: 'transparent', cursor: 'pointer', color: '#9ca3af',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          ✕
        </button>
      </div>

      {/* Action summary */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontSize: '13.5px', color: '#374151', lineHeight: '1.6' }}>
          {ev.title}
        </div>
        {ev.detail && (
          <div style={{
            marginTop: '8px', fontSize: '12px', color: '#6b7280',
            background: '#f9fafb', border: '1px solid #f0f0f0',
            borderRadius: '6px', padding: '7px 10px',
            fontStyle: ev.detail.startsWith('"') ? 'italic' : 'normal',
            lineHeight: '1.5',
          }}>
            {ev.detail}
          </div>
        )}
        {/* Source badge */}
        {ev.source && (
          <div style={{ marginTop: '10px' }}>
            {ev.source === 'github' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                borderRadius: '8px', background: '#f3f4f6',
                color: '#374151', border: '1px solid #e5e7eb',
              }}>
                <GitHubIcon size={10} /> GitHub
              </span>
            )}
            {ev.source === 'jira' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                borderRadius: '8px', background: '#e8f0fe',
                color: '#0052cc', border: '1px solid #c2d4f0',
              }}>
                <JiraIcon size={10} /> JIRA
              </span>
            )}
            {ev.source === 'ai' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                borderRadius: '8px', background: 'rgba(224,9,95,0.07)',
                color: PINK, border: `1px solid ${PINK_BORDER}`,
              }}>
                ✦ AI
              </span>
            )}
          </div>
        )}
      </div>

      {/* Meta table */}
      {ev.panel.meta && ev.panel.meta.length > 0 && (
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', flexDirection: 'column', gap: '9px',
        }}>
          {ev.panel.meta.map(m => (
            <div key={m.label} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{
                fontSize: '11px', color: '#9ca3af', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                width: '68px', flexShrink: 0, paddingTop: '1px',
              }}>
                {m.label}
              </span>
              <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500, lineHeight: '1.5' }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {ev.panel.list && ev.panel.list.length > 0 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {ev.panel.list.map((item, i) => (
              <li key={i} style={{ fontSize: '12.5px', color: '#374151', lineHeight: '1.5' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid #f3f4f6',
        display: 'flex', flexDirection: 'column', gap: '7px',
      }}>
        {ev.panel.actions.map(action => (
          <button
            key={action.label}
            style={{
              padding: '7px 14px', borderRadius: '7px', width: '100%',
              fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', textAlign: 'center',
              background: action.primary ? PINK : 'transparent',
              color: action.primary ? '#fff' : '#374151',
              border: action.primary ? 'none' : '1px solid #e5e7eb',
              transition: 'background 0.12s, opacity 0.12s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '0.85'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1'
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ActivityTab() {
  type FilterId = 'all' | 'prs' | 'comments' | 'ai' | 'merges'
  const [filter, setFilter] = useState<FilterId>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const FILTERS: { id: FilterId; label: string }[] = [
    { id: 'all', label: 'All activity' },
    { id: 'prs', label: 'Pull Requests' },
    { id: 'comments', label: 'Comments' },
    { id: 'ai', label: 'AI' },
    { id: 'merges', label: 'Merges' },
  ]

  const filtered = FEED.filter(ev => {
    if (filter === 'all') return true
    if (filter === 'prs') return ev.iconType === 'pr'
    if (filter === 'comments') return ev.iconType === 'comment' || ev.iconType === 'mention'
    if (filter === 'ai') return ev.iconType === 'ai'
    if (filter === 'merges') return ev.iconType === 'merge' || ev.iconType === 'check'
    return true
  })

  const today = filtered.filter(e => e.minsAgo < 8 * 60)
  const earlier = filtered.filter(e => e.minsAgo >= 8 * 60)
  const selectedEv = selectedId ? FEED.find(e => e.id === selectedId) ?? null : null

  function handleSelect(id: string) {
    setSelectedId(prev => prev === id ? null : id)
  }

  function renderGroup(label: string, events: ActivityEvent[]) {
    if (events.length === 0) return null
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, color: '#c4c9d4',
            textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
          }}>
            {label}
          </span>
          <div style={{ flex: 1, height: '1px', background: '#f3f4f6' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {events.map(ev => (
            <ActivityRow
              key={ev.id}
              ev={ev}
              onClick={() => handleSelect(ev.id)}
              isSelected={selectedId === ev.id}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Feed column */}
      <div style={{ flex: 1, minWidth: 0, padding: selectedEv ? '24px 20px' : '24px 40px', overflowY: 'auto' }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '4px 13px', borderRadius: '20px',
                  fontSize: '12.5px', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${filter === f.id ? PINK : '#e5e7eb'}`,
                  background: filter === f.id ? PINK_BG : 'transparent',
                  color: filter === f.id ? PINK : '#6b7280',
                  transition: 'all 0.12s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '12px', color: '#d1d5db' }}>
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Feed */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13.5px', marginTop: '60px' }}>
            No activity matching this filter
          </div>
        ) : (
          <>
            {renderGroup('Today', today)}
            {renderGroup('Earlier', earlier)}
          </>
        )}
      </div>

      {/* Detail panel — slides in when an item is selected */}
      {selectedEv && (
        <ActivityDetailPanel ev={selectedEv} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: '12px', color: '#9ca3af',
    }}>
      <div style={{ fontSize: '32px' }}>◻</div>
      <div style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '13px' }}>Nothing here yet</div>
    </div>
  )
}

// ── Import / Connect modal ───────────────────────────────────────────────────

type IntegSource = 'notion' | 'drive' | 'github'

function NotionIcon({ size = 22 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.18) + 'px', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.7, fontWeight: 900, color: '#111827', fontFamily: 'Georgia, serif', lineHeight: 1 }}>N</span>
    </div>
  )
}

function DriveIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.897)} viewBox="0 0 87.3 78" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6.6 66.85 3.35 72.5c-.7 1.2-.11 2.7 1.33 2.7h73.66c1.44 0 2.03-1.5 1.33-2.7L76.42 66.85z" fill="#0066da"/>
      <path d="M43.65 7.1 17.95 52.5h51.4L43.65 7.1z" fill="#00ac47"/>
      <path d="M76.42 66.85 56.15 28.5 43.65 7.1 6.6 66.85z" fill="#ea4335"/>
      <path d="M6.6 66.85h69.82L43.65 7.1z" fill="#ffba00"/>
    </svg>
  )
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState<IntegSource | null>(null)
  const [step, setStep] = useState(0)

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1)
    else { setSource(null); setStep(0) }
  }

  const sourceName = source === 'notion' ? 'Notion' : source === 'drive' ? 'Google Drive' : 'GitHub'

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '680px', maxWidth: '95vw', maxHeight: '88vh',
        background: '#fff', borderRadius: '16px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 0.15s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {source && (
              <button
                onClick={handleBack}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '18px', padding: '4px 8px', borderRadius: '6px', fontFamily: 'inherit', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >←</button>
            )}
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                {source ? `Import from ${sourceName}` : 'Import & Connect'}
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '1px' }}>
                {source ? `Step ${step + 1} of 4` : 'Choose a source to bring content into your Diagram Hub'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '18px', padding: '4px 8px', borderRadius: '6px', fontFamily: 'inherit', lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!source ? (
            <ImportSourcePicker onSelect={(s) => { setSource(s); setStep(0) }} />
          ) : source === 'notion' ? (
            <NotionWizard step={step} onNext={() => setStep(s => s + 1)} onClose={onClose} />
          ) : source === 'drive' ? (
            <DriveWizard step={step} onNext={() => setStep(s => s + 1)} onClose={onClose} />
          ) : (
            <GitHubWizard step={step} onNext={() => setStep(s => s + 1)} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}

function ImportSourcePicker({ onSelect }: { onSelect: (s: IntegSource) => void }) {
  const sources: { id: IntegSource; name: string; desc: string; icon: React.ReactNode; bg: string; border: string }[] = [
    {
      id: 'notion', name: 'Notion',
      desc: 'Import pages and databases. Select & Multi-select properties become typed KB columns with tag paths.',
      icon: <NotionIcon size={20} />, bg: '#f9fafb', border: '#e5e7eb',
    },
    {
      id: 'drive', name: 'Google Drive',
      desc: 'Import markdown files, exported docs, and .mmd diagram files from any folder.',
      icon: <DriveIcon size={20} />, bg: '#e8f0fe', border: '#c5d9f7',
    },
    {
      id: 'github', name: 'GitHub',
      desc: 'Connect a repository. Pushed diagram changes auto-create merge requests for review.',
      icon: <GitHubIcon size={18} />, bg: '#f6f8fa', border: '#d0d7de',
    },
  ]
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {sources.map(src => (
        <button
          key={src.id}
          onClick={() => onSelect(src.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px',
            borderRadius: '12px', cursor: 'pointer', background: '#fff',
            border: '1px solid #e5e7eb', textAlign: 'left',
            fontFamily: 'inherit', transition: 'all 0.12s', width: '100%',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = PINK_BORDER; e.currentTarget.style.boxShadow = `0 0 0 3px ${PINK_BG}` }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0, background: src.bg, border: `1px solid ${src.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {src.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '3px' }}>{src.name}</div>
            <div style={{ fontSize: '12.5px', color: '#9ca3af', lineHeight: 1.4 }}>{src.desc}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="#d1d5db"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/></svg>
        </button>
      ))}
    </div>
  )
}

// ─── Notion wizard ─────────────────────────────────────────────────────────

function NotionWizard({ step, onNext, onClose }: { step: number; onNext: () => void; onClose: () => void }) {
  if (step === 0) return <NotionAuth onNext={onNext} />
  if (step === 1) return <NotionScan onNext={onNext} />
  if (step === 2) return <NotionMap onNext={onNext} />
  return <ImportDone source="Notion" docsCount={11} dbCount={2} onClose={onClose} />
}

function NotionAuth({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'done'>('idle')
  return (
    <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: '#f9fafb', border: '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <span style={{ fontSize: '38px', fontWeight: 900, color: '#111827', fontFamily: 'Georgia, serif', lineHeight: 1 }}>N</span>
      </div>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Connect your Notion workspace</div>
        <div style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6 }}>
          Authorize Mermaid to read your pages and databases. Pages become KB documents — databases become structured views with typed columns.
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: '380px', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
          Permissions requested
        </div>
        {[
          { icon: '📖', label: 'Read workspace content', sub: 'Pages, databases, and their properties' },
          { icon: '🏷', label: 'Read database properties', sub: 'Select, multi-select columns and their options' },
        ].map(p => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 14px', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{p.icon}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{p.label}</div>
              <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '2px' }}>{p.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => { setStatus('connecting'); setTimeout(() => { setStatus('done'); setTimeout(onNext, 700) }, 1800) }}
        disabled={status !== 'idle'}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 28px', borderRadius: '10px', cursor: status === 'idle' ? 'pointer' : 'default',
          background: status === 'done' ? '#16a34a' : '#111827', border: 'none',
          color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
          transition: 'background 0.2s',
        }}
      >
        {status === 'idle' && <><NotionIcon size={18} /><span>Sign in with Notion</span></>}
        {status === 'connecting' && <><span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /><span>Connecting…</span></>}
        {status === 'done' && <span>✓ Connected</span>}
      </button>
    </div>
  )
}

const NOTION_PAGES_DATA = [
  { type: 'folder', name: 'Engineering', indent: 0, icon: '📁' },
  { type: 'page', name: 'API Architecture', indent: 1, icon: '📄' },
  { type: 'page', name: 'Database Schema', indent: 1, icon: '📄' },
  { type: 'db', name: 'Task Tracker', indent: 1, icon: '🗄' },
  { type: 'folder', name: 'Product', indent: 0, icon: '📁' },
  { type: 'page', name: 'Roadmap 2026', indent: 1, icon: '📄' },
  { type: 'page', name: 'Feature Specs', indent: 1, icon: '📄' },
  { type: 'db', name: 'Sprint Board', indent: 1, icon: '🗄' },
  { type: 'folder', name: 'Design', indent: 0, icon: '📁' },
  { type: 'page', name: 'Component Library', indent: 1, icon: '📄' },
  { type: 'page', name: 'Brand Guidelines', indent: 1, icon: '📄' },
]

function NotionScan({ onNext }: { onNext: () => void }) {
  const [revealed, setRevealed] = useState(0)
  useEffect(() => {
    let idx = 0
    const iv = setInterval(() => {
      idx++
      setRevealed(idx)
      if (idx >= NOTION_PAGES_DATA.length) { clearInterval(iv); setTimeout(onNext, 900) }
    }, 280)
    return () => clearInterval(iv)
  }, [])
  const progress = Math.round((revealed / NOTION_PAGES_DATA.length) * 100)
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(224,9,95,0.25)', borderTopColor: PINK, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>Scanning workspace…</span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{revealed} / {NOTION_PAGES_DATA.length}</span>
          </div>
          <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: PINK, borderRadius: '2px', transition: 'width 0.25s ease' }} />
          </div>
        </div>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
          Workspace tree
        </div>
        <div style={{ padding: '8px', maxHeight: '300px', overflowY: 'auto' }}>
          {NOTION_PAGES_DATA.slice(0, revealed).map((page, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 8px', paddingLeft: `${8 + page.indent * 20}px`,
                borderRadius: '6px',
                color: page.type === 'db' ? '#7c3aed' : '#374151',
                fontWeight: page.type === 'folder' ? 600 : 400,
                fontSize: '13px',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <span>{page.icon}</span>
              {page.name}
              {page.type === 'db' && (
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', fontWeight: 600, marginLeft: '4px' }}>Database</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotionMap({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '3px' }}>Found 11 pages · 2 databases</div>
      <div style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '20px' }}>Review how your Notion content maps to the Diagram Hub</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: '10px', alignItems: 'start', marginBottom: '20px' }}>

        {/* Left: Notion */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <NotionIcon size={13} /> Notion
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>9 Pages</div>
              {['API Architecture', 'Database Schema', 'Roadmap 2026', 'Feature Specs', '5 more…'].map(p => (
                <div key={p} style={{ fontSize: '12px', color: '#6b7280', padding: '2px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>📄</span> {p}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', background: '#fafafe' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                🗄 Task Tracker <span style={{ fontSize: '10px', background: '#ede9fe', padding: '1px 5px', borderRadius: '8px' }}>DB</span>
              </div>
              {[
                { name: 'Status', type: 'Select', color: '#d97706', bg: 'rgba(245,158,11,0.1)' },
                { name: 'Priority', type: 'Select', color: '#d97706', bg: 'rgba(245,158,11,0.1)' },
                { name: 'Tags', type: 'Multi-select', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
              ].map(col => (
                <div key={col.name} style={{ fontSize: '11.5px', color: '#6b7280', padding: '2px 0', paddingLeft: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '6px', background: col.bg, color: col.color, fontWeight: 600, whiteSpace: 'nowrap' as const }}>{col.type}</span> {col.name}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', background: '#fafafe' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '5px' }}>
                🗄 Sprint Board <span style={{ fontSize: '10px', background: '#ede9fe', padding: '1px 5px', borderRadius: '8px' }}>DB</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#9ca3af', paddingLeft: '12px', marginTop: '4px' }}>2 columns (Status, Sprint)</div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '36px' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="#d1d5db"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/></svg>
        </div>

        {/* Right: KB */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '13px', height: '13px', borderRadius: '3px', background: PINK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: '7px', fontWeight: 900 }}>M</span>
            </div>
            Diagram Hub
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>9 Documents</div>
              {['api-architecture', 'database-schema', 'roadmap-2026', 'feature-specs', '5 more…'].map(p => (
                <div key={p} style={{ fontSize: '11.5px', color: '#6b7280', padding: '2px 0' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#9ca3af' }}>/imported/</span>{p}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', background: PINK_BG }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill={PINK}><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zM9 2.5A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zM1 10.5A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zM9 10.5A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>
                DB: Task Tracker
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '8px' }}>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#374151', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '6px', background: 'rgba(245,158,11,0.12)', color: '#d97706', fontWeight: 600 }}>status</span> Status
                  </div>
                  {['done', 'in-progress', 'todo'].map(tag => (
                    <div key={tag} style={{ fontSize: '10.5px', color: '#9ca3af', paddingLeft: '8px', fontFamily: 'monospace' }}>
                      /imported/task-tracker/status/{tag}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#374151', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '6px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 600 }}>multi-select</span> Tags
                  </div>
                  {['frontend', 'backend', 'infra'].map(tag => (
                    <div key={tag} style={{ fontSize: '10.5px', color: '#9ca3af', paddingLeft: '8px', fontFamily: 'monospace' }}>
                      /imported/task-tracker/tags/{tag}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: PINK_BG }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill={PINK}><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zM9 2.5A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zM1 10.5A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zM9 10.5A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>
                DB: Sprint Board
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', paddingLeft: '16px', marginTop: '3px' }}>2 columns → 2 KB columns</div>
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onNext}
        style={{ width: '100%', padding: '12px', borderRadius: '10px', cursor: 'pointer', background: PINK, border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = PINK_HOVER)}
        onMouseLeave={e => (e.currentTarget.style.background = PINK)}
      >
        Import 11 pages & 2 databases →
      </button>
    </div>
  )
}

// ─── Drive wizard ──────────────────────────────────────────────────────────

function DriveWizard({ step, onNext, onClose }: { step: number; onNext: () => void; onClose: () => void }) {
  if (step === 0) return <DriveAuth onNext={onNext} />
  if (step === 1) return <DriveBrowse onNext={onNext} />
  if (step === 2) return <DriveImporting onNext={onNext} />
  return <ImportDone source="Google Drive" docsCount={4} dbCount={0} onClose={onClose} />
}

function DriveAuth({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'done'>('idle')
  return (
    <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: '#e8f0fe', border: '1px solid #c5d9f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <DriveIcon size={36} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Connect Google Drive</div>
        <div style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6 }}>Browse and import markdown files, exported docs, and .mmd diagram files from any folder.</div>
      </div>
      <button
        onClick={() => { setStatus('connecting'); setTimeout(() => { setStatus('done'); setTimeout(onNext, 700) }, 1800) }}
        disabled={status !== 'idle'}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 28px', borderRadius: '10px', cursor: status === 'idle' ? 'pointer' : 'default', background: status === 'done' ? '#16a34a' : '#1a73e8', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', transition: 'background 0.2s' }}
      >
        {status === 'idle' && <><DriveIcon size={18} /><span>Sign in with Google</span></>}
        {status === 'connecting' && <><span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /><span>Connecting…</span></>}
        {status === 'done' && <span>✓ Connected</span>}
      </button>
    </div>
  )
}

const DRIVE_TREE = [
  { name: 'Engineering Docs', type: 'folder', children: [
    { name: 'architecture-overview.md', type: 'md', size: '12 KB' },
    { name: 'api-reference.md', type: 'md', size: '34 KB' },
    { name: 'deployment-guide.md', type: 'md', size: '8 KB' },
  ]},
  { name: 'Diagrams', type: 'folder', children: [
    { name: 'system-flow.mmd', type: 'mmd', size: '2 KB' },
    { name: 'db-schema.mmd', type: 'mmd', size: '3 KB' },
  ]},
]

function DriveBrowse({ onNext }: { onNext: () => void }) {
  const [sel, setSel] = useState(new Set(['architecture-overview.md', 'api-reference.md', 'system-flow.mmd', 'db-schema.mmd']))
  const toggle = (name: string) => setSel(prev => {
    const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next
  })
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '3px' }}>Select files to import</div>
      <div style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '16px' }}>Markdown (.md) and diagram (.mmd) files will be converted to KB documents</div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>My Drive</div>
        {DRIVE_TREE.map(folder => (
          <div key={folder.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
              <span>📁</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{folder.name}</span>
            </div>
            {folder.children?.map(child => (
              <div
                key={child.name}
                onClick={() => toggle(child.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px 9px 36px',
                  borderBottom: '1px solid #f9fafb', cursor: 'pointer', transition: 'background 0.08s',
                  background: sel.has(child.name) ? PINK_BG : '#fff',
                }}
                onMouseEnter={e => { if (!sel.has(child.name)) e.currentTarget.style.background = '#f9fafb' }}
                onMouseLeave={e => { if (!sel.has(child.name)) e.currentTarget.style.background = '#fff' }}
              >
                <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1.5px solid ${sel.has(child.name) ? PINK : '#d1d5db'}`, background: sel.has(child.name) ? PINK : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {sel.has(child.name) && <svg width="8" height="8" viewBox="0 0 16 16" fill="white"><path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>}
                </div>
                <span style={{ fontSize: '13px' }}>{child.type === 'mmd' ? '🔷' : '📝'}</span>
                <span style={{ fontSize: '13px', color: '#374151', flex: 1 }}>{child.name}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{child.size}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <button
        onClick={onNext}
        style={{ width: '100%', padding: '12px', borderRadius: '10px', cursor: 'pointer', background: PINK, border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = PINK_HOVER)}
        onMouseLeave={e => (e.currentTarget.style.background = PINK)}
      >Import {sel.size} selected files →</button>
    </div>
  )
}

function DriveImporting({ onNext }: { onNext: () => void }) {
  const files = ['architecture-overview.md', 'api-reference.md', 'system-flow.mmd', 'db-schema.mmd']
  const [done, setDone] = useState(0)
  useEffect(() => {
    let idx = 0
    const iv = setInterval(() => {
      idx++; setDone(idx)
      if (idx >= files.length) { clearInterval(iv); setTimeout(onNext, 700) }
    }, 600)
    return () => clearInterval(iv)
  }, [])
  return (
    <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Importing files…</span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>{Math.round((done / files.length) * 100)}%</span>
        </div>
        <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round((done / files.length) * 100)}%`, background: PINK, borderRadius: '3px', transition: 'width 0.4s ease' }} />
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {files.map((f, i) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: i < done ? '#16a34a' : '#9ca3af' }}>
            {i < done
              ? <svg width="14" height="14" viewBox="0 0 16 16" fill="#16a34a"><path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
              : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid #e5e7eb', flexShrink: 0 }} />}
            {f}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── GitHub wizard ────────────────────────────────────────────────────────

function GitHubWizard({ step, onNext, onClose }: { step: number; onNext: () => void; onClose: () => void }) {
  if (step === 0) return <GitHubConnectStep onNext={onNext} />
  if (step === 1) return <GitHubSelectRepo onNext={onNext} />
  if (step === 2) return <GitHubConfigure onNext={onNext} />
  return <GitHubDone onClose={onClose} />
}

function GitHubConnectStep({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'done'>('idle')
  return (
    <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: '#f6f8fa', border: '1px solid #d0d7de', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GitHubIcon size={36} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Connect GitHub</div>
        <div style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6 }}>Connect a repository to sync diagram files. When new commits arrive, a merge request is automatically created for review.</div>
      </div>
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { icon: '🔗', title: 'Push to repo', desc: 'Someone commits a .mmd or diagram file' },
          { icon: '🔔', title: 'MR created automatically', desc: 'A merge request appears in your KB for review' },
          { icon: '✓', title: 'Approve or reject', desc: 'Your team reviews the diff and decides' },
        ].map(item => (
          <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '11px 14px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{item.title}</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => { setStatus('connecting'); setTimeout(() => { setStatus('done'); setTimeout(onNext, 700) }, 1800) }}
        disabled={status !== 'idle'}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 28px', borderRadius: '10px', cursor: status === 'idle' ? 'pointer' : 'default', background: status === 'done' ? '#16a34a' : '#24292f', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', transition: 'background 0.2s' }}
      >
        {status === 'idle' && <><GitHubIcon size={18} /><span>Connect with GitHub</span></>}
        {status === 'connecting' && <><span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /><span>Connecting…</span></>}
        {status === 'done' && <span>✓ Connected</span>}
      </button>
    </div>
  )
}

const GH_REPOS = [
  { name: 'my-org/platform-docs', desc: 'Platform documentation and runbooks', stars: 12, updated: '2m ago', hasMmd: true },
  { name: 'my-org/api-specs', desc: 'OpenAPI specs and architecture diagrams', stars: 8, updated: '1h ago', hasMmd: true },
  { name: 'my-org/frontend', desc: 'React app — main product frontend', stars: 34, updated: '3h ago', hasMmd: false },
  { name: 'my-org/infra', desc: 'Terraform and infrastructure diagrams', stars: 5, updated: '1d ago', hasMmd: true },
]

function GitHubSelectRepo({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<string | null>('my-org/platform-docs')
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '3px' }}>Select a repository</div>
      <div style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '16px' }}>Repos with .mmd or diagram files are highlighted</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
        {GH_REPOS.map(repo => (
          <div
            key={repo.name}
            onClick={() => setSelected(repo.name)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', borderRadius: '10px', cursor: 'pointer',
              border: `1px solid ${selected === repo.name ? PINK_BORDER : '#e5e7eb'}`,
              background: selected === repo.name ? PINK_BG : '#fff',
              transition: 'all 0.12s',
            }}
          >
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${selected === repo.name ? PINK : '#d1d5db'}`, background: selected === repo.name ? PINK : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {selected === repo.name && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>{repo.name}</span>
                {repo.hasMmd && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: PINK_BG, color: PINK, border: `1px solid ${PINK_BORDER}`, fontWeight: 600 }}>.mmd</span>}
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{repo.desc}</div>
            </div>
            <div style={{ fontSize: '11.5px', color: '#9ca3af', flexShrink: 0, textAlign: 'right' as const }}>
              <div>★ {repo.stars}</div>
              <div>{repo.updated}</div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={!selected}
        style={{ width: '100%', padding: '12px', borderRadius: '10px', cursor: selected ? 'pointer' : 'not-allowed', background: selected ? PINK : '#e5e7eb', border: 'none', color: selected ? '#fff' : '#9ca3af', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', transition: 'background 0.15s' }}
        onMouseEnter={e => { if (selected) e.currentTarget.style.background = PINK_HOVER }}
        onMouseLeave={e => { if (selected) e.currentTarget.style.background = PINK }}
      >
        Continue with {selected ?? '—'} →
      </button>
    </div>
  )
}

function GitHubConfigure({ onNext }: { onNext: () => void }) {
  const [branch, setBranch] = useState('main')
  const [folder, setFolder] = useState('diagrams/')
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '3px' }}>Configure sync settings</div>
      <div style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '20px' }}>Set the branch and folder to watch for diagram changes</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Watch branch</label>
          <input value={branch} onChange={e => setBranch(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13.5px', border: '1px solid #e5e7eb', fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box' as const }} onFocus={e => (e.currentTarget.style.borderColor = PINK)} onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Diagrams folder</label>
          <input value={folder} onChange={e => setFolder(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13.5px', border: '1px solid #e5e7eb', fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box' as const }} onFocus={e => (e.currentTarget.style.borderColor = PINK)} onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '4px' }}>Leave blank to watch all .mmd files in the repo</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '8px' }}>What happens on push</div>
          {[
            { icon: '📡', text: `Webhook watches ${branch || 'main'} branch` },
            { icon: '🔍', text: `Scans ${folder || 'all '}*.mmd files for changes` },
            { icon: '🔀', text: 'Creates a merge request for each changed diagram' },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#374151', marginBottom: '5px' }}>
              <span>{item.icon}</span> {item.text}
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={onNext}
        style={{ width: '100%', padding: '12px', borderRadius: '10px', cursor: 'pointer', background: PINK, border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = PINK_HOVER)}
        onMouseLeave={e => (e.currentTarget.style.background = PINK)}
      >Activate sync →</button>
    </div>
  )
}

function GitHubDone({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 16 16" fill="#22c55e"><path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>GitHub connected!</div>
        <div style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6 }}>
          <strong>my-org/platform-docs</strong> is now synced. Any push to <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>main</code> will automatically create a merge request.
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: '380px', padding: '14px 16px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <GitHubIcon size={16} />
        <div style={{ fontSize: '12.5px', color: '#166534' }}>
          <div><strong>my-org/platform-docs</strong> · main · diagrams/</div>
          <div style={{ marginTop: '3px' }}><span style={{ color: '#22c55e', fontWeight: 600 }}>● Active</span> — watching for changes</div>
        </div>
      </div>
      <button onClick={onClose} style={{ padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', background: '#111827', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit' }}>Done</button>
    </div>
  )
}

// ─── Shared "import complete" screen ────────────────────────────────────────

function ImportDone({ source, docsCount, dbCount, onClose }: { source: string; docsCount: number; dbCount: number; onClose: () => void }) {
  return (
    <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 16 16" fill="#22c55e"><path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Import complete!</div>
        <div style={{ fontSize: '13.5px', color: '#6b7280' }}>Successfully imported from {source}.</div>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ padding: '16px 28px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', textAlign: 'center' as const }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827' }}>{docsCount}</div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Documents</div>
        </div>
        {dbCount > 0 && (
          <div style={{ padding: '16px 28px', borderRadius: '12px', background: PINK_BG, border: `1px solid ${PINK_BORDER}`, textAlign: 'center' as const }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: PINK }}>{dbCount}</div>
            <div style={{ fontSize: '12px', color: PINK, marginTop: '4px' }}>Databases</div>
          </div>
        )}
      </div>
      {dbCount > 0 && (
        <div style={{ width: '100%', maxWidth: '400px', padding: '12px 14px', borderRadius: '10px', background: '#fafafa', border: '1px solid #e5e7eb', fontSize: '11.5px', color: '#6b7280', lineHeight: 1.7 }}>
          Documents at <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 4px', borderRadius: '3px', fontSize: '11px' }}>/imported/notion/</span>
          <br />Tags created at <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 4px', borderRadius: '3px', fontSize: '11px' }}>/imported/task-tracker/status/*</span>
        </div>
      )}
      <button onClick={onClose} style={{ padding: '12px 32px', borderRadius: '10px', cursor: 'pointer', background: '#111827', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit' }}>
        Go to Diagram Hub
      </button>
    </div>
  )
}

// ── Inline SVG icon components ──────────────────────────────────────────────

function BookIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ flexShrink: 0 }}>
      <path d="M1.5 1.75A.75.75 0 012.25 1h10.5a.75.75 0 010 1.5H2.25A.75.75 0 011.5 1.75zM2.25 3.5a.75.75 0 000 1.5h10.5a.75.75 0 000-1.5H2.25zm-.75 4.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H2.25a.75.75 0 01-.75-.75zm.75 2.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z"/>
    </svg>
  )
}

function SettingsIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.18.502.28.433.268.97.286 1.47.712l.005-.002.924-.529c.099-.047.4-.099.512.047.372.48.695 1.008.95 1.572.064.163-.013.42-.097.525l-.717.892a1.342 1.342 0 00-.263 1.21c.032.133.049.27.049.413 0 .143-.017.28-.049.413-.09.37.009.81.263 1.21l.717.892c.085.106.16.362.097.525a6.588 6.588 0 01-.95 1.572c-.112.146-.413.094-.512.047l-.924-.53c-.499-.284-1.037-.266-1.47.002a5.07 5.07 0 01-.502.28c-.447.222-.85.629-.997 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.613 6.613 0 01-1.142 0c-.036-.003-.108-.036-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a4.502 4.502 0 01-.502-.28c-.433-.268-.97-.286-1.47-.002l-.924.53c-.099.047-.4.099-.512-.047a6.588 6.588 0 01-.95-1.572c-.064-.163.013-.42.097-.525l.717-.892c.254-.4.353-.84.263-1.21A3.459 3.459 0 014.5 8c0-.143.017-.28.049-.413.09-.37-.009-.81-.263-1.21l-.717-.892c-.085-.106-.16-.362-.097-.525.255-.565.578-1.092.95-1.572.112-.146.413-.094.512-.047l.924.53c.499.284 1.037.266 1.47-.002.161-.1.328-.194.502-.28.447-.222.85-.629.997-1.189l.289-1.105c.029-.11.101-.143.137-.146zM8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
    </svg>
  )
}

function DocsIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ flexShrink: 0 }}>
      <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V6h-2.75A1.75 1.75 0 019 4.25V1.5H3.75zm6.75.062V4.25c0 .138.112.25.25.25h2.688a.252.252 0 00-.011-.013L10.513 1.573a.248.248 0 00-.013-.011z"/>
    </svg>
  )
}

function FolderIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ flexShrink: 0 }}>
      <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3h-6.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.582 1 5.05 1H1.75z"/>
    </svg>
  )
}

function ExternalIcon({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M10.604 1h4.146a.25.25 0 01.25.25v4.146a.25.25 0 01-.427.177L13.03 4.03 9.28 7.78a.75.75 0 01-1.06-1.06l3.75-3.75-1.543-1.543A.25.25 0 0110.604 1zM3.75 2A1.75 1.75 0 002 3.75v8.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 12.25v-3.5a.75.75 0 00-1.5 0v3.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-8.5a.25.25 0 01.25-.25h3.5a.75.75 0 000-1.5h-3.5z"/>
    </svg>
  )
}

function GitHubIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  )
}

function JiraIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M15.83 0C11.73 7.77 13.22 13.34 17.1 17.23L24.04 24.17C27.11 21.4 27.44 16.65 24.78 13.5L15.83 0ZM8.73 7.83C5.4 11.05 5.07 16.3 8.02 19.5L15.94 27.42C12.87 30.19 8.12 30.52 4.97 27.86L0 23.3L8.73 7.83ZM15.94 27.42L20.91 32L31.96 21.58L22.06 21.58L15.94 27.42Z"/>
    </svg>
  )
}
