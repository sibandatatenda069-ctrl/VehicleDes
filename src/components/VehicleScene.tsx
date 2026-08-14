import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  AdaptiveDpr,
  ContactShadows,
  Environment,
  Grid,
  Html,
  Lightformer,
  MeshReflectorMaterial,
  OrbitControls,
  RoundedBox,
} from '@react-three/drei'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Mesh, Object3D } from 'three'
import * as THREE from 'three'
import type { BodyDefinition, BodyId, CategoryId, SlotId, VehicleState } from '../data'
import { bodyById, categorySlots, partById } from '../data'

const StudioEffects = lazy(() => import('./StudioEffects'))
const wheelSlots: SlotId[] = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']

type SceneProps = {
  vehicle: VehicleState
  activeCategory: CategoryId
  pendingPart?: string
  selectedSlot?: SlotId
  showSlots: boolean
  viewResetKey: number
  onSlotClick: (slot: SlotId) => void
  onVehicleReady: (object: Object3D | null) => void
}

type ModelProps = Omit<SceneProps, 'viewResetKey'>

function paintProperties(vehicle: VehicleState) {
  if (vehicle.finish === 'matte') return { roughness: 0.64, metalness: 0.1, clearcoat: 0.12, clearcoatRoughness: 0.72, envMapIntensity: 1.25, ior: 1.48, specularIntensity: 0.72 }
  if (vehicle.finish === 'satin') return { roughness: 0.32, metalness: 0.2, clearcoat: 0.52, clearcoatRoughness: 0.32, envMapIntensity: 1.55, ior: 1.5, specularIntensity: 0.9 }
  return { roughness: 0.14, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.075, envMapIntensity: 1.9, ior: 1.52, specularIntensity: 1 }
}

type GlassProfile = {
  frontBottom: [number, number]
  frontTop: [number, number]
  rearTop: [number, number]
  rearBottom: [number, number]
  roofControl: [number, number]
}

function glassProfile(body: BodyDefinition): GlassProfile {
  const l = body.length
  const lowerTop = body.wheelRadius + body.lowerHeight
  const roof = lowerTop + body.cabinHeight
  if (body.id === 'truck') {
    return {
      frontBottom: [l * 0.16, lowerTop + 0.12],
      frontTop: [l * (body.generationStyle === 'classic' ? 0.135 : body.generationStyle === 'revival' ? 0.115 : 0.1), roof - 0.16],
      rearTop: [-l * (body.generationStyle === 'classic' ? 0.135 : body.generationStyle === 'revival' ? 0.115 : 0.1), roof - 0.12],
      rearBottom: [-l * 0.15, lowerTop + 0.12],
      roofControl: [0, roof - 0.07],
    }
  }
  if (body.id === 'van') {
    return {
      frontBottom: [l * 0.36, lowerTop + 0.1],
      frontTop: [l * (body.generationStyle === 'classic' ? 0.345 : body.generationStyle === 'revival' ? 0.325 : 0.31), roof - 0.15],
      rearTop: [-l * (body.generationStyle === 'classic' ? 0.385 : body.generationStyle === 'revival' ? 0.365 : 0.35), roof - 0.14],
      rearBottom: [-l * 0.4, lowerTop + 0.1],
      roofControl: [0, roof - 0.07],
    }
  }
  if (body.id === 'muscle') {
    return {
      frontBottom: [l * 0.17, lowerTop + 0.1],
      frontTop: [l * (body.generationStyle === 'classic' ? 0.115 : body.generationStyle === 'revival' ? 0.08 : 0.055), roof - 0.14],
      rearTop: [-l * (body.generationStyle === 'classic' ? 0.22 : body.generationStyle === 'revival' ? 0.19 : 0.17), roof - 0.11],
      rearBottom: [-l * 0.27, lowerTop + 0.1],
      roofControl: [body.cabinX, roof - 0.035],
    }
  }
  return {
    frontBottom: [body.id === 'suv' ? l * 0.26 : l * 0.2, lowerTop + 0.1],
    frontTop: [body.id === 'suv'
      ? l * (body.generationStyle === 'classic' ? 0.22 : body.generationStyle === 'revival' ? 0.17 : 0.13)
      : l * (body.generationStyle === 'classic' ? 0.145 : body.generationStyle === 'revival' ? 0.1 : 0.07), roof - 0.14],
    rearTop: [body.id === 'suv'
      ? -l * (body.generationStyle === 'classic' ? 0.26 : body.generationStyle === 'revival' ? 0.22 : 0.19)
      : -l * (body.generationStyle === 'classic' ? 0.23 : body.generationStyle === 'revival' ? 0.19 : 0.16), roof - 0.12],
    rearBottom: [body.id === 'suv' ? -l * 0.3 : -l * 0.29, lowerTop + 0.1],
    roofControl: [body.cabinX, roof - (body.generationStyle === 'classic' ? 0.09 : 0.05)],
  }
}

type GlassWidths = {
  frontBottom: number
  frontTop: number
  rearTop: number
  rearBottom: number
  roof: number
}

function glassWidths(body: BodyDefinition): GlassWidths {
  switch (body.id) {
    case 'sports': return { frontBottom: 0.39, frontTop: 0.32, rearTop: 0.3, rearBottom: 0.355, roof: 0.31 }
    case 'muscle': return { frontBottom: 0.405, frontTop: 0.34, rearTop: 0.32, rearBottom: 0.375, roof: 0.33 }
    case 'suv': return { frontBottom: 0.42, frontTop: 0.37, rearTop: 0.35, rearBottom: 0.4, roof: 0.36 }
    case 'truck': return { frontBottom: 0.42, frontTop: 0.37, rearTop: 0.37, rearBottom: 0.415, roof: 0.37 }
    case 'van': return { frontBottom: 0.43, frontTop: 0.39, rearTop: 0.38, rearBottom: 0.425, roof: 0.39 }
    default: return { frontBottom: 0.405, frontTop: 0.345, rearTop: 0.32, rearBottom: 0.37, roof: 0.335 }
  }
}

type CurvePoint = readonly [number, number]
type BodyEnvelopeProfile = {
  width: readonly CurvePoint[]
  top: readonly CurvePoint[]
  clearance: number
  shoulder: number
  rocker: number
  square: number
}

const BODY_ENVELOPES: Record<BodyId, BodyEnvelopeProfile> = {
  sports: {
    width: [[0, 0.76], [0.08, 0.87], [0.18, 0.99], [0.34, 0.95], [0.5, 0.91], [0.68, 0.96], [0.81, 1], [0.94, 0.84], [1, 0.68]],
    top: [[0, 0.88], [0.08, 0.96], [0.18, 1], [0.34, 1.02], [0.55, 1.01], [0.72, 0.98], [0.82, 0.92], [0.94, 0.72], [1, 0.58]],
    clearance: 0.62, shoulder: 0.085, rocker: 0.13, square: 0.02,
  },
  muscle: {
    width: [[0, 0.8], [0.1, 0.94], [0.18, 1.02], [0.38, 0.98], [0.56, 0.96], [0.75, 1], [0.82, 1.02], [0.94, 0.94], [1, 0.84]],
    top: [[0, 0.92], [0.1, 0.99], [0.2, 1.02], [0.42, 1.04], [0.7, 1.05], [0.84, 1.02], [0.95, 0.9], [1, 0.82]],
    clearance: 0.64, shoulder: 0.11, rocker: 0.1, square: 0.13,
  },
  sedan: {
    width: [[0, 0.78], [0.1, 0.9], [0.18, 0.98], [0.36, 0.96], [0.54, 0.95], [0.72, 0.98], [0.82, 0.99], [0.94, 0.88], [1, 0.72]],
    top: [[0, 0.88], [0.1, 0.96], [0.2, 1], [0.4, 1.01], [0.58, 1.03], [0.74, 1], [0.84, 0.94], [0.95, 0.8], [1, 0.7]],
    clearance: 0.63, shoulder: 0.06, rocker: 0.085, square: 0.045,
  },
  suv: {
    width: [[0, 0.82], [0.09, 0.94], [0.18, 1], [0.38, 0.98], [0.56, 0.98], [0.72, 1], [0.82, 0.99], [0.94, 0.92], [1, 0.82]],
    top: [[0, 1.08], [0.1, 1.08], [0.2, 1.05], [0.42, 1.05], [0.6, 1.06], [0.76, 1.05], [0.86, 1], [0.96, 0.9], [1, 0.84]],
    clearance: 0.7, shoulder: 0.075, rocker: 0.06, square: 0.1,
  },
  truck: {
    width: [[0, 0.88], [0.08, 0.98], [0.18, 1], [0.38, 0.97], [0.56, 0.96], [0.72, 1], [0.82, 1.01], [0.94, 0.96], [1, 0.86]],
    top: [[0, 1], [0.08, 1.02], [0.2, 1.02], [0.48, 1.02], [0.62, 0.98], [0.76, 1.03], [0.86, 1.04], [0.96, 0.94], [1, 0.86]],
    clearance: 0.72, shoulder: 0.085, rocker: 0.045, square: 0.16,
  },
  van: {
    width: [[0, 0.88], [0.08, 0.97], [0.18, 1], [0.38, 0.99], [0.58, 0.99], [0.74, 1], [0.84, 0.98], [0.95, 0.9], [1, 0.74]],
    top: [[0, 1.12], [0.08, 1.1], [0.2, 1.06], [0.44, 1.06], [0.66, 1.07], [0.82, 1.03], [0.94, 0.94], [1, 0.82]],
    clearance: 0.62, shoulder: 0.055, rocker: 0.045, square: 0.12,
  },
}

function sampleCurve(points: readonly CurvePoint[], t: number) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const [startT, startValue] = points[index]
    const [endT, endValue] = points[index + 1]
    if (t <= endT) {
      const local = THREE.MathUtils.clamp((t - startT) / Math.max(0.0001, endT - startT), 0, 1)
      const smooth = local * local * (3 - 2 * local)
      return THREE.MathUtils.lerp(startValue, endValue, smooth)
    }
  }
  return points[points.length - 1][1]
}

function bodyEnvelope(body: BodyDefinition, t: number) {
  const profile = BODY_ENVELOPES[body.id]
  const frontFender = Math.exp(-Math.pow((t - 0.81) / 0.075, 2))
  const rearFender = Math.exp(-Math.pow((t - 0.18) / 0.08, 2))
  const race = body.generationStyle === 'race'
  const classic = body.generationStyle === 'classic'
  const fenderStrength = race ? 0.085 : body.id === 'muscle' ? 0.055 : body.id === 'sports' ? 0.05 : body.id === 'suv' || body.id === 'truck' ? 0.04 : 0.03
  return {
    widthScale: sampleCurve(profile.width, t) + frontFender * fenderStrength + rearFender * (fenderStrength + (body.id === 'sports' ? 0.015 : 0)),
    topScale: sampleCurve(profile.top, t) + (classic ? 0.018 : 0),
    clearance: profile.clearance,
    shoulder: profile.shoulder + (race ? 0.025 : 0),
    rocker: profile.rocker,
    square: profile.square + (classic ? 0.055 : 0),
  }
}

