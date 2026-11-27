import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, MoveHorizontal, X } from 'lucide-react'
import { createPaperBumpMap, createResumeTextures } from '../three/paperTexture'
import { createSheetGeometry, deformPageTurn } from '../three/pageTurnMath'
import { StatusBadge } from './Modals'

function createCoverTexture(dark) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 1390
  const ctx = c.getContext('2d')

  // Mirror horizontally since left resting plane uses back-style alignment or direct front UV
  const grad = ctx.createLinearGradient(0, 0, 1024, 1390)
  if (dark) {
    grad.addColorStop(0, '#141a21')
    grad.addColorStop(1, '#0c1015')
  } else {
    grad.addColorStop(0, '#182026')
    grad.addColorStop(1, '#101519')
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1024, 1390)

  // Architectural inner frame
  ctx.strokeStyle = 'rgba(45, 212, 191, 0.28)'
  ctx.lineWidth = 3
  ctx.strokeRect(54, 54, 916, 1282)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(72, 72, 880, 1246)

  // Accent mark
  ctx.fillStyle = '#2dd4bf'
  ctx.fillRect(120, 420, 96, 8)

  ctx.fillStyle = '#f3f1ea'
  ctx.font = '800 66px "Plus Jakarta Sans", "Inter", sans-serif'
  ctx.fillText('ResumeVault', 120, 520)

  ctx.fillStyle = '#9aa3ad'
  ctx.font = '500 26px "Inter", sans-serif'
  ctx.fillText('3D Archival Talent Dossier', 120, 574)

  ctx.fillStyle = 'rgba(45, 212, 191, 0.85)'
  ctx.font = '600 18px "JetBrains Mono", monospace'
  ctx.fillText('POSTGRESQL 14+ · 3NF RELATIONAL ARCHIVE', 120, 646)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.font = '500 17px "JetBrains Mono", monospace'
  ctx.fillText('← DRAG LEFT TO TURN PAGES  ·  DRAG RIGHT TO RETURN →', 120, 1245)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/**
 * Full-Screen 3D Resume Mode Viewer
 *  - Full-viewport Three.js open 3D Resume Binder
 *  - Drag LEFT: physically grabs and curls the right page across the spine -> opens NEXT resume
 *  - Drag RIGHT: physically grabs and curls the left page back across the spine -> opens PREVIOUS resume
 */
