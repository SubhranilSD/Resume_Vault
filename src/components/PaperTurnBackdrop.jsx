import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createPaperBumpMap, createResumeTextures } from '../three/paperTexture'
import { createSheetGeometry, deformPageTurn } from '../three/pageTurnMath'

/**
 * Full-screen Three.js stage:
 *  - Ambient architectural floating paper folios + subtle atmospheric motes
 *  - Hero 3D curved paper-turn animation whenever a resume is clicked or turned
 */
export default function PaperTurnBackdrop({ theme = 'light', turnEvent, modalOpen = false }) {
  const hostRef = useRef(null)
  const stateRef = useRef({
    theme,
    modalOpen,
    turning: false,
    turnProgress: 0,
    heroPresence: 0,
    heroTarget: 0,
    holdTimer: 0,
    prevPerson: null,
    activePerson: null,
    mouseX: 0,
    mouseY: 0,
    triggerTurn: null
  })

  useEffect(() => {
    stateRef.current.theme = theme
  }, [theme])

  useEffect(() => {
    stateRef.current.modalOpen = modalOpen
    if (modalOpen) {
      // Side-by-side ProfileModal displays its own live unobstructed 3D resume on the right
      stateRef.current.heroTarget = 0
      stateRef.current.holdTimer = 0
    }
  }, [modalOpen])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.06
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 60)
    camera.position.set(0, 0.25, 11.4)

    // Studio three-point lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.72)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.35)
    keyLight.position.set(4.5, 6.2, 7.5)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0x2dd4bf, 0.55)
    rimLight.position.set(-6.0, 2.5, -3.5)
    scene.add(rimLight)

    const fillLight = new THREE.PointLight(0xe2e8f0, 0.45, 24)
    fillLight.position.set(-3.5, -3.2, 5.5)
    scene.add(fillLight)

    const bumpMap = createPaperBumpMap()

    // ---------- 1. AMBIENT FLOATING ARCHITECTURAL SHEETS ----------
    const ambientGroup = new THREE.Group()
    scene.add(ambientGroup)

    const ambientPlaceholder = createResumeTextures(null, { dark: theme === 'dark', variant: 'ambient' })
    const ambientSheets = []
    const ambientGeo = new THREE.PlaneGeometry(2.1, 2.85, 10, 14)
    // Give ambient sheets a subtle permanent gentle wave
    {
      const pos = ambientGeo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        pos.setZ(i, Math.sin(x * 1.1 + y * 0.7) * 0.08)
      }
      pos.needsUpdate = true
      ambientGeo.computeVertexNormals()
    }

    const placements = [
      { x: -6.2, y: 2.3, z: -4.2, rx: 0.18, ry: 0.42, rz: -0.14, speed: 0.26, phase: 0.0 },
      { x: 6.1, y: -1.9, z: -3.8, rx: -0.14, ry: -0.45, rz: 0.12, speed: 0.22, phase: 1.7 },
      { x: -5.4, y: -2.8, z: -5.5, rx: 0.12, ry: 0.32, rz: 0.2, speed: 0.19, phase: 3.1 },
      { x: 5.5, y: 2.8, z: -5.2, rx: -0.16, ry: -0.35, rz: -0.18, speed: 0.24, phase: 4.4 },
      { x: 0.4, y: 3.4, z: -7.0, rx: 0.22, ry: 0.12, rz: 0.08, speed: 0.17, phase: 2.2 }
    ]

    const ambientMaterials = []
    for (const cfg of placements) {
      const mat = new THREE.MeshStandardMaterial({
        map: ambientPlaceholder.frontTex,
        bumpMap,
        bumpScale: 0.012,
        roughness: 0.78,
        metalness: 0.02,
        transparent: true,
        opacity: theme === 'dark' ? 0.12 : 0.24,
        side: THREE.DoubleSide
      })
      ambientMaterials.push(mat)
      const mesh = new THREE.Mesh(ambientGeo, mat)
      mesh.position.set(cfg.x, cfg.y, cfg.z)
      mesh.rotation.set(cfg.rx, cfg.ry, cfg.rz)
      ambientGroup.add(mesh)
      ambientSheets.push({ mesh, cfg })
    }

    // Subtle atmospheric floating particles (executive minimal dust motes)
    const particleCount = 48
    const pGeo = new THREE.BufferGeometry()
    const pPositions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 18
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 11
      pPositions[i * 3 + 2] = -1.5 - Math.random() * 8
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
    const pMat = new THREE.PointsMaterial({
      size: 0.045,
      color: theme === 'dark' ? 0x2dd4bf : 0x0f766e,
      transparent: true,
      opacity: theme === 'dark' ? 0.28 : 0.18,
      depthWrite: false
    })
    const particles = new THREE.Points(pGeo, pMat)
    ambientGroup.add(particles)

    // ---------- 2. HERO 3D TURNING RESUME DOSSIER ----------
    const heroGroup = new THREE.Group()
    // Offset slightly so the turned spread frames both left & right around the center spine
    heroGroup.position.set(0.2, -0.08, 1.4)
    heroGroup.rotation.set(-0.14, -0.18, 0.03)
    heroGroup.visible = false
    scene.add(heroGroup)

    const SHEET_W = 3.2
    const SHEET_H = 4.35

    // Soft resting stack beneath the right-hand page
    const stackGeo = new THREE.PlaneGeometry(SHEET_W, SHEET_H)
    stackGeo.translate(SHEET_W / 2, 0, 0)
    const stackMats = []
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshStandardMaterial({
        color: 0xe6e1d6,
        roughness: 0.88,
        metalness: 0.0,
        transparent: true,
        opacity: 0
      })
      stackMats.push(m)
      const sheet = new THREE.Mesh(stackGeo, m)
      sheet.position.set(0.035 * (i + 1), -0.025 * (i + 1), -0.045 * (i + 1))
      heroGroup.add(sheet)
    }

    // Soft resting left-hand settled sheet (so turning looks like an open executive dossier!)
    const leftBaseGeo = new THREE.PlaneGeometry(SHEET_W, SHEET_H)
    leftBaseGeo.translate(-SHEET_W / 2, 0, 0)
    const leftBaseMat = new THREE.MeshStandardMaterial({
      map: ambientPlaceholder.backTex,
      bumpMap,
      bumpScale: 0.015,
      roughness: 0.82,
      metalness: 0.02,
      transparent: true,
      opacity: 0
    })
    const leftBaseMesh = new THREE.Mesh(leftBaseGeo, leftBaseMat)
    leftBaseMesh.position.set(-0.02, 0, -0.035)
    heroGroup.add(leftBaseMesh)

    // Underlying right-hand sheet (reveals the newly clicked resume as the top sheet turns!)
    const underGeo = new THREE.PlaneGeometry(SHEET_W, SHEET_H)
    underGeo.translate(SHEET_W / 2, 0, 0)
    const underMat = new THREE.MeshStandardMaterial({
      map: ambientPlaceholder.frontTex,
      bumpMap,
      bumpScale: 0.016,
      roughness: 0.72,
      metalness: 0.02,
      transparent: true,
      opacity: 0
    })
    const underMesh = new THREE.Mesh(underGeo, underMat)
    underMesh.position.set(0, 0, -0.008)
    heroGroup.add(underMesh)

    // Active turning sheet (shared deformed geometry for crisp front + back!)
    const { geo: turnGeo, basePositions: turnBase } = createSheetGeometry(SHEET_W, SHEET_H, 46, 34)
    const turnFrontMat = new THREE.MeshStandardMaterial({
      map: ambientPlaceholder.frontTex,
      bumpMap,
      bumpScale: 0.018,
      roughness: 0.68,
      metalness: 0.03,
      transparent: true,
      opacity: 0,
      side: THREE.FrontSide
    })
    const turnBackMat = new THREE.MeshStandardMaterial({
      map: ambientPlaceholder.backTex,
      bumpMap,
      bumpScale: 0.018,
      roughness: 0.72,
      metalness: 0.02,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide
    })
    const turnFrontMesh = new THREE.Mesh(turnGeo, turnFrontMat)
    const turnBackMesh = new THREE.Mesh(turnGeo, turnBackMat)
    heroGroup.add(turnFrontMesh)
    heroGroup.add(turnBackMesh)

    // Subtle spine shadow strip along x = 0
    const spineGeo = new THREE.PlaneGeometry(0.18, SHEET_H + 0.04)
    const spineMat = new THREE.MeshBasicMaterial({
      color: 0x0b0d10,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
    const spineMesh = new THREE.Mesh(spineGeo, spineMat)
    spineMesh.position.set(0, 0, -0.02)
    heroGroup.add(spineMesh)

    // Track disposable textures
    let currentUnderTex = null
    let currentTurnTex = null
    let currentLeftTex = null

    const disposePair = (pair) => {
      if (!pair) return
      pair.frontTex?.dispose()
      pair.backTex?.dispose()
    }

    // Trigger function exposed via ref
    stateRef.current.triggerTurn = (nextPerson) => {
      const dark = stateRef.current.theme === 'dark'
      const prevPerson = stateRef.current.activePerson

      // Previous turning page's back becomes the settled left page
      if (currentLeftTex && currentLeftTex !== currentTurnTex) {
        disposePair(currentLeftTex)
      }
      if (currentTurnTex) {
        currentLeftTex = currentTurnTex
        leftBaseMat.map = currentLeftTex.backTex
        leftBaseMat.needsUpdate = true
      }

      // Previous under sheet becomes the turning top sheet (or synthesize one from prevPerson)
      if (currentUnderTex) {
        currentTurnTex = currentUnderTex
      } else {
        currentTurnTex = createResumeTextures(prevPerson, { dark, variant: 'full' })
      }
      turnFrontMat.map = currentTurnTex.frontTex
      turnBackMat.map = currentTurnTex.backTex
      turnFrontMat.needsUpdate = true
      turnBackMat.needsUpdate = true

      // New clicked candidate becomes the freshly revealed right-hand under sheet!
      const nextTex = createResumeTextures(nextPerson, { dark, variant: 'full' })
      currentUnderTex = nextTex
      underMat.map = nextTex.frontTex
      underMat.needsUpdate = true

      stateRef.current.prevPerson = prevPerson
      stateRef.current.activePerson = nextPerson
      stateRef.current.turning = true
      stateRef.current.turnProgress = 0
      stateRef.current.heroTarget = stateRef.current.modalOpen ? 0 : 0.88
      stateRef.current.holdTimer = stateRef.current.modalOpen ? 0 : 0.65

      deformPageTurn(turnGeo, turnBase, SHEET_W, SHEET_H, 0)
    }

    // Event listeners
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    const onPointerMove = (e) => {
      stateRef.current.mouseX = (e.clientX / window.innerWidth) * 2 - 1
      stateRef.current.mouseY = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    // Animation loop
    let rafId = 0
    let lastTime = performance.now()
    let elapsed = 0

    const animate = (now) => {
      rafId = requestAnimationFrame(animate)
      if (document.hidden) {
        lastTime = now
        return
      }
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      elapsed += dt

      const st = stateRef.current
      const isDark = st.theme === 'dark'

      // Adapt lighting smoothly to theme
      ambientLight.intensity += ((isDark ? 0.56 : 0.82) - ambientLight.intensity) * 0.08
      keyLight.intensity += ((isDark ? 1.25 : 1.32) - keyLight.intensity) * 0.08
      rimLight.intensity += ((isDark ? 0.85 : 0.35) - rimLight.intensity) * 0.08
      pMat.color.setHex(isDark ? 0x2dd4bf : 0x0f766e)
      pMat.opacity += ((isDark ? 0.26 : 0.16) - pMat.opacity) * 0.08

      // Subtle mouse parallax on ambient background
      const targetCamX = st.mouseX * 0.32
      const targetCamY = 0.25 + st.mouseY * 0.2
      camera.position.x += (targetCamX - camera.position.x) * 0.04
      camera.position.y += (targetCamY - camera.position.y) * 0.04
      camera.lookAt(0, 0, 0)

      // Drift ambient sheets
      const targetAmbientOp = isDark ? 0.11 : 0.22
      for (let i = 0; i < ambientSheets.length; i++) {
        const { mesh, cfg } = ambientSheets[i]
        const mat = ambientMaterials[i]
        // Dim ambient sheets slightly while hero page turns
        const goalOp = targetAmbientOp * (1 - st.heroPresence * 0.55)
        mat.opacity += (goalOp - mat.opacity) * 0.08
        if (!reducedMotion) {
          const t = elapsed * cfg.speed + cfg.phase
          mesh.position.y = cfg.y + Math.sin(t) * 0.28
          mesh.rotation.x = cfg.rx + Math.sin(t * 0.7) * 0.06
          mesh.rotation.y = cfg.ry + Math.cos(t * 0.55) * 0.08
        }
      }
      if (!reducedMotion) {
        particles.rotation.y = elapsed * 0.015
      }

      // Advance Hero 3D Page Turn!
      if (st.turning) {
        const duration = reducedMotion ? 0.25 : 1.12
        st.turnProgress = Math.min(1, st.turnProgress + dt / duration)
        deformPageTurn(turnGeo, turnBase, SHEET_W, SHEET_H, st.turnProgress, {
          curlStrength: 0.52,
          whipStrength: 0.28,
          spread: 0.32,
          cornerLead: 0.62,
          flutterAmp: 0.028
        })
        if (st.turnProgress >= 1) {
          st.turning = false
        }
      } else if (!st.modalOpen && st.holdTimer > 0) {
        st.holdTimer -= dt
        if (st.holdTimer <= 0) {
          st.heroTarget = 0
        }
      }

      // Smoothly ease hero visibility & depth
      const presenceSpeed = st.heroTarget > st.heroPresence ? 0.16 : 0.055
      st.heroPresence += (st.heroTarget - st.heroPresence) * presenceSpeed

      if (st.heroPresence > 0.008) {
        heroGroup.visible = true
        const p = st.heroPresence

        // Gentle cinematic glide & tilt as the resume sheet turns
        const turnArc = Math.sin(st.turnProgress * Math.PI)
        const scale = 0.88 + p * 0.14 + turnArc * 0.03
        heroGroup.scale.setScalar(scale)
        heroGroup.position.x = 0.22 - st.turnProgress * 0.22 + st.mouseX * 0.16
        heroGroup.position.y = -0.22 + p * 0.18 + st.mouseY * 0.1
        heroGroup.rotation.y = -0.2 + st.mouseX * 0.09 + turnArc * 0.08
        heroGroup.rotation.x = -0.14 - st.mouseY * 0.05

        // Apply crisp opacity (higher when modal backdrop is focused, balanced translucent over page)
        const baseOp = st.modalOpen ? p * 0.94 : p * (isDark ? 0.42 : 0.56)
        underMat.opacity = baseOp
        turnFrontMat.opacity = baseOp
        turnBackMat.opacity = baseOp
        leftBaseMat.opacity = baseOp * 0.82
        spineMat.opacity = baseOp * 0.22
        for (let i = 0; i < stackMats.length; i++) {
          stackMats[i].opacity = baseOp * (0.65 - i * 0.16)
        }
      } else {
        heroGroup.visible = false
      }

      renderer.render(scene, camera)
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      disposePair(currentUnderTex)
      if (currentTurnTex !== currentUnderTex) disposePair(currentTurnTex)
      if (currentLeftTex !== currentTurnTex && currentLeftTex !== currentUnderTex) disposePair(currentLeftTex)
      disposePair(ambientPlaceholder)
      ambientGeo.dispose()
      ambientMaterials.forEach(m => m.dispose())
      pGeo.dispose()
      pMat.dispose()
      stackGeo.dispose()
      stackMats.forEach(m => m.dispose())
      leftBaseGeo.dispose()
      leftBaseMat.dispose()
      underGeo.dispose()
      underMat.dispose()
      turnGeo.dispose()
      turnFrontMat.dispose()
      turnBackMat.dispose()
      spineGeo.dispose()
      spineMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Fire page turn whenever turnEvent.seq changes!
  useEffect(() => {
    if (!turnEvent?.seq || !stateRef.current.triggerTurn) return
    stateRef.current.triggerTurn(turnEvent.person)
  }, [turnEvent])

  return (
    <div
      ref={hostRef}
      className={`paper-stage ${modalOpen ? 'modal-focus' : ''}`}
      aria-hidden="true"
    />
  )
}