function shellGeometry(body: BodyDefinition) {
  const { length, width, wheelRadius, lowerHeight } = body
  const xSegments = body.generationStyle === 'classic' ? 36 : body.generationStyle === 'race' ? 52 : 42
  const ringSegments = body.generationStyle === 'classic' ? 48 : body.generationStyle === 'race' ? 64 : 56
  const positions: number[] = []
  const indices: number[] = []

  // Fresh body architecture: every family has its own measured longitudinal
  // envelope instead of inheriting a common rounded-box volume.
  for (let i = 0; i <= xSegments; i += 1) {
    const t = i / xSegments
    const x = -length / 2 + t * length
    const envelope = bodyEnvelope(body, t)
    const endRise = Math.pow(Math.abs(t - 0.5) * 2, 6) * wheelRadius * 0.1
    const bottomY = wheelRadius * envelope.clearance + endRise
    const topY = wheelRadius + lowerHeight * envelope.topScale
    const halfWidth = width * 0.5 * envelope.widthScale
    const halfHeight = Math.max(0.18, (topY - bottomY) / 2)
    const centerY = (topY + bottomY) / 2

    for (let j = 0; j < ringSegments; j += 1) {
      const angle = (j / ringSegments) * Math.PI * 2
      const side = Math.sin(angle)
      const vertical = Math.cos(angle)
      // Compound automotive section: a defined shoulder catches highlights,
      // while the lower rocker tucks inward instead of remaining slab-sided.
      const sideExponent = Math.max(0.5, 0.8 - envelope.square * 0.9)
      const verticalExponent = Math.max(0.46, 0.66 - envelope.square * 0.72)
      const sectionY = Math.sign(vertical) * Math.pow(Math.abs(vertical), verticalExponent)
      const shoulder = Math.exp(-Math.pow((sectionY - 0.28) / 0.23, 2))
      const rocker = Math.exp(-Math.pow((sectionY + 0.66) / 0.2, 2))
      const sectionWidth = 1 + shoulder * envelope.shoulder - rocker * envelope.rocker
      const z = Math.sign(side) * Math.pow(Math.abs(side), sideExponent) * halfWidth * sectionWidth
      const y = centerY + sectionY * halfHeight
      positions.push(x, y, z)
    }
  }

  const axleXs = [length * 0.31, -length * 0.32]
  const wheelOpeningRadius = wheelRadius * 1.13
  for (let i = 0; i < xSegments; i += 1) {
    for (let j = 0; j < ringSegments; j += 1) {
      const nextJ = (j + 1) % ringSegments
      const a = i * ringSegments + j
      const b = (i + 1) * ringSegments + j
      const c = (i + 1) * ringSegments + nextJ
      const d = i * ringSegments + nextJ
      const vertices = [a, b, c, d]
      const midX = vertices.reduce((sum, vertex) => sum + positions[vertex * 3], 0) / 4
      const midY = vertices.reduce((sum, vertex) => sum + positions[vertex * 3 + 1], 0) / 4
      const midZ = vertices.reduce((sum, vertex) => sum + positions[vertex * 3 + 2], 0) / 4
      const outerFlank = Math.abs(midZ) > width * 0.33
      const insideWheelOpening = axleXs.some((axleX) => Math.hypot(midX - axleX, midY - wheelRadius) < wheelOpeningRadius)
      // Leave an actual opening in each outer body flank. Previously the tire was
      // merely placed in front of a solid shell, forcing it to stick outside.
      if (outerFlank && insideWheelOpening) continue
      indices.push(a, b, d, b, c, d)
    }
  }

  // Close the sculpted nose and tail at the center of their unique profiles.
  const rearEnvelope = bodyEnvelope(body, 0)
  const frontEnvelope = bodyEnvelope(body, 1)
  const rearCenterY = (wheelRadius * rearEnvelope.clearance + wheelRadius * 0.1 + wheelRadius + lowerHeight * rearEnvelope.topScale) / 2
  const frontCenterY = (wheelRadius * frontEnvelope.clearance + wheelRadius * 0.1 + wheelRadius + lowerHeight * frontEnvelope.topScale) / 2
  const rearCenter = positions.length / 3
  positions.push(-length / 2, rearCenterY, 0)
  const frontCenter = positions.length / 3
  positions.push(length / 2, frontCenterY, 0)
  for (let j = 0; j < ringSegments; j += 1) {
    const nextJ = (j + 1) % ringSegments
    indices.push(rearCenter, nextJ, j)
    const frontStart = xSegments * ringSegments
    indices.push(frontCenter, frontStart + j, frontStart + nextJ)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function roofGeometry(body: BodyDefinition) {
  const profile = glassProfile(body)
  const widths = glassWidths(body)
  const xSegments = body.generationStyle === 'race' ? 28 : 20
  const widthSegments = body.generationStyle === 'race' ? 22 : 18
  const positions: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= xSegments; i += 1) {
    const t = i / xSegments
    const x = THREE.MathUtils.lerp(profile.rearTop[0] - 0.08, profile.frontTop[0] + 0.08, t)
    const baseY = THREE.MathUtils.lerp(profile.rearTop[1], profile.frontTop[1], t)
    const longitudinalArch = Math.sin(Math.PI * t) * (body.id === 'van' ? 0.07 : 0.11)
    const edgeWidth = body.width * widths.roof
    for (let j = 0; j <= widthSegments; j += 1) {
      const across = (j / widthSegments) * 2 - 1
      const lateralCrown = (1 - across * across) * 0.075
      positions.push(x, baseY + longitudinalArch + lateralCrown + 0.08, across * edgeWidth)
    }
  }

  for (let i = 0; i < xSegments; i += 1) {
    for (let j = 0; j < widthSegments; j += 1) {
      const row = widthSegments + 1
      const a = i * row + j
      const b = (i + 1) * row + j
      const c = (i + 1) * row + j + 1
      const d = i * row + j + 1
      indices.push(a, b, d, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function windshieldGeometry(body: BodyDefinition, rear = false) {
  const profile = glassProfile(body)
  const bottom = rear ? profile.rearBottom : profile.frontBottom
  const top = rear ? profile.rearTop : profile.frontTop
  const widthSegments = 24
  const heightSegments = 8
  const widths = glassWidths(body)
  const positions: number[] = []
  const indices: number[] = []
  const bottomHalfWidth = body.width * (rear ? widths.rearBottom : widths.frontBottom)
  const topHalfWidth = body.width * (rear ? widths.rearTop : widths.frontTop)
  const direction = rear ? -1 : 1

  for (let row = 0; row <= heightSegments; row += 1) {
    const verticalT = row / heightSegments
    const verticalCrown = Math.sin(verticalT * Math.PI)
    for (let j = 0; j <= widthSegments; j += 1) {
      const across = (j / widthSegments) * 2 - 1
      const centerBulge = 1 - across * across
      const compoundBulge = centerBulge * (0.025 + verticalCrown * 0.035)
      const x = THREE.MathUtils.lerp(bottom[0], top[0], verticalT) + direction * compoundBulge
      const y = THREE.MathUtils.lerp(bottom[1], top[1], verticalT) + centerBulge * (0.012 + verticalCrown * 0.016)
      const halfWidth = THREE.MathUtils.lerp(bottomHalfWidth, topHalfWidth, verticalT)
      positions.push(x, y, across * halfWidth)
    }
  }
  for (let row = 0; row < heightSegments; row += 1) {
    for (let j = 0; j < widthSegments; j += 1) {
      const stride = widthSegments + 1
      const a = row * stride + j
      const b = (row + 1) * stride + j
      const c = (row + 1) * stride + j + 1
      const d = row * stride + j + 1
      indices.push(a, b, d, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function sideGlassGeometry(body: BodyDefinition, side: -1 | 1) {
  const profile = glassProfile(body)
  const widths = glassWidths(body)
  const width = body.width
  const points: Array<[number, number, number]> = [
    [profile.frontBottom[0], profile.frontBottom[1], side * width * widths.frontBottom],
    [profile.frontTop[0], profile.frontTop[1], side * width * widths.frontTop],
    [profile.roofControl[0], profile.roofControl[1], side * width * widths.roof],
    [profile.rearTop[0], profile.rearTop[1], side * width * widths.rearTop],
    [profile.rearBottom[0], profile.rearBottom[1], side * width * widths.rearBottom],
  ]
  const center: [number, number, number] = [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
    points.reduce((sum, point) => sum + point[2], 0) / points.length + side * 0.018,
  ]
  const positions = [...points.flat(), ...center]
  const centerIndex = points.length
  const indices: number[] = []
  for (let i = 0; i < points.length; i += 1) indices.push(centerIndex, i, (i + 1) % points.length)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function bodyPanelGeometry(body: BodyDefinition, rear = false) {
  const xSegments = body.generationStyle === 'race' ? 28 : 20
  const widthSegments = body.generationStyle === 'race' ? 22 : 18
  const profile = glassProfile(body)
  const innerX = rear ? profile.rearBottom[0] + 0.02 : profile.frontBottom[0] - 0.02
  const outerX = rear ? -body.length / 2 + 0.12 : body.length / 2 - 0.12
  const positions: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= xSegments; i += 1) {
    const t = i / xSegments
    const x = THREE.MathUtils.lerp(innerX, outerX, t)
    const longitudinalT = (x + body.length / 2) / body.length
    const envelope = bodyEnvelope(body, longitudinalT)
    const panelY = body.wheelRadius + body.lowerHeight * envelope.topScale + 0.025
    const halfWidth = body.width * 0.5 * envelope.widthScale * (rear ? 0.82 : 0.8)
    for (let j = 0; j <= widthSegments; j += 1) {
      const across = (j / widthSegments) * 2 - 1
      const crown = (1 - across * across) * (rear ? 0.04 : 0.06)
      const edgeDrop = Math.pow(Math.abs(across), 2.4) * 0.045
      positions.push(x, panelY + crown - edgeDrop, across * halfWidth)
    }
  }
  for (let i = 0; i < xSegments; i += 1) {
    for (let j = 0; j < widthSegments; j += 1) {
      const row = widthSegments + 1
      const a = i * row + j
      const b = (i + 1) * row + j
      const c = (i + 1) * row + j + 1
      const d = i * row + j + 1
      indices.push(a, b, d, b, c, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function wheelPosition(slot: SlotId, body: BodyDefinition, wheelId?: string): [number, number, number] {
  const frontX = body.length * 0.31
  const rearX = -body.length * 0.32
  const offroad = ['wheel_offroad', 'wheel_beadlock', 'wheel_dakar'].includes(wheelId ?? '')
  const wideBody = body.id === 'muscle' || body.generationStyle === 'race'
  const wheelWidth = offroad ? 0.4 : wideBody ? 0.35 : 0.3
  // Sample the actual fender surface at this axle. This keeps every tire flush
  // with its own body—not with an approximate nominal vehicle width.
  const axleX = slot === 'wheel_rl' || slot === 'wheel_rr' ? rearX : frontX
  const archSurface = bodySurface(body, axleX).side
  const sidewallInset = body.generationStyle === 'race' || offroad ? 0 : body.id === 'muscle' ? 0.008 : 0.015
  const sideZ = archSurface - sidewallInset - (wheelWidth / 2 + 0.018)
  const wheelY = body.wheelRadius
  const map: Record<SlotId, [number, number, number]> = {
    wheel_fl: [frontX, wheelY, sideZ],
    wheel_fr: [frontX, wheelY, -sideZ],
    wheel_rl: [rearX, wheelY, sideZ],
    wheel_rr: [rearX, wheelY, -sideZ],
    headlight_l: [body.length / 2 + 0.025, wheelY + body.lowerHeight * 0.58, body.width * 0.31],
    headlight_r: [body.length / 2 + 0.025, wheelY + body.lowerHeight * 0.58, -body.width * 0.31],
    grille: [body.length / 2 + 0.07, wheelY + body.lowerHeight * 0.28, 0],
    spoiler: [-body.length / 2 + 0.28, wheelY + body.lowerHeight + 0.36, 0],
    bumper_front: [body.length / 2 + 0.11, wheelY + body.lowerHeight * 0.1, 0],
    bumper_rear: [-body.length / 2 - 0.11, wheelY + body.lowerHeight * 0.1, 0],
    windows: [body.cabinX, wheelY + body.lowerHeight + body.cabinHeight * 0.54, body.width / 2 + 0.13],
  }
  return map[slot]
}

function Wheel({
  position,
  id,
  color,
  radius,
  selected,
  wide,
  race,
  onClick,
}: {
  position: [number, number, number]
  id?: string
  color: string
  radius: number
  selected: boolean
  wide?: boolean
  race?: boolean
  onClick: () => void
}) {
  const isOffroad = id === 'wheel_offroad' || id === 'wheel_beadlock' || id === 'wheel_dakar'
  const isSteelie = id === 'wheel_steelie'
  const isBeadlock = id === 'wheel_beadlock' || id === 'wheel_dakar'
  const isConcave = id === 'wheel_concave' || id === 'wheel_split5'
  const isCenterlock = id === 'wheel_centerlock' || id === 'wheel_rally'
  const isDisc = id === 'wheel_disc' || id === 'wheel_aeroring' || id === 'wheel_retro_turbo' || isSteelie
  const isDeepDish = id === 'wheel_deepdish' || id === 'wheel_drag'
  const spokeCounts: Record<string, number> = {
    wheel_concave: 10, wheel_centerlock: 10, wheel_rally: 12, wheel_mesh: 12,
    wheel_classic: 5, wheel_deepdish: 5, wheel_turbine: 9, wheel_monoblock: 6,
    wheel_split5: 10, wheel_carbon: 7, wheel_drag: 5, wheel_lowrider: 20,
    wheel_dakar: 8, wheel_luxury: 15,
  }
  const spokeCount = spokeCounts[id ?? ''] ?? 7
  const width = isOffroad ? 0.4 : wide ? 0.35 : 0.3
  const side = position[2] > 0 ? 1 : -1
  const outerFace = side * (width / 2 - 0.012)
  const discFace = side * (width / 2 - 0.052)

  return (
    <group position={position} onClick={(event) => { event.stopPropagation(); onClick() }} name={`Wheel_${id ?? 'standard'}`}>
      {/* rounded sidewalls and tread carcass */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.97, radius * 0.97, width, isOffroad ? 22 : 56]} />
        <meshStandardMaterial color="#0b0c0b" roughness={0.86} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0, outerFace]} scale={[1, 1, 0.26]}>
        <torusGeometry args={[radius * 0.79, radius * 0.18, 12, 56]} />
        <meshStandardMaterial color="#111310" roughness={0.9} />
      </mesh>
      {race && (
        <>
          <mesh position={[0, 0, outerFace + side * 0.022]}>
            <torusGeometry args={[radius * 0.86, 0.012, 6, 64]} />
            <meshBasicMaterial color="#396ce8" toneMapped={false} />
          </mesh>
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index / 12) * Math.PI * 2
            return (
              <mesh key={`sidewall-mark-${index}`} position={[Math.cos(angle) * radius * 0.88, Math.sin(angle) * radius * 0.88, outerFace + side * 0.026]} rotation={[0, 0, angle]}>
                <boxGeometry args={[0.055, 0.014, 0.008]} />
                <meshBasicMaterial color={index % 3 === 0 ? '#f3f5f0' : '#3768df'} toneMapped={false} />
              </mesh>
            )
          })}
        </>
      )}
      {/* individual tread blocks */}
      {Array.from({ length: isOffroad ? 20 : 28 }).map((_, index) => {
        const angle = (index / (isOffroad ? 20 : 28)) * Math.PI * 2
        return (
          <mesh
            key={`tread-${index}`}
            position={[Math.cos(angle) * radius * 0.98, Math.sin(angle) * radius * 0.98, 0]}
            rotation={[0, 0, angle]}
            castShadow
          >
            <boxGeometry args={[isOffroad ? 0.12 : 0.055, isOffroad ? 0.09 : 0.045, width + 0.035]} />
            <meshStandardMaterial color="#080908" roughness={0.96} />
          </mesh>
        )
      })}
      {/* ventilated brake rotor */}
      <mesh position={[0, 0, discFace]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.57, radius * 0.57, 0.035, 48]} />
        <meshStandardMaterial color="#777f7b" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, side * (width / 2 - 0.028)]}>
        <torusGeometry args={[radius * 0.45, 0.018, 7, 40]} />
        <meshStandardMaterial color="#c5cbc8" metalness={0.9} roughness={0.18} />
      </mesh>
      {Array.from({ length: 10 }).map((_, index) => {
        const angle = (index / 10) * Math.PI * 2
        return (
          <mesh key={`rotor-hole-${index}`} position={[Math.cos(angle) * radius * 0.43, Math.sin(angle) * radius * 0.43, side * (width / 2 - 0.02)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.012, 8]} />
            <meshBasicMaterial color="#202421" />
          </mesh>
        )
      })}
      {/* brake caliper */}
      <RoundedBox args={[radius * 0.16, radius * 0.42, 0.055]} radius={0.035} smoothness={2} position={[radius * 0.33, 0, side * (width / 2 - 0.012)]}>
        <meshStandardMaterial color={id === 'wheel_forged' ? '#c7ff52' : '#d84b39'} metalness={0.28} roughness={0.3} />
      </RoundedBox>
      {/* rim barrel */}
      <mesh position={[0, 0, side * (width / 2 - 0.01)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.72, radius * 0.72, 0.045, 56]} />
        <meshPhysicalMaterial color={isSteelie ? '#3d4440' : isDisc || isDeepDish ? '#cbd2cf' : '#171a18'} metalness={0.9} roughness={isSteelie ? 0.34 : 0.2} clearcoat={0.6} />
      </mesh>
      {isSteelie && Array.from({ length: 8 }).map((_, index) => {
        const angle = (index / 8) * Math.PI * 2
        return (
          <mesh key={`steel-vent-${index}`} position={[Math.cos(angle) * radius * 0.43, Math.sin(angle) * radius * 0.43, side * (width / 2 + 0.012)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[radius * 0.075, radius * 0.075, 0.025, 12]} />
            <meshBasicMaterial color="#111411" />
          </mesh>
        )
      })}
      {id === 'wheel_retro_turbo' && Array.from({ length: 12 }).map((_, index) => {
        const angle = (index / 12) * Math.PI * 2
        return <mesh key={`turbo-vane-${index}`} position={[Math.cos(angle) * radius * 0.42, Math.sin(angle) * radius * 0.42, side * (width / 2 + 0.016)]} rotation={[0, 0, angle + 0.34]}><boxGeometry args={[radius * 0.34, 0.028, 0.025]} /><meshStandardMaterial color="#555e59" metalness={0.88} roughness={0.22} /></mesh>
      })}
      {id === 'wheel_split5' && Array.from({ length: 10 }).map((_, index) => {
        const angle = (index / 10) * Math.PI * 2
        return <mesh key={`split-bolt-${index}`} position={[Math.cos(angle) * radius * 0.63, Math.sin(angle) * radius * 0.63, side * (width / 2 + 0.025)]}><sphereGeometry args={[0.012, 8, 6]} /><meshStandardMaterial color="#eef1ee" metalness={1} roughness={0.12} /></mesh>
      })}
      {id === 'wheel_drag' && <mesh position={[0, 0, side * (width / 2 + 0.015)]}><torusGeometry args={[radius * 0.66, 0.034, 8, 48]} /><meshStandardMaterial color="#c69b4d" metalness={0.94} roughness={0.18} /></mesh>}
      {isBeadlock && (
        <>
          <mesh position={[0, 0, side * (width / 2 + 0.012)]}>
            <torusGeometry args={[radius * 0.62, 0.027, 8, 48]} />
            <meshStandardMaterial color="#c6a35e" metalness={0.82} roughness={0.25} />
          </mesh>
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index / 12) * Math.PI * 2
            return (
              <mesh key={`bead-bolt-${index}`} position={[Math.cos(angle) * radius * 0.62, Math.sin(angle) * radius * 0.62, side * (width / 2 + 0.028)]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 0.018, 8]} />
                <meshStandardMaterial color="#e2d1a8" metalness={1} roughness={0.17} />
              </mesh>
            )
          })}
        </>
      )}
      {!isDisc && Array.from({ length: spokeCount }).map((_, index) => {
        const angle = (index / spokeCount) * Math.PI * 2
        return (
          <mesh key={`spoke-${index}`} position={[0, 0, side * (width / 2 + (isConcave ? 0.006 : 0.012))]} rotation={[isConcave ? side * 0.12 : 0, 0, angle]}>
            <boxGeometry args={[radius * (isConcave ? 0.72 : 0.68), radius * (id === 'wheel_mesh' || isConcave ? 0.045 : 0.07), isConcave ? 0.055 : 0.045]} />
            <meshPhysicalMaterial color={color} metalness={0.92} roughness={0.17} clearcoat={0.65} />
          </mesh>
        )
      })}
      {id === 'wheel_aeroring' && <mesh position={[0, 0, side * (width / 2 + 0.012)]}><torusGeometry args={[radius * 0.58, 0.024, 8, 48]} /><meshStandardMaterial color="#74d5dd" emissive="#255e65" emissiveIntensity={0.32} metalness={0.72} /></mesh>}
      {id === 'wheel_carbon' && <mesh position={[0, 0, side * (width / 2 + 0.012)]}><torusGeometry args={[radius * 0.5, 0.032, 8, 42]} /><meshStandardMaterial color="#111513" metalness={0.66} roughness={0.18} /></mesh>}
      {id === 'wheel_luxury' && <mesh position={[0, 0, side * (width / 2 + 0.012)]}><torusGeometry args={[radius * 0.35, 0.022, 7, 40]} /><meshStandardMaterial color="#e1e5e2" metalness={0.96} roughness={0.12} /></mesh>}
      <mesh position={[0, 0, side * (width / 2 + 0.014)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.13, radius * 0.13, 0.04, 28]} />
        <meshStandardMaterial color={isCenterlock ? '#d5a63f' : '#aeb8b4'} metalness={0.95} roughness={0.16} emissive={selected ? '#8fce30' : '#000'} emissiveIntensity={selected ? 0.45 : 0} />
      </mesh>
      {!isCenterlock && Array.from({ length: 5 }).map((_, index) => {
        const angle = (index / 5) * Math.PI * 2
        return (
          <mesh key={`lug-${index}`} position={[Math.cos(angle) * radius * 0.2, Math.sin(angle) * radius * 0.2, side * (width / 2 + 0.035)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.018, 10]} />
            <meshStandardMaterial color="#dce1df" metalness={1} roughness={0.12} />
          </mesh>
        )
      })}
    </group>
  )
}