export default function ResumeModeViewer({
  open,
  resumes = [],
  initialIndex = 0,
  theme = 'light',
  onClose,
  onOpenProfile
}) {
  const mountRef = useRef(null)
  const [index, setIndex] = useState(initialIndex)
  const [dragDir, setDragDir] = useState(null) // 'next' | 'prev' | null
  const [dragPct, setDragPct] = useState(0)
  const [detailsMap, setDetailsMap] = useState({})

  useEffect(() => {
    if (open) {
      setIndex(Math.max(0, Math.min(resumes.length - 1, initialIndex)))
    }
  }, [open, initialIndex, resumes.length])

  // Lazy-fetch rich relational details for current & neighbor resumes so 3D sheets show full work/edu
  useEffect(() => {
    if (!open || !resumes.length) return
    const targets = [resumes[index], resumes[index + 1], resumes[index - 1]].filter(Boolean)
    targets.forEach(r => {
      if (detailsMap[r.id]) return
      fetch(`/api/resumes/${r.id}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data) setDetailsMap(prev => ({ ...prev, [r.id]: { ...r, ...data } }))
        })
        .catch(() => {})
    })
  }, [open, index, resumes])

  const mergedResumesRef = useRef([])
  mergedResumesRef.current = resumes.map(r => (detailsMap[r.id] ? { ...r, ...detailsMap[r.id] } : r))

  const engineRef = useRef({
    index: 0,
    mode: 'idle', // 'idle' | 'drag-next' | 'drag-prev' | 'anim-next' | 'anim-prev' | 'cancel-next' | 'cancel-prev'
    progress: 0,
    dragStartX: 0,
    lastX: 0,
    velocity: 0,
    mx: 0,
    my: 0,
    syncRestingPages: null,
    startProgrammaticTurn: null,
    startDragTurn: null,
    endDragTurn: null
  })

  useEffect(() => {
    engineRef.current.index = index
    engineRef.current.syncRestingPages?.()
  }, [index, detailsMap, resumes.length])

  useEffect(() => {
    if (!open) return
    const mount = mountRef.current
    if (!mount) return

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      return
    }

    const getSize = () => ({
      w: Math.max(320, mount.clientWidth || window.innerWidth),
      h: Math.max(320, mount.clientHeight || window.innerHeight)
    })
    const { w, h } = getSize()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(w, h)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 45)
    const updateCamera = (vw, vh) => {
      const aspect = vw / vh
      camera.aspect = aspect
      if (aspect < 0.85) {
        // Portrait phone view: frame the active right-hand resume sheet large, centered, and clear of top/bottom UI
        const zDist = Math.max(8.8, Math.min(13.2, 5.95 / Math.max(0.42, aspect)))
        camera.position.set(1.475, -0.18, zDist)
        camera.lookAt(1.475, -0.18, 0)
      } else {
        // Landscape / desktop: full open 2-page 3D spread
        const aspectFactor = Math.max(1, 1.52 / Math.max(0.75, aspect))
        camera.position.set(0, 0.25, 8.7 * aspectFactor)
        camera.lookAt(0, 0, 0)
      }
      camera.updateProjectionMatrix()
    }
    updateCamera(w, h)

    // Crisp gallery lighting
    const ambient = new THREE.AmbientLight(0xffffff, 1.02)
    scene.add(ambient)

    const key = new THREE.DirectionalLight(0xfffdf8, 1.18)
    key.position.set(3.5, 5.5, 7.5)
    scene.add(key)

    const rim = new THREE.DirectionalLight(0x2dd4bf, 0.48)
    rim.position.set(-5.5, 2.2, -3.0)
    scene.add(rim)

    const bumpMap = createPaperBumpMap()
    const coverTex = createCoverTexture(theme === 'dark')

    // Small texture cache keyed by candidate id + detailed flag
    const texCache = new Map()
    const getTexPair = (person) => {
      if (!person) return null
      const keyStr = `${person.id}_${person.workExperience ? 'd' : 'b'}`
      if (texCache.has(keyStr)) return texCache.get(keyStr)
      const pair = createResumeTextures(person, { dark: theme === 'dark', variant: 'full' })
      // Keep cache bounded (~16 resumes)
      if (texCache.size > 16) {
        const firstKey = texCache.keys().next().value
        const old = texCache.get(firstKey)
        old.frontTex.dispose()
        old.backTex.dispose()
        texCache.delete(firstKey)
      }
      texCache.set(keyStr, pair)
      return pair
    }

    // Book rig
    const book = new THREE.Group()
    book.rotation.set(-0.08, 0, 0)
    scene.add(book)

    const SHEET_W = 2.95
    const SHEET_H = 4.0

    // Soft studio drop shadow beneath the open spread
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = 512
    shadowCanvas.height = 512
    const sctx = shadowCanvas.getContext('2d')
    const sgrad = sctx.createRadialGradient(256, 256, 40, 256, 256, 240)
    sgrad.addColorStop(0, 'rgba(6, 10, 14, 0.42)')
    sgrad.addColorStop(0.65, 'rgba(6, 10, 14, 0.14)')
    sgrad.addColorStop(1, 'rgba(6, 10, 14, 0)')
    sctx.fillStyle = sgrad
    sctx.fillRect(0, 0, 512, 512)
    const shadowTex = new THREE.CanvasTexture(shadowCanvas)
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(SHEET_W * 2.45, SHEET_H * 1.32),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    )
    shadowPlane.position.set(0, -0.18, -0.35)
    book.add(shadowPlane)

    // Stepped paper deck edges (right stack & left stack) for physical thickness
    const edgeGeo = new THREE.PlaneGeometry(SHEET_W, SHEET_H)
    edgeGeo.translate(SHEET_W / 2, 0, 0)
    const leftEdgeGeo = new THREE.PlaneGeometry(SHEET_W, SHEET_H)
    leftEdgeGeo.translate(-SHEET_W / 2, 0, 0)

    const deckMats = []
    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshStandardMaterial({
        color: theme === 'dark' ? 0xd9d4c8 : 0xe4dfd4,
        roughness: 0.9
      })
      deckMats.push(m)
      const rDeck = new THREE.Mesh(edgeGeo, m)
      rDeck.position.set(0.025 * (i + 1), -0.018 * (i + 1), -0.024 * (i + 1) - 0.02)
      book.add(rDeck)

      const lDeck = new THREE.Mesh(leftEdgeGeo, m)
      lDeck.position.set(-0.025 * (i + 1), -0.018 * (i + 1), -0.024 * (i + 1) - 0.02)
      book.add(lDeck)
    }

    // Center binding crease bar
    const spineGeo = new THREE.PlaneGeometry(0.14, SHEET_H + 0.02)
    const spineMat = new THREE.MeshBasicMaterial({ color: 0x090c10, transparent: true, opacity: 0.32 })
    const spineBar = new THREE.Mesh(spineGeo, spineMat)
    spineBar.position.set(0, 0, -0.014)
    book.add(spineBar)

    // Left resting page (shows previous candidate's Page 02 back, or Cover)
    // Flip UV horizontally on leftBaseGeo because backTex is mirrored for BackSide!
    const leftBaseGeo = new THREE.PlaneGeometry(SHEET_W, SHEET_H)
    leftBaseGeo.translate(-SHEET_W / 2, 0, 0)
    const leftUV = leftBaseGeo.attributes.uv
    for (let i = 0; i < leftUV.count; i++) {
      leftUV.setX(i, 1 - leftUV.getX(i))
    }
    leftUV.needsUpdate = true

    // Separate cover geometry with unmirrored UV for crisp Cover typography
    const coverGeo = new THREE.PlaneGeometry(SHEET_W, SHEET_H)
    coverGeo.translate(-SHEET_W / 2, 0, 0)
    const coverMat = new THREE.MeshStandardMaterial({
      map: coverTex,
      roughness: 0.55,
      metalness: 0.12
    })
    const coverMesh = new THREE.Mesh(coverGeo, coverMat)
    coverMesh.position.set(0, 0, -0.009)
    book.add(coverMesh)

    const leftBaseMat = new THREE.MeshStandardMaterial({
      bumpMap,
      bumpScale: 0.01,
      roughness: 0.8,
      metalness: 0.01
    })
    const leftBaseMesh = new THREE.Mesh(leftBaseGeo, leftBaseMat)
    leftBaseMesh.position.set(0, 0, -0.008)
    book.add(leftBaseMesh)

    // Right resting page (shows active candidate, or next candidate during a leftward turn)
    const rightBaseGeo = new THREE.PlaneGeometry(SHEET_W, SHEET_H)
    rightBaseGeo.translate(SHEET_W / 2, 0, 0)
    const rightBaseMat = new THREE.MeshStandardMaterial({
      bumpMap,
      bumpScale: 0.01,
      roughness: 0.78,
      metalness: 0.01
    })
    const rightBaseMesh = new THREE.Mesh(rightBaseGeo, rightBaseMat)
    rightBaseMesh.position.set(0, 0, -0.008)
    book.add(rightBaseMesh)

    // Active turning sheet (shared deformed BufferGeometry for crisp Front + Back)
    const { geo: turnGeo, basePositions: turnBase } = createSheetGeometry(SHEET_W, SHEET_H, 52, 36)
    const turnFrontMat = new THREE.MeshStandardMaterial({
      bumpMap,
      bumpScale: 0.012,
      roughness: 0.74,
      metalness: 0.015,
      side: THREE.FrontSide
    })
    const turnBackMat = new THREE.MeshStandardMaterial({
      bumpMap,
      bumpScale: 0.012,
      roughness: 0.78,
      metalness: 0.01,
      side: THREE.BackSide
    })
    const turnFrontMesh = new THREE.Mesh(turnGeo, turnFrontMat)
    const turnBackMesh = new THREE.Mesh(turnGeo, turnBackMat)
    turnFrontMesh.visible = false
    turnBackMesh.visible = false
    book.add(turnFrontMesh)
    book.add(turnBackMesh)

    // Helper: assign textures for idle resting state at given index
    const syncRestingPages = () => {
      const list = mergedResumesRef.current
      const idx = Math.max(0, Math.min(list.length - 1, engineRef.current.index))
      const cur = list[idx]
      const prev = idx > 0 ? list[idx - 1] : null

      if (cur) {
        const curPair = getTexPair(cur)
        rightBaseMat.map = curPair.frontTex
        rightBaseMat.needsUpdate = true
        rightBaseMesh.visible = true
      } else {
        rightBaseMesh.visible = false
      }

      if (prev) {
        const prevPair = getTexPair(prev)
        leftBaseMat.map = prevPair.backTex
        leftBaseMat.needsUpdate = true
        leftBaseMesh.visible = true
        coverMesh.visible = false
      } else {
        leftBaseMesh.visible = false
        coverMesh.visible = true
      }

      if (engineRef.current.mode === 'idle') {
        turnFrontMesh.visible = false
        turnBackMesh.visible = false
      }
    }

    // Prepare the 3D turning sheet for a forward (next) or backward (prev) turn
    const setupTurnSheets = (dir) => {
      const list = mergedResumesRef.current
      const idx = engineRef.current.index

      if (dir === 'next') {
        if (idx >= list.length - 1) return false
        const curPair = getTexPair(list[idx])
        const nextPair = getTexPair(list[idx + 1])
        const prevPair = idx > 0 ? getTexPair(list[idx - 1]) : null

        // Turning sheet = current resume (turning right -> left)
        turnFrontMat.map = curPair.frontTex
        turnBackMat.map = curPair.backTex
        turnFrontMat.needsUpdate = true
        turnBackMat.needsUpdate = true

        // Underneath right = next resume freshly revealed!
        rightBaseMat.map = nextPair.frontTex
        rightBaseMat.needsUpdate = true
        rightBaseMesh.visible = true

        // Resting left = previous resume back or Cover
        if (prevPair) {
          leftBaseMat.map = prevPair.backTex
          leftBaseMat.needsUpdate = true
          leftBaseMesh.visible = true
          coverMesh.visible = false
        } else {
          leftBaseMesh.visible = false
          coverMesh.visible = true
        }

        turnFrontMesh.visible = true
        turnBackMesh.visible = true
        return true
      }

      if (dir === 'prev') {
        if (idx <= 0) return false
        const prevPair = getTexPair(list[idx - 1])
        const curPair = getTexPair(list[idx])
        const prev2Pair = idx > 1 ? getTexPair(list[idx - 2]) : null

        // Turning sheet = previous resume peeling back from left -> right!
        turnFrontMat.map = prevPair.frontTex
        turnBackMat.map = prevPair.backTex
        turnFrontMat.needsUpdate = true
        turnBackMat.needsUpdate = true

        // Underneath left = index - 2 back or Cover
        if (prev2Pair) {
          leftBaseMat.map = prev2Pair.backTex
          leftBaseMat.needsUpdate = true
          leftBaseMesh.visible = true
          coverMesh.visible = false
        } else {
          leftBaseMesh.visible = false
          coverMesh.visible = true
        }

        // Resting right = current resume
        rightBaseMat.map = curPair.frontTex
        rightBaseMat.needsUpdate = true
        rightBaseMesh.visible = true

        turnFrontMesh.visible = true
        turnBackMesh.visible = true
        return true
      }
      return false
    }

    engineRef.current.syncRestingPages = syncRestingPages

    engineRef.current.startProgrammaticTurn = (dir) => {
      const e = engineRef.current
      if (e.mode !== 'idle') return
      if (!setupTurnSheets(dir)) return
      if (dir === 'next') {
        e.mode = 'anim-next'
        e.progress = 0.001
      } else {
        e.mode = 'anim-prev'
        e.progress = 0.999
      }
    }

    engineRef.current.startDragTurn = (dir) => {
      const e = engineRef.current
      if (!setupTurnSheets(dir)) return false
      e.mode = dir === 'next' ? 'drag-next' : 'drag-prev'
      e.progress = dir === 'next' ? 0 : 1
      return true
    }

    engineRef.current.endDragTurn = () => {
      const e = engineRef.current
      if (e.mode === 'drag-next') {
        if (e.progress > 0.25 || e.velocity < -4.5) {
          e.mode = 'anim-next'
        } else {
          e.mode = 'cancel-next'
        }
      } else if (e.mode === 'drag-prev') {
        if (e.progress < 0.75 || e.velocity > 4.5) {
          e.mode = 'anim-prev'
        } else {
          e.mode = 'cancel-prev'
        }
      }
    }

    syncRestingPages()

    const ro = new ResizeObserver(() => {
      const sz = getSize()
      updateCamera(sz.w, sz.h)
      renderer.setSize(sz.w, sz.h)
    })
    ro.observe(mount)

    let raf = 0
    let last = performance.now()
    let clock = 0

    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      clock += dt

      const e = engineRef.current

      // Advance active page turn state machine
      if (e.mode === 'anim-next') {
        e.progress = Math.min(1, e.progress + dt * 1.45)
        deformPageTurn(turnGeo, turnBase, SHEET_W, SHEET_H, e.progress, {
          curlStrength: 0.56,
          whipStrength: 0.28,
          spread: 0.3,
          cornerLead: 0.62,
          flutterAmp: 0.024
        })
        if (e.progress >= 1) {
          e.mode = 'idle'
          e.index = Math.min(mergedResumesRef.current.length - 1, e.index + 1)
          setIndex(e.index)
          syncRestingPages()
        }
      } else if (e.mode === 'cancel-next') {
        e.progress = Math.max(0, e.progress - dt * 2.4)
        deformPageTurn(turnGeo, turnBase, SHEET_W, SHEET_H, e.progress, {
          curlStrength: 0.45,
          whipStrength: 0.16,
          spread: 0.26
        })
        if (e.progress <= 0) {
          e.mode = 'idle'
          syncRestingPages()
        }
      } else if (e.mode === 'anim-prev') {
        e.progress = Math.max(0, e.progress - dt * 1.45)
        deformPageTurn(turnGeo, turnBase, SHEET_W, SHEET_H, e.progress, {
          curlStrength: 0.56,
          whipStrength: 0.24,
          spread: 0.3,
          cornerLead: 0.58,
          flutterAmp: 0.024
        })
        if (e.progress <= 0) {
          e.mode = 'idle'
          e.index = Math.max(0, e.index - 1)
          setIndex(e.index)
          syncRestingPages()
        }
      } else if (e.mode === 'cancel-prev') {
        e.progress = Math.min(1, e.progress + dt * 2.4)
        deformPageTurn(turnGeo, turnBase, SHEET_W, SHEET_H, e.progress, {
          curlStrength: 0.45,
          whipStrength: 0.16,
          spread: 0.26
        })
        if (e.progress >= 1) {
          e.mode = 'idle'
          syncRestingPages()
        }
      } else if (e.mode === 'drag-next' || e.mode === 'drag-prev') {
        deformPageTurn(turnGeo, turnBase, SHEET_W, SHEET_H, e.progress, {
          curlStrength: 0.54,
          whipStrength: 0.22,
          spread: 0.3,
          cornerLead: 0.6,
          flutterAmp: 0.012
        })
      }

      // Gentle architectural parallax tilt
      const targetRotY = e.mx * 0.08
      const targetRotX = -0.07 - e.my * 0.055
      book.rotation.y += (targetRotY - book.rotation.y) * 0.08
      book.rotation.x += (targetRotX - book.rotation.x) * 0.08
      book.position.y = Math.sin(clock * 1.1) * 0.025

      renderer.render(scene, camera)
    }

    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      texCache.forEach(p => {
        p.frontTex.dispose()
        p.backTex.dispose()
      })
      texCache.clear()
      coverTex.dispose()
      shadowTex.dispose()
      shadowPlane.geometry.dispose()
      shadowPlane.material.dispose()
      edgeGeo.dispose()
      leftEdgeGeo.dispose()
      deckMats.forEach(m => m.dispose())
      spineGeo.dispose()
      spineMat.dispose()
      coverGeo.dispose()
      coverMat.dispose()
      leftBaseGeo.dispose()
      leftBaseMat.dispose()
      rightBaseGeo.dispose()
      rightBaseMat.dispose()
      turnGeo.dispose()
      turnFrontMat.dispose()
      turnBackMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [open, theme])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') engineRef.current.startProgrammaticTurn?.('next')
      if (e.key === 'ArrowLeft') engineRef.current.startProgrammaticTurn?.('prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Pointer drag handlers implementing BOTH Drag-Left (Next) and Drag-Right (Prev) mechanisms!
  const pointerDownRef = useRef(false)
  const pointerStartXRef = useRef(0)

  const onPointerDown = useCallback((e) => {
    if (e.target.closest('button')) return
    if (engineRef.current.mode !== 'idle') return
    pointerDownRef.current = true
    pointerStartXRef.current = e.clientX
    engineRef.current.dragStartX = e.clientX
    engineRef.current.lastX = e.clientX
    engineRef.current.velocity = 0
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const eng = engineRef.current
    eng.mx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    eng.my = -(((e.clientY - rect.top) / rect.height) * 2 - 1)

    if (!pointerDownRef.current) return
    const dx = e.clientX - pointerStartXRef.current
    eng.velocity = e.clientX - eng.lastX
    eng.lastX = e.clientX

    // Lock drag direction once pointer travels >= 8px
    if (eng.mode === 'idle' && Math.abs(dx) >= 8) {
      if (dx < 0) {
        // Drag LEFT -> open NEXT page
        if (eng.startDragTurn?.('next')) {
          setDragDir('next')
        }
      } else {
        // Drag RIGHT -> open PREVIOUS page
        if (eng.startDragTurn?.('prev')) {
          setDragDir('prev')
        }
      }
    }

    const dragSpan = Math.min(300, Math.max(150, rect.width * 0.5))
    if (eng.mode === 'drag-next') {
      const p = Math.max(0, Math.min(1, -dx / dragSpan))
      eng.progress = p
      setDragPct(Math.round(p * 100))
    } else if (eng.mode === 'drag-prev') {
      const p = Math.max(0, Math.min(1, 1 - dx / dragSpan))
      eng.progress = p
      setDragPct(Math.round((1 - p) * 100))
    }
  }, [])

  const onPointerUp = useCallback((e) => {
    if (!pointerDownRef.current) return
    pointerDownRef.current = false
    e?.currentTarget?.releasePointerCapture?.(e.pointerId)
    engineRef.current.endDragTurn?.()
    setDragDir(null)
    setDragPct(0)
  }, [])

  if (!open) return null

  const current = mergedResumesRef.current[index] || resumes[index]
  const canPrev = index > 0
  const canNext = index < resumes.length - 1

  return (
    <div
      className={`resume-mode-overlay ${dragDir ? 'is-dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="dialog"
      aria-modal="true"
      aria-label="Full-screen 3D Resume Mode"
    >
      <div ref={mountRef} className="resume-mode-canvas" />

      {/* Top minimal floating bar */}
      <header className="rm-topbar">
        <div className="rm-brand">
          <span className="rm-badge"><BookOpen size={14} /> 3D Resume Mode</span>
          <span className="rm-count">{resumes.length ? `${index + 1} of ${resumes.length}` : '0 resumes'}</span>
        </div>

        <div className={`rm-drag-guide ${dragDir ? 'active' : ''}`}>
          {dragDir === 'next' ? (
            <>Turning to next resume · {dragPct}%</>
          ) : dragDir === 'prev' ? (
            <>Turning to previous resume · {dragPct}%</>
          ) : (
            <><MoveHorizontal size={13} /> Drag left for next page · Drag right for previous page</>
          )}
        </div>

        <button type="button" className="rm-close" onClick={onClose} aria-label="Exit Resume Mode">
          <X size={16} /> <span>Exit</span> <kbd>Esc</kbd>
        </button>
      </header>

      {/* Bottom floating dock */}
      <footer className="rm-dock">
        <button
          type="button"
          className="rm-nav-btn rm-nav-prev"
          disabled={!canPrev}
          onClick={() => engineRef.current.startProgrammaticTurn?.('prev')}
          title="Previous resume (or drag right)"
        >
          <ArrowLeft size={15} /> <span>Prev</span>
        </button>

        {current ? (
          <div className="rm-cand-info">
            <div className="rm-cand-meta">
              <b>{current.name}</b>
              <span>{current.role} · {Number(current.experience || 0).toFixed(1)} yrs</span>
            </div>
            <StatusBadge status={current.status} />
            <button
              type="button"
              className="btn btn-primary btn-sm rm-open-btn"
              onClick={() => { onClose(); onOpenProfile?.(current) }}
            >
              <ExternalLink size={13} /> <span>Open profile</span>
            </button>
          </div>
        ) : (
          <div className="rm-cand-info"><span>No resumes loaded</span></div>
        )}

        <button
          type="button"
          className="rm-nav-btn rm-nav-next"
          disabled={!canNext}
          onClick={() => engineRef.current.startProgrammaticTurn?.('next')}
          title="Next resume (or drag left)"
        >
          <span>Next</span> <ArrowRight size={15} />
        </button>
      </footer>
    </div>
  )
}
