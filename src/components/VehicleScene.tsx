import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import {
  ContactShadows,
  Environment,
  Grid,
  Html,
  Lightformer,
  MeshReflectorMaterial,
  OrbitControls,
  RoundedBox,
} from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Mesh, Object3D } from 'three'
import * as THREE from 'three'
import type { BodyDefinition, CategoryId, SlotId, VehicleState } from '../data'
import { bodyById, categorySlots, partById } from '../data'

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
  if (vehicle.finish === 'matte') return { roughness: 0.72, metalness: 0.08, clearcoat: 0.08, clearcoatRoughness: 0.8 }
  if (vehicle.finish === 'satin') return { roughness: 0.38, metalness: 0.18, clearcoat: 0.42, clearcoatRoughness: 0.38 }
  return { roughness: 0.18, metalness: 0.26, clearcoat: 1, clearcoatRoughness: 0.12 }
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
      frontTop: [l * 0.1, roof - 0.16],
      rearTop: [-l * 0.1, roof - 0.12],
      rearBottom: [-l * 0.15, lowerTop + 0.12],
      roofControl: [0, roof - 0.07],
    }
  }
  if (body.id === 'van') {
    return {
      frontBottom: [l * 0.36, lowerTop + 0.1],
      frontTop: [l * 0.31, roof - 0.15],
      rearTop: [-l * 0.35, roof - 0.14],
      rearBottom: [-l * 0.4, lowerTop + 0.1],
      roofControl: [0, roof - 0.07],
    }
  }
  return {
    frontBottom: [body.id === 'suv' ? l * 0.26 : l * 0.2, lowerTop + 0.1],
    frontTop: [body.id === 'suv' ? l * 0.13 : l * 0.07, roof - 0.14],
    rearTop: [body.id === 'suv' ? -l * 0.19 : -l * 0.16, roof - 0.12],
    rearBottom: [body.id === 'suv' ? -l * 0.3 : -l * 0.29, lowerTop + 0.1],
    roofControl: [body.cabinX, roof - 0.05],
  }
}