function Headlight({ position, body, id, selected, onClick }: { position: [number, number, number]; body: BodyDefinition; id?: string; selected: boolean; onClick: () => void }) {
  const familyScaleY = body.id === 'truck' ? 1.28 : body.id === 'van' ? 1.22 : body.id === 'suv' ? 1.16 : body.id === 'sports' ? 0.84 : 1
  const familyScaleZ = body.id === 'muscle' ? 1.14 : body.id === 'truck' ? 1.1 : body.id === 'sports' ? 1.08 : 1
  const quad = id === 'light_quad'
  const projector = id === 'light_projector'
  const rally = id === 'light_rally'
  const vertical = id === 'light_vertical' || id === 'light_split'
  const pixel = id === 'light_pixel'
  const endurance = id === 'light_endurance'
  const raceblade = id === 'light_raceblade' || endurance
  const dual = quad || projector || id === 'light_diamond'
  const round = id === 'light_round' || id === 'light_classic' || id === 'light_classic_round' || id === 'light_popups' || dual || rally
  return (
    <group position={position} scale={[1, familyScaleY, familyScaleZ]} onClick={(event) => { event.stopPropagation(); onClick() }} name={`Headlight_${id}`}>
      <pointLight position={[0.18, 0, 0]} color="#dffaff" intensity={0.32} distance={2.4} decay={2} />
      <RoundedBox args={[0.11, rally ? 0.4 : round ? 0.36 : vertical ? 0.44 : raceblade ? 0.26 : 0.3, dual ? 0.44 : round ? 0.38 : raceblade ? 0.62 : 0.55]} radius={0.07} smoothness={3}>
        <meshStandardMaterial color="#131918" metalness={0.58} roughness={0.2} emissive={selected ? '#81c42c' : '#000'} emissiveIntensity={0.35} />
      </RoundedBox>
      {round ? (
        <>
          {(dual ? [-0.09, 0.09] : [0]).map((z) => (
            <group key={z} position={[0, 0, z]}>
              <mesh position={[0.068, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[dual ? 0.078 : rally ? 0.13 : 0.115, dual ? 0.018 : 0.025, 12, 36]} />
                <meshStandardMaterial color="#e8fdff" emissive="#d8fbff" emissiveIntensity={4.2} toneMapped={false} />
              </mesh>
              <mesh position={[0.07, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <circleGeometry args={[dual ? 0.048 : rally ? 0.085 : 0.07, 28]} />
                <meshPhysicalMaterial color={rally ? '#fff1c8' : '#d9f7fb'} transmission={0.45} opacity={0.78} transparent roughness={0.03} />
              </mesh>
            </group>
          ))}
        </>
      ) : (
        <>
          {(vertical ? [-0.135, -0.045, 0.045, 0.135] : raceblade ? [-0.24, -0.145, -0.05, 0.05, 0.145, 0.24] : pixel ? [-0.2, -0.12, -0.04, 0.04, 0.12, 0.2] : [-0.105, 0, 0.105]).map((value) => (
            <mesh key={value} position={[0.071, vertical ? value : raceblade ? 0.04 - Math.abs(value) * 0.22 : pixel ? (Math.round((value + 0.2) / 0.08) % 2 ? -0.035 : 0.035) : 0.02, vertical ? 0 : value]}>
              <boxGeometry args={vertical ? [0.02, 0.026, 0.34] : raceblade ? [0.02, endurance ? 0.075 : 0.055, 0.048] : pixel ? [0.02, 0.052, 0.052] : [0.02, id === 'light_slash' ? 0.035 : id === 'light_boxtype' ? 0.15 : 0.11, 0.06]} />
              <meshStandardMaterial color="#e9fdff" emissive="#d5faff" emissiveIntensity={4} toneMapped={false} />
            </mesh>
          ))}
          <mesh position={[0.078, -0.105, 0]}>
            <boxGeometry args={[0.02, 0.018, 0.42]} />
            <meshBasicMaterial color="#f2ffff" toneMapped={false} />
          </mesh>
        </>
      )}
      {id === 'light_neon' && <mesh position={[0.082, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1.7, 0.7]}><torusGeometry args={[0.16, 0.018, 8, 48]} /><meshStandardMaterial color="#e4ffff" emissive="#a9f4ff" emissiveIntensity={4.5} toneMapped={false} /></mesh>}
      {id === 'light_split' && <mesh position={[0.084, 0, 0]}><boxGeometry args={[0.018, 0.03, 0.48]} /><meshStandardMaterial color="#efffff" emissive="#bff7ff" emissiveIntensity={4} toneMapped={false} /></mesh>}
      {id === 'light_popups' && <RoundedBox args={[0.16, 0.09, 0.36]} radius={0.035} smoothness={3} position={[-0.065, 0.17, 0]} rotation={[0, 0, -0.1]}><meshStandardMaterial color="#202622" metalness={0.42} roughness={0.28} /></RoundedBox>}
      {id === 'light_diamond' && [-0.09, 0.09].map((z) => <mesh key={`diamond-bezel-${z}`} position={[0.082, 0, z]} rotation={[0, Math.PI / 2, Math.PI / 4]}><ringGeometry args={[0.07, 0.095, 4]} /><meshStandardMaterial color="#dce8e5" metalness={0.86} roughness={0.16} side={THREE.DoubleSide} /></mesh>)}
      {id === 'light_classic_round' && <><mesh position={[0.084, 0, 0]}><boxGeometry args={[0.018, 0.025, 0.25]} /><meshStandardMaterial color="#e9d7a9" emissive="#d6b875" emissiveIntensity={0.8} /></mesh><mesh position={[0.085, 0, 0]}><boxGeometry args={[0.018, 0.25, 0.025]} /><meshStandardMaterial color="#e9d7a9" emissive="#d6b875" emissiveIntensity={0.8} /></mesh></>}
      <mesh position={[0.088, 0, 0]}>
        <boxGeometry args={[0.025, rally ? 0.37 : round ? 0.33 : vertical ? 0.41 : raceblade ? 0.23 : 0.27, dual ? 0.41 : round ? 0.35 : raceblade ? 0.59 : 0.51]} />
        <meshPhysicalMaterial color="#dff9fb" transparent opacity={0.24} transmission={0.42} roughness={0.03} clearcoat={1} />
      </mesh>
    </group>
  )
}

function Grille({ body, id, color, selected, onClick }: { body: BodyDefinition; id?: string; color: string; selected: boolean; onClick: () => void }) {
  const raceMesh = id === 'grille_race'
  const honeycomb = id === 'grille_honeycomb' || id === 'grille_mesh_fine' || id === 'grille_heritage_mesh' || raceMesh
  const closed = id === 'grille_ev'
  const horizontal = id === 'grille_slat' || id === 'grille_louvered'
  const turbine = id === 'grille_turbine'
  const fineMesh = id === 'grille_mesh_fine'
  const heritageMesh = id === 'grille_heritage_mesh'
  const meshColumns = fineMesh ? 9 : 7
  const meshRows = fineMesh ? 5 : 4
  const bars = id === 'grille_billet' ? 12 : id === 'grille_vertical' ? 9 : id === 'grille_bar' || id === 'grille_louvered' ? 8 : id === 'grille_chrome' ? 6 : id === 'grille_twin' ? 2 : 5
  const heightFactor = body.id === 'truck' ? 0.68 : body.id === 'suv' ? 0.6 : body.id === 'van' ? 0.56 : body.id === 'muscle' ? 0.5 : body.id === 'sedan' ? 0.4 : 0.38
  const widthFactor = body.id === 'truck' ? 0.76 : body.id === 'suv' ? 0.68 : body.id === 'van' ? 0.64 : body.id === 'muscle' ? 0.66 : body.id === 'sports' ? 0.55 : 0.52
  const verticalCenter = body.id === 'truck' ? 0.47 : body.id === 'suv' ? 0.43 : body.id === 'van' ? 0.42 : body.id === 'muscle' ? 0.4 : body.id === 'sedan' ? 0.36 : 0.32
  const grilleHeight = body.lowerHeight * heightFactor
  const grilleWidth = body.width * widthFactor
  return (
    <group position={[body.length / 2 + 0.045, body.wheelRadius + body.lowerHeight * verticalCenter, 0]} onClick={(e) => { e.stopPropagation(); onClick() }} name={`Grille_${id}`}>
      <RoundedBox args={[0.11, grilleHeight, grilleWidth]} radius={body.id === 'truck' || body.generationStyle === 'classic' ? 0.045 : 0.08} smoothness={4}>
        <meshStandardMaterial color={closed ? '#40504f' : '#0b0e0d'} metalness={closed ? 0.62 : 0.46} roughness={closed ? 0.2 : 0.3} emissive={selected ? '#8ccf2d' : '#000'} emissiveIntensity={0.25} />
      </RoundedBox>
      {honeycomb ? Array.from({ length: meshColumns * meshRows }).map((_, index) => {
        const row = Math.floor(index / meshColumns)
        const column = index % meshColumns
        return (
          <mesh key={index} position={[0.069, (row - (meshRows - 1) / 2) * grilleHeight * (fineMesh ? 0.155 : 0.2), (column - (meshColumns - 1) / 2) * grilleWidth * (fineMesh ? 0.096 : 0.126) + (row % 2 ? grilleWidth * (fineMesh ? 0.045 : 0.06) : 0)]} rotation={[0, Math.PI / 2, heritageMesh ? Math.PI / 4 : 0]}>
            <ringGeometry args={[fineMesh ? 0.012 : heritageMesh ? 0.018 : 0.022, fineMesh ? 0.022 : heritageMesh ? 0.033 : 0.036, heritageMesh ? 4 : 6]} />
            <meshStandardMaterial color={heritageMesh ? '#dbe2df' : fineMesh ? '#89928e' : '#56605b'} metalness={heritageMesh ? 0.94 : 0.68} roughness={heritageMesh ? 0.16 : 0.28} side={THREE.DoubleSide} />
          </mesh>
        )
      }) : !closed && !horizontal && !turbine && Array.from({ length: bars }).map((_, index) => (
        <RoundedBox key={index} args={[0.032, grilleHeight * 0.82, id === 'grille_hex' ? 0.025 : 0.035]} radius={0.01} smoothness={2} position={[0.067, 0, ((index - (bars - 1) / 2) / bars) * grilleWidth * 0.86]}>
          <meshStandardMaterial color={id === 'grille_chrome' || id === 'grille_vertical' ? '#d7dfdc' : color} metalness={0.94} roughness={0.17} />
        </RoundedBox>
      ))}
      {horizontal && Array.from({ length: bars }).map((_, index) => (
        <RoundedBox key={`slat-${index}`} args={[0.035, grilleHeight * 0.055, grilleWidth * 0.88]} radius={0.008} smoothness={2} position={[0.071, ((index - (bars - 1) / 2) / bars) * grilleHeight * 0.75, 0]} rotation={[id === 'grille_louvered' ? -0.2 : 0, 0, 0]}>
          <meshStandardMaterial color={id === 'grille_slat' ? '#cdd5d1' : color} metalness={0.9} roughness={0.2} />
        </RoundedBox>
      ))}
      {turbine && Array.from({ length: 10 }).map((_, index) => (
        <mesh key={`turbine-${index}`} position={[0.075, 0, 0]} rotation={[index * Math.PI / 10, 0, 0]}>
          <boxGeometry args={[0.03, grilleHeight * 0.72, 0.025]} />
          <meshStandardMaterial color="#7d8782" metalness={0.9} roughness={0.22} />
        </mesh>
      ))}
      {id === 'grille_crosshair' && <><RoundedBox args={[0.04, 0.055, grilleWidth * 0.96]} radius={0.014} smoothness={2} position={[0.078, 0, 0]}><meshStandardMaterial color="#d2dad6" metalness={0.95} roughness={0.15} /></RoundedBox><RoundedBox args={[0.04, grilleHeight * 0.92, 0.055]} radius={0.014} smoothness={2} position={[0.078, 0, 0]}><meshStandardMaterial color="#d2dad6" metalness={0.95} roughness={0.15} /></RoundedBox></>}
      {id === 'grille_splitter' && [-0.25, 0.25].map((z) => <RoundedBox key={`split-port-${z}`} args={[0.04, grilleHeight * 0.9, 0.04]} radius={0.012} smoothness={2} position={[0.078, 0, z * grilleWidth * 1.8]}><meshStandardMaterial color="#aeb7b3" metalness={0.9} roughness={0.2} /></RoundedBox>)}
      <mesh position={[0.076, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[0.055, 0.075, 32]} />
        <meshStandardMaterial color="#d7dfdc" metalness={1} roughness={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Spoiler({ body, id, color, selected, onClick }: { body: BodyDefinition; id?: string; color: string; selected: boolean; onClick: () => void }) {
  const lip = id === 'spoiler_lip' || id === 'spoiler_muscle' || id === 'spoiler_drag' || id === 'spoiler_cleanlip'
  const active = id === 'spoiler_active'
  const roofMount = id === 'spoiler_roof' || id === 'spoiler_rallyroof'
  const shark = id === 'spoiler_shark'
  const gt3 = id === 'spoiler_gt3' || id === 'spoiler_endurance'
  const extreme = id === 'spoiler_timeattack'
  const pedestal = id === 'spoiler_pedestal' || id === 'spoiler_touring' || id === 'spoiler_double' || gt3 || extreme
  const height = lip ? 0.07 : roofMount ? 0.16 : active ? 0.18 : extreme ? 0.78 : gt3 ? 0.68 : id === 'spoiler_touring' ? 0.38 : pedestal ? 0.56 : id === 'spoiler_heritage' ? 0.28 : 0.42
  const x = roofMount ? glassProfile(body).rearTop[0] - 0.06 : -body.length / 2 + 0.32
  const mountY = roofMount ? body.wheelRadius + body.lowerHeight + body.cabinHeight + 0.03 : body.wheelRadius + body.lowerHeight
  const y = mountY + (lip ? 0.035 : height)
  return (
    <group position={[x, y, 0]} onClick={(e) => { e.stopPropagation(); onClick() }} name={`Spoiler_${id}`}>
      {!lip && !shark && [-0.63, 0.63].map((z) => (
        <RoundedBox key={z} args={[0.09, height, 0.075]} radius={0.025} smoothness={2} position={[0, -height / 2, z]} rotation={[0, 0, -0.08]}>
          <meshStandardMaterial color={color} metalness={0.44} roughness={0.26} />
        </RoundedBox>
      ))}
      {gt3 && [-0.66, 0.66].map((z) => (
        <RoundedBox key={`swan-${z}`} args={[0.32, 0.07, 0.055]} radius={0.025} smoothness={2} position={[0.14, -height * 0.38, z]} rotation={[0, 0, -0.8]}>
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.24} />
        </RoundedBox>
      ))}
      {!shark && <RoundedBox args={[id === 'spoiler_cleanlip' ? 0.14 : id === 'spoiler_drag' ? 0.12 : lip ? 0.22 : active ? 0.27 : roofMount ? 0.3 : extreme ? 0.55 : gt3 ? 0.46 : 0.38, active ? 0.055 : 0.075, body.width * (id === 'spoiler_drag' ? 0.84 : id === 'spoiler_cleanlip' ? 0.62 : lip ? 0.73 : roofMount ? 0.82 : active ? 0.76 : extreme ? 1.02 : gt3 ? 0.96 : 0.91)]} radius={0.04} smoothness={3} rotation={[id === 'spoiler_split' ? 0.06 : active ? -0.12 : gt3 || extreme ? -0.08 : -0.025, 0, -0.06]}>
        <meshPhysicalMaterial color={color} metalness={0.56} roughness={0.21} clearcoat={0.7} emissive={selected ? '#92d534' : '#000'} emissiveIntensity={0.18} />
      </RoundedBox>}
      {id === 'spoiler_double' && <RoundedBox args={[0.3, 0.06, body.width * 0.86]} radius={0.035} smoothness={3} position={[-0.12, -0.14, 0]} rotation={[0.08, 0, -0.04]}><meshPhysicalMaterial color={color} metalness={0.56} roughness={0.21} clearcoat={0.7} /></RoundedBox>}
      {id === 'spoiler_drag' && <RoundedBox args={[0.04, 0.11, body.width * 0.83]} radius={0.018} smoothness={2} position={[-0.035, 0.045, 0]} rotation={[0, 0, -0.04]}><meshStandardMaterial color="#171b18" metalness={0.5} roughness={0.28} /></RoundedBox>}
      {id === 'spoiler_rallyroof' && [-0.32, 0, 0.32].map((z) => <mesh key={`roof-fin-${z}`} position={[-0.08, 0.07, z]} rotation={[0, 0, -0.2]}><boxGeometry args={[0.24, 0.09, 0.025]} /><meshStandardMaterial color={color} metalness={0.44} roughness={0.27} /></mesh>)}
      {id === 'spoiler_endurance' && <RoundedBox args={[0.05, 0.1, body.width * 0.93]} radius={0.018} smoothness={2} position={[-0.19, 0.05, 0]}><meshStandardMaterial color="#111512" metalness={0.5} roughness={0.24} /></RoundedBox>}
      {shark && <RoundedBox args={[0.62, 0.34, 0.055]} radius={0.035} smoothness={3} position={[0, -0.16, 0]} rotation={[0, 0, -0.24]}><meshPhysicalMaterial color={color} metalness={0.5} roughness={0.24} clearcoat={0.65} /></RoundedBox>}
      {!lip && !active && !roofMount && !shark && [-1, 1].map((side) => (
        <mesh key={side} position={[0, 0.015, side * body.width * 0.46]}>
          <boxGeometry args={[0.34, 0.21, 0.035]} />
          <meshStandardMaterial color={color} metalness={0.45} roughness={0.27} />
        </mesh>
      ))}
    </group>
  )
}

function Bumper({ body, rear, id, color, selected, onClick }: { body: BodyDefinition; rear?: boolean; id?: string; color: string; selected: boolean; onClick: () => void }) {
  const x = (rear ? -1 : 1) * (body.length / 2 + 0.055)
  const rally = id === 'bumper_rally'
  const offroad = id === 'bumper_offroad'
  const utility = id === 'bumper_utility'
  const safari = id === 'bumper_safari'
  const armored = rally || offroad || utility || safari
  const classic = id === 'bumper_classic' || id === 'bumper_retro'
  const race = id === 'bumper_race' || id === 'bumper_timeattack' || id === 'bumper_endurance'
  const gt = id === 'bumper_gt' || id === 'bumper_touring' || race
  return (
    <group position={[x, body.wheelRadius + body.lowerHeight * 0.1, 0]} onClick={(e) => { e.stopPropagation(); onClick() }} name={`${rear ? 'Rear' : 'Front'}_Bumper_${id}`}>
      <RoundedBox args={[armored ? 0.2 : 0.13, armored ? 0.34 : classic ? 0.17 : 0.2, body.width * (offroad ? 0.86 : 0.91)]} radius={classic ? 0.035 : 0.06} smoothness={3}>
        <meshPhysicalMaterial color={id === 'bumper_chrome' || classic ? '#d7dfdc' : color} metalness={id === 'bumper_chrome' || classic ? 0.94 : armored ? 0.72 : 0.25} roughness={id === 'bumper_chrome' || classic ? 0.16 : 0.34} clearcoat={0.35} emissive={selected ? '#91d22f' : '#000'} emissiveIntensity={0.14} />
      </RoundedBox>
      {!rear && id === 'bumper_sport' && [-0.67, 0.67].map((z) => (
        <mesh key={z} position={[0.09, -0.12, z]} rotation={[0, 0, z > 0 ? -0.16 : 0.16]}>
          <boxGeometry args={[0.38, 0.045, 0.34]} />
          <meshPhysicalMaterial color="#111412" roughness={0.28} metalness={0.4} clearcoat={0.35} />
        </mesh>
      ))}
      {gt && [-0.52, 0, 0.52].map((z) => (
        <mesh key={`gt-fin-${z}`} position={[rear ? -0.08 : 0.08, -0.14, z]} rotation={[0, 0, rear ? -0.18 : 0.18]}>
          <boxGeometry args={[0.34, 0.12, 0.035]} />
          <meshStandardMaterial color="#101310" metalness={0.38} roughness={0.32} />
        </mesh>
      ))}
      {race && !rear && [-1, 1].map((side) => (
        <group key={`race-canards-${side}`} position={[0.12, 0.02, side * body.width * 0.45]}>
          {[-0.07, 0.07].map((offset) => (
            <mesh key={offset} position={[0, offset, 0]} rotation={[0, 0, side * -0.18]}>
              <boxGeometry args={[0.42, 0.025, 0.2]} />
              <meshStandardMaterial color="#0b0e0c" metalness={0.5} roughness={0.25} />
            </mesh>
          ))}
        </group>
      ))}
      {classic && [-0.62, 0.62].map((z) => (
        <RoundedBox key={`overrider-${z}`} args={[0.12, 0.28, 0.12]} radius={0.035} smoothness={3} position={[rear ? -0.08 : 0.08, 0.07, z]}>
          <meshStandardMaterial color="#d9dfdc" metalness={0.96} roughness={0.14} />
        </RoundedBox>
      ))}
      {!rear && armored && (
        <>
          <mesh position={[0.12, 0.17, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[body.width * 0.34, 0.035, 8, 32, Math.PI]} />
            <meshStandardMaterial color="#505854" metalness={0.82} roughness={0.25} />
          </mesh>
          {offroad && [-0.48, 0.48].map((z) => (
            <mesh key={`recovery-${z}`} position={[0.15, -0.14, z]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.06, 0.018, 8, 20]} />
              <meshStandardMaterial color="#d89a3e" metalness={0.86} roughness={0.22} />
            </mesh>
          ))}
        </>
      )}
      {id === 'bumper_timeattack' && <RoundedBox args={[0.52, 0.04, body.width * 1.04]} radius={0.022} smoothness={3} position={[rear ? -0.19 : 0.19, -0.155, 0]}><meshStandardMaterial color="#090c0a" metalness={0.48} roughness={0.25} /></RoundedBox>}
      {id === 'bumper_drift' && [-0.52, 0.52].map((z) => <RoundedBox key={`drift-port-${z}`} args={[0.04, 0.12, 0.28]} radius={0.04} smoothness={3} position={[rear ? -0.075 : 0.075, 0.01, z]}><meshStandardMaterial color="#070a08" roughness={0.4} /></RoundedBox>)}
      {id === 'bumper_street' && <RoundedBox args={[0.36, 0.045, body.width * 0.92]} radius={0.025} smoothness={3} position={[rear ? -0.11 : 0.11, -0.12, 0]}><meshStandardMaterial color="#151916" metalness={0.42} roughness={0.28} /></RoundedBox>}
      {id === 'bumper_retro' && <RoundedBox args={[0.08, 0.075, body.width * 0.72]} radius={0.025} smoothness={3} position={[rear ? -0.085 : 0.085, -0.01, 0]}><meshStandardMaterial color="#242926" roughness={0.58} /></RoundedBox>}
      {utility && <RoundedBox args={[0.27, 0.055, body.width * 0.48]} radius={0.02} smoothness={2} position={[rear ? -0.11 : 0.11, -0.14, 0]}><meshStandardMaterial color="#7b8580" metalness={0.78} roughness={0.3} /></RoundedBox>}
      {safari && !rear && [-0.34, 0.34].map((z) => <mesh key={`safari-lamp-${z}`} position={[0.17, 0.18, z]} rotation={[0, Math.PI / 2, 0]}><cylinderGeometry args={[0.09, 0.09, 0.045, 24]} /><meshStandardMaterial color="#fff0bd" emissive="#ffd98b" emissiveIntensity={1.2} toneMapped={false} /></mesh>)}
      {id === 'bumper_touring' && [-0.46, 0.46].map((z) => <RoundedBox key={`touring-duct-${z}`} args={[0.05, 0.14, 0.24]} radius={0.04} smoothness={3} position={[rear ? -0.075 : 0.075, 0.015, z]}><meshStandardMaterial color="#090c0a" metalness={0.3} roughness={0.34} /></RoundedBox>)}
      {id === 'bumper_endurance' && [-0.7, 0.7].map((z) => <mesh key={`release-${z}`} position={[rear ? -0.09 : 0.09, 0.07, z]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.035, 0.009, 7, 20]} /><meshStandardMaterial color="#e54235" metalness={0.72} roughness={0.22} /></mesh>)}
    </group>
  )
}

function SlotMarker({ position, label, onClick }: { position: [number, number, number]; label: string; onClick: () => void }) {
  const ref = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.09
      ref.current.scale.setScalar(scale)
    }
  })
  return (
    <group position={position} name="EditorSlotGuide" userData={{ editorOnly: true }}>
      <mesh ref={ref} onClick={(event) => { event.stopPropagation(); onClick() }}>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshBasicMaterial color="#b4f34b" transparent opacity={0.92} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.24, 20, 20]} />
        <meshBasicMaterial color="#b4f34b" transparent opacity={0.13} depthTest={false} toneMapped={false} />
      </mesh>
      <Html center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <span className="slot-tag">{label}</span>
      </Html>
    </group>
  )
}

