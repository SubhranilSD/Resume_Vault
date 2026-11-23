import * as THREE from 'three'

let cachedBumpMap = null

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5) {
  if (!text) return y
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ')
  let line = ''
  let lines = 0
  let curY = y
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      lines++
      if (lines >= maxLines) {
        ctx.fillText(`${line.slice(0, Math.max(0, line.length - 1))}…`, x, curY)
        return curY + lineHeight
      }
      ctx.fillText(line, x, curY)
      line = words[i]
      curY += lineHeight
    } else {
      line = test
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, curY)
    curY += lineHeight
  }
  return curY
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function paintPaperGrain(ctx, W, H, dark) {
  // Crisp bright archival cotton-rag sheet
  const bg = ctx.createLinearGradient(0, 0, W, H)
  if (dark) {
    bg.addColorStop(0, '#fcfbf7')
    bg.addColorStop(0.55, '#f6f4ed')
    bg.addColorStop(1, '#ece8de')
  } else {
    bg.addColorStop(0, '#ffffff')
    bg.addColorStop(0.6, '#fcfbf8')
    bg.addColorStop(1, '#f4f0e8')
  }
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Delicate cotton fiber texture
  ctx.save()
  ctx.globalAlpha = 0.028
  for (let i = 0; i < 420; i++) {
    const px = (Math.sin(i * 12.9898) * 43758.5453) % 1
    const py = (Math.sin(i * 78.233) * 19341.1234) % 1
    const x = Math.abs(px) * W
    const y = Math.abs(py) * H
    ctx.fillStyle = i % 2 === 0 ? '#5c5549' : '#ffffff'
    ctx.fillRect(x, y, 2 + (i % 4), 1.2)
  }
  ctx.restore()

  // Crisp subtle paper edge hairline so sheet pops against any studio bg
  ctx.strokeStyle = 'rgba(17, 20, 24, 0.14)'
  ctx.lineWidth = 3
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3)

  // Inner editorial frame border
  ctx.strokeStyle = 'rgba(17, 20, 24, 0.065)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(26, 26, W - 52, H - 52)
}

export function createPaperBumpMap() {
  if (cachedBumpMap) return cachedBumpMap
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const idx = i / 4
    const x = idx % 256
    const y = Math.floor(idx / 256)
    const fiber = Math.sin(x * 0.45 + Math.sin(y * 0.2)) * 7 + Math.cos(y * 0.35) * 5
    const grain = ((Math.sin(idx * 12.9898) * 43758.5453) % 1) * 14
    const v = Math.max(0, Math.min(255, Math.round(128 + fiber + grain)))
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 4)
  cachedBumpMap = tex
  return tex
}

