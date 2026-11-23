import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const NODES = [
  { name: 'resumes', pk: 'PK resume_id', role: 'CORE', pos: [0, 0.15, 0], accent: '#0f766e' },
  { name: 'candidates', pk: 'PK candidate_id', role: '1:N', pos: [-2.45, 0.95, 0.35], accent: '#0284c7' },
  { name: 'resume_skills', pk: 'PK composite', role: 'BRIDGE', pos: [2.25, 0.72, 0.25], accent: '#0f766e' },
  { name: 'skills', pk: 'PK skill_id', role: 'DICT', pos: [4.1, 0.1, -0.3], accent: '#15803d' },
  { name: 'work_experience', pk: 'FK resume_id', role: '1:N', pos: [-1.15, -1.35, 0.55], accent: '#6d28d9' },
  { name: 'education', pk: 'FK resume_id', role: '1:N', pos: [1.15, -1.38, 0.5], accent: '#6d28d9' },
  { name: 'applications', pk: 'BRIDGE M:N', role: 'BRIDGE', pos: [-2.25, -0.32, -1.15], accent: '#b45309' },
  { name: 'job_openings', pk: 'PK job_id', role: 'REQS', pos: [-4.05, -0.75, -1.4], accent: '#b45309' },
  { name: 'audit_logs', pk: 'TRIGGER', role: 'AUDIT', pos: [2.4, -0.95, -1.25], accent: '#c2410c' }
]

const EDGES = [
  ['candidates', 'resumes'],
  ['resumes', 'resume_skills'],
  ['resume_skills', 'skills'],
  ['resumes', 'work_experience'],
  ['resumes', 'education'],
  ['resumes', 'applications'],
  ['job_openings', 'applications'],
  ['resumes', 'audit_logs']
]

