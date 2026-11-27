import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Activity, ArrowRight, BarChart3, Bell, BookOpen, BriefcaseBusiness, Building2, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Code2, Database, Download,
  Edit3, ExternalLink, FileText, GraduationCap, HardDrive, LayoutDashboard,
  LayoutGrid, Mail, MapPin, Moon, MoreHorizontal, PanelRight, Plus, RefreshCw, Search, Sparkles, Sun,
  Trash2, Users, X
} from 'lucide-react'
import { avatarColors, chartColors } from './data/presets'
import CommandPalette from './components/CommandPalette'
import { AddEditModal, Avatar, ConfirmModal, HelpModal, ProfileModal, StatusBadge, StorageModal } from './components/Modals'
import JobsPage from './components/JobsPage'
import AiShortlistPage from './components/AiShortlistPage'
import DatabasePage from './components/DatabasePage'
import QueryLabPage from './components/QueryLabPage'
import ReportsPage from './components/ReportsPage'
import PaperTurnBackdrop from './components/PaperTurnBackdrop'
import ResumePaper3D from './components/ResumePaper3D'
import ResumeModeViewer from './components/ResumeModeViewer'
import './styles.css'

const NAV = [
  ['Overview', LayoutDashboard, 'Home'],
  ['Talent pool', Users, 'Talent'],
  ['Job openings', BriefcaseBusiness, 'Jobs'],
  ['AI Shortlist', Sparkles, 'Shortlist'],
  ['Database', Database, 'Schema'],
  ['Query lab', Code2, 'SQL'],
  ['Reports', BarChart3, 'Reports']
]

const MOBILE_PRIMARY_NAV = NAV.slice(0, 4)
const MOBILE_MORE_NAV = [
  ['Database', Database, 'Database Schema', 'Tables, indexes & 3D constellation'],
  ['Query lab', Code2, 'SQL Query Lab', 'Run read-only SQL & EXPLAIN plans'],
  ['Reports', BarChart3, 'Reports & Analytics', 'Skill demand & sourcing metrics']
]

const WORKSPACES = [
  { name: 'Northstar Studio', sub: 'Enterprise talent' },
  { name: 'Engineering Org', sub: 'Technical hiring' },
  { name: 'Campus Pipeline', sub: 'University recruiting' }
]

const STATUS_COLORS = { Active: 'var(--green)', 'In review': 'var(--orange)', Archived: 'var(--text-3)' }

