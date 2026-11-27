import React, { useEffect, useState } from 'react'
import {
  BriefcaseBusiness, Building2, Check, Database, Download, Edit3,
  FilePlus2, GraduationCap, HardDrive, Layers, Mail, MapPin, Phone,
  Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, X
} from 'lucide-react'
import { sampleProfiles } from '../data/presets'
import ResumePaper3D from './ResumePaper3D'

export function Avatar({ person, small = false }) {
  const initials = person.initials || (person.name || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()
  return <span className={`avatar ${person.color || 'lilac'} ${small ? 'avatar-sm' : ''}`}>{initials}</span>
}

export function StatusBadge({ status }) {
  const cls = status === 'Active' ? 'active' : status === 'In review' ? 'review' : 'archived'
  return <span className={`status ${cls}`}><i />{status}</span>
}

function dateLabel(value) {
  if (!value) return 'just now'
  const d = new Date(value)
  const days = Math.max(0, Math.floor((Date.now() - d) / 86400000))
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
}

export function ProfileModal({
  person,
  onClose,
  onStatusChange,
  onEdit,
  onDelete,
  connected,
  theme = 'light',
  onPaperTurn,
  onOpenResumeMode
}) {
  const [tab, setTab] = useState('overview')
  const [paperSide, setPaperSide] = useState(1)
  const [detail, setDetail] = useState(person)
  const [loading, setLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    setDetail(person)
    setTab('overview')
    setPaperSide(1)
    if (!connected || !person?.id) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/resumes/${person.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data) {
          setDetail({ ...person, ...data })
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [person, connected])

  const handleStatus = async (nextStatus) => {
    if (nextStatus === detail.status) return
    setUpdatingStatus(true)
    try {
      await onStatusChange(detail.id, nextStatus)
      setDetail(prev => ({ ...prev, status: nextStatus }))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const downloadSummary = () => {
    const lines = [
      `RESUME SUMMARY — ${detail.name}`,
      `Role: ${detail.role}`,
      `Status: ${detail.status} | Experience: ${Number(detail.experience).toFixed(1)} years`,
      `Email: ${detail.email} | Phone: ${detail.phone || 'N/A'} | Location: ${detail.location || 'N/A'}`,
      `Source: ${detail.source}`,
      '',
      'SUMMARY',
      detail.summary || 'No summary provided.',
      '',
      'SKILLS',
      (detail.skills || []).join(', ') || 'None listed',
      '',
      'WORK EXPERIENCE',
      ...(detail.workExperience?.length
        ? detail.workExperience.map(w => `- ${w.title} at ${w.company} (${String(w.startedOn).slice(0, 10)} to ${w.endedOn ? String(w.endedOn).slice(0, 10) : 'Present'}): ${w.description || ''}`)
        : ['No detailed work history recorded.']),
      '',
      'EDUCATION',
      ...(detail.education?.length
        ? detail.education.map(e => `- ${e.degree} ${e.field ? `in ${e.field}` : ''} — ${e.institution} (${e.graduationYear || 'N/A'})`)
        : ['No education records attached.'])
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${detail.name.toLowerCase().replace(/\s+/g, '-')}-resume.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="modal-backdrop modal-backdrop-paper" onMouseDown={onClose}>
      <div className="profile-split-shell" onMouseDown={e => e.stopPropagation()}>
        <div className="modal profile-modal">
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal"><X size={17} /></button>

          <div className="profile-hero">
            <Avatar person={detail} />
            <div className="profile-hero-info">
              <h2>{detail.name}</h2>
              <span>{detail.role}</span>
            </div>
            <div className="profile-status-switch">
              {['Active', 'In review', 'Archived'].map(s => (
                <button
                  key={s}
                  type="button"
                  disabled={updatingStatus}
                  onClick={() => handleStatus(s)}
                  className={`status-chip ${detail.status === s ? 'selected' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-tabs">
            {[
              ['overview', 'Overview', 1, false],
              ['paper', '3D Resume', 1, true],
              ['history', 'Experience & Edu', 2, false],
              ['apps', `Applications (${detail.applications?.length || 0})`, 2, false],
              ['raw', 'Raw DB Row', 2, false]
            ].map(([key, label, targetSide, mobileOnly]) => (
              <button
                key={key}
                type="button"
                className={`modal-tab ${tab === key ? 'active' : ''} ${mobileOnly ? 'mobile-only-tab' : ''}`}
                onClick={() => {
                  setTab(key)
                  setPaperSide(targetSide)
                }}
              >
                {label}
              </button>
            ))}
          </div>

        {tab === 'paper' && (
          <div className="profile-mobile-paper-tab">
            <ResumePaper3D
              person={detail}
              theme={theme}
              tall
              controlledSide={paperSide}
              onTurn={(_, nextSide) => {
                if (nextSide) setPaperSide(nextSide)
                onPaperTurn?.(detail)
              }}
              onFullscreen={onOpenResumeMode ? () => { onClose(); onOpenResumeMode(detail) } : undefined}
            />
          </div>
        )}

        {tab === 'overview' && (
          <>
            <div className="profile-detail-grid">
              <div><small><Mail size={11} /> EMAIL</small><b>{detail.email}</b></div>
              <div><small><MapPin size={11} /> LOCATION</small><b>{detail.location || 'Remote'}</b></div>
              <div><small><BriefcaseBusiness size={11} /> EXPERIENCE</small><b>{Number(detail.experience).toFixed(1)} years</b></div>
              <div><small><Phone size={11} /> PHONE / SOURCE</small><b>{detail.phone || detail.source}</b></div>
            </div>
            {detail.summary && (
              <div className="profile-summary-box">
                <small>CANDIDATE SUMMARY</small>
                <p>{detail.summary}</p>
              </div>
            )}
            <div className="profile-skills">
              <small>NORMALIZED SKILLS · {detail.skills?.length || 0}</small>
              <div className="tag-list">
                {(detail.skillDetails?.length ? detail.skillDetails : (detail.skills || []).map(name => ({ name }))).map(s => (
                  <span className="skill-tag" key={s.name}>
                    {s.name}{s.proficiency ? <em className="skill-prof"> · {s.proficiency}</em> : null}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'history' && (
          <div className="profile-history-tab">
            {loading && <div className="loading-note">Loading relational child tables...</div>}
            <div className="history-section">
              <small><Building2 size={12} /> WORK EXPERIENCE</small>
              {detail.workExperience?.length ? detail.workExperience.map(w => (
                <div className="history-card" key={w.experience_id}>
                  <div className="history-head">
                    <b>{w.title}</b>
                    <span>{String(w.startedOn).slice(0, 7)} — {w.endedOn ? String(w.endedOn).slice(0, 7) : 'Present'}</span>
                  </div>
                  <div className="history-sub">{w.company}</div>
                  {w.description && <p>{w.description}</p>}
                </div>
              )) : <div className="empty-mini">No work history rows attached to this resume_id.</div>}
            </div>
            <div className="history-section">
              <small><GraduationCap size={12} /> EDUCATION</small>
              {detail.education?.length ? detail.education.map(ed => (
                <div className="history-card" key={ed.education_id}>
                  <div className="history-head">
                    <b>{ed.degree}{ed.field ? ` · ${ed.field}` : ''}</b>
                    <span>{ed.graduationYear || '—'}</span>
                  </div>
                  <div className="history-sub">{ed.institution}</div>
                </div>
              )) : <div className="empty-mini">No education rows attached to this resume_id.</div>}
            </div>
          </div>
        )}

        {tab === 'apps' && (
          <div className="profile-history-tab">
            {detail.applications?.length ? detail.applications.map(a => (
              <div className="history-card" key={a.application_id}>
                <div className="history-head">
                  <b>{a.jobTitle}</b>
                  <span className="stage-pill">{a.stage}</span>
                </div>
                <div className="history-sub">{a.department} · {a.jobLocation}</div>
              </div>
            )) : <div className="empty-mini">This candidate has not been linked to any job opening yet. Go to Job openings to assign them.</div>}
          </div>
        )}

        {tab === 'raw' && (
          <pre className="raw-json">
            {JSON.stringify({
              resume_id: detail.id,
              candidate_id: detail.candidateId,
              full_name: detail.name,
              email: detail.email,
              current_title: detail.role,
              experience_years: Number(detail.experience),
              status: detail.status,
              skills: detail.skills
            }, null, 2)}
          </pre>
        )}

          <div className="profile-foot">
            <span><Database size={13} /> Resume ID · {detail.id} · Updated {dateLabel(detail.updatedAt).toLowerCase()}</span>
            <div className="profile-foot-actions">
              <button type="button" className="button-secondary btn-sm" onClick={downloadSummary}>
                <Download size={13} /> Summary
              </button>
              <button type="button" className="button-secondary btn-sm" onClick={() => onEdit(detail)}>
                <Edit3 size={13} /> Edit
              </button>
              <button type="button" className="button-danger btn-sm" onClick={() => onDelete(detail)}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        </div>

        <aside className="profile-paper-pane" aria-label="Live 3D Resume Preview">
          <ResumePaper3D
            person={detail}
            theme={theme}
            tall
            controlledSide={paperSide}
            onTurn={(_, nextSide) => {
              if (nextSide) setPaperSide(nextSide)
              onPaperTurn?.(detail)
            }}
            onFullscreen={onOpenResumeMode ? () => { onClose(); onOpenResumeMode(detail) } : undefined}
          />
        </aside>
      </div>
    </div>
  )
}

export function AddEditModal({ initialData, onClose, onSave }) {
  const isEdit = Boolean(initialData?.id)
  const [form, setForm] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    role: initialData?.role || '',
    location: initialData?.location || '',
    experience: initialData?.experience ?? '',
    skills: Array.isArray(initialData?.skills) ? initialData.skills.join(', ') : (initialData?.skills || ''),
    source: initialData?.source || 'Direct upload',
    status: initialData?.status || 'Active',
    summary: initialData?.summary || '',
    company: '',
    jobTitle: '',
    institution: '',
    degree: '',
    graduationYear: ''
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [sampleIdx, setSampleIdx] = useState(0)

  const fillSample = () => {
    const sample = sampleProfiles[sampleIdx % sampleProfiles.length]
    setForm(sample)
    setSampleIdx(i => i + 1)
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.includes('@') || !form.role.trim()) {
      setError('Full name, valid email address, and current role are required.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSave({
        ...form,
        experience: Number(form.experience) || 0,
        skills: form.skills.split(',').map(x => x.trim()).filter(Boolean)
      }, initialData?.id)
    } catch (err) {
      setError(err.message || 'Unable to save this profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal add-modal" onSubmit={submit} onMouseDown={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}><X size={17} /></button>
        <div className="modal-top-row">
          <div>
            <div className="modal-kicker"><FilePlus2 size={14} /> {isEdit ? 'EDIT PROFILE' : 'TRANSACTIONAL INTAKE'}</div>
            <h2>{isEdit ? `Edit ${initialData.name}` : 'Add a resume'}</h2>
          </div>
          {!isEdit && (
            <button type="button" className="button-secondary btn-sm" onClick={fillSample}>
              <Sparkles size={13} /> Fill Sample
            </button>
          )}
        </div>
        <p>{isEdit ? 'Updates candidate, resume, and skill mappings in PostgreSQL.' : 'Writes candidate, resume, skills, and history in a single PostgreSQL BEGIN/COMMIT transaction.'}</p>

        <div className="form-grid">
          <label>Full name *
            <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jamie Rivera" />
          </label>
          <label>Email address *
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="jamie@example.com" />
          </label>
          <label>Current role *
            <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Full-Stack Engineer" />
          </label>
          <label>Location
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="City, Country" />
          </label>
          <label>Experience (years)
            <input type="number" min="0" step="0.5" value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} placeholder="4.5" />
          </label>
          <label>Status
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="In review">In review</option>
              <option value="Archived">Archived</option>
            </select>
          </label>
          <label className="span-2">Skills <small>comma separated</small>
            <input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="React, PostgreSQL, TypeScript, Python" />
          </label>
          <label className="span-2">Summary
            <textarea rows={2} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Brief professional summary..." />
          </label>
          {!isEdit && (
            <>
              <label>Recent company <small>optional</small>
                <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. Stripe" />
              </label>
              <label>Past job title <small>optional</small>
                <input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} placeholder="e.g. Software Engineer" />
              </label>
              <label>University / Institution <small>optional</small>
                <input value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} placeholder="e.g. K.R. Mangalam University" />
              </label>
              <label>Degree <small>optional</small>
                <input value={form.degree} onChange={e => setForm({ ...form, degree: e.target.value })} placeholder="e.g. B.Tech CSE" />
              </label>
            </>
          )}
        </div>

        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="button-primary" disabled={saving}>
            {isEdit ? <Check size={16} /> : <Plus size={16} />}
            {saving ? 'Saving…' : isEdit ? 'Update profile' : 'Save to PostgreSQL'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function StorageModal({ onClose, onNotify, onRefresh }) {
  const [schema, setSchema] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    fetch('/api/schema')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setSchema(d))
      .catch(() => {})
  }

  useEffect(() => { load() }, [])

  const runAnalyze = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/database/analyze', { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      onNotify(data.message)
      load()
    } catch (e) {
      onNotify(e.message || 'ANALYZE failed')
    } finally {
      setBusy(false)
    }
  }

  const runSeed = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/database/seed', { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      onNotify(data.message)
      load()
      onRefresh()
    } catch (e) {
      onNotify(e.message || 'Seed failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal storage-modal" onMouseDown={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}><X size={17} /></button>
        <div className="modal-kicker"><HardDrive size={14} /> POSTGRESQL STORAGE</div>
        <h2>Database storage & maintenance</h2>
        <p>Live relation sizes from <code>pg_stat_user_tables</code> and <code>pg_database_size()</code>.</p>

        <div className="storage-summary-box">
          <div><small>TOTAL DATABASE SIZE</small><b>{schema?.databaseSize?.db_size || '—'}</b></div>
          <div><small>TRACKED TABLES</small><b>{schema?.tables?.length || 9} tables</b></div>
        </div>

        <div className="storage-table-list">
          {(schema?.tables || []).map(t => (
            <div className="storage-table-row" key={t.table_name}>
              <span>{t.table_name}</span>
              <small>{t.row_count} rows</small>
              <b>{t.total_size}</b>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="button-secondary" disabled={busy} onClick={runSeed}>
            <Database size={14} /> Re-seed Dataset
          </button>
          <button type="button" className="button-primary" disabled={busy} onClick={runAnalyze}>
            <RefreshCw size={14} /> Run ANALYZE
          </button>
        </div>
      </div>
    </div>
  )
}

export function HelpModal({ onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal help-modal" onMouseDown={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}><X size={17} /></button>
        <div className="modal-kicker"><ShieldCheck size={14} /> DBMS CAPSTONE GUIDE</div>
        <h2>ResumeVault Architecture</h2>
        <p>Every feature in this workspace maps directly to a core relational database concept in PostgreSQL 14+.</p>
        <div className="help-grid">
          <div className="help-card">
            <b><Layers size={15} /> 3NF Normalization</b>
            <span>Candidates, resumes, and skills are separated so email or skill updates never create anomalies.</span>
          </div>
          <div className="help-card">
            <b><Database size={15} /> ACID Transactions</b>
            <span>Adding or editing a resume runs inside <code>BEGIN ... COMMIT</code> with automatic <code>ROLLBACK</code> on error.</span>
          </div>
          <div className="help-card">
            <b><ShieldCheck size={15} /> Cascading Integrity</b>
            <span>Deleting a resume cascades cleanly to <code>resume_skills</code>, <code>work_experience</code>, <code>education</code>, and <code>applications</code>.</span>
          </div>
          <div className="help-card">
            <b><Sparkles size={15} /> Audit Triggers</b>
            <span><code>AFTER INSERT/UPDATE/DELETE</code> triggers automatically log every resume mutation into <code>audit_logs</code>.</span>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="button-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div className="modal confirm-modal" onMouseDown={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="button-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