export function createResumeTextures(person, options = {}) {
  const { dark = false, variant = 'full' } = options
  const W = variant === 'ambient' ? 512 : 1024
  const H = variant === 'ambient' ? 696 : 1390
  const scale = W / 840

  const p = person || {
    id: 104,
    name: 'Curriculum Vitae',
    role: 'Talent Intelligence Dossier',
    email: 'talent@resumevault.db',
    location: 'PostgreSQL · 3NF',
    experience: 6.5,
    status: 'Active',
    source: 'Direct Archive',
    summary: 'Normalized candidate dossier indexed in PostgreSQL with full relational skills, work timeline, and audit trail.',
    skills: ['PostgreSQL', 'TypeScript', 'React', 'Node.js', 'System Design', 'SQL']
  }

  // ---------- FRONT FACE (PAGE 01) ----------
  const frontCanvas = document.createElement('canvas')
  frontCanvas.width = W
  frontCanvas.height = H
  const ctx = frontCanvas.getContext('2d')
  ctx.scale(scale, scale)

  paintPaperGrain(ctx, 840, 1140, dark)

  const accent = '#0b6b63'
  ctx.fillStyle = accent
  ctx.fillRect(58, 52, 92, 7)

  // Folio header tag right
  ctx.fillStyle = '#5e5950'
  ctx.font = '600 15px "JetBrains Mono", monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`RV-${String(p.id || '001').padStart(4, '0')} · FOLIO`, 782, 62)
  ctx.textAlign = 'left'

  // Candidate Name
  ctx.fillStyle = '#101215'
  ctx.font = '800 46px "Plus Jakarta Sans", "Inter", sans-serif'
  const displayName = String(p.name || 'Candidate Profile').slice(0, 26)
  ctx.fillText(displayName, 58, 126)

  // Role subtitle
  ctx.fillStyle = accent
  ctx.font = '700 22px "Inter", sans-serif'
  ctx.fillText(String(p.role || 'Specialist').slice(0, 48), 58, 162)

  // Metadata bar
  ctx.fillStyle = '#3f3c36'
  ctx.font = '500 15.5px "Inter", sans-serif'
  const metaParts = [
    p.email || 'candidate@resumevault.io',
    p.location || 'Remote',
    `${Number(p.experience || 0).toFixed(1)} yrs exp`
  ]
  ctx.fillText(metaParts.join('   ·   ').slice(0, 74), 58, 198)

  // Status pill on top right
  const statusText = p.status || 'Active'
  const pillColor = statusText === 'Active' ? '#146c35' : statusText === 'In review' ? '#a14a07' : '#475569'
  const pillBg = statusText === 'Active' ? 'rgba(21,128,61,0.13)' : statusText === 'In review' ? 'rgba(180,83,9,0.14)' : 'rgba(100,116,139,0.14)'
  ctx.font = '700 14.5px "Inter", sans-serif'
  const stWidth = ctx.measureText(statusText).width + 34
  drawRoundedRect(ctx, 782 - stWidth, 92, stWidth, 34, 17)
  ctx.fillStyle = pillBg
  ctx.fill()
  ctx.fillStyle = pillColor
  ctx.fillText(statusText, 782 - stWidth + 17, 114)

  // Divider rule
  ctx.strokeStyle = 'rgba(16, 18, 21, 0.18)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(58, 224)
  ctx.lineTo(782, 224)
  ctx.stroke()

  // Section 1: Executive Summary
  let y = 264
  ctx.fillStyle = '#6b665c'
  ctx.font = '700 13.5px "JetBrains Mono", monospace'
  ctx.fillText('01 / EXECUTIVE SUMMARY', 58, y)
  y += 30
  ctx.fillStyle = '#1f2226'
  ctx.font = '400 17.5px "Inter", sans-serif'
  const summaryText = p.summary ||
    `${p.name || 'Candidate'} brings ${Number(p.experience || 0).toFixed(1)} years of experience as ${p.role || 'a technical professional'}, specializing in ${(p.skills || []).slice(0, 4).join(', ') || 'modern engineering systems'}.`
  y = wrapText(ctx, summaryText, 58, y, 722, 28, 5)

  // Section 2: Core Competencies / Skills
  y += 24
  ctx.fillStyle = '#6b665c'
  ctx.font = '700 13.5px "JetBrains Mono", monospace'
  ctx.fillText('02 / NORMALIZED COMPETENCIES', 58, y)
  y += 20

  const skills = (Array.isArray(p.skills) && p.skills.length ? p.skills : ['PostgreSQL', 'Architecture', 'Analytics', 'Leadership']).slice(0, 10)
  let sx = 58
  let sy = y
  ctx.font = '600 14.5px "Inter", sans-serif'
  for (const sk of skills) {
    const label = String(sk).slice(0, 22)
    const tw = ctx.measureText(label).width + 26
    if (sx + tw > 780) {
      sx = 58
      sy += 38
    }
    drawRoundedRect(ctx, sx, sy, tw, 30, 7)
    ctx.fillStyle = 'rgba(11, 107, 99, 0.095)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(11, 107, 99, 0.3)'
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.fillStyle = '#0c4a45'
    ctx.fillText(label, sx + 13, sy + 20)
    sx += tw + 10
  }
  y = sy + 62

  // Section 3: Experience / Career Highlights
  ctx.fillStyle = '#6b665c'
  ctx.font = '700 13.5px "JetBrains Mono", monospace'
  ctx.fillText('03 / CAREER TIMELINE', 58, y)
  y += 28

  const workList = Array.isArray(p.workExperience) && p.workExperience.length
    ? p.workExperience.slice(0, 3)
    : [
        { title: p.role || 'Senior Specialist', company: p.source ? `${p.source} Verified` : 'Primary Engagement', startedOn: '2022', endedOn: null, description: 'Core technical execution, cross-functional collaboration, and production delivery.' },
        { title: 'Core Contributor & Systems Lead', company: 'Enterprise Track', startedOn: '2019', endedOn: '2022', description: 'Led architecture improvements, automated QA workflows, and mentored incoming engineers.' }
      ]

  for (const w of workList) {
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(66, y - 6, 4.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#111316'
    ctx.font = '700 18.5px "Inter", sans-serif'
    ctx.fillText(String(w.title || p.role || 'Role').slice(0, 42), 86, y)

    ctx.fillStyle = '#5f5a51'
    ctx.font = '600 13.5px "JetBrains Mono", monospace'
    ctx.textAlign = 'right'
    const period = `${String(w.startedOn || '2021').slice(0, 4)} — ${w.endedOn ? String(w.endedOn).slice(0, 4) : 'Present'}`
    ctx.fillText(period, 782, y)
    ctx.textAlign = 'left'

    y += 24
    ctx.fillStyle = accent
    ctx.font = '600 15.5px "Inter", sans-serif'
    ctx.fillText(String(w.company || 'Organization').slice(0, 48), 86, y)

    y += 22
    if (w.description) {
      ctx.fillStyle = '#3b3935'
      ctx.font = '400 14.5px "Inter", sans-serif'
      y = wrapText(ctx, w.description, 86, y, 690, 21, 2) + 18
    } else {
      ctx.fillStyle = 'rgba(17, 20, 24, 0.13)'
      drawRoundedRect(ctx, 86, y - 8, 620, 6.5, 3)
      ctx.fill()
      drawRoundedRect(ctx, 86, y + 6, 470, 6.5, 3)
      ctx.fill()
      y += 38
    }
    if (y > 970) break
  }

  // Editorial footer
  ctx.strokeStyle = 'rgba(16, 18, 21, 0.14)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(58, 1054)
  ctx.lineTo(782, 1054)
  ctx.stroke()

  ctx.fillStyle = '#6b665c'
  ctx.font = '600 13px "JetBrains Mono", monospace'
  ctx.fillText('RESUMEVAULT · POSTGRESQL RELATIONAL DOSSIER', 58, 1086)
  ctx.textAlign = 'right'
  ctx.fillText('PAGE 01 / 02', 782, 1086)
  ctx.textAlign = 'left'

  // Subtle spine shadow on left edge
  const spineGrad = ctx.createLinearGradient(0, 0, 46, 0)
  spineGrad.addColorStop(0, 'rgba(15, 18, 22, 0.16)')
  spineGrad.addColorStop(1, 'rgba(15, 18, 22, 0)')
  ctx.fillStyle = spineGrad
  ctx.fillRect(0, 0, 46, 1140)

  // ---------- BACK FACE (PAGE 02, horizontally mirrored for plane BackSide UV) ----------
  const backCanvas = document.createElement('canvas')
  backCanvas.width = W
  backCanvas.height = H
  const bctx = backCanvas.getContext('2d')
  bctx.scale(scale, scale)

  bctx.save()
  bctx.translate(840, 0)
  bctx.scale(-1, 1)

  paintPaperGrain(bctx, 840, 1140, dark)

  bctx.fillStyle = '#5e5950'
  bctx.font = '700 13.5px "JetBrains Mono", monospace'
  bctx.fillText(`${displayName.toUpperCase()}  ·  CONTINUATION`, 58, 72)
  bctx.textAlign = 'right'
  bctx.fillText('PAGE 02 / 02', 782, 72)
  bctx.textAlign = 'left'

  bctx.strokeStyle = 'rgba(16, 18, 21, 0.16)'
  bctx.lineWidth = 1.5
  bctx.beginPath()
  bctx.moveTo(58, 92)
  bctx.lineTo(782, 92)
  bctx.stroke()

  // Education section
  let by = 148
  bctx.fillStyle = '#6b665c'
  bctx.font = '700 13.5px "JetBrains Mono", monospace'
  bctx.fillText('04 / ACADEMIC CREDENTIALS', 58, by)
  by += 32

  const eduList = Array.isArray(p.education) && p.education.length
    ? p.education.slice(0, 3)
    : [{ degree: 'Verified Academic Credential', institution: p.location || 'Accredited Institution', graduationYear: '—' }]

  for (const ed of eduList) {
    bctx.fillStyle = '#111316'
    bctx.font = '700 20px "Inter", sans-serif'
    bctx.fillText(String(ed.degree || 'Degree').slice(0, 46), 58, by)
    bctx.textAlign = 'right'
    bctx.fillStyle = '#5f5a51'
    bctx.font = '600 15px "JetBrains Mono", monospace'
    bctx.fillText(String(ed.graduationYear || '—'), 782, by)
    bctx.textAlign = 'left'
    by += 26
    bctx.fillStyle = accent
    bctx.font = '600 16px "Inter", sans-serif'
    bctx.fillText(String(ed.institution || 'University').slice(0, 52), 58, by)
    by += 44
  }

  // Applications summary if present
  if (Array.isArray(p.applications) && p.applications.length) {
    by += 8
    bctx.fillStyle = '#6b665c'
    bctx.font = '700 13.5px "JetBrains Mono", monospace'
    bctx.fillText('05 / ACTIVE PIPELINE APPLICATIONS', 58, by)
    by += 28
    for (const app of p.applications.slice(0, 3)) {
      bctx.fillStyle = '#111316'
      bctx.font = '600 17px "Inter", sans-serif'
      bctx.fillText(String(app.jobTitle || 'Role').slice(0, 42), 58, by)
      bctx.textAlign = 'right'
      bctx.fillStyle = accent
      bctx.font = '700 14px "JetBrains Mono", monospace'
      bctx.fillText(String(app.stage || 'New').toUpperCase(), 782, by)
      bctx.textAlign = 'left'
      by += 32
    }
  }

  // Relational Metadata Stamp Card
  by = Math.max(by + 24, 430)
  drawRoundedRect(bctx, 58, by, 724, 215, 12)
  bctx.fillStyle = 'rgba(11, 107, 99, 0.065)'
  bctx.fill()
  bctx.strokeStyle = 'rgba(11, 107, 99, 0.28)'
  bctx.lineWidth = 1.6
  bctx.stroke()

  bctx.fillStyle = accent
  bctx.font = '700 14px "JetBrains Mono", monospace'
  bctx.fillText('POSTGRESQL 3NF INTEGRITY STAMP', 86, by + 40)

  bctx.fillStyle = '#1a1d21'
  bctx.font = '500 16px "JetBrains Mono", monospace'
  bctx.fillText(`resume_id      :  #${p.id || '—'}`, 86, by + 84)
  bctx.fillText(`candidate_id   :  #${p.candidateId || p.id || '—'}`, 86, by + 116)
  bctx.fillText(`source_channel :  ${String(p.source || 'Direct').slice(0, 34)}`, 86, by + 148)
  bctx.fillText(`pipeline_state :  ${p.status || 'Active'}`, 86, by + 180)

  // Ruled evaluator lines
  let ry = by + 272
  if (ry < 980) {
    bctx.fillStyle = '#6b665c'
    bctx.font = '700 13.5px "JetBrains Mono", monospace'
    bctx.fillText('EVALUATOR NOTES & SIGN-OFF', 58, ry)
    ry += 30
    bctx.strokeStyle = 'rgba(16, 18, 21, 0.12)'
    bctx.lineWidth = 1.2
    for (let i = 0; i < 5 && ry + i * 38 < 1050; i++) {
      bctx.beginPath()
      bctx.moveTo(58, ry + i * 38)
      bctx.lineTo(782, ry + i * 38)
      bctx.stroke()
    }
  }

  // Spine shadow on right edge of mirrored canvas
  const bSpineGrad = bctx.createLinearGradient(840, 0, 794, 0)
  bSpineGrad.addColorStop(0, 'rgba(15, 18, 22, 0.16)')
  bSpineGrad.addColorStop(1, 'rgba(15, 18, 22, 0)')
  bctx.fillStyle = bSpineGrad
  bctx.fillRect(794, 0, 46, 1140)

  bctx.restore()

  const frontTex = new THREE.CanvasTexture(frontCanvas)
  frontTex.colorSpace = THREE.SRGBColorSpace
  frontTex.anisotropy = 8

  const backTex = new THREE.CanvasTexture(backCanvas)
  backTex.colorSpace = THREE.SRGBColorSpace
  backTex.anisotropy = 8

  return { frontTex, backTex }
}