function dateLabel(value) {
  if (!value) return 'just now'
  const days = Math.max(0, Math.floor((Date.now() - new Date(value)) / 86400000))
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`
}

function pageList(current, total) {
  const pages = []
  const start = Math.max(1, current - 1)
  const end = Math.min(total, current + 1)
  if (start > 1) { pages.push(1); if (start > 2) pages.push('…') }
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total) { if (end < total - 1) pages.push('…'); pages.push(total) }
  return pages
}

const withLook = (rows) => rows.map((x, i) => ({
  ...x,
  initials: x.name.split(' ').map(v => v[0]).join('').slice(0, 2).toUpperCase(),
  color: avatarColors[(Number(x.id) || i) % avatarColors.length]
}))

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('rv_theme_v2') || 'light')
  const [page, setPage] = useState('Overview')
  const [workspaceIdx, setWorkspaceIdx] = useState(0)
  const [menu, setMenu] = useState(null)
  const [unread, setUnread] = useState(true)

  const [health, setHealth] = useState({ status: 'checking', database: 'resume_vault', latencyMs: 0 })
  const [resumes, setResumes] = useState([])
  const [recent, setRecent] = useState([])
  const [totalResumes, setTotalResumes] = useState(0)
  const [stats, setStats] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [sortBy, setSortBy] = useState('updated_desc')
  const [viewMode, setViewMode] = useState('split')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [activityDays, setActivityDays] = useState(30)
  const [selectedId, setSelectedId] = useState(null)

  const [cmdOpen, setCmdOpen] = useState(false)
  const [activeProfile, setActiveProfile] = useState(null)
  const [editProfile, setEditProfile] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [storageOpen, setStorageOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [queryIdx, setQueryIdx] = useState(0)
  const [toast, setToast] = useState('')
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [paperTurn, setPaperTurn] = useState({ seq: 0, person: null })
  const [resumeMode, setResumeMode] = useState({ open: false, index: 0 })
  const navRef = useRef(null)
  const [navPill, setNavPill] = useState({ left: 0, width: 0, ready: false })

  const connected = health.status === 'connected'

  const resumePool = resumes.length ? resumes : recent

  const openResumeMode = useCallback((targetPerson) => {
    const pool = resumes.length ? resumes : recent
    if (!pool.length) {
      setToast('No resumes available for Resume Mode')
      setTimeout(() => setToast(''), 2600)
      return
    }
    const idx = targetPerson ? Math.max(0, pool.findIndex(r => r.id === targetPerson.id)) : 0
    setResumeMode({ open: true, index: idx })
  }, [resumes, recent])

  const triggerPaperTurn = useCallback((person) => {
    setPaperTurn(prev => ({ seq: prev.seq + 1, person: person || prev.person }))
  }, [])

  const openProfile = useCallback((person) => {
    if (!person) return
    setActiveProfile(person)
    triggerPaperTurn(person)
  }, [triggerPaperTurn])

  const selectCandidate = useCallback((person) => {
    if (!person) return
    setSelectedId(prev => {
      if (prev !== person.id) triggerPaperTurn(person)
      return person.id
    })
  }, [triggerPaperTurn])

  useLayoutEffect(() => {
    const updatePill = () => {
      const navEl = navRef.current
      if (!navEl) return
      const activeBtn = navEl.querySelector('.topnav-link.active')
      if (activeBtn) {
        setNavPill({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth, ready: true })
      }
    }
    updatePill()
    window.addEventListener('resize', updatePill)
    return () => window.removeEventListener('resize', updatePill)
  }, [page])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('rv_theme_v2', theme)
  }, [theme])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen(o => !o)
      }
      if (e.key === 'Escape') setMenu(null)
    }
    const onClick = () => setMenu(null)
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick)
    }
  }, [])

  const toggleMenu = (name) => (e) => {
    e.stopPropagation()
    setMenu(m => (m === name ? null : name))
  }

  const notify = useCallback((message) => {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const checkHealth = useCallback(async () => {
    try {
      const r = await fetch('/api/health')
      const data = await r.json()
      if (!r.ok || data.status !== 'connected') throw new Error('offline')
      setHealth(data)
      return true
    } catch {
      setHealth({ status: 'offline', database: 'resume_vault', latencyMs: 0 })
      return false
    }
  }, [])

  const loadResumes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        search, status: statusFilter, skill: skillFilter, sort: sortBy,
        page: String(currentPage), limit: String(pageSize)
      })
      const r = await fetch(`/api/resumes?${params}`)
      if (!r.ok) throw new Error('load failed')
      const json = await r.json()
      const rows = withLook(json.data || [])
      setResumes(rows)
      setTotalResumes(json.total || 0)
      setSelectedId(prev => (rows.some(x => x.id === prev) ? prev : rows[0]?.id ?? null))
    } catch {
      setResumes([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, skillFilter, sortBy, currentPage, pageSize])

  const loadStats = useCallback(async () => {
    try {
      const [sRes, aRes, rRes] = await Promise.all([
        fetch(`/api/stats?days=${activityDays}`),
        fetch('/api/audit-logs'),
        fetch('/api/resumes?limit=6&sort=updated_desc')
      ])
      if (sRes.ok) setStats(await sRes.json())
      if (aRes.ok) setAuditLogs(await aRes.json())
      if (rRes.ok) setRecent(withLook((await rRes.json()).data || []))
    } catch { }
  }, [activityDays])

  const refreshAll = useCallback(async () => {
    const ok = await checkHealth()
    if (ok) await Promise.all([loadResumes(), loadStats()])
    else setLoading(false)
  }, [checkHealth, loadResumes, loadStats])

  useEffect(() => { refreshAll() }, [refreshAll])
  useEffect(() => { setCurrentPage(1) }, [search, statusFilter, skillFilter, sortBy, pageSize])

  const saveProfile = async (form, id) => {
    if (!connected) throw new Error('PostgreSQL is offline. Start the API with npm run server.')
    const r = await fetch(id ? `/api/resumes/${id}` : '/api/resumes', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const result = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(result.details || result.error || 'Could not save profile')
    setAddOpen(false)
    setEditProfile(null)
    notify(id ? 'Profile updated in PostgreSQL' : 'Resume saved to PostgreSQL')
    refreshAll()
  }

  const updateStatus = async (id, nextStatus) => {
    const r = await fetch(`/api/resumes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    })
    if (r.ok) { notify(`Status set to ${nextStatus}`); refreshAll() }
    else notify('Could not update status')
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const r = await fetch(`/api/resumes/${deleteTarget.id}`, { method: 'DELETE' })
    if (r.ok) {
      notify(`${deleteTarget.name} deleted — cascade + audit logged`)
      setDeleteTarget(null)
      setActiveProfile(null)
      refreshAll()
    } else notify('Unable to delete resume')
  }

  const exportRows = () => {
    const lines = [
      ['ID', 'Name', 'Email', 'Role', 'Location', 'Experience', 'Status', 'Source', 'Skills'],
      ...resumes.map(r => [r.id, r.name, r.email, r.role, r.location, `${r.experience} yrs`, r.status, r.source, (r.skills || []).join('; ')])
    ]
    const csv = lines.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `resumevault-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    notify(`Exported ${resumes.length} profiles to CSV`)
  }

  const openSkillFilter = (skill) => {
    setSkillFilter(skill)
    setPage('Talent pool')
    notify(`Filtered by ${skill}`)
  }

  const summary = stats?.summary
  const topSkills = stats?.topSkills || []
  const totalPages = Math.max(1, Math.ceil(totalResumes / pageSize))
  const selected = resumes.find(r => r.id === selectedId) || null
  const ws = WORKSPACES[workspaceIdx]

  return (
    <div className="app">
      <PaperTurnBackdrop theme={theme} turnEvent={paperTurn} modalOpen={Boolean(activeProfile) || resumeMode.open} />

      <header className="appbar">
        <div className="appbar-inner">
          <button type="button" className="brand" onClick={() => setPage('Overview')}>
            <span className="brand-mark"><Database size={15} /></span>
            <span className="brand-name">ResumeVault</span>
          </button>

          <nav className="topnav" ref={navRef} aria-label="Primary">
            {navPill.ready && (
              <span
                className="topnav-pill"
                style={{ transform: `translateX(${navPill.left}px)`, width: `${navPill.width}px` }}
                aria-hidden="true"
              />
            )}
            {NAV.map(([label, Icon]) => (
              <button
                type="button"
                key={label}
                className={`topnav-link ${page === label ? 'active' : ''}`}
                onClick={() => setPage(label)}
              >
                <Icon size={15} strokeWidth={1.9} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="appbar-actions">
            <button type="button" className="search-trigger" onClick={() => setCmdOpen(true)}>
              <Search size={14} /><span>Search</span><kbd>Ctrl K</kbd>
            </button>

            <div className="pop-anchor">
              <button
                type="button"
                className={`db-pill ${connected ? 'ok' : 'down'}`}
                onClick={async (e) => { toggleMenu('health')(e); checkHealth() }}
                title="PostgreSQL connection"
              >
                <i /><span>{connected ? `${Math.round(Number(health.latencyMs) || 0)} ms` : 'Offline'}</span>
              </button>
              {menu === 'health' && (
                <div className="popover" onClick={e => e.stopPropagation()}>
                  <div className="popover-head">PostgreSQL</div>
                  <dl className="kv">
                    <dt>Status</dt><dd className={connected ? 'text-ok' : 'text-bad'}>{health.status}</dd>
                    <dt>Database</dt><dd>{health.database}</dd>
                    <dt>Server</dt><dd>{health.version || '—'}</dd>
                    <dt>Latency</dt><dd>{health.latencyMs} ms</dd>
                    <dt>Pool</dt><dd>{health.poolTotal ?? 0} open · {health.poolIdle ?? 0} idle</dd>
                  </dl>
                  <button type="button" className="btn btn-quiet btn-block" onClick={() => { checkHealth(); notify('Connection re-tested') }}>
                    <RefreshCw size={13} /> Re-test connection
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="bar-icon"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="pop-anchor">
              <button type="button" className="bar-icon" aria-label="Activity" onClick={(e) => { toggleMenu('notif')(e); setUnread(false) }}>
                <Bell size={16} />{unread && auditLogs.length > 0 && <i className="dot" />}
              </button>
              {menu === 'notif' && (
                <div className="popover popover-wide" onClick={e => e.stopPropagation()}>
                  <div className="popover-head">
                    <span>Database activity</span>
                    <button type="button" className="link" onClick={() => { setPage('Database'); setMenu(null) }}>View all</button>
                  </div>
                  <ul className="feed">
                    {auditLogs.slice(0, 6).map(log => (
                      <li key={log.id}>
                        <span className={`op op-${log.action.toLowerCase()}`}>{log.action}</span>
                        <span className="feed-text">{log.tableName} <b>#{log.recordId}</b></span>
                        <time>{dateLabel(log.changedAt)}</time>
                      </li>
                    ))}
                    {auditLogs.length === 0 && <li className="muted">No trigger events yet.</li>}
                  </ul>
                </div>
              )}
            </div>

            <div className="pop-anchor">
              <button type="button" className="me" onClick={toggleMenu('user')} aria-label="Account menu">
                <span className="me-avatar">AM</span>
                <ChevronDown size={14} />
              </button>
              {menu === 'user' && (
                <div className="popover popover-menu" onClick={e => e.stopPropagation()}>
                  <div className="me-card">
                    <span className="me-avatar lg">AM</span>
                    <div><b>Alex Morgan</b><small>Workspace admin</small></div>
                  </div>
                  <div className="menu-label">Workspace</div>
                  {WORKSPACES.map((w, i) => (
                    <button type="button" key={w.name} className="menu-item" onClick={() => { setWorkspaceIdx(i); setMenu(null); notify(`Switched to ${w.name}`) }}>
                      <span className="ws-dot">{w.name[0]}</span>
                      <span className="grow">{w.name}<small>{w.sub}</small></span>
                      {i === workspaceIdx && <Check size={14} />}
                    </button>
                  ))}
                  <div className="menu-sep" />
                  <button type="button" className="menu-item" onClick={() => { setStorageOpen(true); setMenu(null) }}><HardDrive size={14} /><span className="grow">Storage & maintenance</span></button>
                  <button type="button" className="menu-item" onClick={() => { refreshAll(); setMenu(null); notify('Synced with PostgreSQL') }}><RefreshCw size={14} /><span className="grow">Sync data</span></button>
                  <button type="button" className="menu-item" onClick={() => { setHelpOpen(true); setMenu(null) }}><CircleHelp size={14} /><span className="grow">Help & architecture</span></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        {page === 'Overview' && (
          <div className="page page-anim" key="overview">
            <PageHeader
              crumb={ws.name}
              title="Talent overview"
              subtitle={`Live from PostgreSQL · ${health.database}`}
              actions={<>
                <button type="button" className="btn btn-quiet" onClick={() => openResumeMode(recent[0] || resumes[0])}><BookOpen size={14} /> Resume mode</button>
                <button type="button" className="btn btn-quiet" onClick={exportRows}><Download size={14} /> Export</button>
                <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}><Plus size={15} /> Add resume</button>
              </>}
            />

            <section className="kpi-strip">
              <Kpi
                label="Resumes"
                value={(summary?.total_resumes ?? 0).toLocaleString()}
                note="total in resume_vault"
                onClick={() => { setSearch(''); setStatusFilter(''); setSkillFilter(''); setSortBy('updated_desc'); setPage('Talent pool') }}
              />
              <Kpi
                label="Active"
                value={(summary?.active_count ?? 0).toLocaleString()}
                note={`${Math.round(((summary?.active_count || 0) / Math.max(1, summary?.total_resumes || 1)) * 100)}% of pool`}
                tone="ok"
                onClick={() => { setSearch(''); setSkillFilter(''); setStatusFilter('Active'); setPage('Talent pool') }}
              />
              <Kpi
                label="In review"
                value={(summary?.review_count ?? 0).toLocaleString()}
                note="awaiting decision"
                tone="warn"
                onClick={() => { setSearch(''); setSkillFilter(''); setStatusFilter('In review'); setPage('Talent pool') }}
              />
              <Kpi
                label="Avg. experience"
                value={`${summary?.avg_experience ?? '0.0'}`}
                unit="yrs"
                note="across all resumes"
                onClick={() => { setSearch(''); setStatusFilter(''); setSkillFilter(''); setSortBy('experience_desc'); setPage('Talent pool') }}
              />
              <Kpi
                label="Open roles"
                value={summary?.open_jobs ?? 0}
                note={`${summary?.total_applications ?? 0} applications`}
                onClick={() => setPage('Job openings')}
              />
            </section>

            <div className="grid-2-1">
              <section className="card">
                <CardHead
                  title="Resume intake"
                  sub={`New resumes per day · last ${activityDays} days`}
                  right={
                    <div className="seg" role="tablist">
                      {[7, 30, 90].map(d => (
                        <button type="button" key={d} className={activityDays === d ? 'on' : ''} onClick={() => setActivityDays(d)}>{d}d</button>
                      ))}
                    </div>
                  }
                />
                <ActivityChart data={stats?.activity || []} />
              </section>

              <section className="card">
                <CardHead title="Pipeline status" sub="Share of resumes by status" />
                <PipelineBar data={stats?.statusBreakdown || []} onPick={(s) => { setStatusFilter(s); setPage('Talent pool') }} />
                <div className="divider" />
                <CardHead title="Top sources" sub="Where resumes come from" small />
                <ul className="mini-bars">
                  {(stats?.sources || []).slice(0, 5).map((s, i) => {
                    const max = Math.max(1, ...(stats?.sources || []).map(x => x.count))
                    return (
                      <li key={s.source}>
                        <span className="mini-label" title={s.source}>{s.source}</span>
                        <span className="mini-track"><i style={{ width: `${Math.max(4, (s.count / max) * 100)}%`, background: chartColors[i % chartColors.length] }} /></span>
                        <b>{s.count.toLocaleString()}</b>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </div>

            <div className="grid-1-1">
              <section className="card">
                <CardHead title="Most common skills" sub="Click a skill to filter candidates" right={<button type="button" className="link" onClick={() => setPage('Reports')}>Full report <ArrowRight size={13} /></button>} />
                <div className="skill-cloud">
                  {topSkills.slice(0, 12).map((s, i) => (
                    <button type="button" key={s.skill} className="skill-chip" onClick={() => openSkillFilter(s.skill)}>
                      <span className="chip-dot" style={{ background: chartColors[i % chartColors.length] }} />
                      {s.skill}<b>{s.count.toLocaleString()}</b>
                    </button>
                  ))}
                </div>
              </section>

              <section className="card">
                <CardHead title="Recent database events" sub="Captured by audit triggers" right={<button type="button" className="link" onClick={() => setPage('Database')}>Open database <ArrowRight size={13} /></button>} />
                <ul className="feed feed-card">
                  {auditLogs.slice(0, 6).map(log => (
                    <li key={log.id}>
                      <span className={`op op-${log.action.toLowerCase()}`}>{log.action}</span>
                      <span className="feed-text">{log.tableName} <b>#{log.recordId}</b></span>
                      <time>{dateLabel(log.changedAt)}</time>
                    </li>
                  ))}
                  {auditLogs.length === 0 && <li className="muted">No trigger events yet. Add or edit a resume to create one.</li>}
                </ul>
              </section>
            </div>

            <section className="card card-flush">
              <div className="card-pad">
                <CardHead title="Recently updated" sub="Latest candidate profiles" right={<button type="button" className="link" onClick={() => setPage('Talent pool')}>All candidates <ArrowRight size={13} /></button>} />
              </div>
              <RecentTable rows={recent} onOpen={openProfile} />
            </section>
          </div>
        )}

        {page === 'Talent pool' && (
          <div className="page page-wide page-anim" key="talent">
            <PageHeader
              crumb={ws.name}
              title="Talent pool"
              subtitle={`${totalResumes.toLocaleString()} candidates match your filters`}
              actions={<>
                <button type="button" className="btn btn-quiet" onClick={() => openResumeMode(selected || resumes[0])}><BookOpen size={14} /> Resume mode</button>
                <button type="button" className="btn btn-quiet" onClick={exportRows}><Download size={14} /> Export page</button>
                <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}><Plus size={15} /> Add resume</button>
              </>}
            />

            <div className="toolbar">
              <label className="field-search">
                <Search size={15} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, role, location or skill" />
                {search && <button type="button" className="clear" onClick={() => setSearch('')} aria-label="Clear search"><X size={13} /></button>}
              </label>

              <div className="seg" role="tablist" aria-label="Status filter">
                {[['', 'All'], ['Active', 'Active'], ['In review', 'In review'], ['Archived', 'Archived']].map(([v, l]) => (
                  <button type="button" key={l} className={statusFilter === v ? 'on' : ''} onClick={() => setStatusFilter(v)}>{l}</button>
                ))}
              </div>

              <select className="select" value={skillFilter} onChange={e => setSkillFilter(e.target.value)} aria-label="Filter by skill">
                <option value="">Any skill</option>
                {topSkills.map(s => <option key={s.skill} value={s.skill}>{s.skill} ({s.count})</option>)}
              </select>

              <select className="select" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort">
                <option value="updated_desc">Recently updated</option>
                <option value="experience_desc">Most experienced</option>
                <option value="experience_asc">Least experienced</option>
                <option value="name_asc">Name A–Z</option>
              </select>

              <div className="seg seg-icons" aria-label="Layout">
                <button type="button" className={viewMode === 'split' ? 'on' : ''} onClick={() => setViewMode('split')} title="List with preview"><PanelRight size={15} /></button>
                <button type="button" className={viewMode === 'grid' ? 'on' : ''} onClick={() => setViewMode('grid')} title="Card grid"><LayoutGrid size={15} /></button>
                <button type="button" onClick={() => openResumeMode(selected || resumes[0])} title="Full-screen 3D Resume Mode"><BookOpen size={15} /></button>
              </div>
            </div>

            {(search || statusFilter || skillFilter) && (
              <div className="filter-row">
                {search && <button type="button" className="tag-x" onClick={() => setSearch('')}>“{search}” <X size={12} /></button>}
                {statusFilter && <button type="button" className="tag-x" onClick={() => setStatusFilter('')}>Status: {statusFilter} <X size={12} /></button>}
                {skillFilter && <button type="button" className="tag-x" onClick={() => setSkillFilter('')}>Skill: {skillFilter} <X size={12} /></button>}
                <button type="button" className="link" onClick={() => { setSearch(''); setStatusFilter(''); setSkillFilter('') }}>Clear all</button>
              </div>
            )}

            <div className={`split ${viewMode === 'grid' ? 'split-grid' : ''}`}>
              <section className="card card-flush list-card">
                {loading ? (
                  <div className="skeletons">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" />)}</div>
                ) : resumes.length === 0 ? (
                  <div className="empty">
                    <Search size={20} />
                    <b>No candidates match</b>
                    <span>Try a different search or clear the filters.</span>
                  </div>
                ) : viewMode === 'split' ? (
                  <ul className="cand-list">
                    {resumes.map((r, idx) => (
                      <li key={r.id} style={{ '--i': Math.min(idx, 12) }}>
                        <button
                          type="button"
                          className={`cand-row ${r.id === selectedId ? 'selected' : ''}`}
                          onClick={() => {
                            if (window.innerWidth <= 960) openProfile(r)
                            else selectCandidate(r)
                          }}
                          onDoubleClick={() => openProfile(r)}
                        >
                          <Avatar person={r} />
                          <span className="cand-main">
                            <b>{r.name}</b>
                            <small>{r.role}</small>
                          </span>
                          <span className="cand-exp">{Number(r.experience).toFixed(1)}<small>yrs</small></span>
                          <StatusBadge status={r.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="cand-grid">
                    {resumes.map((r, idx) => (
                      <button type="button" className="cand-card" key={r.id} style={{ '--i': Math.min(idx, 12) }} onClick={() => openProfile(r)}>
                        <div className="cand-card-top">
                          <Avatar person={r} />
                          <StatusBadge status={r.status} />
                        </div>
                        <b>{r.name}</b>
                        <small className="clamp-1">{r.role}</small>
                        <span className="cand-card-meta"><MapPin size={12} /> {r.location || 'Remote'} · {Number(r.experience).toFixed(1)} yrs</span>
                        <span className="tags">{(r.skills || []).slice(0, 3).map(s => <span key={s} className="tag">{s}</span>)}</span>
                      </button>
                    ))}
                  </div>
                )}

                <footer className="list-foot">
                  <span>
                    {totalResumes ? ((currentPage - 1) * pageSize + 1).toLocaleString() : 0}–{Math.min(currentPage * pageSize, totalResumes).toLocaleString()} of {totalResumes.toLocaleString()}
                  </span>
                  <div className="pager">
                    <select className="select select-sm" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} aria-label="Rows per page">
                      <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
                    </select>
                    <button type="button" className="pg" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
                    {pageList(currentPage, totalPages).map((p, i) => p === '…'
                      ? <span key={`d${i}`} className="pg-dots">…</span>
                      : <button type="button" key={p} className={`pg ${p === currentPage ? 'on' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
                    )}
                    <button type="button" className="pg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
                  </div>
                </footer>
              </section>

              {viewMode === 'split' && (
                <CandidatePreview
                  person={selected}
                  theme={theme}
                  onPaperTurn={triggerPaperTurn}
                  onOpenResumeMode={openResumeMode}
                  onOpen={() => selected && openProfile(selected)}
                  onEdit={() => selected && setEditProfile(selected)}
                  onDelete={() => selected && setDeleteTarget(selected)}
                  onStatusChange={(s) => selected && updateStatus(selected.id, s)}
                />
              )}
            </div>
          </div>
        )}

        {page === 'Job openings' && <div className="page page-anim" key="jobs"><JobsPage resumes={recent.length ? [...recent, ...resumes.filter(r => !recent.some(x => x.id === r.id))] : resumes} connected={connected} onNotify={notify} /></div>}
        {page === 'AI Shortlist' && <div className="page page-anim" key="ai"><AiShortlistPage connected={connected} onSelectResume={openProfile} onNotify={notify} onRefresh={refreshAll} /></div>}
        {page === 'Database' && <div className="page page-anim" key="db"><DatabasePage connected={connected} theme={theme} /></div>}
        {page === 'Query lab' && <div className="page page-anim" key="sql"><QueryLabPage query={queryIdx} setQuery={setQueryIdx} connected={connected} onNotify={notify} /></div>}
        {page === 'Reports' && <div className="page page-anim" key="reports"><ReportsPage stats={stats} resumes={resumes} onSelectSkill={openSkillFilter} /></div>}
      </main>

      <footer className="statusbar">
        <span><i className={`led ${connected ? 'ok' : 'down'}`} /> {connected ? `Connected to ${health.database}` : 'PostgreSQL offline'}</span>
        <span className="statusbar-mid">{ws.name} · {(summary?.total_resumes ?? 0).toLocaleString()} resumes · {summary?.total_skills ?? 0} skills</span>
        <span className="statusbar-links">
          <button type="button" onClick={() => setHelpOpen(true)}>Help</button>
          <button type="button" onClick={() => setStorageOpen(true)}>Storage</button>
          <span>© 2026 ResumeVault</span>
        </span>
      </footer>

      {mobileMoreOpen && (
        <>
          <div className="mobile-more-backdrop" onClick={() => setMobileMoreOpen(false)} />
          <div className="mobile-more-sheet" role="menu" aria-label="More navigation">
            <div className="mobile-more-head">
              <span>DBMS &amp; Analytics</span>
              <button type="button" className="mobile-more-close" onClick={() => setMobileMoreOpen(false)} aria-label="Close menu">
                <X size={16} />
              </button>
            </div>
            <div className="mobile-more-list">
              {MOBILE_MORE_NAV.map(([label, Icon, title, desc]) => (
                <button
                  type="button"
                  key={label}
                  role="menuitem"
                  className={`mobile-more-item ${page === label ? 'active' : ''}`}
                  onClick={() => {
                    setPage(label)
                    setMobileMoreOpen(false)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <span className="mobile-more-icon"><Icon size={18} strokeWidth={2} /></span>
                  <span className="mobile-more-copy">
                    <b>{title}</b>
                    <small>{desc}</small>
                  </span>
                  <ChevronRight size={15} className="mobile-more-arrow" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {MOBILE_PRIMARY_NAV.map(([label, Icon, shortLabel]) => {
          const isActive = page === label && !mobileMoreOpen
          return (
            <button
              type="button"
              key={label}
              className={`mobile-tab ${isActive ? 'active' : ''}`}
              onClick={() => {
                setPage(label)
                setMobileMoreOpen(false)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              <span className="mobile-tab-icon"><Icon size={19} strokeWidth={isActive ? 2.2 : 1.75} /></span>
              <span>{shortLabel}</span>
            </button>
          )
        })}
        {(() => {
          const isMorePage = MOBILE_MORE_NAV.some(([label]) => label === page)
          const isActive = mobileMoreOpen || isMorePage
          return (
            <button
              type="button"
              className={`mobile-tab ${isActive ? 'active' : ''}`}
              aria-expanded={mobileMoreOpen}
              onClick={() => setMobileMoreOpen(v => !v)}
            >
              <span className="mobile-tab-icon"><MoreHorizontal size={19} strokeWidth={isActive ? 2.3 : 1.8} /></span>
              <span>More</span>
            </button>
          )
        })()}
      </nav>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        resumes={[...recent, ...resumes]}
        onNavigate={setPage}
        onSelectResume={openProfile}
        onSelectQuery={setQueryIdx}
        onOpenAdd={() => setAddOpen(true)}
      />

      {activeProfile && (
        <ProfileModal
          person={activeProfile}
          connected={connected}
          theme={theme}
          onPaperTurn={triggerPaperTurn}
          onOpenResumeMode={openResumeMode}
          onClose={() => setActiveProfile(null)}
          onStatusChange={updateStatus}
          onEdit={(p) => { setActiveProfile(null); setEditProfile(p) }}
          onDelete={(p) => setDeleteTarget(p)}
        />
      )}

      <ResumeModeViewer
        open={resumeMode.open}
        resumes={resumePool}
        initialIndex={resumeMode.index}
        theme={theme}
        onClose={() => setResumeMode(m => ({ ...m, open: false }))}
        onOpenProfile={openProfile}
      />

      {(addOpen || editProfile) && (
        <AddEditModal
          initialData={editProfile}
          onClose={() => { setAddOpen(false); setEditProfile(null) }}
          onSave={saveProfile}
        />
      )}

      {storageOpen && <StorageModal onClose={() => setStorageOpen(false)} onNotify={notify} onRefresh={refreshAll} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.name}?`}
          message="This runs DELETE on resumes. Skills, work history, education and applications for this resume are removed by ON DELETE CASCADE, and the trigger writes a DELETE row to audit_logs."
          confirmLabel="Delete profile"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  )
}

function PageHeader({ crumb, title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <div className="crumb">{crumb}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

function CardHead({ title, sub, right, small }) {
  return (
    <div className={`card-head ${small ? 'small' : ''}`}>
      <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      {right}
    </div>
  )
}

function Kpi({ label, value, unit, note, tone, onClick }) {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  const isFloat = typeof value === 'string' && value.includes('.')
  const [shown, setShown] = useState(Number.isFinite(numeric) ? numeric : value)

  useEffect(() => {
    if (!Number.isFinite(numeric)) {
      setShown(value)
      return
    }
    let raf = 0
    const startVal = Number.isFinite(Number(String(shown).replace?.(/,/g, ''))) ? Number(String(shown).replace(/,/g, '')) : 0
    const diff = numeric - startVal
    if (Math.abs(diff) < 0.001) {
      setShown(value)
      return
    }
    const startTime = performance.now()
    const dur = 520
    const step = (now) => {
      const t = Math.min(1, (now - startTime) / dur)
      const ease = 1 - Math.pow(1 - t, 3)
      const cur = startVal + diff * ease
      setShown(isFloat ? cur.toFixed(1) : Math.round(cur).toLocaleString())
      if (t < 1) raf = requestAnimationFrame(step)
      else setShown(value)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <button type="button" className={`kpi ${tone ? `kpi-${tone}` : ''} ${onClick ? 'kpi-clickable' : ''}`} onClick={onClick}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{shown}{unit && <small>{unit}</small>}</span>
      <span className="kpi-note">{note}</span>
    </button>
  )
}

function PipelineBar({ data, onPick }) {
  const total = Math.max(1, data.reduce((a, b) => a + b.count, 0))
  return (
    <div className="pipeline">
      <div className="pipeline-bar">
        {data.map(d => (
          <button
            type="button"
            key={d.status}
            style={{ width: `${(d.count / total) * 100}%`, background: STATUS_COLORS[d.status] || 'var(--text-3)' }}
            title={`${d.status}: ${d.count}`}
            onClick={() => onPick(d.status)}
          />
        ))}
      </div>
      <ul className="pipeline-legend">
        {data.map(d => (
          <li key={d.status}>
            <button type="button" onClick={() => onPick(d.status)}>
              <i style={{ background: STATUS_COLORS[d.status] || 'var(--text-3)' }} />
              <span>{d.status}</span>
              <b>{d.count.toLocaleString()}</b>
              <em>{Math.round((d.count / total) * 100)}%</em>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActivityChart({ data }) {
  const pts = data.length ? data : [{ day: '', additions: 0 }, { day: '', additions: 0 }]
  const maxVal = Math.max(4, ...pts.map(d => d.additions))
  const W = 720, H = 180
  const bw = W / pts.length
  const total = pts.reduce((a, b) => a + b.additions, 0)
  return (
    <div className="chart">
      <div className="chart-total"><b>{total.toLocaleString()}</b> resumes added in this period</div>
      <div className="chart-body">
        <div className="chart-y"><span>{maxVal}</span><span>{Math.round(maxVal / 2)}</span><span>0</span></div>
        <div className="chart-plot">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {[0, 0.5, 1].map(f => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="grid-line" />)}
            {pts.map((d, i) => {
              const h = (d.additions / maxVal) * (H - 4)
              return (
                <rect key={i} x={i * bw + bw * 0.18} y={H - h} width={bw * 0.64} height={Math.max(h, d.additions ? 2 : 0)} rx="2" className="bar">
                  <title>{`${String(d.day).slice(0, 10)} — ${d.additions} resumes`}</title>
                </rect>
              )
            })}
          </svg>
          <div className="chart-x">
            <span>{String(pts[0]?.day || '').slice(5, 10)}</span>
            <span>{String(pts[Math.floor(pts.length / 2)]?.day || '').slice(5, 10)}</span>
            <span>{String(pts[pts.length - 1]?.day || '').slice(5, 10)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecentTable({ rows, onOpen }) {
  if (!rows.length) return <div className="empty"><b>No resumes yet</b><span>Add one to get started.</span></div>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Candidate</th><th>Role</th><th>Experience</th><th>Skills</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onClick={() => onOpen(r)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen(r)}>
              <td><div className="who"><Avatar person={r} small /><div><b>{r.name}</b><small>{r.email}</small></div></div></td>
              <td><span className="clamp-1">{r.role}</span></td>
              <td className="num">{Number(r.experience).toFixed(1)} yrs</td>
              <td><span className="tags">{(r.skills || []).slice(0, 2).map(s => <span key={s} className="tag">{s}</span>)}{r.skills?.length > 2 && <span className="tag tag-more">+{r.skills.length - 2}</span>}</span></td>
              <td><StatusBadge status={r.status} /></td>
              <td className="muted">{dateLabel(r.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CandidatePreview({ person, theme, onPaperTurn, onOpenResumeMode, onOpen, onEdit, onDelete, onStatusChange }) {
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (!person?.id) return
    let cancelled = false
    setDetail(null)
    fetch(`/api/resumes/${person.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setDetail(d) })
      .catch(() => { })
    return () => { cancelled = true }
  }, [person?.id])

  if (!person) {
    return (
      <aside className="card preview preview-empty">
        <Users size={22} />
        <b>Select a candidate</b>
        <span>Their 3D resume folio &amp; preview appear here.</span>
      </aside>
    )
  }

  const d = { ...(detail || {}), ...person, skills: detail?.skills || person.skills || [] }

  return (
    <aside className="card preview preview-enter" key={person.id}>
      <ResumePaper3D person={d} theme={theme} height={224} onTurn={onPaperTurn} onFullscreen={onOpenResumeMode} />

      <div className="preview-head">
        <Avatar person={person} />
        <div className="grow">
          <h3>{d.name}</h3>
          <p>{d.role}</p>
        </div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onOpen}><ExternalLink size={13} /> Open</button>
      </div>

      <div className="seg seg-full" role="tablist" aria-label="Status">
        {['Active', 'In review', 'Archived'].map(s => (
          <button type="button" key={s} className={d.status === s ? 'on' : ''} onClick={() => d.status !== s && onStatusChange(s)}>{s}</button>
        ))}
      </div>

      <dl className="facts">
        <div><dt><Mail size={12} /> Email</dt><dd>{d.email}</dd></div>
        <div><dt><MapPin size={12} /> Location</dt><dd>{d.location || 'Remote'}</dd></div>
        <div><dt><BriefcaseBusiness size={12} /> Experience</dt><dd>{Number(d.experience).toFixed(1)} years</dd></div>
        <div><dt><FileText size={12} /> Source</dt><dd>{d.source}</dd></div>
      </dl>

      {d.summary && (
        <section className="preview-sec">
          <h4>Summary</h4>
          <p className="clamp-5">{d.summary}</p>
        </section>
      )}

      <section className="preview-sec">
        <h4>Skills · {d.skills.length}</h4>
        <span className="tags">
          {(detail?.skillDetails?.length ? detail.skillDetails : d.skills.map(n => ({ name: n }))).map(s => (
            <span key={s.name} className="tag">{s.name}{s.proficiency && <em> · {s.proficiency}</em>}</span>
          ))}
        </span>
      </section>

      {detail?.workExperience?.length > 0 && (
        <section className="preview-sec">
          <h4><Building2 size={12} /> Experience</h4>
          <ul className="timeline">
            {detail.workExperience.slice(0, 3).map(w => (
              <li key={w.experience_id}><b>{w.title}</b><span>{w.company} · {String(w.startedOn).slice(0, 4)}–{w.endedOn ? String(w.endedOn).slice(0, 4) : 'now'}</span></li>
            ))}
          </ul>
        </section>
      )}

      {detail?.education?.length > 0 && (
        <section className="preview-sec">
          <h4><GraduationCap size={12} /> Education</h4>
          <ul className="timeline">
            {detail.education.map(e => <li key={e.education_id}><b>{e.degree}</b><span>{e.institution}{e.graduationYear ? ` · ${e.graduationYear}` : ''}</span></li>)}
          </ul>
        </section>
      )}

      {detail?.applications?.length > 0 && (
        <section className="preview-sec">
          <h4><Activity size={12} /> Applications</h4>
          <ul className="timeline">
            {detail.applications.map(a => <li key={a.application_id}><b>{a.jobTitle}</b><span>{a.stage} · {a.department}</span></li>)}
          </ul>
        </section>
      )}

      <div className="preview-actions">
        <button type="button" className="btn btn-quiet" onClick={onEdit}><Edit3 size={14} /> Edit</button>
        <button type="button" className="btn btn-danger" onClick={onDelete}><Trash2 size={14} /> Delete</button>
      </div>
      <div className="preview-id">resume_id {d.id} · candidate_id {d.candidateId ?? '—'}</div>
    </aside>
  )
}
