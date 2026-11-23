import React, { useEffect, useState } from 'react'
import { ArrowRight, Check, Code2, Command, Copy, Database, Play, Zap } from 'lucide-react'
import { queryPresets } from '../data/presets'

export default function QueryLabPage({ query, setQuery, connected, onNotify }) {
  const [sql, setSql] = useState(queryPresets[query].sql)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setSql(queryPresets[query].sql)
    setError('')
  }, [query])

  const execute = async (explain = false) => {
    if (!connected) {
      setError('PostgreSQL is offline. Start the API server to execute live SQL queries.')
      return
    }
    setRunning(true)
    setError('')
    try {
      const r = await fetch('/api/query/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, explain })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Query execution failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
      setResult(null)
    } finally {
      setRunning(false)
    }
  }

  const copySql = async () => {
    await navigator.clipboard?.writeText(sql)
    onNotify('SQL copied to clipboard')
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><Code2 size={13} /> SQL PLAYGROUND</div>
          <h1>Query lab</h1>
          <p>Run live read-only PostgreSQL queries and inspect execution plans.</p>
        </div>
        <div className="heading-actions">
          <span className="engine-pill"><span className="footer-green" /> PostgreSQL 14+ · Read-only sandbox</span>
        </div>
      </div>

      <div className="query-intro">
        <div className="query-intro-icon"><Command size={18} /></div>
        <div>
          <b>Interactive SQL Runner</b>
          <span>Select any preset below or edit the SQL directly, then click <b>Run query</b> or <b>EXPLAIN ANALYZE</b> to execute against your live PostgreSQL database.</span>
        </div>
      </div>

      <div className="query-grid">
        {queryPresets.map((item, i) => (
          <button
            type="button"
            className={`query-card ${query === i ? 'query-selected' : ''}`}
            key={item.n}
            onClick={() => setQuery(i)}
          >
            <div className="query-card-top"><span>{item.n}</span><span>{item.tag}</span></div>
            <b>{item.title}</b>
            <p>{item.desc}</p>
            <div className="query-mini">
              <code>{item.sql.split('\n').slice(0, 3).join('\n')}</code>
              <span>+{Math.max(1, item.sql.split('\n').length - 3)} lines</span>
            </div>
            <div className="query-card-bottom">
              <span><Check size={13} /> {item.result}</span>
              <ArrowRight size={15} />
            </div>
          </button>
        ))}
      </div>

      <section className="panel sql-editor">
        <div className="editor-title">
          <div>
            <span className="editor-dot" />
            <b>{queryPresets[query].title}</b>
            <span className="editor-file">query_{String(query + 1).padStart(2, '0')}.sql</span>
          </div>
          <div className="editor-actions">
            <button type="button" className="button-secondary btn-sm" onClick={copySql}>
              <Copy size={13} /> Copy SQL
            </button>
            <button type="button" className="button-secondary btn-sm" disabled={running} onClick={() => execute(true)}>
              <Zap size={13} /> EXPLAIN ANALYZE
            </button>
            <button type="button" className="button-primary btn-sm" disabled={running} onClick={() => execute(false)}>
              <Play size={13} /> {running ? 'Running...' : 'Run query'}
            </button>
          </div>
        </div>

        <textarea
          className="sql-textarea"
          value={sql}
          onChange={e => setSql(e.target.value)}
          rows={8}
          spellCheck={false}
        />

        <div className="editor-foot">
          <span><span className="footer-green" /> {result ? `${result.rowCount} rows returned in ${result.executionMs} ms` : 'Ready to execute'}</span>
          <span>PostgreSQL · BEGIN READ ONLY</span>
        </div>
      </section>

      {error && <div className="form-error query-error">{error}</div>}

      {result && (
        <section className="panel table-panel query-results-panel">
          <div className="panel-title">
            <div>
              <h2>Query results</h2>
              <p>Live output from PostgreSQL · {result.rowCount} row(s) in {result.executionMs} ms</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>{result.columns.map(col => <th key={col}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {result.rows.map((row, idx) => (
                  <tr key={idx}>
                    {result.columns.map(col => (
                      <td key={col} className="mono-cell">{row[col] === null ? 'NULL' : String(row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.rows.length === 0 && <div className="empty-state"><b>0 rows returned</b></div>}
          </div>
        </section>
      )}

      <div className="normalization-callout">
        <div className="concept-icon purple"><Database size={16} /></div>
        <div>
          <b>Why normalize?</b>
          <span>Candidate details live once in <code>candidates</code>; skills live once in <code>skills</code>; <code>resume_skills</code> resolves their many-to-many relationship. This avoids duplicated text and keeps updates consistent.</span>
        </div>
      </div>
    </>
  )
}
