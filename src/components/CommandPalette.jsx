import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Code2, Database, FilePlus2, LayoutDashboard, Search, Sparkles, Users, BriefcaseBusiness, BarChart3, X } from 'lucide-react'
import { queryPresets } from '../data/presets'

export default function CommandPalette({ open, onClose, resumes, onNavigate, onSelectResume, onSelectQuery, onOpenAdd }) {
  const [term, setTerm] = useState('')
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    if (open) {
      setTerm('')
      setCursor(0)
    }
  }, [open])

  const items = useMemo(() => {
    const q = term.trim().toLowerCase()
    const pages = [
      { id: 'nav-overview', type: 'Page', title: 'Overview Dashboard', sub: 'KPIs, activity chart, recent resumes', icon: LayoutDashboard, action: () => onNavigate('Overview') },
      { id: 'nav-talent', type: 'Page', title: 'Talent Pool Directory', sub: 'Search, filter and manage all candidates', icon: Users, action: () => onNavigate('Talent pool') },
      { id: 'nav-jobs', type: 'Page', title: 'Job Openings & Pipeline', sub: 'Manage roles and applicant stages', icon: BriefcaseBusiness, action: () => onNavigate('Job openings') },
      { id: 'nav-ai', type: 'Page', title: 'AI Auto-Shortlist', sub: 'Auto-rank resumes for every open job', icon: Sparkles, action: () => onNavigate('AI Shortlist') },
      { id: 'nav-db', type: 'Page', title: 'Database & Schema Explorer', sub: '3NF tables, ER map, audit logs', icon: Database, action: () => onNavigate('Database') },
      { id: 'nav-sql', type: 'Page', title: 'SQL Query Lab', sub: 'Run live PostgreSQL queries & EXPLAIN', icon: Code2, action: () => onNavigate('Query lab') },
      { id: 'nav-reports', type: 'Page', title: 'Reports & Analytics', sub: 'Skill demand and source breakdown', icon: BarChart3, action: () => onNavigate('Reports') },
      { id: 'act-add', type: 'Action', title: 'Add New Resume', sub: 'Open candidate intake transaction modal', icon: FilePlus2, action: () => onOpenAdd() }
    ]

    const matchedPages = pages.filter(p => !q || `${p.title} ${p.sub}`.toLowerCase().includes(q))
    const matchedResumes = resumes
      .filter(r => !q || `${r.name} ${r.role} ${r.email} ${(r.skills || []).join(' ')}`.toLowerCase().includes(q))
      .slice(0, q ? 8 : 4)
      .map(r => ({
        id: `res-${r.id}`,
        type: 'Candidate',
        title: r.name,
        sub: `${r.role} · ${(r.skills || []).slice(0, 3).join(', ')}`,
        icon: Users,
        action: () => onSelectResume(r)
      }))

    const matchedQueries = queryPresets
      .filter(qp => !q || `${qp.title} ${qp.tag} ${qp.desc}`.toLowerCase().includes(q))
      .slice(0, 3)
      .map((qp, idx) => ({
        id: `q-${qp.n}`,
        type: 'SQL Query',
        title: qp.title,
        sub: qp.tag,
        icon: Code2,
        action: () => {
          onSelectQuery(idx)
          onNavigate('Query lab')
        }
      }))

    return [...matchedResumes, ...matchedPages, ...matchedQueries]
  }, [term, resumes, onNavigate, onSelectResume, onSelectQuery, onOpenAdd])

  useEffect(() => {
    setCursor(0)
  }, [term])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor(c => Math.min(items.length - 1, c + 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor(c => Math.max(0, c - 1))
      }
      if (e.key === 'Enter' && items[cursor]) {
        e.preventDefault()
        items[cursor].action()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, cursor, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="cmd-palette" onMouseDown={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Search size={17} />
          <input
            autoFocus
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Search candidates, skills, pages, or SQL presets..."
          />
          <button type="button" className="icon-ghost" onClick={onClose} aria-label="Close search">
            <X size={16} />
          </button>
        </div>
        <div className="cmd-list">
          {items.length === 0 && (
            <div className="cmd-empty">No matching candidates, pages, or queries.</div>
          )}
          {items.map((item, idx) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={`cmd-item ${idx === cursor ? 'cmd-active' : ''}`}
                onMouseEnter={() => setCursor(idx)}
                onClick={() => { item.action(); onClose() }}
              >
                <span className="cmd-item-icon"><Icon size={15} /></span>
                <span className="cmd-item-copy">
                  <b>{item.title}</b>
                  <small>{item.sub}</small>
                </span>
                <span className="cmd-type">{item.type}</span>
                <ArrowRight size={13} className="cmd-arrow" />
              </button>
            )
          })}
        </div>
        <div className="cmd-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