function shellGeometry(body: BodyDefinition) {
  const { length, width, wheelRadius, lowerHeight } = body
  const xSegments = 18
  const ringSegments = 24
  const positions: number[] = []
  const indices: number[] = []

  // A longitudinal super-ellipse gives the lower body compound curvature in all
  // three axes. Nose, tail, shoulder and rocker widths are no longer planar.
  for (let i = 0; i <= xSegments; i += 1) {
    const t = i / xSegments
    const x = -length / 2 + t * length
    const longitudinalCrown = Math.pow(Math.sin(Math.PI * t), 0.55)
    const noseBias = Math.max(0, (t - 0.68) / 0.32)
    const tailBias = Math.max(0, (0.2 - t) / 0.2)
    const halfWidth = width * 0.5 * (0.77 + longitudinalCrown * 0.23 - noseBias * 0.045 - tailBias * 0.025)
    const halfHeight = lowerHeight * 0.5 * (0.72 + longitudinalCrown * 0.28)
    const centerY = wheelRadius + lowerHeight * 0.47 + noseBias * 0.025

    for (let j = 0; j < ringSegments; j += 1) {
      const angle = (j / ringSegments) * Math.PI * 2
      const side = Math.sin(angle)
      const vertical = Math.cos(angle)
      // Exponents below one create automotive shoulder lines while retaining
      // genuinely rounded corners and a softly crowned hood/deck surface.
      const z = Math.sign(side) * Math.pow(Math.abs(side), 0.78) * halfWidth
      const y = centerY + Math.sign(vertical) * Math.pow(Math.abs(vertical), 0.62) * halfHeight
      positions.push(x, y, z)
    }
  }

  for (let i = 0; i < xSegments; i += 1) {
    for (let j = 0; j < ringSegments; j += 1) {
      const nextJ = (j + 1) % ringSegments
      const a = i * ringSegments + j
      const b = (i + 1) * ringSegments + j
      const c = (i + 1) * ringSegments + nextJ
      const d = i * ringSegments + nextJ
      indices.push(a, b, d, b, c, d)
    }
  }

  // Close the sculpted nose and tail with radial caps.
  const rearCenter = positions.length / 3
  positions.push(-length / 2, wheelRadius + lowerHeight * 0.47, 0)
  const frontCenter = positions.length / 3
  positions.push(length / 2, wheelRadius + lowerHeight * 0.495, 0)
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
  const xSegments = 12
  const widthSegments = 10
  const positions: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= xSegments; i += 1) {
    const t = i / xSegments
    const x = THREE.MathUtils.lerp(profile.rearTop[0] - 0.08, profile.frontTop[0] + 0.08, t)
    const baseY = THREE.MathUtils.lerp(profile.rearTop[1], profile.frontTop[1], t)
    const longitudinalArch = Math.sin(Math.PI * t) * (body.id === 'van' ? 0.07 : 0.11)
    const edgeWidth = body.width * (body.id === 'van' ? 0.43 : 0.39)
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
  const widthSegments = 14
  const positions: number[] = []
  const indices: number[] = []
  const bottomHalfWidth = body.width * (rear ? 0.37 : 0.405)
  const topHalfWidth = body.width * (rear ? 0.32 : 0.345)
  const direction = rear ? -1 : 1

  for (let row = 0; row <= 1; row += 1) {
    for (let j = 0; j <= widthSegments; j += 1) {
      const across = (j / widthSegments) * 2 - 1
      const centerBulge = 1 - across * across
      const x = THREE.MathUtils.lerp(bottom[0], top[0], row) + direction * centerBulge * 0.045
      const y = THREE.MathUtils.lerp(bottom[1], top[1], row) + centerBulge * 0.025
      const halfWidth = THREE.MathUtils.lerp(bottomHalfWidth, topHalfWidth, row)
      positions.push(x, y, across * halfWidth)
    }
  }
  for (let j = 0; j < widthSegments; j += 1) {
    const a = j
    const b = widthSegments + 1 + j
    const c = widthSegments + 1 + j + 1
    const d = j + 1
    indices.push(a, b, d, b, c, d)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function sideGlassGeometry(body: BodyDefinition, side: -1 | 1) {
  const profile = glassProfile(body)
  const width = body.width
  const points: Array<[number, number, number]> = [
    [profile.frontBottom[0], profile.frontBottom[1], side * width * 0.405],
    [profile.frontTop[0], profile.frontTop[1], side * width * 0.345],
    [profile.roofControl[0], profile.roofControl[1], side * width * 0.335],
    [profile.rearTop[0], profile.rearTop[1], side * width * 0.32],
    [profile.rearBottom[0], profile.rearBottom[1], side * width * 0.37],
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
  const xSegments = 12
  const widthSegments = 10
  const lowerTop = body.wheelRadius + body.lowerHeight
  const profile = glassProfile(body)
  const innerX = rear ? profile.rearBottom[0] + 0.02 : profile.frontBottom[0] - 0.02
  const outerX = rear ? -body.length / 2 + 0.12 : body.length / 2 - 0.12
  const positions: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= xSegments; i += 1) {
    const t = i / xSegments
    const x = THREE.MathUtils.lerp(innerX, outerX, t)
    const endDrop = t * t * (rear ? 0.09 : 0.14)
    const halfWidth = THREE.MathUtils.lerp(body.width * 0.38, body.width * (rear ? 0.41 : 0.39), t)
    for (let j = 0; j <= widthSegments; j += 1) {
      const across = (j / widthSegments) * 2 - 1
      const crown = (1 - across * across) * (rear ? 0.035 : 0.055)
      const edgeDrop = Math.pow(Math.abs(across), 3) * 0.035
      positions.push(x, lowerTop + 0.035 - endDrop + crown - edgeDrop, across * halfWidth)
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

function wheelPosition(slot: SlotId, body: BodyDefinition): [number, number, number] {
  const frontX = body.length * 0.31
  const rearX = -body.length * 0.32
  const sideZ = body.width / 2 + 0.15
  const wheelY = body.wheelRadius
  const map: Record<SlotId, [number, number, number]> = {
    wheel_fl: [frontX, wheelY, sideZ],
    wheel_fr: [frontX, wheelY, -sideZ],
    wheel_rl: [rearX, wheelY, sideZ],
    wheel_rr: [rearX, wheelY, -sideZ],
    headlight_l: [body.length / 2 + 0.08, wheelY + body.lowerHeight * 0.58, body.width * 0.31],
    headlight_r: [body.length / 2 + 0.08, wheelY + body.lowerHeight * 0.58, -body.width * 0.31],
    grille: [body.length / 2 + 0.16, wheelY + body.lowerHeight * 0.28, 0],
    spoiler: [-body.length / 2 + 0.28, wheelY + body.lowerHeight + 0.36, 0],
    bumper_front: [body.length / 2 + 0.2, wheelY * 0.54, 0],
    bumper_rear: [-body.length / 2 - 0.2, wheelY * 0.54, 0],
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
  onClick,
}: {
  position: [number, number, number]
  id?: string
  color: string
  radius: number
  selected: boolean
  onClick: () => void
}) {
  const isOffroad = id === 'wheel_offroad'
  const isDisc = id === 'wheel_disc'
  const spokeCount = id === 'wheel_mesh' ? 12 : id === 'wheel_classic' ? 5 : id === 'wheel_turbine' ? 9 : 7
  const width = isOffroad ? 0.4 : 0.3
  const side = position[2] > 0 ? 1 : -1
  const outerFace = side * (width / 2 + 0.022)
  const discFace = side * (width / 2 + 0.006)

  return (
    <group position={position} onClick={(event) => { event.stopPropagation(); onClick() }} name={`Wheel_${id ?? 'standard'}`}>
      {/* rounded sidewalls and tread carcass */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.97, radius * 0.97, width, isOffroad ? 22 : 56]} />
        <meshStandardMaterial color="#0b0c0b" roughness={0.86} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0, outerFace]}>
        <torusGeometry args={[radius * 0.79, radius * 0.18, 12, 56]} />
        <meshStandardMaterial color="#111310" roughness={0.9} />
      </mesh>
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
      <mesh position={[0, 0, side * (width / 2 + 0.029)]}>
        <torusGeometry args={[radius * 0.45, 0.018, 7, 40]} />
        <meshStandardMaterial color="#c5cbc8" metalness={0.9} roughness={0.18} />
      </mesh>
      {Array.from({ length: 10 }).map((_, index) => {
        const angle = (index / 10) * Math.PI * 2
        return (
          <mesh key={`rotor-hole-${index}`} position={[Math.cos(angle) * radius * 0.43, Math.sin(angle) * radius * 0.43, side * (width / 2 + 0.036)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.012, 8]} />
            <meshBasicMaterial color="#202421" />
          </mesh>
        )
      })}
      {/* brake caliper */}
      <RoundedBox args={[radius * 0.16, radius * 0.42, 0.055]} radius={0.035} smoothness={2} position={[radius * 0.33, 0, side * (width / 2 + 0.045)]}>
        <meshStandardMaterial color={id === 'wheel_forged' ? '#c7ff52' : '#d84b39'} metalness={0.28} roughness={0.3} />
      </RoundedBox>
      {/* rim barrel */}
      <mesh position={[0, 0, side * (width / 2 + 0.052)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.72, radius * 0.72, 0.045, 56]} />
        <meshPhysicalMaterial color={isDisc ? '#cbd2cf' : '#171a18'} metalness={0.9} roughness={0.2} clearcoat={0.6} />
      </mesh>
      {!isDisc && Array.from({ length: spokeCount }).map((_, index) => {
        const angle = (index / spokeCount) * Math.PI * 2
        return (
          <mesh key={`spoke-${index}`} position={[0, 0, side * (width / 2 + 0.083)]} rotation={[0, 0, angle]}>
            <boxGeometry args={[radius * 0.68, radius * (id === 'wheel_mesh' ? 0.045 : 0.07), 0.045]} />
            <meshPhysicalMaterial color={color} metalness={0.92} roughness={0.17} clearcoat={0.65} />
          </mesh>
        )
      })}
      <mesh position={[0, 0, side * (width / 2 + 0.11)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.13, radius * 0.13, 0.05, 28]} />
        <meshStandardMaterial color="#aeb8b4" metalness={0.95} roughness={0.16} emissive={selected ? '#8fce30' : '#000'} emissiveIntensity={selected ? 0.45 : 0} />
      </mesh>
      {Array.from({ length: 5 }).map((_, index) => {
        const angle = (index / 5) * Math.PI * 2
        return (
          <mesh key={`lug-${index}`} position={[Math.cos(angle) * radius * 0.2, Math.sin(angle) * radius * 0.2, side * (width / 2 + 0.141)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.025, 10]} />
            <meshStandardMaterial color="#dce1df" metalness={1} roughness={0.12} />
          </mesh>
        )
      })}
    </group>
  )
}

function Headlight({ position, id, selected, onClick }: { position: [number, number, number]; id?: string; selected: boolean; onClick: () => void }) {
  const round = id === 'light_round' || id === 'light_classic'
  return (
    <group position={position} onClick={(event) => { event.stopPropagation(); onClick() }} name={`Headlight_${id}`}>
      <pointLight position={[0.18, 0, 0]} color="#dffaff" intensity={0.32} distance={2.4} decay={2} />
      <RoundedBox args={[0.11, round ? 0.36 : 0.3, round ? 0.36 : 0.55]} radius={0.07} smoothness={3}>
        <meshStandardMaterial color="#131918" metalness={0.58} roughness={0.2} emissive={selected ? '#81c42c' : '#000'} emissiveIntensity={0.35} />
      </RoundedBox>
      {round ? (
        <>
          <mesh position={[0.068, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.115, 0.025, 12, 36]} />
            <meshStandardMaterial color="#e8fdff" emissive="#d8fbff" emissiveIntensity={4.2} toneMapped={false} />
          </mesh>
          <mesh position={[0.07, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.07, 28]} />
            <meshPhysicalMaterial color="#d9f7fb" transmission={0.45} opacity={0.75} transparent roughness={0.03} />
          </mesh>
        </>
      ) : (
        <>
          {[-0.105, 0, 0.105].map((z) => (
            <mesh key={z} position={[0.071, 0.02, z]}>
              <boxGeometry args={[0.02, id === 'light_slash' ? 0.035 : 0.11, 0.06]} />
              <meshStandardMaterial color="#e9fdff" emissive="#d5faff" emissiveIntensity={4} toneMapped={false} />
            </mesh>
          ))}
          <mesh position={[0.078, -0.105, 0]}>
            <boxGeometry args={[0.02, 0.018, 0.42]} />
            <meshBasicMaterial color="#f2ffff" toneMapped={false} />
          </mesh>
        </>
      )}
      <mesh position={[0.088, 0, 0]}>
        <boxGeometry args={[0.025, round ? 0.33 : 0.27, round ? 0.33 : 0.51]} />
        <meshPhysicalMaterial color="#dff9fb" transparent opacity={0.24} transmission={0.42} roughness={0.03} clearcoat={1} />
      </mesh>
    </group>
  )
}

function Grille({ body, id, color, selected, onClick }: { body: BodyDefinition; id?: string; color: string; selected: boolean; onClick: () => void }) {
  const bars = id === 'grille_bar' ? 8 : id === 'grille_chrome' ? 6 : 5
  const grilleHeight = body.lowerHeight * 0.46
  return (
    <group position={[body.length / 2 + 0.085, body.wheelRadius + body.lowerHeight * 0.31, 0]} onClick={(e) => { e.stopPropagation(); onClick() }} name={`Grille_${id}`}>
      <RoundedBox args={[0.11, grilleHeight, body.width * 0.49]} radius={0.08} smoothness={3}>
        <meshStandardMaterial color="#0b0e0d" metalness={0.46} roughness={0.3} emissive={selected ? '#8ccf2d' : '#000'} emissiveIntensity={0.25} />
      </RoundedBox>
      {Array.from({ length: bars }).map((_, index) => (
        <RoundedBox key={index} args={[0.032, grilleHeight * 0.82, id === 'grille_hex' ? 0.025 : 0.035]} radius={0.01} smoothness={2} position={[0.067, 0, ((index - (bars - 1) / 2) / bars) * body.width * 0.42]}>
          <meshStandardMaterial color={id === 'grille_chrome' ? '#d7dfdc' : color} metalness={0.94} roughness={0.17} />
        </RoundedBox>
      ))}
      <mesh position={[0.076, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[0.055, 0.075, 32]} />
        <meshStandardMaterial color="#d7dfdc" metalness={1} roughness={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Spoiler({ body, id, color, selected, onClick }: { body: BodyDefinition; id?: string; color: string; selected: boolean; onClick: () => void }) {
  const lip = id === 'spoiler_lip'
  const height = lip ? 0.07 : id === 'spoiler_heritage' ? 0.28 : 0.42
  const x = -body.length / 2 + 0.32
  const y = body.wheelRadius + body.lowerHeight + height
  return (
    <group position={[x, y, 0]} onClick={(e) => { e.stopPropagation(); onClick() }} name={`Spoiler_${id}`}>
      {!lip && [-0.63, 0.63].map((z) => (
        <RoundedBox key={z} args={[0.09, height, 0.075]} radius={0.025} smoothness={2} position={[0, -height / 2, z]} rotation={[0, 0, -0.08]}>
          <meshStandardMaterial color={color} metalness={0.44} roughness={0.26} />
        </RoundedBox>
      ))}
      <RoundedBox args={[lip ? 0.22 : 0.38, 0.075, body.width * (lip ? 0.73 : 0.91)]} radius={0.04} smoothness={3} rotation={[id === 'spoiler_split' ? 0.06 : -0.025, 0, -0.06]}>
        <meshPhysicalMaterial color={color} metalness={0.56} roughness={0.21} clearcoat={0.7} emissive={selected ? '#92d534' : '#000'} emissiveIntensity={0.18} />
      </RoundedBox>
      {!lip && [-1, 1].map((side) => (
        <mesh key={side} position={[0, 0.015, side * body.width * 0.46]}>
          <boxGeometry args={[0.34, 0.21, 0.035]} />
          <meshStandardMaterial color={color} metalness={0.45} roughness={0.27} />
        </mesh>
      ))}
    </group>
  )
}

function Bumper({ body, rear, id, color, selected, onClick }: { body: BodyDefinition; rear?: boolean; id?: string; color: string; selected: boolean; onClick: () => void }) {
  const x = (rear ? -1 : 1) * (body.length / 2 + 0.1)
  const rally = id === 'bumper_rally'
  return (
    <group position={[x, body.wheelRadius * 0.54, 0]} onClick={(e) => { e.stopPropagation(); onClick() }} name={`${rear ? 'Rear' : 'Front'}_Bumper_${id}`}>
      <RoundedBox args={[rally ? 0.18 : 0.13, rally ? 0.32 : 0.2, body.width * 0.91]} radius={0.06} smoothness={3}>
        <meshPhysicalMaterial color={color} metalness={rally ? 0.72 : 0.25} roughness={0.34} clearcoat={0.35} emissive={selected ? '#91d22f' : '#000'} emissiveIntensity={0.14} />
      </RoundedBox>
      {!rear && id === 'bumper_sport' && [-0.67, 0.67].map((z) => (
        <mesh key={z} position={[0.09, -0.12, z]} rotation={[0, 0, z > 0 ? -0.16 : 0.16]}>
          <boxGeometry args={[0.38, 0.045, 0.34]} />
          <meshPhysicalMaterial color="#111412" roughness={0.28} metalness={0.4} clearcoat={0.35} />
        </mesh>
      ))}
      {!rear && rally && (
        <mesh position={[0.12, 0.17, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[body.width * 0.34, 0.035, 8, 32, Math.PI]} />
          <meshStandardMaterial color="#505854" metalness={0.82} roughness={0.25} />
        </mesh>
      )}
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
  return (
    <>
      {[-1, 1].flatMap((side) => xPositions.map((x) => (
        <group key={`${side}-${x}`} position={[x, body.wheelRadius, side * (body.width / 2 + 0.082)]}>
          <mesh>
            <torusGeometry args={[body.wheelRadius * 1.09, 0.055, 10, 48, Math.PI]} />
            <meshPhysicalMaterial color={vehicle.bodyColor} {...paint} />
          </mesh>
          <mesh position={[0, 0, -side * 0.018]}>
            <torusGeometry args={[body.wheelRadius * 1.02, 0.027, 8, 48, Math.PI]} />
            <meshStandardMaterial color="#111411" roughness={0.5} />
          </mesh>
        </group>
      )))}
    </>
  )
}

function Seat({ position, color = '#242824' }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.54, 0.16, 0.48]} radius={0.08} smoothness={3} rotation={[0, 0, -0.06]} castShadow>
        <meshStandardMaterial color={color} roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.17, 0.66, 0.49]} radius={0.08} smoothness={3} position={[-0.2, 0.36, 0]} rotation={[0, 0, -0.12]} castShadow>
        <meshStandardMaterial color={color} roughness={0.68} />
      </RoundedBox>
      <RoundedBox args={[0.13, 0.19, 0.29]} radius={0.055} smoothness={3} position={[-0.27, 0.75, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.7} />
      </RoundedBox>
      {/* stitched bolsters catch highlights through the side glass */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[-0.11, 0.36, side * 0.235]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[0.08, 0.5, 0.025]} />
          <meshStandardMaterial color="#3b413d" roughness={0.56} />
        </mesh>
      ))}
      <mesh position={[-0.29, 0.43, 0.17]} rotation={[0, 0, -0.18]}>
        <boxGeometry args={[0.025, 0.57, 0.018]} />
        <meshStandardMaterial color="#151916" roughness={0.82} />
      </mesh>
      <mesh position={[-0.215, 0.37, 0.251]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.012, 0.45, 0.012]} />
        <meshBasicMaterial color="#9ca39f" />
      </mesh>
    </group>
  )
}