function FenderArches({ body, vehicle }: { body: BodyDefinition; vehicle: VehicleState }) {
  const paint = paintProperties(vehicle)
  const xPositions = [body.length * 0.31, -body.length * 0.32]
  const oversizedTires = wheelSlots.some((slot) => ['wheel_offroad', 'wheel_beadlock', 'wheel_dakar'].includes(vehicle.parts[slot] ?? ''))
  const archRadius = body.wheelRadius * (oversizedTires ? 1.19 : 1.12)
  return (
    <>
      {[-1, 1].flatMap((side) => xPositions.map((x) => (
        <group key={`${side}-${x}`} position={[x, body.wheelRadius, side * (bodySurface(body, x).side + 0.008)]}>
          {/* The shell generator now has real wheel openings. A recessed liner
              closes the well behind the tire while the thin painted lip follows
              the body surface instead of intersecting the wheel. */}
          <mesh position={[0, 0, -side * 0.48]}>
            <circleGeometry args={[archRadius - 0.04, 64]} />
            <meshStandardMaterial color="#090b0a" roughness={0.86} metalness={0.04} side={THREE.DoubleSide} />
          </mesh>
          <mesh castShadow>
            <torusGeometry args={[archRadius, 0.045, 10, 64, Math.PI]} />
            <meshPhysicalMaterial color={vehicle.bodyColor} {...paint} />
          </mesh>
          <mesh position={[0, 0, -side * 0.025]}>
            <torusGeometry args={[archRadius - 0.035, 0.025, 8, 64, Math.PI]} />
            <meshStandardMaterial color="#0d100e" roughness={0.62} />
          </mesh>
        </group>
      )))}
    </>
  )
}