function createNodeFaceTexture(node, rowCount, dark) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 240
  const ctx = c.getContext('2d')

  // Card face fill
  ctx.fillStyle = dark ? '#171c22' : '#ffffff'
  ctx.fillRect(0, 0, 512, 240)

  // Top accent bar
  ctx.fillStyle = node.accent
  ctx.fillRect(0, 0, 512, 16)

  // Hairline border
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.14)' : 'rgba(20,24,28,0.12)'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, 508, 236)

  // Role tag
  ctx.fillStyle = dark ? 'rgba(45, 212, 191, 0.16)' : 'rgba(15, 118, 110, 0.1)'
  ctx.fillRect(28, 36, 118, 34)
  ctx.fillStyle = dark ? '#5eead4' : node.accent
  ctx.font = '700 18px "JetBrains Mono", monospace'
  ctx.fillText(node.role, 40, 59)

  // Row count right
  ctx.textAlign = 'right'
  ctx.fillStyle = dark ? '#9ca3af' : '#64748b'
  ctx.font = '600 18px "JetBrains Mono", monospace'
  ctx.fillText(`${rowCount ?? '—'} rows`, 484, 59)
  ctx.textAlign = 'left'

  // Table name
  ctx.fillStyle = dark ? '#f3f4f6' : '#141517'
  ctx.font = '700 34px "JetBrains Mono", monospace'
  ctx.fillText(node.name, 28, 134)

  // PK / FK subtitle
  ctx.fillStyle = dark ? '#9ca3af' : '#57534d'
  ctx.font = '500 22px "JetBrains Mono", monospace'
  ctx.fillText(node.pk, 28, 186)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export default function SchemaConstellation3D({ tables = [], theme = 'light', onSelectTable }) {
  const mountRef = useRef(null)
  const [hovered, setHovered] = useState(null)
  const propsRef = useRef({ tables, theme, onSelectTable })
  propsRef.current = { tables, theme, onSelectTable }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      return
    }

    const getSize = () => ({
      w: Math.max(260, mount.clientWidth || 520),
      h: Math.max(220, mount.clientHeight || 290)
    })
    const { w, h } = getSize()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(w, h)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 40)
    camera.position.set(0, 1.35, 9.4)

    const ambient = new THREE.AmbientLight(0xffffff, 0.85)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 1.1)
    dir.position.set(5, 7, 6)
    scene.add(dir)
    const tealRim = new THREE.PointLight(0x2dd4bf, 0.9, 18)
    tealRim.position.set(0, 2.5, 3.2)
    scene.add(tealRim)

    const root = new THREE.Group()
    scene.add(root)

    // Build table row map
    const countMap = {}
    for (const t of propsRef.current.tables) countMap[t.table_name] = t.row_count

    const dark = propsRef.current.theme === 'dark'
    const nodeMap = new Map()
    const pickables = []
    const disposables = []

    const slabGeo = new THREE.BoxGeometry(1.52, 0.72, 0.14)
    disposables.push(slabGeo)

    const sideMat = new THREE.MeshStandardMaterial({
      color: dark ? 0x262d35 : 0xdcd7cb,
      roughness: 0.4,
      metalness: 0.25
    })
    disposables.push(sideMat)

    for (const cfg of NODES) {
      const faceTex = createNodeFaceTexture(cfg, countMap[cfg.name], dark)
      disposables.push(faceTex)
      const faceMat = new THREE.MeshStandardMaterial({
        map: faceTex,
        roughness: 0.35,
        metalness: 0.08
      })
      disposables.push(faceMat)

      const mats = [sideMat, sideMat, sideMat, sideMat, faceMat, faceMat]
      const mesh = new THREE.Mesh(slabGeo, mats)
      mesh.position.set(...cfg.pos)
      mesh.userData = { node: cfg, baseY: cfg.pos[1], phase: Math.random() * Math.PI * 2 }
      root.add(mesh)
      nodeMap.set(cfg.name, mesh)
      pickables.push(mesh)
    }

    // Build curved 3D FK tubes & traveling data pulse orbs
    const pulses = []
    const pulseGeo = new THREE.SphereGeometry(0.055, 12, 12)
    const pulseMat = new THREE.MeshBasicMaterial({ color: dark ? 0x2dd4bf : 0x0f766e })
    disposables.push(pulseGeo, pulseMat)

    const edgeColor = dark ? 0x2dd4bf : 0x0f766e
    for (let idx = 0; idx < EDGES.length; idx++) {
      const [fromName, toName] = EDGES[idx]
      const a = nodeMap.get(fromName)
      const b = nodeMap.get(toName)
      if (!a || !b) continue
      const p0 = a.position.clone()
      const p2 = b.position.clone()
      const mid = p0.clone().add(p2).multiplyScalar(0.5)
      mid.z += 0.45
      mid.y += 0.22
      const curve = new THREE.QuadraticBezierCurve3(p0, mid, p2)
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.014, 6, false)
      const tubeMat = new THREE.MeshBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: dark ? 0.36 : 0.28
      })
      disposables.push(tubeGeo, tubeMat)
      const tube = new THREE.Mesh(tubeGeo, tubeMat)
      root.add(tube)

      const orb = new THREE.Mesh(pulseGeo, pulseMat)
      root.add(orb)
      pulses.push({ orb, curve, t: (idx * 0.17) % 1, speed: 0.24 + (idx % 3) * 0.06 })
    }

    // Orbit drag + raycaster hover/click
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2(-9, -9)
    let isDragging = false
    let draggedDist = 0
    let prevX = 0
    let prevY = 0
    let targetRotY = -0.14
    let targetRotX = 0.08
    let hoveredMesh = null

    const updatePointer = (e) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const onDown = (e) => {
      isDragging = true
      draggedDist = 0
      prevX = e.clientX
      prevY = e.clientY
    }
    const onMove = (e) => {
      updatePointer(e)
      if (isDragging) {
        const dx = e.clientX - prevX
        const dy = e.clientY - prevY
        draggedDist += Math.hypot(dx, dy)
        targetRotY = Math.max(-0.85, Math.min(0.85, targetRotY + dx * 0.0055))
        targetRotX = Math.max(-0.45, Math.min(0.45, targetRotX + dy * 0.0045))
        prevX = e.clientX
        prevY = e.clientY
      }
    }
    const onUp = () => {
      if (isDragging && draggedDist < 6 && hoveredMesh) {
        const tableName = hoveredMesh.userData.node.name
        const match = propsRef.current.tables.find(t => t.table_name === tableName) || {
          table_name: tableName,
          row_count: '—',
          total_size: '—'
        }
        propsRef.current.onSelectTable?.(match)
      }
      isDragging = false
    }
    const onLeave = () => {
      isDragging = false
      pointer.set(-9, -9)
      hoveredMesh = null
      setHovered(null)
    }

    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onLeave)

    const ro = new ResizeObserver(() => {
      const sz = getSize()
      camera.aspect = sz.w / sz.h
      camera.updateProjectionMatrix()
      renderer.setSize(sz.w, sz.h)
    })
    ro.observe(mount)

    let raf = 0
    let last = performance.now()
    let clock = 0

    const animate = (now) => {
      raf = requestAnimationFrame(animate)
      if (document.hidden) {
        last = now
        return
      }
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      clock += dt

      // Smooth orbit damping + gentle idle breathing
      const idleY = isDragging ? 0 : Math.sin(clock * 0.42) * 0.09
      root.rotation.y += (targetRotY + idleY - root.rotation.y) * 0.08
      root.rotation.x += (targetRotX - root.rotation.x) * 0.08

      // Raycast hover
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(pickables, false)
      const nextHover = hits[0]?.object || null
      if (nextHover !== hoveredMesh) {
        hoveredMesh = nextHover
        el.style.cursor = hoveredMesh ? 'pointer' : isDragging ? 'grabbing' : 'grab'
        setHovered(hoveredMesh ? hoveredMesh.userData.node : null)
      }

      // Animate nodes & hover lift
      for (const mesh of pickables) {
        const isHov = mesh === hoveredMesh
        const floatY = mesh.userData.baseY + Math.sin(clock * 1.1 + mesh.userData.phase) * 0.045
        mesh.position.y += (floatY + (isHov ? 0.1 : 0) - mesh.position.y) * 0.14
        const targetScale = isHov ? 1.09 : 1
        mesh.scale.x += (targetScale - mesh.scale.x) * 0.16
        mesh.scale.y += (targetScale - mesh.scale.y) * 0.16
        mesh.scale.z += (targetScale - mesh.scale.z) * 0.16
      }

      // Advance foreign-key data pulses
      for (const p of pulses) {
        p.t = (p.t + dt * p.speed) % 1
        p.curve.getPoint(p.t, p.orb.position)
      }

      camera.lookAt(0, -0.15, 0)
      renderer.render(scene, camera)
    }

    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
      disposables.forEach(d => d.dispose?.())
      renderer.dispose()
      if (el.parentNode === mount) mount.removeChild(el)
    }
  }, [theme, tables.length])

  return (
    <div className="schema-3d-wrap">
      <div ref={mountRef} className="schema-3d-canvas" />
      <div className="schema-3d-hud">
        <span className="schema-3d-pill">
          {hovered ? (
            <><b>{hovered.name}</b> · {hovered.pk} · Click to inspect</>
          ) : (
            <>Drag to orbit · Click any 3D table to inspect</>
          )}
        </span>
      </div>
    </div>
  )
}
