import React, { useState, useRef, useEffect } from 'react'
import type { Message } from '../App'

interface Props {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  currentCode: string
  apiKey: string
  onRequestKey: () => void
  onProposedCode: (code: string) => void
}

const SYSTEM_PROMPT = `You are an expert Mermaid diagram assistant embedded in Mermaid Studio — an AI-native diagram editor.

The user is working with a Mermaid diagram. Your job is to help them generate, modify, and understand diagrams.

IMPORTANT: Always respond with a valid JSON object in EXACTLY this format:
{"type":"code","content":"..."} for diagram changes
{"type":"message","content":"..."} for explanations

Rules:
- Use "code" type when the user wants to generate, create, modify, update, add, remove, or change a diagram
- Use "message" type when the user wants an explanation, description, or asks a question
- For "code" responses: content must be raw Mermaid syntax only (no markdown fences, no explanation text)
- Keep diagrams clean, well-labeled, and syntactically correct
- Default to flowchart LR for process flows, sequenceDiagram for API interactions
- Style important nodes with classDef or inline styles when appropriate
- Be creative but precise

The current diagram code will be provided in the user message context.`

const QUICK_ACTIONS = [
  { label: '✨ Generate', prompt: 'Generate a new diagram for: ' },
  { label: '🔍 Explain', prompt: 'Explain this diagram in plain language.' },
  { label: '🎨 Improve style', prompt: 'Improve the visual style of this diagram with better colors and formatting.' },
  { label: '➕ Add error handling', prompt: 'Add error handling paths to this diagram.' },
]

export default function AIPanel({ messages, setMessages, currentCode, apiKey, onRequestKey, onProposedCode }: Props) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    if (!apiKey) {
      onRequestKey()
      return
    }

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text.trim(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const contextualInput = `Current diagram:\n\`\`\`\n${currentCode}\n\`\`\`\n\nUser request: ${text.trim()}`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [
            ...messages
              .filter(m => m.id !== 'welcome' && !m.id.startsWith('load-') && !m.id.startsWith('new-'))
              .slice(-10)
              .map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: contextualInput },
          ],
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message || `API error ${response.status}`)
      }

      const data = await response.json()
      const rawContent: string = data.content[0].text

      // Parse the JSON response
      let parsed: { type: 'code' | 'message'; content: string }
      try {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { type: 'message', content: rawContent }
      } catch {
        // Fallback: detect if it looks like Mermaid code
        const mermaidKeywords = /^(flowchart|sequenceDiagram|graph|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline)/m
        const cleanContent = rawContent.replace(/```mermaid\n?/g, '').replace(/```/g, '').trim()
        parsed = {
          type: mermaidKeywords.test(cleanContent) ? 'code' : 'message',
          content: cleanContent,
        }
      }

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: parsed.type === 'code'
          ? 'I\'ve proposed changes to the diagram. Review and approve when ready.'
          : parsed.content,
        type: parsed.type,
        proposedCode: parsed.type === 'code' ? parsed.content : undefined,
      }

      setMessages(prev => [...prev, assistantMsg])

      if (parsed.type === 'code' && parsed.content) {
        onProposedCode(parsed.content)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${message}. Check your API key and try again.`,
        type: 'message',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div style={{
      width: '340px', minWidth: '340px', display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
      }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
        }}>✦</div>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>AI Assistant</span>
        {!apiKey && (
          <button
            onClick={onRequestKey}
            style={{
              marginLeft: 'auto', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer',
              background: 'var(--ai-dim)', border: '1px solid var(--ai)',
              color: 'var(--ai)', fontSize: '11px', fontWeight: 500,
            }}
          >
            Add key
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map(msg => (
          <div key={msg.id} className="fade-in" style={{
            display: 'flex', gap: '8px',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
              }}>✦</div>
            )}
            <div style={{
              maxWidth: '260px', padding: '8px 12px', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? 'var(--primary)' : 'var(--surface2)',
              color: msg.role === 'user' ? '#0d1117' : 'var(--text)',
              fontSize: '13px', lineHeight: '1.5',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
            }}>
              {msg.content}
              {msg.type === 'code' && msg.proposedCode && (
                <div style={{
                  marginTop: '8px', padding: '6px 8px', borderRadius: '4px',
                  background: 'rgba(0,0,0,0.3)', fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace", color: 'var(--primary)',
                  border: '1px solid var(--primary-glow)',
                  maxHeight: '80px', overflowY: 'auto',
                }}>
                  {msg.proposedCode.substring(0, 120)}{msg.proposedCode.length > 120 ? '...' : ''}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="fade-in" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '6px',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
            }}>✦</div>
            <div style={{
              padding: '10px 14px', borderRadius: '12px 12px 12px 2px',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              display: 'flex', gap: '4px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} className="loading-dot" style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: 'var(--ai)', display: 'inline-block',
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--border-subtle)',
        display: 'flex', flexWrap: 'wrap', gap: '4px', flexShrink: 0,
      }}>
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => {
              if (action.prompt.endsWith(': ')) {
                setInput(action.prompt)
                inputRef.current?.focus()
              } else {
                sendMessage(action.prompt)
              }
            }}
            style={{
              padding: '3px 8px', borderRadius: '4px', cursor: 'pointer',
              background: 'var(--surface3)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: '11px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.color = 'var(--text)'
              ;(e.target as HTMLButtonElement).style.borderColor = 'var(--ai)'
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.color = 'var(--text-muted)'
              ;(e.target as HTMLButtonElement).style.borderColor = 'var(--border)'
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px', borderTop: '1px solid var(--border)', flexShrink: 0,
        background: 'var(--surface2)',
      }}>
        <div style={{
          display: 'flex', gap: '8px', alignItems: 'flex-end',
          background: 'var(--surface3)', borderRadius: '10px',
          border: '1px solid var(--border)',
          padding: '8px 12px',
          transition: 'border-color 0.15s',
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--ai)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={apiKey ? 'Ask anything about this diagram...' : 'Add an API key to use AI features'}
            disabled={!apiKey || isLoading}
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', color: 'var(--text)',
              fontSize: '13px', resize: 'none', lineHeight: '1.5',
              maxHeight: '80px', overflowY: 'auto',
            }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 80) + 'px'
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading || !apiKey}
            style={{
              width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer',
              background: input.trim() && apiKey ? 'var(--ai)' : 'var(--surface)',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
              opacity: !input.trim() || isLoading || !apiKey ? 0.4 : 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill={input.trim() && apiKey ? '#fff' : 'var(--text-muted)'}>
              <path d="M1.5 1.5l13 6.5-13 6.5V9.5l9-3-9-3V1.5z" />
            </svg>
          </button>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '6px', textAlign: 'center' }}>
          Enter to send · Shift+Enter for newline
        </div>
      </div>
    </div>
  )
}