function Seat({ position, color = '#242824', rear = false }: { position: [number, number, number]; color?: string; rear?: boolean }) {
  const rearScale = rear ? 0.88 : 1
  return (
    <group position={position} scale={[rear ? 0.92 : 1, rearScale, rear ? 0.94 : 1]}>
      <RoundedBox args={[0.52, 0.13, 0.47]} radius={0.075} smoothness={3} rotation={[0, 0, -0.045]} castShadow>
        <meshStandardMaterial color={color} roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.16, 0.48, 0.48]} radius={0.075} smoothness={3} position={[-0.18, 0.27, 0]} rotation={[0, 0, -0.1]} castShadow>
        <meshStandardMaterial color={color} roughness={0.68} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.14, 0.27]} radius={0.05} smoothness={3} position={[-0.235, 0.55, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.7} />
      </RoundedBox>
      {/* stitched bolsters catch highlights without crossing the glass envelope */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[-0.1, 0.27, side * 0.225]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[0.07, 0.36, 0.02]} />
          <meshStandardMaterial color="#3b413d" roughness={0.56} />
        </mesh>
      ))}
      <mesh position={[-0.245, 0.31, 0.165]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.022, 0.4, 0.016]} />
        <meshStandardMaterial color="#151916" roughness={0.82} />
      </mesh>
      <mesh position={[-0.19, 0.28, 0.241]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.01, 0.32, 0.01]} />
        <meshBasicMaterial color="#9ca39f" />
      </mesh>
    </group>
  )
}

function VehicleInterior({ body }: { body: BodyDefinition }) {
  const lowerTop = body.wheelRadius + body.lowerHeight
  const frontSeatX = body.id === 'truck' ? body.length * 0.005 : body.id === 'van' ? body.length * 0.14 : body.length * 0.015
  // Rear occupants sit ahead of the sloping rear glass instead of intersecting it.
  const rearSeatX = body.id === 'van' ? -body.length * 0.1 : -body.length * 0.09
  const seatZ = body.width * 0.21
  const interiorProfile = glassProfile(body)
  // Fit the complete dashboard envelope behind the sloped windscreen—not only
  // its lower edge. This prevents the binnacle and screen clipping on low Apex
  // cabins and on the more upright SUV generations.
  const dashboardTopY = lowerTop + 0.52
  const windshieldRise = Math.max(0.2, interiorProfile.frontTop[1] - interiorProfile.frontBottom[1])
  const windshieldT = THREE.MathUtils.clamp((dashboardTopY - interiorProfile.frontBottom[1]) / windshieldRise, 0, 1)
  const windshieldBoundaryX = THREE.MathUtils.lerp(interiorProfile.frontBottom[0], interiorProfile.frontTop[0], windshieldT)
  const dashX = windshieldBoundaryX - 0.28
  const driverZ = body.width * 0.21

  return (
    <group name="Detailed_Interior">
      <RoundedBox args={[body.cabinLength * 0.72, 0.1, body.width * 0.72]} radius={0.05} smoothness={2} position={[body.cabinX, lowerTop - 0.08, 0]}>
        <meshStandardMaterial color="#111411" roughness={0.86} />
      </RoundedBox>
      {[-1, 1].map((side) => <Seat key={`front-${side}`} position={[frontSeatX, lowerTop + 0.03, side * seatZ]} />)}
      {body.id !== 'truck' && body.generationStyle !== 'race' && [-1, 1].map((side) => <Seat rear key={`rear-${side}`} position={[rearSeatX, lowerTop + 0.015, side * seatZ]} color="#292e2a" />)}
      {body.generationStyle === 'race' && (
        <group name="FIA_Roll_Cage">
          {[-1, 1].map((side) => (
            <group key={`cage-${side}`}>
              <FrameBeam from={[interiorProfile.frontBottom[0] - 0.16, lowerTop + 0.08, side * body.width * 0.31]} to={[interiorProfile.frontTop[0], interiorProfile.frontTop[1] - 0.04, side * body.width * 0.28]} color="#cf2824" thickness={0.038} depth={0.038} />
              <FrameBeam from={[interiorProfile.frontTop[0], interiorProfile.frontTop[1] - 0.04, side * body.width * 0.28]} to={[interiorProfile.rearTop[0], interiorProfile.rearTop[1] - 0.04, side * body.width * 0.28]} color="#cf2824" thickness={0.038} depth={0.038} />
              <FrameBeam from={[interiorProfile.rearTop[0], interiorProfile.rearTop[1] - 0.04, side * body.width * 0.28]} to={[interiorProfile.rearBottom[0] + 0.16, lowerTop + 0.08, side * body.width * 0.31]} color="#cf2824" thickness={0.038} depth={0.038} />
            </group>
          ))}
          <FrameBeam from={[interiorProfile.rearBottom[0] + 0.12, lowerTop + 0.12, -body.width * 0.3]} to={[interiorProfile.rearTop[0], interiorProfile.rearTop[1] - 0.05, body.width * 0.28]} color="#cf2824" thickness={0.04} depth={0.04} />
          <FrameBeam from={[interiorProfile.rearBottom[0] + 0.12, lowerTop + 0.12, body.width * 0.3]} to={[interiorProfile.rearTop[0], interiorProfile.rearTop[1] - 0.05, -body.width * 0.28]} color="#cf2824" thickness={0.04} depth={0.04} />
          <mesh position={[rearSeatX, lowerTop + 0.12, -body.width * 0.2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.46, 20]} />
            <meshStandardMaterial color="#d9342c" metalness={0.42} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* dashboard, instrument binnacle and center stack */}
      <RoundedBox args={[0.34, 0.24, body.width * 0.74]} radius={0.08} smoothness={3} position={[dashX, lowerTop + 0.24, 0]} rotation={[0, 0, 0.06]}>
        <meshStandardMaterial color="#171b18" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.18, 0.18, 0.52]} radius={0.06} smoothness={3} position={[dashX - 0.08, lowerTop + 0.37, driverZ]}>
        <meshStandardMaterial color="#0c0e0d" roughness={0.45} />
      </RoundedBox>
      <mesh position={[dashX - 0.18, lowerTop + 0.39, driverZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.36, 0.09]} />
        <meshStandardMaterial color="#162829" emissive="#69c7cf" emissiveIntensity={0.55} roughness={0.2} />
      </mesh>
      <RoundedBox args={[0.055, 0.22, 0.34]} radius={0.035} smoothness={3} position={[dashX - 0.2, lowerTop + 0.38, 0]}>
        <meshStandardMaterial color="#090c0b" roughness={0.3} />
      </RoundedBox>
      <mesh position={[dashX - 0.233, lowerTop + 0.39, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.27, 0.145]} />
        <meshStandardMaterial color="#102a30" emissive="#3f9caf" emissiveIntensity={0.7} roughness={0.12} />
      </mesh>
      {[-0.24, 0.24].map((z) => (
        <mesh key={`vent-${z}`} position={[dashX - 0.2, lowerTop + 0.25, z]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.055, 0.009, 8, 24]} />
          <meshStandardMaterial color="#636b67" metalness={0.72} roughness={0.24} />
        </mesh>
      ))}
      <RoundedBox args={[0.78, 0.16, 0.2]} radius={0.06} smoothness={3} position={[body.cabinX, lowerTop + 0.02, 0]}>
        <meshStandardMaterial color="#151815" roughness={0.55} />
      </RoundedBox>
      <mesh position={[body.cabinX + 0.16, lowerTop + 0.13, 0]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.025, 0.035, 0.22, 12]} />
        <meshStandardMaterial color="#7b827e" metalness={0.72} roughness={0.25} />
      </mesh>

      {/* steering wheel and column */}
      <group position={[dashX - 0.08, lowerTop + 0.35, driverZ]} rotation={[0, Math.PI / 2, 0.08]}>
        <mesh>
          <torusGeometry args={[0.17, 0.026, 10, 32]} />
          <meshStandardMaterial color="#111311" roughness={0.65} />
        </mesh>
        {[0, 2.1, 4.2].map((angle) => (
          <mesh key={angle} rotation={[0, 0, angle]}>
            <boxGeometry args={[0.14, 0.025, 0.025]} />
            <meshStandardMaterial color="#4f5652" metalness={0.65} roughness={0.25} />
          </mesh>
        ))}
      </group>
      <mesh position={[dashX - 0.01, lowerTop + 0.35, driverZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.26, 14]} />
        <meshStandardMaterial color="#303632" metalness={0.62} roughness={0.3} />
      </mesh>

      {/* rear-view mirror, mounting stalk and reflective face */}
      <group position={[interiorProfile.frontTop[0] - 0.1, interiorProfile.frontTop[1] - 0.13, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.14, 12]} />
          <meshStandardMaterial color="#161a17" roughness={0.48} />
        </mesh>
        <RoundedBox args={[0.08, 0.13, 0.38]} radius={0.04} smoothness={3} position={[-0.06, -0.05, 0]}>
          <meshStandardMaterial color="#151917" roughness={0.35} />
        </RoundedBox>
        <mesh position={[-0.105, -0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.31, 0.085]} />
          <meshPhysicalMaterial color="#a9bcbd" metalness={0.7} roughness={0.08} />
        </mesh>
      </group>

      {/* axles, differentials and visible suspension under the car */}
      {[body.length * 0.31, -body.length * 0.32].map((x) => (
        <group key={`axle-${x}`} position={[x, body.wheelRadius * 0.72, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.045, body.width * 0.92, 16]} />
            <meshStandardMaterial color="#202521" metalness={0.62} roughness={0.42} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.24, 20]} />
            <meshStandardMaterial color="#292f2b" metalness={0.5} roughness={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function FrameBeam({ from, to, color, thickness = 0.085, depth = 0.085 }: { from: [number, number, number]; to: [number, number, number]; color: string; thickness?: number; depth?: number }) {
  const transform = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const direction = end.clone().sub(start)
    const midpoint = start.clone().add(end).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
    return { midpoint, quaternion, length: direction.length() }
  }, [from, to])
  return (
    <RoundedBox args={[thickness, transform.length, depth]} radius={Math.min(thickness, depth) * 0.32} smoothness={2} position={transform.midpoint} quaternion={transform.quaternion}>
      <meshPhysicalMaterial color={color} metalness={0.25} roughness={0.28} clearcoat={0.55} />
    </RoundedBox>
  )
}

