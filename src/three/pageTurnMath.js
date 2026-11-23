import * as THREE from 'three'

/**
 * Create a high-resolution PlaneGeometry anchored on its left spine (x in [0, width], y in [-h/2, h/2]).
 * Also returns a Float32Array snapshot of the rest vertex positions for fast zero-allocation deformation.
 */
export function createSheetGeometry(width = 2.6, height = 3.5, segX = 44, segY = 32) {
  const geo = new THREE.PlaneGeometry(width, height, segX, segY)
  geo.translate(width / 2, 0, 0)
  const basePositions = new Float32Array(geo.attributes.position.array)
  return { geo, basePositions, width, height }
}

/**
 * Physically-inspired curved 3D paper page-turn solver.
 * progress: 0 (resting flat on right) -> 1 (turned smoothly 180deg to left)
 * direction: 1 (forward turn right->left) or -1 (backward turn)
 */
export function deformPageTurn(geo, basePositions, width, height, progress, opts = {}) {
  const {
    curlStrength = 0.42,
    whipStrength = 0.24,
    spread = 0.3,
    cornerLead = 0.58,
    flutterAmp = 0.022
  } = opts

  const pos = geo.attributes.position
  const arr = pos.array
  const count = pos.count
  const pClamped = Math.max(0, Math.min(1, progress))

  if (pClamped <= 0.0001) {
    arr.set(basePositions)
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return
  }

  for (let i = 0; i < count; i++) {
    const ix = i * 3
    const x0 = basePositions[ix]
    const y0 = basePositions[ix + 1]

    const u = x0 / width // 0 at spine, 1 at outer edge
    const v = (y0 + height / 2) / height // 0 at bottom, 1 at top

    // Bottom-right corner lifts first (like a human thumb lifting the page corner)
    const lag = (v * cornerLead + (1 - u) * (1 - cornerLead)) * spread
    const raw = pClamped * (1 + spread) - lag
    const localP = raw <= 0 ? 0 : raw >= 1 ? 1 : raw

    // Quintic smoothstep for silky silk-like acceleration & landing
    const ep = localP * localP * localP * (localP * (localP * 6 - 15) + 10)
    const theta = ep * Math.PI
    const sinT = Math.sin(theta)
    const cosT = Math.cos(theta)

    // Natural radial compression so arching paper preserves sheet length
    const archEnvelope = Math.sin(u * Math.PI)
    const r = x0 * (1 - 0.045 * sinT * archEnvelope)

    // Base hinged coordinates
    let x = r * cosT
    let z = r * sinT

    // Convex paper belly + trailing outer edge whip + subtle air flutter
    const curl = sinT * archEnvelope * curlStrength
    const tipWhip = sinT * Math.pow(u, 2.15) * (0.46 - ep) * whipStrength
    const flutter = Math.sin(pClamped * Math.PI) * Math.sin(u * 5.2 - pClamped * 9.5) * flutterAmp * u
    const bend = curl + tipWhip + flutter

    // Apply bend along the sheet's local outward normal (-sinT, 0, cosT)
    x += -sinT * bend
    z += cosT * bend

    // Subtle vertical skew on corner lift so the turning corner sweeps organically
    const yLift = sinT * (1 - v) * u * 0.095

    arr[ix] = x
    arr[ix + 1] = y0 + yLift
    arr[ix + 2] = z
  }

  pos.needsUpdate = true
  geo.computeVertexNormals()
}

/**
 * Subtle tactile hover corner-peel on the bottom-right corner of a flat resume sheet.
 * amount: 0 (flat) -> 1 (gently curled corner)
 */
export function applyCornerPeel(geo, basePositions, width, height, amount) {
  const pos = geo.attributes.position
  const arr = pos.array
  const count = pos.count
  const a = Math.max(0, Math.min(1, amount))

  if (a <= 0.0005) {
    arr.set(basePositions)
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return
  }

  for (let i = 0; i < count; i++) {
    const ix = i * 3
    const x0 = basePositions[ix]
    const y0 = basePositions[ix + 1]

    const u = x0 / width // 0..1 left->right
    const v = (y0 + height / 2) / height // 0..1 bottom->top

    // Corner proximity factor concentrated around bottom-right (u=1, v=0)
    const d = Math.max(0, u + (1 - v) - 1.15) / 0.85
    const bend = d * d * a

    arr[ix] = x0 - bend * 0.34
    arr[ix + 1] = y0 + bend * 0.22
    arr[ix + 2] = bend * 0.62
  }

  pos.needsUpdate = true
  geo.computeVertexNormals()
}
