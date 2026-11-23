import React, { useEffect, useState } from 'react'
import { BriefcaseBusiness, Building2, MapPin, Plus, UserPlus, Users, X } from 'lucide-react'

const STAGES = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']

export default function JobsPage({ resumes, connected, onNotify }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [applicants, setApplicants] = useState([])
  const [loadingApps, setLoadingApps] = useState(false)
  const [applyResumeId, setApplyResumeId] = useState('')
  const [newJob, setNewJob] = useState({ title: '', department: 'Engineering', location: 'Remote', status: 'Open' })

  const loadJobs = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/jobs')
      if (r.ok) setJobs(await r.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (connected) loadJobs()
    else setLoading(false)
  }, [connected])

  const openApplicants = async (job) => {
    setSelectedJob(job)
    setLoadingApps(true)
    try {
      const r = await fetch(`/api/jobs/${job.id}/applications`)
      if (r.ok) setApplicants(await r.json())
    } finally {
      setLoadingApps(false)
    }
  }

  const createJob = async (e) => {
    e.preventDefault()
    if (!newJob.title.trim() || !newJob.department.trim()) return
    const r = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newJob)
    })
    if (r.ok) {
      const created = await r.json()
      setJobs(prev => [created, ...prev])
      setCreateOpen(false)
      setNewJob({ title: '', department: 'Engineering', location: 'Remote', status: 'Open' })
      onNotify(`Created job opening: ${created.title}`)
    }
  }

  const toggleJobStatus = async (job, nextStatus) => {
    const r = await fetch(`/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    })
    if (r.ok) {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: nextStatus } : j))
      onNotify(`${job.title} marked as ${nextStatus}`)
    }
  }

  const changeStage = async (appId, stage) => {
    const r = await fetch(`/api/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage })
    })
    if (r.ok) {
      setApplicants(prev => prev.map(a => a.id === appId ? { ...a, stage } : a))
      onNotify(`Applicant moved to ${stage}`)
      loadJobs()
    }
  }

  const applyCandidate = async () => {
    if (!applyResumeId || !selectedJob) return
    const r = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeId: Number(applyResumeId), jobId: selectedJob.id, stage: 'New' })
    })
    if (r.ok) {
      setApplyResumeId('')
      openApplicants(selectedJob)
      loadJobs()
      onNotify('Candidate linked to job opening')
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><BriefcaseBusiness size={13} /> HIRING PIPELINE</div>
          <h1>Job openings</h1>
          <p>Connect candidate profiles to open roles via the normalized <code>applications</code> junction table.</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Create job opening
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel jobs-empty"><p>Loading job openings from PostgreSQL...</p></div>
      ) : (
        <div className="jobs-grid">
          {jobs.map(job => (
            <div className="panel job-card" key={job.id}>
              <div className="job-card-head">
                <span className={`job-status-badge ${job.status.toLowerCase()}`}>{job.status}</span>
                <select
                  aria-label="Job status"
                  className="job-status-select"
                  value={job.status}
                  onChange={e => toggleJobStatus(job, e.target.value)}
                >
                  <option value="Open">Open</option>
                  <option value="Paused">Paused</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <h3>{job.title}</h3>
              <div className="job-meta">
                <span><Building2 size={13} /> {job.department}</span>
                <span><MapPin size={13} /> {job.location || 'Remote'}</span>
              </div>
              <div className="job-stats-row">
                <div><b>{job.applicantCount}</b><span>Total applicants</span></div>
                <div><b>{job.activePipeline}</b><span>Interview / Offer</span></div>
              </div>
              <button type="button" className="button-secondary job-view-btn" onClick={() => openApplicants(job)}>
                <Users size={14} /> View applicants ({job.applicantCount})
              </button>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="modal-backdrop" onMouseDown={() => setCreateOpen(false)}>
          <form className="modal add-modal" onSubmit={createJob} onMouseDown={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setCreateOpen(false)}><X size={17} /></button>
            <div className="modal-kicker"><BriefcaseBusiness size={14} /> NEW REQUISITION</div>
            <h2>Create job opening</h2>
            <p>Adds a new row to <code>job_openings</code> in PostgreSQL.</p>
            <div className="form-grid">
              <label className="span-2">Job title *
                <input autoFocus required value={newJob.title} onChange={e => setNewJob({ ...newJob, title: e.target.value })} placeholder="e.g. Senior Backend Engineer" />
              </label>
              <label>Department *
                <input required value={newJob.department} onChange={e => setNewJob({ ...newJob, department: e.target.value })} placeholder="Engineering" />
              </label>
              <label>Location
                <input value={newJob.location} onChange={e => setNewJob({ ...newJob, location: e.target.value })} placeholder="Remote / Bengaluru" />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="submit" className="button-primary"><Plus size={15} /> Create role</button>
            </div>
          </form>
        </div>
      )}

      {selectedJob && (
        <div className="modal-backdrop" onMouseDown={() => setSelectedJob(null)}>
          <div className="modal profile-modal" onMouseDown={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setSelectedJob(null)}><X size={17} /></button>
            <div className="modal-kicker"><Users size={14} /> {selectedJob.department.toUpperCase()}</div>
            <h2>{selectedJob.title}</h2>
            <p>{selectedJob.location} · Manage candidate stages in <code>applications</code>.</p>

            <div className="apply-bar">
              <select value={applyResumeId} onChange={e => setApplyResumeId(e.target.value)}>
                <option value="">Select a candidate from Talent pool...</option>
                {resumes.map(r => (
                  <option key={r.id} value={r.id}>{r.name} — {r.role} ({r.experience} yrs)</option>
                ))}
              </select>
              <button type="button" className="button-primary" disabled={!applyResumeId} onClick={applyCandidate}>
                <UserPlus size={14} /> Assign
              </button>
            </div>

            <div className="applicant-list">
              {loadingApps && <div className="loading-note">Loading applicants...</div>}
              {!loadingApps && applicants.length === 0 && (
                <div className="empty-mini">No applicants linked to this role yet. Use the selector above to assign one.</div>
              )}
              {applicants.map(a => (
                <div className="applicant-row" key={a.id}>
                  <div>
                    <b>{a.name}</b>
                    <small>{a.role} · {Number(a.experience).toFixed(1)} yrs · {a.email}</small>
                  </div>
                  <select value={a.stage} onChange={e => changeStage(a.id, e.target.value)} className="stage-select">
                    {STAGES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
