import React, { useCallback, useEffect, useState } from 'react'
import {
  BriefcaseBusiness, Building2, Check, CheckCircle2, ChevronDown, ChevronRight,
  ListFilter, MapPin, RefreshCw, RotateCcw, Sparkles, UserCheck, UserPlus
} from 'lucide-react'
import { avatarColors } from '../data/presets'
import { Avatar, StatusBadge } from './Modals'

const DEFAULTS = {
  minExperience: 2,
  statusMode: 'active_review',
  sortBy: 'skills_desc',
  customSkills: ''
}

export default function AiShortlistPage({ connected, onSelectResume, onNotify, onRefresh }) {
  const [criteria, setCriteria] = useState(DEFAULTS)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState('')

  // Minimized by default: map of jobId -> boolean (true = expanded)
  const [expandedJobs, setExpandedJobs] = useState({})
  // Full list loaded per job: map of jobId -> { candidates: [], loading: boolean }
  const [fullLists, setFullLists] = useState({})
  // Manual checkbox selections: Set of "jobId:resumeId"
  const [selected, setSelected] = useState(() => new Set())

  const runShortlist = useCallback(async (override) => {
    if (!connected) return
    const payload = override || criteria
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/ai-shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, topN: 5 })
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || 'Shortlisting failed')
      setData(json)
      setFullLists({})
      setSelected(new Set())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [connected, criteria])

  useEffect(() => {
    if (connected) runShortlist(DEFAULTS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected])

  const toggleExpand = (jobId) => {
    setExpandedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }))
  }

  const openEntireList = async (jobId) => {
    setExpandedJobs(prev => ({ ...prev, [jobId]: true }))
    setFullLists(prev => ({ ...prev, [jobId]: { ...(prev[jobId] || {}), loading: true } }))
    try {
      const r = await fetch('/api/ai-shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...criteria, jobId, topN: 500 })
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || 'Unable to load full list')
      const entry = json.jobs?.[0]
      setFullLists(prev => ({
        ...prev,
        [jobId]: { candidates: entry?.shortlisted || [], loading: false }
      }))
    } catch (e) {
      onNotify(e.message)
      setFullLists(prev => ({ ...prev, [jobId]: { ...(prev[jobId] || {}), loading: false } }))
    }
  }

  const collapseToTop5 = (jobId) => {
    setFullLists(prev => {
      const next = { ...prev }
      delete next[jobId]
      return next
    })
  }

  const toggleSelect = (jobId, resumeId) => {
    const key = `${jobId}:${resumeId}`
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAllInJob = (jobId, rows) => {
    const selectable = rows.filter(c => !c.pipelineStage)
    const allChecked = selectable.length > 0 && selectable.every(c => selected.has(`${jobId}:${c.id}`))
    setSelected(prev => {
      const next = new Set(prev)
      for (const c of selectable) {
        const key = `${jobId}:${c.id}`
        if (allChecked) next.delete(key)
        else next.add(key)
      }
      return next
    })
  }

  const shortlistAssignments = async (assignments, label) => {
    if (!assignments.length) {
      onNotify('Select at least one candidate first')
      return
    }
    setAssigning(true)
    try {
      const r = await fetch('/api/ai-shortlist/apply-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments })
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || 'Shortlist failed')
      onNotify(label || json.message)
      await runShortlist(criteria)
      onRefresh?.()
    } catch (e) {
      onNotify(e.message)
    } finally {
      setAssigning(false)
    }
  }

  const shortlistSelectedGlobal = () => {
    const items = [...selected].map(key => {
      const [jobId, resumeId] = key.split(':')
      return { jobId: Number(jobId), resumeId: Number(resumeId) }
    })
    shortlistAssignments(items, `Shortlisted ${items.length} selected candidate(s)`)
  }

  const resetFilters = () => {
    setCriteria(DEFAULTS)
    runShortlist(DEFAULTS)
    onNotify('Filters reset')
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><Sparkles size={13} /> JOB SHORTLISTER</div>
          <h1>Shortlist by job opening</h1>
          <p>Filter candidates from PostgreSQL and manually select who to shortlist for each open role.</p>
        </div>
        <div className="heading-actions">
          {selected.size > 0 && (
            <button type="button" className="btn btn-primary" disabled={assigning} onClick={shortlistSelectedGlobal}>
              <UserCheck size={14} /> Shortlist selected ({selected.size})
            </button>
          )}
          <button type="button" className="btn btn-quiet" disabled={loading || !connected} onClick={() => runShortlist()}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <section className="card ai-simple-filters">
        <div className="ai-simple-grid">
          <label className="ai-input-field">
            <span>Min experience (yrs)</span>
            <input
              type="number"
              min="0"
              max="25"
              step="0.5"
              value={criteria.minExperience}
              onChange={e => setCriteria({ ...criteria, minExperience: Number(e.target.value) })}
            />
          </label>

          <label className="ai-input-field">
            <span>Candidate status</span>
            <select className="select" value={criteria.statusMode} onChange={e => setCriteria({ ...criteria, statusMode: e.target.value })}>
              <option value="active_review">Active &amp; In review</option>
              <option value="active_only">Active only</option>
              <option value="all">All statuses</option>
            </select>
          </label>

          <label className="ai-input-field">
            <span>Sort candidates by</span>
            <select className="select" value={criteria.sortBy} onChange={e => setCriteria({ ...criteria, sortBy: e.target.value })}>
              <option value="skills_desc">Most matched skills</option>
              <option value="experience_desc">Most experienced</option>
              <option value="updated_desc">Recently updated</option>
            </select>
          </label>

          <label className="ai-input-field">
            <span>Required skills <small>(optional)</small></span>
            <input
              type="text"
              value={criteria.customSkills}
              onChange={e => setCriteria({ ...criteria, customSkills: e.target.value })}
              placeholder="e.g. PostgreSQL, AWS"
            />
          </label>
        </div>

        <div className="ai-simple-actions">
          <span className="muted" style={{ fontSize: 12.5 }}>
            {data ? `${data.evaluatedResumes.toLocaleString()} resumes filtered in ${data.executionMs} ms` : 'Ready'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-quiet btn-sm" onClick={resetFilters}>
              <RotateCcw size={13} /> Reset
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={loading || !connected} onClick={() => runShortlist()}>
              <ListFilter size={13} /> Apply filters
            </button>
          </div>
        </div>
      </section>

      {error && <div className="form-error">{error}</div>}

      {!connected ? (
        <div className="card empty">
          <b>PostgreSQL is offline</b>
          <span>Start the backend server (<code>npm run server</code>) to load job matches.</span>
        </div>
      ) : loading && !data ? (
        <div className="card skeletons">
          {[1, 2, 3].map(n => <div key={n} className="skeleton" />)}
        </div>
      ) : (
        <div className="ai-jobs-stack">
          {(data?.jobs || []).map(entry => {
            const { job, targetSkills, totalQualified, shortlisted } = entry
            const isExpanded = Boolean(expandedJobs[job.id])
            const fullState = fullLists[job.id]
            const isShowingAll = Boolean(fullState?.candidates)
            const rows = isShowingAll ? fullState.candidates : shortlisted

            const jobSelected = rows.filter(c => selected.has(`${job.id}:${c.id}`))
            const selectableRows = rows.filter(c => !c.pipelineStage)
            const allChecked = selectableRows.length > 0 && selectableRows.every(c => selected.has(`${job.id}:${c.id}`))

            return (
              <section className="card card-flush ai-job-section" key={job.id}>
                <div
                  className={`ai-job-header ai-job-toggle ${isExpanded ? 'open' : ''}`}
                  onClick={() => toggleExpand(job.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleExpand(job.id)}
                >
                  <div className="ai-job-title-block">
                    <div className="ai-job-title-row">
                      <span className="ai-chevron">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                      <BriefcaseBusiness size={15} className="ai-accent-icon" />
                      <h2>{job.title}</h2>
                      <span className={`job-status-badge ${job.status.toLowerCase()}`}>{job.status}</span>
                      <span className="ai-count-pill">{totalQualified.toLocaleString()} matched</span>
                    </div>
                    <div className="job-meta" style={{ paddingLeft: 24 }}>
                      <span><Building2 size={12} /> {job.department}</span>
                      <span><MapPin size={12} /> {job.location || 'Remote'}</span>
                      <span className="ai-inline-skills">
                        {targetSkills.slice(0, 5).map(sk => <span key={sk} className="tag">{sk}</span>)}
                      </span>
                    </div>
                  </div>

                  <div className="ai-job-header-actions" onClick={e => e.stopPropagation()}>
                    {jobSelected.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={assigning}
                        onClick={() => shortlistAssignments(
                          jobSelected.map(c => ({ jobId: job.id, resumeId: c.id })),
                          `Shortlisted ${jobSelected.length} candidate(s) for ${job.title}`
                        )}
                      >
                        <UserCheck size={13} /> Shortlist selected ({jobSelected.length})
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => toggleExpand(job.id)}
                    >
                      {isExpanded ? 'Minimize' : 'Show list'}
                    </button>
                    {!isShowingAll && totalQualified > 5 && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        disabled={fullState?.loading}
                        onClick={() => openEntireList(job.id)}
                      >
                        {fullState?.loading ? 'Loading…' : `Open entire list (${totalQualified})`}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <>
                    {rows.length === 0 ? (
                      <div className="empty-mini" style={{ margin: '14px 18px' }}>
                        No candidates match these filters for {job.title}.
                      </div>
                    ) : (
                      <div className={`table-wrap ${isShowingAll ? 'ai-full-scroll' : ''}`}>
                        <table className="table ai-table">
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>
                                <input
                                  type="checkbox"
                                  aria-label={`Select all candidates for ${job.title}`}
                                  checked={allChecked}
                                  disabled={selectableRows.length === 0}
                                  onChange={() => toggleSelectAllInJob(job.id, rows)}
                                />
                              </th>
                              <th>Candidate</th>
                              <th>Matched skills</th>
                              <th>Experience</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((c, idx) => {
                              const person = {
                                ...c,
                                initials: c.name.split(' ').map(v => v[0]).join('').slice(0, 2).toUpperCase(),
                                color: avatarColors[(Number(c.id) || idx) % avatarColors.length]
                              }
                              const isChecked = selected.has(`${job.id}:${c.id}`)
                              return (
                                <tr key={c.id} className={isChecked ? 'ai-row-selected' : ''} onClick={() => onSelectResume(person)}>
                                  <td onClick={e => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      aria-label={`Select ${c.name}`}
                                      checked={isChecked}
                                      disabled={Boolean(c.pipelineStage)}
                                      onChange={() => toggleSelect(job.id, c.id)}
                                    />
                                  </td>
                                  <td>
                                    <div className="who">
                                      <Avatar person={person} small />
                                      <div>
                                        <b>{c.name}</b>
                                        <small className="clamp-1">{c.role}</small>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="tags">
                                      {c.matchedSkills.slice(0, 4).map(s => <span key={s} className="tag ai-tag-hit"><Check size={10} /> {s}</span>)}
                                      {c.matchedSkills.length === 0 && (c.skills || []).slice(0, 3).map(s => <span key={s} className="tag">{s}</span>)}
                                    </div>
                                  </td>
                                  <td className="num">{Number(c.experience).toFixed(1)} yrs</td>
                                  <td><StatusBadge status={c.status} /></td>
                                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                    {c.pipelineStage ? (
                                      <span className="ai-in-pipeline"><CheckCircle2 size={12} /> {c.pipelineStage}</span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-quiet btn-sm"
                                        disabled={assigning}
                                        onClick={() => shortlistAssignments([{ jobId: job.id, resumeId: c.id }], `${c.name} shortlisted for ${job.title}`)}
                                      >
                                        <UserPlus size={12} /> Shortlist
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="ai-job-footer">
                      <span>Showing <b>{rows.length}</b> of <b>{totalQualified.toLocaleString()}</b> matched candidates</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {isShowingAll ? (
                          <button type="button" className="link" onClick={() => collapseToTop5(job.id)}>Show top 5 only</button>
                        ) : totalQualified > rows.length ? (
                          <button type="button" className="link" disabled={fullState?.loading} onClick={() => openEntireList(job.id)}>
                            {fullState?.loading ? 'Loading…' : `Open entire list (${totalQualified.toLocaleString()})`}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
