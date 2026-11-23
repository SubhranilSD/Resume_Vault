import React, { useEffect, useState } from 'react'
import { Activity, ChevronRight, Database, HardDrive, RefreshCw, ShieldCheck, X, Zap } from 'lucide-react'
import SchemaConstellation3D from './SchemaConstellation3D'

const tableDescriptions = {
  candidates: 'Candidate identity & contact info',
  resumes: 'Resume profile, status & experience',
  skills: 'Canonical normalized skill dictionary',
  resume_skills: 'M:N bridge with proficiency levels',
  work_experience: 'Dated employment history',
  education: 'Academic degrees & institutions',
  job_openings: 'Open requisitions & departments',
  applications: 'Candidate ↔ job stage tracking',
  audit_logs: 'Trigger-captured mutation events'
}

export default function DatabasePage({ connected, theme = 'light' }) {
  const [schema, setSchema] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    if (!connected) return
    setLoading(true)
    try {
      const [sRes, aRes] = await Promise.all([fetch('/api/schema'), fetch('/api/audit-logs')])
      if (sRes.ok) setSchema(await sRes.json())
      if (aRes.ok) setAuditLogs(await aRes.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [connected])

  const tables = schema?.tables || Object.keys(tableDescriptions).map(name => ({
    table_name: name, row_count: '—', total_size: '—'
  }))

  const tableCols = (schema?.columns || []).filter(c => c.table_name === selectedTable?.table_name)
  const tableIndexes = (schema?.indexes || []).filter(i => i.table_name === selectedTable?.table_name)

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><Database size={13} /> RELATIONAL MODEL</div>
          <h1>Database</h1>
          <p>Live PostgreSQL schema inspector, 3NF entity map, and trigger audit logs.</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh schema
          </button>
          <span className={`connection-pill page-connection ${connected ? 'connected' : ''}`}>
            <i />{connected ? 'PostgreSQL · Connected' : 'PostgreSQL · Offline'}
          </span>
        </div>
      </div>

      <div className="db-summary">
        <div className="db-stat"><span>Engine</span><b><Database size={15} /> PostgreSQL 14+</b></div>
        <div className="db-stat"><span>Database Size</span><b>{schema?.databaseSize?.db_size || 'resume_vault'}</b></div>
        <div className="db-stat"><span>Tables</span><b>{String(tables.length).padStart(2, '0')} <small>3NF normalized</small></b></div>
        <div className="db-stat"><span>Integrity</span><b className="integrity"><ShieldCheck size={15} /> FK & Triggers active</b></div>
      </div>

      <div className="db-layout">
        <section className="panel schema-panel">
          <div className="panel-title">
            <div><h2>Schema explorer</h2><p>Click any table to inspect columns & indexes</p></div>
            <span className="engine-pill"><HardDrive size={13} /> MVCC · Heap</span>
          </div>
          <div className="table-list">
            {tables.map((t) => (
              <button
                type="button"
                className="schema-row schema-row-btn"
                key={t.table_name}
                onClick={() => setSelectedTable(t)}
              >
                <div className="schema-icon"><Database size={16} /></div>
                <div className="schema-name">
                  <b>{t.table_name}</b>
                  <span>{tableDescriptions[t.table_name] || 'Relational table'}</span>
                </div>
                <span className="schema-count">{t.row_count} rows · {t.total_size}</span>
                <span className="schema-type">{t.table_name === 'resume_skills' || t.table_name === 'applications' ? 'BRIDGE' : 'TABLE'}</span>
                <ChevronRight size={15} className="schema-chevron" />
              </button>
            ))}
          </div>
        </section>

        <section className="panel er-panel">
          <div className="panel-title">
            <div><h2>Entity relationships</h2><p>Interactive 3D normalized schema · Third Normal Form</p></div>
            <span className="er-badge">3NF · 3D</span>
          </div>
          <SchemaConstellation3D
            tables={tables}
            theme={theme}
            onSelectTable={setSelectedTable}
          />
          <div className="er-legend"><span><b>PK</b> Primary key</span><span><b>FK</b> Foreign key</span><span><b>3D</b> Live relational paths</span></div>
        </section>
      </div>

      <section className="panel audit-panel">
        <div className="panel-title">
          <div><h2>Live Trigger Audit Logs</h2><p>Automated records from <code>trg_resume_*_audit</code> triggers</p></div>
          <span className="engine-pill"><Activity size={13} /> {auditLogs.length} recent events</span>
        </div>
        <div className="audit-list">
          {auditLogs.length === 0 ? (
            <div className="empty-mini">No audit log entries found yet. Add, update, or delete a resume to trigger an audit row.</div>
          ) : (
            auditLogs.slice(0, 8).map(log => (
              <div className="audit-row" key={log.id}>
                <span className={`audit-badge ${log.action.toLowerCase()}`}>{log.action}</span>
                <b>{log.tableName}</b>
                <span>record_id #{log.recordId}</span>
                <small>{new Date(log.changedAt).toLocaleString()}</small>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="db-bottom-grid">
        <div className="panel concept-card"><div className="concept-icon purple"><ShieldCheck size={17} /></div><div><b>Referential integrity</b><p>Foreign keys cascade safely, preventing orphaned resumes and skill mappings.</p></div></div>
        <div className="panel concept-card"><div className="concept-icon green"><Zap size={17} /></div><div><b>Purposeful indexing</b><p>Composite indexes support status filters, recency sorting and reverse skill lookups.</p></div></div>
        <div className="panel concept-card"><div className="concept-icon orange"><Activity size={17} /></div><div><b>Auditable changes</b><p>Triggers write resume insert, update, and delete events to a timestamped audit log.</p></div></div>
      </div>

      {selectedTable && (
        <div className="modal-backdrop" onMouseDown={() => setSelectedTable(null)}>
          <div className="modal profile-modal" onMouseDown={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setSelectedTable(null)}><X size={17} /></button>
            <div className="modal-kicker"><Database size={14} /> TABLE INSPECTOR</div>
            <h2>{selectedTable.table_name}</h2>
            <p>{selectedTable.row_count} live rows · {selectedTable.total_size} total relation size</p>

            <div className="inspector-section">
              <small>COLUMNS ({tableCols.length})</small>
              <div className="inspector-table">
                {tableCols.map(c => (
                  <div className="inspector-row" key={c.column_name}>
                    <b>{c.column_name}</b>
                    <span>{c.data_type}</span>
                    <em>{c.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}</em>
                  </div>
                ))}
              </div>
            </div>

            <div className="inspector-section">
              <small>INDEXES ({tableIndexes.length})</small>
              <div className="inspector-indexes">
                {tableIndexes.map(idx => (
                  <div className="index-item" key={idx.index_name}>
                    <b>{idx.index_name}</b>
                    <code>{idx.definition}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