function createRaceTexture(kind: 'door' | 'banner') {
  const canvas = document.createElement('canvas')
  canvas.width = kind === 'door' ? 512 : 1024
  canvas.height = kind === 'door' ? 512 : 192
  const context = canvas.getContext('2d')!
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (kind === 'door') {
    context.fillStyle = '#f6f7f3'
    context.fillRect(38, 38, 436, 436)
    context.strokeStyle = '#151916'
    context.lineWidth = 18
    context.strokeRect(38, 38, 436, 436)
    context.fillStyle = '#131714'
    context.font = '900 260px Arial Black, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('18', 256, 285)
    context.fillStyle = '#d92825'
    context.fillRect(55, 66, 402, 42)
    context.fillStyle = '#ffffff'
    context.font = '700 24px Arial, sans-serif'
    context.fillText('VEHICLEDES  GT', 256, 88)
  } else {
    context.fillStyle = 'rgba(10, 13, 11, .92)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffffff'
    context.font = '800 70px Arial, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('VEHICLEDES  //  GT COMPETITION', canvas.width / 2, canvas.height / 2)
    context.fillStyle = '#d82926'
    context.fillRect(0, canvas.height - 22, canvas.width, 22)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function RaceDecals({ body }: { body: BodyDefinition }) {
  const doorTexture = useMemo(() => createRaceTexture('door'), [])
  const bannerTexture = useMemo(() => createRaceTexture('banner'), [])
  const profile = glassProfile(body)
  const lowerTop = body.wheelRadius + body.lowerHeight
  useEffect(() => () => {
    doorTexture.dispose()
    bannerTexture.dispose()
  }, [doorTexture, bannerTexture])
  return (
    <group name="GT_Competition_Livery">
      {[-1, 1].map((side) => (
        <mesh key={side} position={[body.cabinX - 0.02, lowerTop - 0.22, side * body.width * 0.506]} rotation={[0, side < 0 ? Math.PI : 0, 0]} renderOrder={4}>
          <planeGeometry args={[0.68, 0.56]} />
          <meshBasicMaterial map={doorTexture} transparent side={THREE.DoubleSide} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
      <mesh position={[profile.frontTop[0] + 0.018, profile.frontTop[1] - 0.1, 0]} rotation={[0, Math.PI / 2, 0]} renderOrder={4}>
        <planeGeometry args={[body.width * 0.62, 0.13]} />
        <meshBasicMaterial map={bannerTexture} transparent side={THREE.DoubleSide} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  )
}

function RearSignatureLights({ body }: { body: BodyDefinition }) {
  const lowerTop = body.wheelRadius + body.lowerHeight
  const rearX = -body.length / 2 - 0.038
  const lampY = lowerTop - body.lowerHeight * (body.id === 'suv' || body.id === 'van' ? 0.18 : 0.23)
  const lens = { color: '#7b0907', emissive: '#f12d22', emissiveIntensity: 2.1, roughness: 0.16, toneMapped: false }
  const led = { color: '#ff7566', emissive: '#ff2f24', emissiveIntensity: 3.4, toneMapped: false }

  return (
    <group name={`${body.name}_Rear_Light_Signature`}>
      {[-1, 1].map((side) => {
        const sideZ = side * body.width * (body.id === 'van' ? 0.405 : body.id === 'suv' ? 0.39 : body.id === 'truck' ? 0.37 : 0.31)
        if (body.id === 'muscle') return (
          <group key={`muscle-tail-${side}`} position={[rearX, lampY, sideZ]}>
            <RoundedBox args={[0.09, 0.24, 0.5]} radius={0.055} smoothness={4}><meshStandardMaterial color="#160c0a" metalness={0.42} roughness={0.26} /></RoundedBox>
            {[-0.13, 0.13].map((offset) => <group key={offset} position={[-0.052, 0, offset]} rotation={[0, -Math.PI / 2, 0]}><mesh><torusGeometry args={[0.082, 0.018, 10, 32]} /><meshStandardMaterial {...led} /></mesh><mesh position={[0, 0, 0.004]}><circleGeometry args={[0.055, 28]} /><meshStandardMaterial {...lens} /></mesh></group>)}
          </group>
        )
        if (body.id === 'suv' || body.id === 'truck' || body.id === 'van') {
          const height = body.id === 'van' ? 0.66 : body.id === 'suv' ? 0.52 : 0.42
          const lampWidth = body.id === 'van' ? 0.17 : body.id === 'suv' ? 0.22 : 0.29
          return (
            <group key={`utility-tail-${side}`} position={[rearX, lampY + height * 0.12, sideZ]}>
              <RoundedBox args={[0.09, height, lampWidth]} radius={0.055} smoothness={4}><meshStandardMaterial {...lens} /></RoundedBox>
              {[-0.26, 0, 0.26].map((offset, index) => <RoundedBox key={offset} args={[0.025, height * 0.16, lampWidth * 0.74]} radius={0.018} smoothness={2} position={[-0.055, offset * height, 0]}><meshStandardMaterial color={index === 1 ? '#fff0d4' : '#ff6958'} emissive={index === 1 ? '#ffd9a2' : '#ff3024'} emissiveIntensity={index === 1 ? 1.6 : 3} toneMapped={false} /></RoundedBox>)}
            </group>
          )
        }
        const sedan = body.id === 'sedan'
        return (
          <group key={`road-tail-${side}`} position={[rearX, lampY, sideZ]}>
            <RoundedBox args={[0.09, sedan ? 0.24 : 0.17, body.width * (sedan ? 0.24 : 0.22)]} radius={0.055} smoothness={4}><meshStandardMaterial {...lens} /></RoundedBox>
            {(sedan ? [-0.065, 0.065] : [-0.045, 0, 0.045]).map((offset) => <RoundedBox key={offset} args={[0.022, 0.024, body.width * (sedan ? 0.2 : 0.18)]} radius={0.01} smoothness={2} position={[-0.055, offset, 0]}><meshStandardMaterial {...led} /></RoundedBox>)}
          </group>
        )
      })}
    </group>
  )
}

function GlassAndBodyDetails({ vehicle, body, selectedSlot, onSlotClick }: { vehicle: VehicleState; body: BodyDefinition; selectedSlot?: SlotId; onSlotClick: (slot: SlotId) => void }) {
  const leftGlass = useMemo(() => sideGlassGeometry(body, 1), [body])
  const rightGlass = useMemo(() => sideGlassGeometry(body, -1), [body])
  const frontGlass = useMemo(() => windshieldGeometry(body), [body])
  const rearGlass = useMemo(() => windshieldGeometry(body, true), [body])
  useEffect(() => () => {
    leftGlass.dispose()
    rightGlass.dispose()
    frontGlass.dispose()
    rearGlass.dispose()
  }, [leftGlass, rightGlass, frontGlass, rearGlass])
  const lowerTop = body.wheelRadius + body.lowerHeight
  const profile = glassProfile(body)
  const widths = glassWidths(body)
  const exhaustPositions = body.id === 'muscle' || (body.id === 'van' && body.generationStyle === 'modern') ? [] : body.generationStyle === 'race' ? [-0.7, -0.48, 0.48, 0.7] : body.id === 'truck' ? [0.52] : [-0.58, 0.58]
  const glassId = vehicle.parts.windows
  const glassOpacity: Record<string, number> = {
    window_clear: 0.52, window_privacy: 0.94, window_dark: 0.9, window_bronze: 0.76,
    window_blue: 0.62, window_green: 0.68, window_amber: 0.72, window_mirror: 0.84,
    window_race: 0.48, window_lightblue: 0.56, window_factory: 0.68, window_limo: 0.97,
    window_gradient: 0.64,
  }
  const glassColors: Record<string, string> = {
    window_bronze: '#75634d', window_privacy: '#111c1d', window_blue: '#3e7183',
    window_green: '#41675d', window_amber: '#7c5e35', window_mirror: '#93a3a4',
    window_race: '#8bb9c1', window_lightblue: '#639bab', window_factory: '#3d5657',
    window_limo: '#081011', window_gradient: '#274f68',
  }
  const glassTransmission = glassId === 'window_clear' || glassId === 'window_race' ? 0.28 : glassId === 'window_blue' || glassId === 'window_lightblue' ? 0.18 : glassId === 'window_privacy' || glassId === 'window_limo' || glassId === 'window_mirror' ? 0.015 : 0.06
  const glassColor = glassColors[glassId ?? ''] ?? vehicle.glassColor
  const glassMaterial = (
    <meshPhysicalMaterial
      color={glassColor}
      transparent
      opacity={glassOpacity[glassId ?? ''] ?? 0.72}
      transmission={glassTransmission}
      thickness={glassId === 'window_race' ? 0.018 : 0.035}
      ior={1.45}
      roughness={glassId === 'window_race' ? 0.08 : 0.035}
      metalness={glassId === 'window_mirror' ? 0.62 : 0.12}
      clearcoat={1}
      clearcoatRoughness={0.025}
      envMapIntensity={1.8}
      depthWrite={false}
      side={THREE.DoubleSide}
      emissive={selectedSlot === 'windows' ? '#426920' : '#061011'}
      emissiveIntensity={selectedSlot === 'windows' ? 0.22 : 0.06}
    />
  )

  const frontBottomX = profile.frontBottom[0]
  const glassBottomY = profile.frontBottom[1]
  const pillarXs = body.id === 'truck' ? [-body.length * 0.015] : body.id === 'van' ? [body.length * 0.08, -body.length * 0.16] : [body.cabinX]

  return (
    <>
      {[-1, 1].map((side) => (
        <group key={`side-glass-${side}`}>
          <FrameBeam
            from={[profile.frontBottom[0], lowerTop + 0.025, side * body.width * widths.frontBottom]}
            to={[profile.rearBottom[0], lowerTop + 0.025, side * body.width * widths.rearBottom]}
            color={vehicle.bodyColor}
            thickness={0.085}
            depth={0.09}
          />
          <mesh
            geometry={side > 0 ? leftGlass : rightGlass}
            renderOrder={3}
            onClick={(event) => { event.stopPropagation(); onSlotClick('windows') }}
            name={side > 0 ? 'Left_Side_Glass' : 'Right_Side_Glass'}
          >
            {glassMaterial}
          </mesh>
          {pillarXs.map((x) => (
            <RoundedBox key={x} args={[0.075, body.cabinHeight * 0.78, 0.045]} radius={0.018} smoothness={2} position={[x, lowerTop + body.cabinHeight * 0.5, side * body.width * ((widths.frontTop + widths.rearTop) / 2 + 0.008)]}>
              <meshStandardMaterial color={vehicle.trimColor} roughness={0.26} metalness={0.25} />
            </RoundedBox>
          ))}
          {/* flush door handles */}
          {(body.id === 'truck' ? [body.length * 0.015] : [body.length * 0.07, -body.length * 0.21]).map((x) => (
            <RoundedBox key={`handle-${x}`} args={[0.19, 0.035, 0.035]} radius={0.015} smoothness={2} position={[x, lowerTop - 0.12, side * (bodySideAt(body, x, lowerTop - 0.12) + 0.012)]}>
              <meshStandardMaterial color="#aeb5b1" metalness={0.88} roughness={0.2} />
            </RoundedBox>
          ))}
          {/* rockers and door shut lines are projected onto the sampled body skin */}
          <FrameBeam
            from={[body.length * 0.25, body.wheelRadius + body.lowerHeight * 0.1, side * (bodySideAt(body, body.length * 0.25, body.wheelRadius + body.lowerHeight * 0.1) + 0.012)]}
            to={[-body.length * 0.27, body.wheelRadius + body.lowerHeight * 0.1, side * (bodySideAt(body, -body.length * 0.27, body.wheelRadius + body.lowerHeight * 0.1) + 0.012)]}
            color={vehicle.trimColor}
            thickness={0.055}
            depth={0.045}
          />
          {pillarXs.map((x) => {
            const seamBottomY = body.wheelRadius + body.lowerHeight * 0.14
            const seamTopY = lowerTop - 0.06
            return <FrameBeam key={`seam-${x}`} from={[x, seamBottomY, side * (bodySideAt(body, x, seamBottomY) + 0.014)]} to={[x, seamTopY, side * (bodySideAt(body, x, seamTopY) + 0.014)]} color="#202420" thickness={0.012} depth={0.012} />
          })}
        </group>
      ))}

      {/* Dedicated compound-curved front windshield and rear glass. These are
          separate exportable surfaces rather than dark boxes painted on a cabin. */}
      <mesh geometry={frontGlass} renderOrder={3} onClick={(event) => { event.stopPropagation(); onSlotClick('windows') }} name="Front_Windshield">
        {glassMaterial}
      </mesh>
      <mesh geometry={rearGlass} renderOrder={3} onClick={(event) => { event.stopPropagation(); onSlotClick('windows') }} name="Rear_Windshield">
        {glassMaterial}
      </mesh>
      {glassId === 'window_gradient' && <RoundedBox args={[0.035, 0.11, body.width * 0.69]} radius={0.025} smoothness={3} position={[profile.frontTop[0] + 0.012, profile.frontTop[1] - 0.1, 0]} rotation={[0, 0, -0.1]}><meshPhysicalMaterial color="#225a84" transparent opacity={0.58} transmission={0.08} roughness={0.04} /></RoundedBox>}
      {glassId === 'window_race' && [profile.frontTop, profile.frontBottom, profile.rearTop, profile.rearBottom].flatMap((point, pointIndex) => [-1, 1].map((side) => (
        <mesh key={`poly-fastener-${pointIndex}-${side}`} position={[point[0] + (pointIndex < 2 ? 0.025 : -0.025), point[1], side * body.width * 0.34]}>
          <sphereGeometry args={[0.018, 10, 8]} />
          <meshStandardMaterial color="#c4ccc8" metalness={0.9} roughness={0.2} />
        </mesh>
      )))}

      {/* Structural A/C pillars, roof rails and glass header rails clearly frame
          both windscreens from every camera angle. */}
      {[-1, 1].map((side) => {
        const frontBottom: [number, number, number] = [profile.frontBottom[0], profile.frontBottom[1], side * body.width * widths.frontBottom]
        const frontTop: [number, number, number] = [profile.frontTop[0], profile.frontTop[1] + 0.04, side * body.width * widths.frontTop]
        const rearTop: [number, number, number] = [profile.rearTop[0], profile.rearTop[1] + 0.04, side * body.width * widths.rearTop]
        const rearBottom: [number, number, number] = [profile.rearBottom[0], profile.rearBottom[1], side * body.width * widths.rearBottom]
        return (
          <group key={`cabin-frame-${side}`}>
            <FrameBeam from={frontBottom} to={frontTop} color={vehicle.bodyColor} thickness={0.095} depth={0.11} />
            <FrameBeam from={frontTop} to={rearTop} color={vehicle.bodyColor} thickness={0.095} depth={0.11} />
            <FrameBeam from={rearTop} to={rearBottom} color={vehicle.bodyColor} thickness={0.1} depth={0.11} />
            <FrameBeam from={rearBottom} to={frontBottom} color={vehicle.bodyColor} thickness={0.075} depth={0.1} />
          </group>
        )
      })}
      <RoundedBox args={[0.075, 0.075, body.width * widths.frontTop * 2.06]} radius={0.025} smoothness={2} position={[profile.frontTop[0], profile.frontTop[1] + 0.04, 0]}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
      </RoundedBox>
      <RoundedBox args={[0.075, 0.075, body.width * widths.rearTop * 2.06]} radius={0.025} smoothness={2} position={[profile.rearTop[0], profile.rearTop[1] + 0.04, 0]}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
      </RoundedBox>
      <RoundedBox args={[0.13, 0.1, body.width * widths.frontBottom * 2.06]} radius={0.035} smoothness={3} position={[profile.frontBottom[0], profile.frontBottom[1] - 0.025, 0]}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
      </RoundedBox>
      <RoundedBox args={[0.13, 0.1, body.width * widths.rearBottom * 2.06]} radius={0.035} smoothness={3} position={[profile.rearBottom[0], profile.rearBottom[1] - 0.025, 0]}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
      </RoundedBox>

      {/* separate wiper arms and blades sit proud of the windscreen */}
      {[-0.32, 0.32].map((z, index) => (
        <group key={`wiper-${z}`} position={[frontBottomX + 0.02, glassBottomY + 0.09, z]} rotation={[0.05, 0, index ? -0.22 : 0.22]}>
          <mesh>
            <boxGeometry args={[0.025, 0.025, body.width * 0.34]} />
            <meshStandardMaterial color="#0c0f0d" metalness={0.45} roughness={0.34} />
          </mesh>
          <mesh position={[0, 0, index ? -body.width * 0.16 : body.width * 0.16]}>
            <boxGeometry args={[0.035, 0.035, body.width * 0.22]} />
            <meshStandardMaterial color="#090b09" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* mirrors with reflective inserts */}
      {[-1, 1].map((side) => (
        <group key={`mirror-${side}`} position={[frontBottomX - 0.06, lowerTop + body.cabinHeight * 0.25, side * body.width * 0.49]}>
          <RoundedBox args={[0.25, 0.13, 0.22]} radius={0.055} smoothness={3}>
            <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
          </RoundedBox>
          <mesh position={[-0.06, 0, side * 0.116]}>
            <planeGeometry args={[0.14, 0.075]} />
            <meshPhysicalMaterial color="#8fa3a4" metalness={0.75} roughness={0.08} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.055, -0.066, 0]}>
            <boxGeometry args={[0.11, 0.07, 0.04]} />
            <meshStandardMaterial color={vehicle.trimColor} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Family-specific rear signatures make each silhouette recognizable at night. */}
      <RearSignatureLights body={body} />
      <RoundedBox args={[0.035, 0.045, body.width * 0.3]} radius={0.018} smoothness={2} position={[profile.rearTop[0] - 0.035, profile.rearTop[1] - 0.1, 0]}>
        <meshStandardMaterial color="#bd1712" emissive="#ff2d24" emissiveIntensity={1.5} toneMapped={false} />
      </RoundedBox>

      {/* registration plates */}
      {[1, -1].map((direction) => (
        <group key={`plate-${direction}`} position={[direction * (body.length / 2 + 0.115), body.wheelRadius + 0.04, 0]} rotation={[0, direction < 0 ? Math.PI : 0, 0]}>
          <RoundedBox args={[0.025, 0.17, 0.47]} radius={0.025} smoothness={2}>
            <meshStandardMaterial color="#e8ebe5" roughness={0.46} />
          </RoundedBox>
          <mesh position={[0.016, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.36, 0.07]} />
            <meshBasicMaterial color="#293029" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {[-1, 1].flatMap((direction) => [-0.62, -0.22, 0.22, 0.62].map((z) => (
        <mesh key={`sensor-${direction}-${z}`} position={[direction * (body.length / 2 + 0.122), body.wheelRadius + body.lowerHeight * 0.1, z]}>
          <sphereGeometry args={[0.018, 12, 8]} />
          <meshStandardMaterial color="#7f8883" metalness={0.65} roughness={0.28} />
        </mesh>
      )))}

      {/* Powertrain-appropriate exhaust finishers and a shell-connected diffuser. */}
      {exhaustPositions.map((z) => (
        <mesh key={`exhaust-${z}`} position={[-body.length / 2 - 0.14, body.wheelRadius * 0.78, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[body.generationStyle === 'race' ? 0.062 : 0.075, body.generationStyle === 'race' ? 0.068 : 0.075, 0.25, 24, 1, true]} />
          <meshStandardMaterial color="#59605d" metalness={0.95} roughness={0.19} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <RoundedBox args={[0.2, 0.12, body.width * (body.id === 'truck' || body.id === 'van' ? 0.5 : 0.64)]} radius={0.035} smoothness={3} position={[-body.length / 2 - 0.05, body.wheelRadius * 0.82, 0]}>
        <meshStandardMaterial color="#101310" metalness={0.34} roughness={0.38} />
      </RoundedBox>
      {(body.id === 'sports' || body.generationStyle === 'race') && [-0.48, -0.24, 0, 0.24, 0.48].map((z) => <mesh key={`diffuser-fin-${z}`} position={[-body.length / 2 - 0.13, body.wheelRadius * 0.79, z]}><boxGeometry args={[0.3, 0.12, 0.025]} /><meshStandardMaterial color="#090c0a" metalness={0.45} roughness={0.3} /></mesh>)}

      {/* fog lamps and amber repeater strips give the front fascia game-vehicle readability */}
      {[-1, 1].map((side) => (
        <group key={`fog-${side}`} position={[body.length / 2 + 0.1, body.wheelRadius + body.lowerHeight * 0.09, side * body.width * 0.38]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.07, 24]} />
            <meshStandardMaterial color="#f4fcdf" emissive="#eaffc6" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
          <mesh position={[0.012, 0.11, 0]}>
            <boxGeometry args={[0.025, 0.035, 0.2]} />
            <meshStandardMaterial color="#f2a637" emissive="#f08d1c" emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* panel gaps and hood creases are sampled from the fresh crown surfaces */}
      <mesh position={[body.length * 0.24, bodySurface(body, body.length * 0.24).top + 0.075, 0]}>
        <boxGeometry args={[0.014, 0.01, bodySurface(body, body.length * 0.24).side * 1.58]} />
        <meshBasicMaterial color="#111411" transparent opacity={0.48} />
      </mesh>
      <mesh position={[-body.length * 0.4, bodySurface(body, -body.length * 0.4).top + 0.065, 0]}>
        <boxGeometry args={[0.014, 0.01, bodySurface(body, -body.length * 0.4).side * 1.56]} />
        <meshBasicMaterial color="#111411" transparent opacity={0.45} />
      </mesh>

      {[-0.46, 0.46].map((z) => (
        <mesh key={`hood-line-${z}`} position={[body.length * 0.35, bodySurface(body, body.length * 0.35).top + 0.065, z]} rotation={[0, 0, -0.02]}>
          <boxGeometry args={[body.length * 0.18, 0.01, 0.016]} />
          <meshStandardMaterial color={vehicle.trimColor} transparent opacity={0.32} />
        </mesh>
      ))}
    </>
  )
}

function FamilyFasciaDetails({ vehicle, body }: { vehicle: VehicleState; body: BodyDefinition }) {
  const frontX = body.length / 2 + 0.012
  const lowerTop = body.wheelRadius + body.lowerHeight
  const paint = paintProperties(vehicle)
  const dark = '#0a0d0b'

  return (
    <group name={`${body.name}_Family_Fascia`}>
      {body.id === 'sports' && (
        <>
          {[-1, 1].map((side) => (
            <group key={`sports-duct-${side}`} position={[frontX, body.wheelRadius + body.lowerHeight * 0.25, side * body.width * 0.39]}>
              <RoundedBox args={[0.12, 0.27, body.width * 0.2]} radius={0.075} smoothness={5} rotation={[0, 0, side * -0.08]}><meshStandardMaterial color={dark} metalness={0.4} roughness={0.3} /></RoundedBox>
              {[-0.055, 0, 0.055].map((y) => <mesh key={y} position={[0.068, y, 0]}><boxGeometry args={[0.025, 0.018, body.width * 0.15]} /><meshStandardMaterial color="#606966" metalness={0.82} roughness={0.22} /></mesh>)}
            </group>
          ))}
          <RoundedBox args={[0.16, 0.07, body.width * 0.78]} radius={0.03} smoothness={3} position={[frontX - 0.01, lowerTop - 0.03, 0]}><meshPhysicalMaterial color={vehicle.bodyColor} {...paint} /></RoundedBox>
        </>
      )}
      {body.id === 'muscle' && (
        <>
          <RoundedBox args={[0.15, 0.12, body.width * 0.87]} radius={0.035} smoothness={3} position={[frontX, body.wheelRadius + body.lowerHeight * 0.69, 0]}><meshPhysicalMaterial color={vehicle.bodyColor} {...paint} /></RoundedBox>
          {[-1, 1].map((side) => <RoundedBox key={`muscle-port-${side}`} args={[0.1, 0.2, body.width * 0.18]} radius={0.045} smoothness={4} position={[frontX + 0.015, body.wheelRadius + body.lowerHeight * 0.27, side * body.width * 0.39]}><meshStandardMaterial color={dark} metalness={0.32} roughness={0.36} /></RoundedBox>)}
        </>
      )}
      {body.id === 'sedan' && (
        <>
          <RoundedBox args={[0.11, 0.035, body.width * 0.68]} radius={0.015} smoothness={2} position={[frontX + 0.02, body.wheelRadius + body.lowerHeight * 0.58, 0]}><meshStandardMaterial color="#cbd3cf" metalness={0.94} roughness={0.15} /></RoundedBox>
          {[-1, 1].map((side) => <RoundedBox key={`sedan-curtain-${side}`} args={[0.09, 0.25, 0.07]} radius={0.025} smoothness={3} position={[frontX + 0.02, body.wheelRadius + body.lowerHeight * 0.3, side * body.width * 0.44]} rotation={[side * 0.06, 0, 0]}><meshStandardMaterial color={dark} metalness={0.36} roughness={0.32} /></RoundedBox>)}
        </>
      )}
      {body.id === 'suv' && (
        <>
          <RoundedBox args={[0.13, 0.09, body.width * 0.79]} radius={0.035} smoothness={3} position={[frontX, body.wheelRadius + body.lowerHeight * 0.72, 0]}><meshPhysicalMaterial color={vehicle.bodyColor} {...paint} /></RoundedBox>
          {[-1, 1].map((side) => <RoundedBox key={`suv-duct-${side}`} args={[0.11, 0.36, body.width * 0.11]} radius={0.04} smoothness={3} position={[frontX + 0.018, body.wheelRadius + body.lowerHeight * 0.31, side * body.width * 0.43]}><meshStandardMaterial color="#111612" metalness={0.3} roughness={0.42} /></RoundedBox>)}
        </>
      )}
      {body.id === 'truck' && (
        <>
          <RoundedBox args={[0.14, 0.09, body.width * 0.86]} radius={0.025} smoothness={2} position={[frontX, body.wheelRadius + body.lowerHeight * 0.77, 0]}><meshPhysicalMaterial color={vehicle.bodyColor} {...paint} /></RoundedBox>
          <RoundedBox args={[0.14, 0.08, body.width * 0.86]} radius={0.025} smoothness={2} position={[frontX, body.wheelRadius + body.lowerHeight * 0.18, 0]}><meshStandardMaterial color="#6f7974" metalness={0.75} roughness={0.3} /></RoundedBox>
          {[-1, 1].map((side) => <RoundedBox key={`truck-surround-${side}`} args={[0.14, body.lowerHeight * 0.61, 0.08]} radius={0.025} smoothness={2} position={[frontX, body.wheelRadius + body.lowerHeight * 0.475, side * body.width * 0.41]}><meshPhysicalMaterial color={vehicle.bodyColor} {...paint} /></RoundedBox>)}
        </>
      )}
      {body.id === 'van' && (
        <>
          <RoundedBox args={[0.13, 0.16, body.width * 0.72]} radius={0.06} smoothness={4} position={[frontX, body.wheelRadius + body.lowerHeight * 0.72, 0]}><meshPhysicalMaterial color={vehicle.bodyColor} {...paint} /></RoundedBox>
          {[-1, 1].map((side) => <group key={`van-curtain-${side}`} position={[frontX + 0.025, body.wheelRadius + body.lowerHeight * 0.31, side * body.width * 0.43]}>{[-0.09, 0, 0.09].map((offset) => <mesh key={offset} position={[0, offset, 0]}><boxGeometry args={[0.04, 0.045, 0.16]} /><meshStandardMaterial color="#252c28" metalness={0.46} roughness={0.32} /></mesh>)}</group>)}
        </>
      )}
    </group>
  )
}

function bodySurface(body: BodyDefinition, x: number) {
  const t = THREE.MathUtils.clamp((x + body.length / 2) / body.length, 0, 1)
  const envelope = bodyEnvelope(body, t)
  return {
    side: body.width * 0.5 * envelope.widthScale,
    top: body.wheelRadius + body.lowerHeight * envelope.topScale,
  }
}

function bodySideAt(body: BodyDefinition, x: number, y: number) {
  const t = THREE.MathUtils.clamp((x + body.length / 2) / body.length, 0, 1)
  const envelope = bodyEnvelope(body, t)
  const endRise = Math.pow(Math.abs(t - 0.5) * 2, 6) * body.wheelRadius * 0.1
  const bottomY = body.wheelRadius * envelope.clearance + endRise
  const topY = body.wheelRadius + body.lowerHeight * envelope.topScale
  const centerY = (topY + bottomY) / 2
  const halfHeight = Math.max(0.18, (topY - bottomY) / 2)
  const sectionY = THREE.MathUtils.clamp((y - centerY) / halfHeight, -0.98, 0.98)
  const sideExponent = Math.max(0.5, 0.8 - envelope.square * 0.9)
  const verticalExponent = Math.max(0.46, 0.66 - envelope.square * 0.72)
  const verticalBase = Math.pow(Math.abs(sectionY), 1 / verticalExponent)
  const sideBase = Math.sqrt(Math.max(0, 1 - verticalBase * verticalBase))
  const shoulder = Math.exp(-Math.pow((sectionY - 0.28) / 0.23, 2))
  const rocker = Math.exp(-Math.pow((sectionY + 0.66) / 0.2, 2))
  return body.width * 0.5 * envelope.widthScale * Math.pow(sideBase, sideExponent) * (1 + shoulder * envelope.shoulder - rocker * envelope.rocker)
}

function BodyShell({ vehicle, body }: { vehicle: VehicleState; body: BodyDefinition }) {
  const geometry = useMemo(() => shellGeometry(body), [body])
  const roof = useMemo(() => roofGeometry(body), [body])
  const hood = useMemo(() => bodyPanelGeometry(body), [body])
  const deck = useMemo(() => bodyPanelGeometry(body, true), [body])
  useEffect(() => () => {
    geometry.dispose()
    roof.dispose()
    hood.dispose()
    deck.dispose()
  }, [geometry, roof, hood, deck])

  const paint = paintProperties(vehicle)
  const lowerTop = body.wheelRadius + body.lowerHeight
  const profile = glassProfile(body)
  const sportsIntakeX = -body.length * 0.14
  const sportsIntakeY = body.wheelRadius + body.lowerHeight * 0.62
  const sportsIntakeSide = bodySideAt(body, sportsIntakeX, sportsIntakeY)
  const fenderVentX = body.length * 0.235
  const fenderVentY = body.wheelRadius + body.lowerHeight * 0.57
  const fenderVentSide = bodySideAt(body, fenderVentX, fenderVentY)
  const muscleDomeX = body.length * 0.285
  const muscleDomeSurface = bodySurface(body, muscleDomeX)
  const sideFrontX = body.length * 0.24
  const sideRearX = -body.length * 0.25
  const characterFrontY = body.wheelRadius + body.lowerHeight * 0.24
  const characterRearY = body.wheelRadius + body.lowerHeight * 0.2
  const characterFrontSide = bodySideAt(body, sideFrontX, characterFrontY)
  const characterRearSide = bodySideAt(body, sideRearX, characterRearY)

  return (
    <group name={`${body.name}_Fresh_Photoreal_Body`}>
      <mesh geometry={geometry} castShadow receiveShadow name={`${body.name}_PrimaryBody`}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paint} />
      </mesh>
      <mesh geometry={hood} castShadow receiveShadow name={`${body.name}_Hood`}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paint} side={THREE.DoubleSide} />
      </mesh>
      {body.id !== 'truck' && body.id !== 'van' && (
        <mesh geometry={deck} castShadow receiveShadow name={`${body.name}_RearDeck`}>
          <meshPhysicalMaterial color={vehicle.bodyColor} {...paint} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh geometry={roof} castShadow receiveShadow name={`${body.name}_Roof`}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paint} side={THREE.DoubleSide} />
      </mesh>

      <FenderArches body={body} vehicle={vehicle} />
      <FamilyFasciaDetails body={body} vehicle={vehicle} />

      {/* Surface-following lower character line. Both endpoints are sampled from
          the new body envelope, so the detail is embedded rather than floating. */}
      {[-1, 1].map((side) => (
        <FrameBeam
          key={`lower-character-${side}`}
          from={[sideFrontX, characterFrontY, side * (characterFrontSide + 0.008)]}
          to={[sideRearX, characterRearY, side * (characterRearSide + 0.008)]}
          color={body.generationStyle === 'classic' ? '#c7cecb' : vehicle.trimColor}
          thickness={body.generationStyle === 'classic' ? 0.025 : 0.018}
          depth={0.02}
        />
      ))}

      {body.id === 'sports' && [-1, 1].map((side) => (
        <group key={`sports-sculpt-${side}`} position={[sportsIntakeX, sportsIntakeY, side * (sportsIntakeSide + 0.012)]}>
          <RoundedBox args={[0.56, 0.27, 0.038]} radius={0.095} smoothness={6} rotation={[0, 0, -0.16]}>
            <meshStandardMaterial color="#070a08" metalness={0.38} roughness={0.3} />
          </RoundedBox>
          {[-0.12, 0, 0.12].map((offset) => (
            <mesh key={offset} position={[offset, 0.015, side * 0.024]} rotation={[0, 0, -0.16]}>
              <boxGeometry args={[0.17, 0.018, 0.016]} />
              <meshStandardMaterial color="#59625e" metalness={0.78} roughness={0.22} />
            </mesh>
          ))}
        </group>
      ))}

      {body.id === 'muscle' && (
        <>
          <RoundedBox args={[0.78, 0.12, 0.5]} radius={0.08} smoothness={5} position={[muscleDomeX, muscleDomeSurface.top + 0.055, 0]} rotation={[0, 0, -0.025]} castShadow>
            <meshPhysicalMaterial color={vehicle.bodyColor} {...paint} />
          </RoundedBox>
          <RoundedBox args={[0.09, 0.085, 0.34]} radius={0.03} smoothness={4} position={[muscleDomeX + 0.1, muscleDomeSurface.top + 0.105, 0]}>
            <meshStandardMaterial color="#080b09" metalness={0.34} roughness={0.36} />
          </RoundedBox>
          {[-1, 1].map((side) => (
            <mesh key={`muscle-pipe-${side}`} position={[-body.length * 0.04, body.wheelRadius * 0.78, side * (body.width * 0.5 + 0.035)]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.04, 0.045, body.length * 0.3, 24, 1, true]} />
              <meshStandardMaterial color="#68716d" metalness={0.96} roughness={0.18} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </>
      )}

      {body.id === 'sedan' && (
        <RoundedBox args={[body.length * 0.18, 0.055, body.width * 0.7]} radius={0.035} smoothness={4} position={[-body.length * 0.405, bodySurface(body, -body.length * 0.405).top + 0.025, 0]}>
          <meshPhysicalMaterial color={vehicle.bodyColor} {...paint} />
        </RoundedBox>
      )}

      {body.id === 'suv' && [-1, 1].map((side) => (
        <FrameBeam
          key={`suv-cladding-${side}`}
          from={[body.length * 0.28, body.wheelRadius * 0.9, side * (bodySideAt(body, body.length * 0.28, body.wheelRadius * 0.9) + 0.025)]}
          to={[-body.length * 0.31, body.wheelRadius * 0.88, side * (bodySideAt(body, -body.length * 0.31, body.wheelRadius * 0.88) + 0.025)]}
          color="#161b18"
          thickness={0.13}
          depth={0.085}
        />
      ))}

      {body.id === 'truck' && (
        <>
          <RoundedBox args={[body.length * 0.29, 0.055, body.width * 0.72]} radius={0.035} smoothness={3} position={[-body.length * 0.35, lowerTop - 0.2, 0]}>
            <meshStandardMaterial color="#151916" roughness={0.78} />
          </RoundedBox>
          {[-1, 1].map((side) => (
            <RoundedBox key={`bed-rail-${side}`} args={[body.length * 0.31, 0.33, 0.11]} radius={0.04} smoothness={4} position={[-body.length * 0.34, lowerTop - 0.03, side * body.width * 0.43]}>
              <meshPhysicalMaterial color={vehicle.bodyColor} {...paint} />
            </RoundedBox>
          ))}
          <RoundedBox args={[0.12, 0.34, body.width * 0.86]} radius={0.04} smoothness={4} position={[-body.length * 0.475, lowerTop - 0.03, 0]}>
            <meshPhysicalMaterial color={vehicle.bodyColor} {...paint} />
          </RoundedBox>
          {[-1, 1].map((side) => (
            <RoundedBox key={`truck-step-${side}`} args={[body.length * 0.34, 0.075, 0.16]} radius={0.035} smoothness={3} position={[body.length * 0.03, body.wheelRadius * 0.73, side * body.width * 0.49]}>
              <meshStandardMaterial color="#252b27" roughness={0.4} metalness={0.52} />
            </RoundedBox>
          ))}
        </>
      )}

      {body.id === 'van' && [-1, 1].map((side) => (
        <FrameBeam
          key={`van-track-${side}`}
          from={[-body.length * 0.04, lowerTop - 0.08, side * (bodySideAt(body, -body.length * 0.04, lowerTop - 0.08) + 0.012)]}
          to={[-body.length * 0.42, lowerTop - 0.08, side * (bodySideAt(body, -body.length * 0.42, lowerTop - 0.08) + 0.012)]}
          color={vehicle.trimColor}
          thickness={0.024}
          depth={0.024}
        />
      ))}

      {body.generationStyle === 'modern' && body.id !== 'truck' && body.id !== 'van' && [-1, 1].map((side) => (
        <RoundedBox key={`fender-vent-${side}`} args={[0.3, 0.14, 0.025]} radius={0.035} smoothness={4} position={[fenderVentX, fenderVentY, side * (fenderVentSide + 0.014)]} rotation={[0, 0, -0.12]}>
          <meshStandardMaterial color="#090c0a" metalness={0.42} roughness={0.3} />
        </RoundedBox>
      ))}

      {body.generationStyle === 'race' && (
        <>
          <RoundedBox args={[0.72, 0.045, body.width * 1.01]} radius={0.022} smoothness={3} position={[body.length / 2 + 0.15, body.wheelRadius * 0.75, 0]}>
            <meshStandardMaterial color="#090c0a" metalness={0.52} roughness={0.24} />
          </RoundedBox>
          {[-1, 1].map((side) => (
            <group key={`race-side-${side}`}>
              <RoundedBox args={[body.length * 0.55, 0.12, 0.12]} radius={0.035} smoothness={3} position={[-body.length * 0.02, body.wheelRadius * 0.82, side * body.width * 0.505]}>
                <meshStandardMaterial color="#0d100e" metalness={0.48} roughness={0.25} />
              </RoundedBox>
              <RoundedBox args={[0.56, 0.38, 0.035]} radius={0.1} smoothness={5} position={[sportsIntakeX, sportsIntakeY - body.lowerHeight * 0.04, side * (bodySideAt(body, sportsIntakeX, sportsIntakeY - body.lowerHeight * 0.04) + 0.012)]} rotation={[0, 0, -0.16]}>
                <meshStandardMaterial color="#070a08" metalness={0.38} roughness={0.3} />
              </RoundedBox>
            </group>
          ))}
          <RoundedBox args={[0.48, 0.13, 0.4]} radius={0.065} smoothness={5} position={[body.cabinX + 0.04, lowerTop + body.cabinHeight + 0.13, 0]} rotation={[0, 0, -0.045]}>
            <meshStandardMaterial color="#0e1210" metalness={0.5} roughness={0.22} />
          </RoundedBox>
          <mesh position={[body.length / 2 + 0.35, body.wheelRadius * 0.81, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.07, 0.016, 8, 24]} />
            <meshStandardMaterial color="#da2c26" metalness={0.7} roughness={0.2} />
          </mesh>
          <RaceDecals body={body} />
          {!vehicle.parts.spoiler && <Spoiler body={body} id="spoiler_gt3" color="#111512" selected={false} onClick={() => undefined} />}
        </>
      )}

      {body.generationStyle === 'modern' && body.id !== 'truck' && body.id !== 'muscle' && (
        <RoundedBox args={[body.cabinLength * 0.34, 0.022, body.width * 0.46]} radius={0.11} smoothness={5} position={[body.cabinX - 0.03, lowerTop + body.cabinHeight + 0.052, 0]}>
          <meshPhysicalMaterial color="#101b1c" metalness={0.38} roughness={0.055} clearcoat={1} />
        </RoundedBox>
      )}

      {(body.id === 'suv' || body.id === 'van') && [-1, 1].map((side) => (
        <FrameBeam
          key={`roof-rail-${side}`}
          from={[profile.frontTop[0] - 0.12, lowerTop + body.cabinHeight + 0.11, side * body.width * 0.31]}
          to={[profile.rearTop[0] + 0.12, lowerTop + body.cabinHeight + 0.09, side * body.width * 0.31]}
          color={vehicle.trimColor}
          thickness={0.042}
          depth={0.052}
        />
      ))}

      <RoundedBox args={[body.length * 0.73, 0.16, body.width * 0.75]} radius={0.06} smoothness={4} position={[0, body.wheelRadius * 0.72, 0]}>
        <meshStandardMaterial color="#0d100e" metalness={0.26} roughness={0.72} />
      </RoundedBox>
    </group>
  )
}

function VehicleModel({ vehicle, activeCategory, pendingPart, selectedSlot, showSlots, onSlotClick, onVehicleReady }: ModelProps) {
  const body = useMemo(() => bodyById(vehicle.bodyId, vehicle.generationId), [vehicle.bodyId, vehicle.generationId])
  const root = useRef<Group>(null)

  useEffect(() => {
    onVehicleReady(root.current)
    return () => onVehicleReady(null)
  }, [onVehicleReady])

  const compatibleSlots = pendingPart ? categorySlots[partById(pendingPart)?.category ?? activeCategory] : categorySlots[activeCategory]

  return (
    <group ref={root} name="VehicleDes_Car" rotation={[0, -0.18, 0]}>
      <BodyShell vehicle={vehicle} body={body} />
      <VehicleInterior body={body} />
      <GlassAndBodyDetails vehicle={vehicle} body={body} selectedSlot={selectedSlot} onSlotClick={onSlotClick} />

      {wheelSlots.map((slot) => vehicle.parts[slot] && (
        <Wheel
          key={slot}
          id={vehicle.parts[slot]}
          color={vehicle.partColors[slot] ?? '#aeb6b2'}
          radius={body.wheelRadius * (['wheel_offroad', 'wheel_beadlock', 'wheel_dakar'].includes(vehicle.parts[slot] ?? '') ? 1.07 : 1)}
          position={wheelPosition(slot, body, vehicle.parts[slot])}
          selected={selectedSlot === slot}
          wide={body.id === 'muscle' || body.generationStyle === 'race'}
          race={body.generationStyle === 'race'}
          onClick={() => onSlotClick(slot)}
        />
      ))}

      {(['headlight_l', 'headlight_r'] as SlotId[]).map((slot) => vehicle.parts[slot] && (
        <Headlight key={slot} body={body} id={vehicle.parts[slot]} position={wheelPosition(slot, body)} selected={selectedSlot === slot} onClick={() => onSlotClick(slot)} />
      ))}

      {vehicle.parts.grille && <Grille body={body} id={vehicle.parts.grille} color={vehicle.partColors.grille ?? vehicle.trimColor} selected={selectedSlot === 'grille'} onClick={() => onSlotClick('grille')} />}
      {vehicle.parts.spoiler && <Spoiler body={body} id={vehicle.parts.spoiler} color={vehicle.partColors.spoiler ?? vehicle.trimColor} selected={selectedSlot === 'spoiler'} onClick={() => onSlotClick('spoiler')} />}
      {vehicle.parts.bumper_front && <Bumper body={body} id={vehicle.parts.bumper_front} color={vehicle.partColors.bumper_front ?? vehicle.trimColor} selected={selectedSlot === 'bumper_front'} onClick={() => onSlotClick('bumper_front')} />}
      {vehicle.parts.bumper_rear && <Bumper rear body={body} id={vehicle.parts.bumper_rear} color={vehicle.partColors.bumper_rear ?? vehicle.trimColor} selected={selectedSlot === 'bumper_rear'} onClick={() => onSlotClick('bumper_rear')} />}

      {showSlots && compatibleSlots.map((slot) => (
        <SlotMarker key={slot} position={wheelPosition(slot, body, wheelSlots.includes(slot) ? pendingPart ?? vehicle.parts[slot] : undefined)} label={slot.replace(/_/g, ' ')} onClick={() => onSlotClick(slot)} />
      ))}
    </group>
  )
}

function CameraRig({ resetKey }: { resetKey: number }) {
  const controls = useRef<any>(null)
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(7.3, 3.8, 7.6)
    controls.current?.target.set(0, 0.88, 0)
    controls.current?.update()
  }, [camera, resetKey])
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.075} minDistance={5.2} maxDistance={13} minPolarAngle={0.32} maxPolarAngle={Math.PI / 2.04} target={[0, 0.88, 0]} />
}

function StudioEnvironment({ enhanced }: { enhanced: boolean }) {
  return (
    <Environment resolution={enhanced ? 512 : 128} background={false}>
      <Lightformer form="rect" intensity={5} color="#ffffff" position={[0, 6, -5]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4, 1]} />
      <Lightformer form="rect" intensity={3} color="#dff4ff" position={[5, 2.5, 1]} rotation={[0, Math.PI / 2, 0]} scale={[5, 2, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#f6ffdf" position={[-4, 3, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 2, 1]} />
      <Lightformer form="ring" intensity={2} color="#ffffff" position={[0, 4, 5]} scale={3} />
    </Environment>
  )
}

export default function VehicleScene(props: SceneProps) {
  const [ready, setReady] = useState(false)
  const [enhanced, setEnhanced] = useState(false)
  const background = useMemo(() => new THREE.Color('#d6dad4'), [])

  // Render usable geometry first, then stream in the expensive reflection and
  // post-processing passes after the first frame is visible.
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => setEnhanced(true), 420)
    return () => window.clearTimeout(timer)
  }, [ready])

  return (
    <div className="canvas-shell">
      <Canvas
        shadows
        dpr={[1, enhanced ? 2 : 1.25]}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 34, position: [7.3, 3.8, 7.6], near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          gl.setClearColor(background)
          gl.toneMappingExposure = 1.08
          requestAnimationFrame(() => setReady(true))
        }}
      >
        <fog attach="fog" args={['#d6dad4', 11, 22]} />
        <ambientLight intensity={0.42} />
        <hemisphereLight args={['#f8ffff', '#70786f', 0.95]} />
        <directionalLight position={[5, 9, 6]} intensity={3.05} castShadow shadow-mapSize={[enhanced ? 2048 : 1024, enhanced ? 2048 : 1024]} shadow-camera-far={20} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-bias={-0.00035} />
        <directionalLight position={[-4, 3, -5]} intensity={0.9} color="#c7dce3" />
        <StudioEnvironment enhanced={enhanced} />
        <VehicleModel {...props} />
        <mesh position={[0, -0.075, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          {enhanced ? (
            <MeshReflectorMaterial
              color="#cbd0ca"
              metalness={0.08}
              roughness={0.78}
              blur={[280, 100]}
              resolution={512}
              mixBlur={1.2}
              mixStrength={0.32}
              depthScale={0.35}
              minDepthThreshold={0.35}
              maxDepthThreshold={1.4}
            />
          ) : <meshStandardMaterial color="#cbd0ca" roughness={0.82} metalness={0.05} />}
        </mesh>
        <ContactShadows position={[0, -0.015, 0]} scale={12} blur={2.1} opacity={0.54} far={7} resolution={enhanced ? 512 : 256} color="#252a25" />
        <Grid position={[0, -0.025, 0]} args={[30, 30]} cellSize={0.5} cellThickness={0.38} cellColor="#b3b8b1" sectionSize={2.5} sectionThickness={0.7} sectionColor="#9fa59e" fadeDistance={14} fadeStrength={1.7} infiniteGrid />
        {enhanced && (
          <Suspense fallback={null}>
            <StudioEffects />
          </Suspense>
        )}
        <AdaptiveDpr pixelated />
        <CameraRig resetKey={props.viewResetKey} />
      </Canvas>
      {!ready && <div className="canvas-loading">Preparing studio…</div>}
    </div>
  )
}
