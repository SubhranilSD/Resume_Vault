import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Maximize2 } from 'lucide-react'
import { createPaperBumpMap, createResumeTextures } from '../three/paperTexture'
import { applyCornerPeel, createSheetGeometry, deformPageTurn } from '../three/pageTurnMath'

/**
 * Interactive 3D Resume Paper Folio Card.
 * Supports:
 *  - Drag left -> physically scrub-turn forward to Page 02 (Back)
 *  - Drag right -> physically scrub-turn backward to Page 01 (Front)
 *  - Click -> smooth animated page flip
 *  - Cursor parallax + dynamic lighting + hover corner curl
 */
export default function ResumePaper3D({
  person,
  theme = 'light',
  height = 225,
  controlledSide,
  onTurn,
  onFullscreen,
  tall = false
}) {
  const mountRef = useRef(null)
  const [pageSide, setPageSide] = useState(1)
  const [dragging, setDragging] = useState(false)

  const ctrlRef = useRef({
    flipped: false,
    progress: 0,
    target: 0,
    hover: false,
    peel: 0,
    mx: 0,
    my: 0,
    theme,
    isDragging: false,
    dragStartX: 0,
    dragStartProgress: 0,
    dragMoved: 0,
    lastVelocity: 0,
    lastClientX: 0,
    updateTextures: null,
    triggerEntrance: null
  })

  useEffect(() => {
    ctrlRef.current.theme = theme
  }, [theme])

  // Sync when controlledSide changes (e.g. ProfileModal tabs on left)
  useEffect(() => {
    if (!controlledSide) return
    const c = ctrlRef.current
    const wantFlipped = controlledSide === 2
    if (c.flipped !== wantFlipped) {
      c.flipped = wantFlipped
      c.target = wantFlipped ? 1 : 0
      c.peel = 0
      setPageSide(controlledSide)
    }
  }, [controlledSide])

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
      w: Math.max(200, mount.clientWidth || 360),
      h: Math.max(180, mount.clientHeight || height)
    })
    const { w, h } = getSize()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(w, h)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(tall ? 29 : 31, w / h, 0.1, 30)
    camera.position.set(0, tall ? -0.02 : 0.03, tall ? 6.15 : 5.95)

    // Crisp editorial studio lighting so archival paper stays bright & razor-sharp
    const ambient = new THREE.AmbientLight(0xffffff, 1.05)
    scene.add(ambient)

    const key = new THREE.DirectionalLight(0xfffdf8, 1.15)
    key.position.set(2.4, 3.6, 5.8)
    scene.add(key)

    const rim = new THREE.DirectionalLight(0x2dd4bf, 0.45)
    rim.position.set(-3.8, 1.6, -2.5)
    scene.add(rim)

    const cursorLight = new THREE.PointLight(0xffffff, 0.35, 14)
    cursorLight.position.set(0, 0, 4.2)
    scene.add(cursorLight)

    const bumpMap = createPaperBumpMap()
    const W = tall ? 2.2 : 2.1
    const H = tall ? 2.98 : 2.85

    const pivot = new THREE.Group()
    scene.add(pivot)

    // Soft studio drop shadow
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = 256
    shadowCanvas.height = 256
    const sctx = shadowCanvas.getContext('2d')
    const grad = sctx.createRadialGradient(128, 128, 28, 128, 128, 122)
    grad.addColorStop(0, 'rgba(10, 14, 18, 0.34)')
    grad.addColorStop(0.62, 'rgba(10, 14, 18, 0.12)')
    grad.addColorStop(1, 'rgba(10, 14, 18, 0)')
    sctx.fillStyle = grad
    sctx.fillRect(0, 0, 256, 256)
    const shadowTex = new THREE.CanvasTexture(shadowCanvas)
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.8), shadowMat)
    shadowMesh.position.set(0.08, -0.14, -0.58)
    pivot.add(shadowMesh)

    // Subtle stacked paper backing sheet
    const backStackGeo = new THREE.PlaneGeometry(W, H)
    const backStackMat = new THREE.MeshStandardMaterial({
      color: 0xeae6dc,
      roughness: 0.9,
      metalness: 0,
      transparent: true,
      opacity: 0.92
    })
    const backStack = new THREE.Mesh(backStackGeo, backStackMat)
    backStack.position.set(0.065, -0.055, -0.14)
    backStack.rotation.z = -0.022
    pivot.add(backStack)

    // Main turning sheet holder (kept optically centered while flipping around left spine)
    const sheetHolder = new THREE.Group()
    sheetHolder.position.x = -W / 2
    pivot.add(sheetHolder)

    const { geo, basePositions } = createSheetGeometry(W, H, 42, 32)
    const initialPair = createResumeTextures(person, { dark: theme === 'dark', variant: 'full' })
    let activePair = initialPair

    const frontMat = new THREE.MeshStandardMaterial({
      map: initialPair.frontTex,
      bumpMap,
      bumpScale: 0.01,
      roughness: 0.78,
      metalness: 0.01,
      side: THREE.FrontSide
    })
    const backMat = new THREE.MeshStandardMaterial({
      map: initialPair.backTex,
      bumpMap,
      bumpScale: 0.01,
      roughness: 0.8,
      metalness: 0.01,
      side: THREE.BackSide
    })
    const frontMesh = new THREE.Mesh(geo, frontMat)
    const backMesh = new THREE.Mesh(geo, backMat)
    sheetHolder.add(frontMesh)
    sheetHolder.add(backMesh)

    ctrlRef.current.updateTextures = (nextPerson, isDark) => {
      const nextPair = createResumeTextures(nextPerson, { dark: isDark, variant: 'full' })
      const old = activePair
      activePair = nextPair
      frontMat.map = nextPair.frontTex
      backMat.map = nextPair.backTex
      frontMat.needsUpdate = true
      backMat.needsUpdate = true
      if (old) {
        old.frontTex.dispose()
        old.backTex.dispose()
      }
    }

    let entranceT = 0
    ctrlRef.current.triggerEntrance = () => {
      entranceT = 1
      ctrlRef.current.flipped = false
      ctrlRef.current.target = 0
      ctrlRef.current.progress = 0.45
      setPageSide(1)
    }

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

    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden) {
        last = now
        return
      }
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      clock += dt

      const c = ctrlRef.current

      if (c.isDragging) {
        // Real-time scrubbed physical page curl following drag!
        deformPageTurn(geo, basePositions, W, H, c.progress, {
          curlStrength: 0.42,
          whipStrength: 0.2,
          spread: 0.28,
          cornerLead: 0.6,
          flutterAmp: 0.012
        })
      } else {
        const diff = c.target - c.progress
        const isTurning = Math.abs(diff) > 0.002
        if (isTurning) {
          c.progress += diff * Math.min(1, dt * 6.8)
          if (Math.abs(c.target - c.progress) <= 0.002) {
            c.progress = c.target
          }
          deformPageTurn(geo, basePositions, W, H, c.progress, {
            curlStrength: 0.38,
            whipStrength: 0.19,
            spread: 0.28,
            cornerLead: 0.6,
            flutterAmp: 0.016
          })
        } else if (c.progress < 0.01) {
          const peelGoal = c.hover ? 1 : 0
          if (Math.abs(peelGoal - c.peel) > 0.004) {
            c.peel += (peelGoal - c.peel) * Math.min(1, dt * 10)
            applyCornerPeel(geo, basePositions, W, H, c.peel * 0.55)
          }
        }
      }

      // Keep turning page centered optically
      const centerShiftX = -W / 2 + c.progress * W
      sheetHolder.position.x += (centerShiftX - sheetHolder.position.x) * (c.isDragging ? 0.35 : 0.22)

      if (entranceT > 0.005) entranceT *= Math.pow(0.04, dt)
      else entranceT = 0

      const parallaxScale = c.isDragging ? 0.08 : 0.2
      const rotY = c.mx * parallaxScale + Math.sin(clock * 1.0) * 0.025
      const rotX = -c.my * (parallaxScale * 0.72) + Math.cos(clock * 0.85) * 0.02 + entranceT * 0.16
      pivot.rotation.y += (rotY - pivot.rotation.y) * 0.1
      pivot.rotation.x += (rotX - pivot.rotation.x) * 0.1
      pivot.position.y = Math.sin(clock * 1.3) * 0.028 - entranceT * 0.1

      cursorLight.position.x = c.mx * 2.5
      cursorLight.position.y = c.my * 2.2
      backStackMat.opacity = 0.9 * (1 - c.progress * 0.45)

      renderer.render(scene, camera)
    }

    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (activePair) {
        activePair.frontTex.dispose()
        activePair.backTex.dispose()
      }
      shadowTex.dispose()
      shadowMat.dispose()
      shadowMesh.geometry.dispose()
      backStackGeo.dispose()
      backStackMat.dispose()
      geo.dispose()
      frontMat.dispose()
      backMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [tall])

  useEffect(() => {
    if (!ctrlRef.current.updateTextures) return
    ctrlRef.current.updateTextures(person, theme === 'dark')
  }, [person, theme])

  useEffect(() => {
    if (!person?.id || !ctrlRef.current.triggerEntrance) return
    ctrlRef.current.triggerEntrance()
  }, [person?.id])

  const handlePointerDown = (e) => {
    if (e.target.closest('button')) return
    const c = ctrlRef.current
    c.isDragging = true
    c.dragStartX = e.clientX
    c.lastClientX = e.clientX
    c.dragStartProgress = c.progress
    c.dragMoved = 0
    c.lastVelocity = 0
    c.peel = 0
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const c = ctrlRef.current
    c.mx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    c.my = -(((e.clientY - rect.top) / rect.height) * 2 - 1)

    if (c.isDragging) {
      const dx = e.clientX - c.dragStartX
      c.lastVelocity = e.clientX - c.lastClientX
      c.lastClientX = e.clientX
      c.dragMoved = Math.max(c.dragMoved, Math.abs(dx))
      // Drag LEFT (dx < 0) advances progress toward 1 (Page 02); Drag RIGHT (dx > 0) returns toward 0 (Page 01)
      const span = Math.max(160, rect.width * 0.58)
      c.progress = Math.max(0, Math.min(1, c.dragStartProgress - dx / span))
    }
  }

  const finishDrag = (e) => {
    const c = ctrlRef.current
    if (!c.isDragging) return
    c.isDragging = false
    setDragging(false)
    e?.currentTarget?.releasePointerCapture?.(e.pointerId)

    let nextFlipped = c.flipped
    if (c.dragMoved < 8) {
      // Tap/click toggles page
      nextFlipped = !c.flipped
    } else if (c.lastVelocity < -4) {
      nextFlipped = true
    } else if (c.lastVelocity > 4) {
      nextFlipped = false
    } else {
      nextFlipped = c.progress >= 0.45
    }

    const changed = nextFlipped !== c.flipped
    c.flipped = nextFlipped
    c.target = nextFlipped ? 1 : 0
    setPageSide(nextFlipped ? 2 : 1)
    if (changed) onTurn?.(person, nextFlipped ? 2 : 1)
  }

  return (
    <div
      className={`folio-3d-wrap ${tall ? 'folio-3d-tall' : ''} ${dragging ? 'is-dragging' : ''}`}
      style={tall ? undefined : { height }}
      onPointerEnter={() => { ctrlRef.current.hover = true }}
      onPointerLeave={() => {
        ctrlRef.current.hover = false
        if (!ctrlRef.current.isDragging) {
          ctrlRef.current.mx = 0
          ctrlRef.current.my = 0
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      role="region"
      aria-label="Interactive 3D resume sheet — drag left or right to turn page"
    >
      <div ref={mountRef} className="folio-3d-canvas" />
      {tall ? (
        <div className="folio-minimal-bar">
          <span className="folio-minimal-meta">Page 0{pageSide} / 02 · Drag to turn</span>
          {onFullscreen && (
            <button
              type="button"
              className="folio-minimal-btn"
              title="Open Full-Screen 3D Resume Mode"
              onClick={(e) => { e.stopPropagation(); onFullscreen(person) }}
            >
              <Maximize2 size={12} /> <span>Full screen</span>
            </button>
          )}
        </div>
      ) : (
        <div className="folio-3d-hud">
          <span className="folio-badge">0{pageSide} / 02</span>
          {onFullscreen && (
            <button
              type="button"
              className="folio-fs-btn"
              title="Open Full-Screen 3D Resume Mode"
              onClick={(e) => { e.stopPropagation(); onFullscreen(person) }}
            >
              <Maximize2 size={11} /> <span>Resume mode</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