function VehicleInterior({ body }: { body: BodyDefinition }) {
  const lowerTop = body.wheelRadius + body.lowerHeight
  const frontSeatX = body.id === 'truck' ? body.length * 0.015 : body.id === 'van' ? body.length * 0.15 : body.length * 0.03
  const rearSeatX = body.id === 'van' ? -body.length * 0.17 : -body.length * 0.18
  const seatZ = body.width * 0.22
  const interiorProfile = glassProfile(body)
  const dashX = interiorProfile.frontBottom[0] - 0.12
  const driverZ = body.width * 0.23

  return (
    <group name="Detailed_Interior">
      <RoundedBox args={[body.cabinLength * 0.72, 0.1, body.width * 0.72]} radius={0.05} smoothness={2} position={[body.cabinX, lowerTop - 0.08, 0]}>
        <meshStandardMaterial color="#111411" roughness={0.86} />
      </RoundedBox>
      {[-1, 1].map((side) => <Seat key={`front-${side}`} position={[frontSeatX, lowerTop + 0.03, side * seatZ]} />)}
      {body.id !== 'truck' && [-1, 1].map((side) => <Seat key={`rear-${side}`} position={[rearSeatX, lowerTop + 0.02, side * seatZ]} color="#292e2a" />)}

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
  const glassId = vehicle.parts.windows
  const glassOpacity = glassId === 'window_clear' ? 0.52 : glassId === 'window_dark' ? 0.9 : glassId === 'window_bronze' ? 0.76 : 0.72
  const glassColor = glassId === 'window_bronze' ? '#75634d' : vehicle.glassColor
  const glassMaterial = (
    <meshPhysicalMaterial
      color={glassColor}
      transparent
      opacity={glassOpacity}
      transmission={glassId === 'window_clear' ? 0.28 : 0.06}
      thickness={0.035}
      ior={1.45}
      roughness={0.035}
      metalness={0.12}
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
          <RoundedBox
            args={[Math.abs(profile.frontBottom[0] - profile.rearBottom[0]) + 0.12, 0.16, 0.09]}
            radius={0.04}
            smoothness={3}
            position={[(profile.frontBottom[0] + profile.rearBottom[0]) / 2, lowerTop + 0.025, side * body.width * 0.445]}
          >
            <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
          </RoundedBox>
          <mesh
            geometry={side > 0 ? leftGlass : rightGlass}
            renderOrder={3}
            onClick={(event) => { event.stopPropagation(); onSlotClick('windows') }}
            name={side > 0 ? 'Left_Side_Glass' : 'Right_Side_Glass'}
          >
            {glassMaterial}
          </mesh>
          {pillarXs.map((x) => (
            <RoundedBox key={x} args={[0.075, body.cabinHeight * 0.78, 0.035]} radius={0.018} smoothness={2} position={[x, lowerTop + body.cabinHeight * 0.5, side * (body.width / 2 + 0.105)]}>
              <meshStandardMaterial color={vehicle.trimColor} roughness={0.26} metalness={0.25} />
            </RoundedBox>
          ))}
          {/* flush door handles */}
          {(body.id === 'truck' ? [body.length * 0.015] : [body.length * 0.07, -body.length * 0.21]).map((x) => (
            <RoundedBox key={`handle-${x}`} args={[0.19, 0.035, 0.025]} radius={0.015} smoothness={2} position={[x, lowerTop - 0.12, side * (body.width / 2 + 0.11)]}>
              <meshStandardMaterial color="#aeb5b1" metalness={0.88} roughness={0.2} />
            </RoundedBox>
          ))}
          {/* lower sill and door shut lines */}
          <mesh position={[body.cabinX, body.wheelRadius * 0.35, side * (body.width / 2 + 0.092)]}>
            <boxGeometry args={[body.length * 0.52, 0.055, 0.045]} />
            <meshStandardMaterial color={vehicle.trimColor} metalness={0.35} roughness={0.3} />
          </mesh>
          {pillarXs.map((x) => (
            <mesh key={`seam-${x}`} position={[x, lowerTop - body.lowerHeight * 0.44, side * body.width * 0.5]}>
              <boxGeometry args={[0.012, body.lowerHeight * 0.84, 0.012]} />
              <meshBasicMaterial color="#212520" transparent opacity={0.5} />
            </mesh>
          ))}
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

      {/* Structural A/C pillars, roof rails and glass header rails clearly frame
          both windscreens from every camera angle. */}
      {[-1, 1].map((side) => {
        const frontBottom: [number, number, number] = [profile.frontBottom[0], profile.frontBottom[1], side * body.width * 0.405]
        const frontTop: [number, number, number] = [profile.frontTop[0], profile.frontTop[1] + 0.04, side * body.width * 0.345]
        const rearTop: [number, number, number] = [profile.rearTop[0], profile.rearTop[1] + 0.04, side * body.width * 0.32]
        const rearBottom: [number, number, number] = [profile.rearBottom[0], profile.rearBottom[1], side * body.width * 0.37]
        return (
          <group key={`cabin-frame-${side}`}>
            <FrameBeam from={frontBottom} to={frontTop} color={vehicle.bodyColor} thickness={0.095} depth={0.11} />
            <FrameBeam from={frontTop} to={rearTop} color={vehicle.bodyColor} thickness={0.095} depth={0.11} />
            <FrameBeam from={rearTop} to={rearBottom} color={vehicle.bodyColor} thickness={0.1} depth={0.11} />
            <FrameBeam from={rearBottom} to={frontBottom} color={vehicle.bodyColor} thickness={0.075} depth={0.1} />
          </group>
        )
      })}
      <RoundedBox args={[0.075, 0.075, body.width * 0.7]} radius={0.025} smoothness={2} position={[profile.frontTop[0], profile.frontTop[1] + 0.04, 0]}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
      </RoundedBox>
      <RoundedBox args={[0.075, 0.075, body.width * 0.65]} radius={0.025} smoothness={2} position={[profile.rearTop[0], profile.rearTop[1] + 0.04, 0]}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
      </RoundedBox>
      <RoundedBox args={[0.13, 0.1, body.width * 0.83]} radius={0.035} smoothness={3} position={[profile.frontBottom[0], profile.frontBottom[1] - 0.025, 0]}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
      </RoundedBox>
      <RoundedBox args={[0.13, 0.1, body.width * 0.76]} radius={0.035} smoothness={3} position={[profile.rearBottom[0], profile.rearBottom[1] - 0.025, 0]}>
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
        <group key={`mirror-${side}`} position={[frontBottomX - 0.06, lowerTop + body.cabinHeight * 0.25, side * (body.width / 2 + 0.22)]}>
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

      {/* rear lamps always present for road realism */}
      {[-1, 1].map((side) => (
        <group key={`tail-${side}`} position={[-body.length / 2 - 0.035, lowerTop - body.lowerHeight * 0.23, side * body.width * 0.32]}>
          <RoundedBox args={[0.075, 0.2, body.width * 0.22]} radius={0.055} smoothness={3}>
            <meshStandardMaterial color="#6d0806" emissive="#ef261b" emissiveIntensity={1.9} roughness={0.18} toneMapped={false} />
          </RoundedBox>
          <mesh position={[-0.043, 0, 0]}>
            <boxGeometry args={[0.012, 0.15, body.width * 0.18]} />
            <meshPhysicalMaterial color="#ff6c59" transparent opacity={0.48} transmission={0.18} roughness={0.08} />
          </mesh>
        </group>
      ))}

      {/* registration plates */}
      {[1, -1].map((direction) => (
        <group key={`plate-${direction}`} position={[direction * (body.length / 2 + 0.155), body.wheelRadius + 0.04, 0]} rotation={[0, direction < 0 ? Math.PI : 0, 0]}>
          <RoundedBox args={[0.025, 0.17, 0.47]} radius={0.025} smoothness={2}>
            <meshStandardMaterial color="#e8ebe5" roughness={0.46} />
          </RoundedBox>
          <mesh position={[0.016, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.36, 0.07]} />
            <meshBasicMaterial color="#293029" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* twin exhaust tips and rear diffuser */}
      {[-0.58, 0.58].map((z) => (
        <mesh key={`exhaust-${z}`} position={[-body.length / 2 - 0.14, body.wheelRadius * 0.24, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.075, 0.075, 0.25, 24, 1, true]} />
          <meshStandardMaterial color="#59605d" metalness={0.95} roughness={0.19} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[-body.length / 2 - 0.05, body.wheelRadius * 0.17, 0]}>
        <boxGeometry args={[0.2, 0.12, body.width * 0.64]} />
        <meshStandardMaterial color="#101310" metalness={0.34} roughness={0.38} />
      </mesh>

      {/* fog lamps and amber repeater strips give the front fascia game-vehicle readability */}
      {[-1, 1].map((side) => (
        <group key={`fog-${side}`} position={[body.length / 2 + 0.1, body.wheelRadius * 0.55, side * body.width * 0.38]}>
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

      {/* GTA-era panel gaps: readable at driving distance without excessive geometry */}
      <mesh position={[body.length * 0.24, lowerTop + 0.065, 0]}>
        <boxGeometry args={[0.014, 0.012, body.width * 0.82]} />
        <meshBasicMaterial color="#111411" transparent opacity={0.48} />
      </mesh>
      <mesh position={[-body.length * 0.4, lowerTop + 0.025, 0]}>
        <boxGeometry args={[0.014, 0.012, body.width * 0.78]} />
        <meshBasicMaterial color="#111411" transparent opacity={0.45} />
      </mesh>

      {/* subtle hood creases */}
      {[-0.46, 0.46].map((z) => (
        <mesh key={`hood-line-${z}`} position={[body.length * 0.35, lowerTop + 0.055, z]} rotation={[0, 0, -0.02]}>
          <boxGeometry args={[body.length * 0.18, 0.012, 0.018]} />
          <meshStandardMaterial color={vehicle.trimColor} transparent opacity={0.32} />
        </mesh>
      ))}
    </>
  )
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
  const lowerTop = body.wheelRadius + body.lowerHeight

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow name={`${body.name}_SculptedBody`}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
      </mesh>
      <mesh geometry={hood} castShadow name={`${body.name}_SculptedHood`}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} side={THREE.DoubleSide} />
      </mesh>
      {body.id !== 'truck' && body.id !== 'van' && (
        <mesh geometry={deck} castShadow name={`${body.name}_SculptedDeck`}>
          <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh geometry={roof} castShadow name={`${body.name}_CurvedRoof`}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} side={THREE.DoubleSide} />
      </mesh>
      <FenderArches body={body} vehicle={vehicle} />

      {/* stamped shoulder creases, rocker contours and a proper fuel door keep the
          broad side surfaces readable under moving game lighting. */}
      {[-1, 1].map((side) => (
        <group key={`surface-detail-${side}`}>
          <FrameBeam
            from={[body.length * 0.42, body.wheelRadius + body.lowerHeight * 0.68, side * body.width * 0.492]}
            to={[-body.length * 0.43, body.wheelRadius + body.lowerHeight * 0.62, side * body.width * 0.492]}
            color={vehicle.trimColor}
            thickness={0.018}
            depth={0.018}
          />
          <FrameBeam
            from={[body.length * 0.38, body.wheelRadius + body.lowerHeight * 0.19, side * body.width * 0.487]}
            to={[-body.length * 0.38, body.wheelRadius + body.lowerHeight * 0.15, side * body.width * 0.487]}
            color={vehicle.trimColor}
            thickness={0.025}
            depth={0.028}
          />
        </group>
      ))}
      <mesh position={[-body.length * 0.36, body.wheelRadius + body.lowerHeight * 0.68, body.width * 0.498]}>
        <torusGeometry args={[0.105, 0.012, 8, 32]} />
        <meshStandardMaterial color={vehicle.trimColor} metalness={0.45} roughness={0.34} />
      </mesh>
      {body.id === 'sports' && [-0.36, 0.36].map((z) => (
        <RoundedBox key={`hood-vent-${z}`} args={[0.34, 0.018, 0.12]} radius={0.04} smoothness={3} position={[body.length * 0.34, lowerTop + 0.095, z]} rotation={[0, 0, -0.025]}>
          <meshStandardMaterial color="#111512" metalness={0.42} roughness={0.32} />
        </RoundedBox>
      ))}
      {/* inset panoramic panel follows the new arched roof as a contrasting detail */}
      {body.id !== 'truck' && (
        <RoundedBox args={[body.cabinLength * 0.34, 0.025, body.width * 0.48]} radius={0.12} smoothness={4} position={[body.cabinX - 0.03, lowerTop + body.cabinHeight + 0.055, 0]}>
          <meshPhysicalMaterial color="#142021" metalness={0.4} roughness={0.06} clearcoat={1} />
        </RoundedBox>
      )}
      {/* pickup bed liner */}
      {body.id === 'truck' && (
        <>
          <RoundedBox args={[body.length * 0.28, 0.055, body.width * 0.75]} radius={0.035} smoothness={2} position={[-body.length * 0.35, lowerTop + 0.08, 0]}>
            <meshStandardMaterial color="#161a17" roughness={0.72} />
          </RoundedBox>
          {[-1, 1].map((side) => (
            <RoundedBox key={side} args={[body.length * 0.3, 0.2, 0.11]} radius={0.035} smoothness={2} position={[-body.length * 0.34, lowerTop + 0.12, side * body.width * 0.43]}>
              <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
            </RoundedBox>
          ))}
        </>
      )}
      {/* underbody shadow masks the hollow procedural shell */}
      <RoundedBox args={[body.length * 0.73, 0.13, body.width * 0.74]} radius={0.06} smoothness={2} position={[0, body.wheelRadius * 0.23, 0]}>
        <meshStandardMaterial color="#101210" roughness={0.78} />
      </RoundedBox>
    </>
  )
}

function VehicleModel({ vehicle, activeCategory, pendingPart, selectedSlot, showSlots, onSlotClick, onVehicleReady }: ModelProps) {
  const body = bodyById(vehicle.bodyId)
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
          radius={body.wheelRadius * (vehicle.parts[slot] === 'wheel_offroad' ? 1.08 : 1)}
          position={wheelPosition(slot, body)}
          selected={selectedSlot === slot}
          onClick={() => onSlotClick(slot)}
        />
      ))}

      {(['headlight_l', 'headlight_r'] as SlotId[]).map((slot) => vehicle.parts[slot] && (
        <Headlight key={slot} id={vehicle.parts[slot]} position={wheelPosition(slot, body)} selected={selectedSlot === slot} onClick={() => onSlotClick(slot)} />
      ))}

      {vehicle.parts.grille && <Grille body={body} id={vehicle.parts.grille} color={vehicle.partColors.grille ?? vehicle.trimColor} selected={selectedSlot === 'grille'} onClick={() => onSlotClick('grille')} />}
      {vehicle.parts.spoiler && <Spoiler body={body} id={vehicle.parts.spoiler} color={vehicle.partColors.spoiler ?? vehicle.trimColor} selected={selectedSlot === 'spoiler'} onClick={() => onSlotClick('spoiler')} />}
      {vehicle.parts.bumper_front && <Bumper body={body} id={vehicle.parts.bumper_front} color={vehicle.partColors.bumper_front ?? vehicle.trimColor} selected={selectedSlot === 'bumper_front'} onClick={() => onSlotClick('bumper_front')} />}
      {vehicle.parts.bumper_rear && <Bumper rear body={body} id={vehicle.parts.bumper_rear} color={vehicle.partColors.bumper_rear ?? vehicle.trimColor} selected={selectedSlot === 'bumper_rear'} onClick={() => onSlotClick('bumper_rear')} />}

      {showSlots && compatibleSlots.map((slot) => (
        <SlotMarker key={slot} position={wheelPosition(slot, body)} label={slot.replace(/_/g, ' ')} onClick={() => onSlotClick(slot)} />
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

function StudioEnvironment() {
  return (
    <Environment resolution={256} background={false}>
      <Lightformer form="rect" intensity={5} color="#ffffff" position={[0, 6, -5]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4, 1]} />
      <Lightformer form="rect" intensity={3} color="#dff4ff" position={[5, 2.5, 1]} rotation={[0, Math.PI / 2, 0]} scale={[5, 2, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#f6ffdf" position={[-4, 3, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 2, 1]} />
      <Lightformer form="ring" intensity={2} color="#ffffff" position={[0, 4, 5]} scale={3} />
    </Environment>
  )
}

export default function VehicleScene(props: SceneProps) {
  const [ready, setReady] = useState(false)
  const background = useMemo(() => new THREE.Color('#d6dad4'), [])

  return (
    <div className="canvas-shell">
      <Canvas
        shadows
        dpr={[1, 1.8]}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ fov: 34, position: [7.3, 3.8, 7.6], near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          gl.setClearColor(background)
          gl.toneMappingExposure = 1.08
          setReady(true)
        }}
      >
        <fog attach="fog" args={['#d6dad4', 11, 22]} />
        <ambientLight intensity={0.7} />
        <hemisphereLight args={['#f8ffff', '#70786f', 1.25]} />
        <directionalLight position={[5, 9, 6]} intensity={2.7} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-far={20} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-bias={-0.00035} />
        <directionalLight position={[-4, 3, -5]} intensity={0.9} color="#c7dce3" />
        <StudioEnvironment />
        <VehicleModel {...props} />
        <mesh position={[0, -0.075, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
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
        </mesh>
        <ContactShadows position={[0, -0.015, 0]} scale={12} blur={2.1} opacity={0.54} far={7} resolution={512} color="#252a25" />
        <Grid position={[0, -0.025, 0]} args={[30, 30]} cellSize={0.5} cellThickness={0.38} cellColor="#b3b8b1" sectionSize={2.5} sectionThickness={0.7} sectionColor="#9fa59e" fadeDistance={14} fadeStrength={1.7} infiniteGrid />
        <EffectComposer multisampling={0}>
          <N8AO halfRes quality="medium" aoRadius={0.42} distanceFalloff={0.85} intensity={1.45} color="#20251f" />
          <Bloom intensity={0.38} luminanceThreshold={1.05} luminanceSmoothing={0.22} mipmapBlur />
          <Vignette offset={0.35} darkness={0.2} />
          <SMAA />
        </EffectComposer>
        <CameraRig resetKey={props.viewResetKey} />
      </Canvas>
      {!ready && <div className="canvas-loading">Preparing studio…</div>}
    </div>
  )
}
