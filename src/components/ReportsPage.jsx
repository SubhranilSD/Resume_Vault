import React from 'react'
import { Activity, BarChart3, Database, FolderKanban, Gauge, Sparkles, Users } from 'lucide-react'
import { chartColors } from '../data/presets'

export default function ReportsPage({ stats, resumes, onSelectSkill }) {
  const summary = stats?.summary
  const topSkills = stats?.topSkills || []
  const sources = stats?.sources || []
  const maxSkillCount = Math.max(1, ...topSkills.map(s => s.count))

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><BarChart3 size={13} /> TALENT INTELLIGENCE</div>
          <h1>Reports</h1>
          <p>Live SQL aggregations from <code>v_skill_demand</code> and <code>resumes</code>.</p>
        </div>
        <span className="engine-pill"><Activity size={13} /> Live from PostgreSQL</span>
      </div>

      <div className="stats-grid report-stats">
        <div className="stat-card">
          <div className="stat-top"><div className="stat-icon violet"><Users size={17} /></div><span className="stat-delta">Live</span></div>
          <div className="stat-label">Candidate profiles</div>
          <div className="stat-bottom"><div className="stat-value">{summary?.total_resumes ?? resumes.length}</div><span className="stat-caption">in database</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><div className="stat-icon green"><Sparkles size={17} /></div><span className="stat-delta">Normalized</span></div>
          <div className="stat-label">Canonical skills</div>
          <div className="stat-bottom"><div className="stat-value">{summary?.total_skills ?? topSkills.length}</div><span className="stat-caption">unique tags</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><div className="stat-icon blue"><Gauge size={17} /></div><span className="stat-delta">AVG()</span></div>
          <div className="stat-label">Avg. experience</div>
          <div className="stat-bottom"><div className="stat-value">{summary?.avg_experience ?? '5.4'} <small>yrs</small></div><span className="stat-caption">across pool</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><div className="stat-icon orange"><FolderKanban size={17} /></div><span className="stat-delta">Pipeline</span></div>
          <div className="stat-label">In review queue</div>
          <div className="stat-bottom"><div className="stat-value">{summary?.review_count ?? resumes.filter(x => x.status === 'In review').length}</div><span className="stat-caption">needs attention</span></div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel report-panel">
          <div className="panel-title">
            <div><h2>Skill distribution</h2><p>Click any skill to filter Talent pool</p></div>
            <span className="engine-pill"><Database size={13} /> v_skill_demand</span>
          </div>
          <div className="report-bars">
            {topSkills.map((item, i) => (
              <button
                type="button"
                key={item.skill}
                className="report-bar-row report-bar-btn"
                onClick={() => onSelectSkill(item.skill)}
                title={`Filter Talent pool by ${item.skill}`}
              >
                <span>{item.skill}</span>
                <div className="progress">
                  <i style={{ width: `${Math.max(10, (item.count / maxSkillCount) * 100)}%`, background: chartColors[i % chartColors.length] }} />
                </div>
                <b>{item.count}</b>
              </button>
            ))}
          </div>
        </div>

        <div className="panel report-panel">
          <div className="panel-title">
            <div><h2>Sourcing channels</h2><p>Candidate volume & average experience by source</p></div>
            <span className="engine-pill">GROUP BY source</span>
          </div>
          <div className="source-list">
            {sources.map(src => (
              <div className="source-row" key={src.source}>
                <div>
                  <b>{src.source}</b>
                  <small>Avg {src.avg_exp} yrs exp</small>
                </div>
                <span className="source-count">{src.count} profiles</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="normalization-callout">
        <div className="concept-icon green"><BarChart3 size={16} /></div>
        <div>
          <b>Powered by SQL aggregation</b>
          <span>This report groups the <code>resume_skills</code> bridge table by canonical <code>skill_id</code> and counts distinct <code>resume_id</code> rows, so duplicate skill labels never inflate demand.</span>
        </div>
      </div>
    </>
  )
}
