import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ContactShadows,
  Environment,
  Grid,
  Html,
  Lightformer,
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

function shellGeometry(body: BodyDefinition) {
  const { length: l, wheelRadius: wr, lowerHeight: lh, cabinHeight: ch, width } = body
  const lowerTop = wr + lh
  const roof = lowerTop + ch
  const shape = new THREE.Shape()

  shape.moveTo(l / 2 - 0.03, wr * 0.27)
  shape.quadraticCurveTo(l / 2 + 0.1, wr + lh * 0.34, l / 2 - 0.13, lowerTop - lh * 0.12)

  if (body.id === 'truck') {
    shape.quadraticCurveTo(l * 0.37, lowerTop + 0.03, l * 0.2, lowerTop + 0.03)
    shape.lineTo(l * 0.12, roof - ch * 0.13)
    shape.quadraticCurveTo(l * 0.07, roof + 0.03, -l * 0.12, roof)
    shape.lineTo(-l * 0.19, lowerTop + 0.06)
    shape.lineTo(-l * 0.49, lowerTop + 0.01)
  } else if (body.id === 'van') {
    shape.quadraticCurveTo(l * 0.49, lowerTop + ch * 0.52, l * 0.35, roof - 0.05)
    shape.quadraticCurveTo(0, roof + 0.07, -l * 0.43, roof - 0.02)
    shape.quadraticCurveTo(-l * 0.51, roof - ch * 0.22, -l * 0.49, lowerTop + 0.02)
  } else {
    const frontRoofX = body.id === 'suv' ? l * 0.16 : l * 0.09
    const rearRoofX = body.id === 'suv' ? -l * 0.22 : -l * 0.18
    const hoodX = body.id === 'suv' ? l * 0.31 : l * 0.24
    shape.quadraticCurveTo(l * 0.4, lowerTop + 0.04, hoodX, lowerTop + 0.05)
    shape.quadraticCurveTo(frontRoofX + l * 0.08, lowerTop + ch * 0.22, frontRoofX, roof - ch * 0.1)
    shape.quadraticCurveTo(frontRoofX - l * 0.06, roof + 0.04, rearRoofX, roof)
    shape.quadraticCurveTo(rearRoofX - l * 0.08, roof - ch * 0.1, -l * 0.34, lowerTop + ch * 0.12)
    shape.quadraticCurveTo(-l * 0.43, lowerTop + 0.04, -l * 0.49, lowerTop - 0.04)
  }

  shape.quadraticCurveTo(-l / 2 - 0.08, wr + lh * 0.2, -l / 2 + 0.02, wr * 0.25)
  shape.lineTo(-l * 0.43, wr * 0.12)
  shape.quadraticCurveTo(-l * 0.17, wr * 0.03, 0, wr * 0.05)
  shape.quadraticCurveTo(l * 0.17, wr * 0.03, l * 0.43, wr * 0.12)
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: body.id === 'sports' ? 0.11 : 0.08,
    bevelThickness: 0.07,
    curveSegments: 20,
  })
  geometry.translate(0, 0, -width / 2)
  geometry.computeVertexNormals()
  return geometry
}

function sideGlassGeometry(body: BodyDefinition) {
  const l = body.length
  const lowerTop = body.wheelRadius + body.lowerHeight
  const roof = lowerTop + body.cabinHeight
  const shape = new THREE.Shape()

  if (body.id === 'truck') {
    shape.moveTo(l * 0.16, lowerTop + 0.12)
    shape.lineTo(l * 0.1, roof - 0.16)
    shape.quadraticCurveTo(0, roof - 0.07, -l * 0.1, roof - 0.12)
    shape.lineTo(-l * 0.15, lowerTop + 0.12)
  } else if (body.id === 'van') {
    shape.moveTo(l * 0.36, lowerTop + 0.1)
    shape.lineTo(l * 0.31, roof - 0.15)
    shape.quadraticCurveTo(0, roof - 0.07, -l * 0.35, roof - 0.14)
    shape.lineTo(-l * 0.4, lowerTop + 0.1)
  } else {
    const frontTopX = body.id === 'suv' ? l * 0.13 : l * 0.07
    const rearTopX = body.id === 'suv' ? -l * 0.19 : -l * 0.16
    const frontBottomX = body.id === 'suv' ? l * 0.26 : l * 0.2
    const rearBottomX = body.id === 'suv' ? -l * 0.3 : -l * 0.29
    shape.moveTo(frontBottomX, lowerTop + 0.1)
    shape.lineTo(frontTopX, roof - 0.14)
    shape.quadraticCurveTo(body.cabinX, roof - 0.05, rearTopX, roof - 0.12)
    shape.lineTo(rearBottomX, lowerTop + 0.1)
  }
  shape.closePath()
  return new THREE.ShapeGeometry(shape, 18)
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

function GlassAndBodyDetails({ vehicle, body, selectedSlot, onSlotClick }: { vehicle: VehicleState; body: BodyDefinition; selectedSlot?: SlotId; onSlotClick: (slot: SlotId) => void }) {
  const sideGlass = useMemo(() => sideGlassGeometry(body), [body])
  useEffect(() => () => sideGlass.dispose(), [sideGlass])
  const lowerTop = body.wheelRadius + body.lowerHeight
  const roof = lowerTop + body.cabinHeight
  const glassId = vehicle.parts.windows
  const glassOpacity = glassId === 'window_clear' ? 0.42 : glassId === 'window_dark' ? 0.84 : glassId === 'window_bronze' ? 0.68 : 0.6
  const glassColor = glassId === 'window_bronze' ? '#75634d' : vehicle.glassColor
  const glassMaterial = (
    <meshPhysicalMaterial
      color={glassColor}
      transparent
      opacity={glassOpacity}
      transmission={glassId === 'window_clear' ? 0.42 : 0.14}
      roughness={0.04}
      metalness={0.08}
      clearcoat={1}
      clearcoatRoughness={0.04}
      side={THREE.DoubleSide}
      emissive={selectedSlot === 'windows' ? '#426920' : '#000'}
      emissiveIntensity={0.18}
    />
  )

  const frontBottomX = body.id === 'van' ? body.length * 0.39 : body.id === 'truck' ? body.length * 0.19 : body.id === 'suv' ? body.length * 0.28 : body.length * 0.22
  const frontTopX = body.id === 'van' ? body.length * 0.33 : body.id === 'truck' ? body.length * 0.1 : body.id === 'suv' ? body.length * 0.15 : body.length * 0.08
  const rearBottomX = body.id === 'van' ? -body.length * 0.43 : body.id === 'truck' ? -body.length * 0.17 : -body.length * 0.32
  const rearTopX = body.id === 'van' ? -body.length * 0.39 : body.id === 'truck' ? -body.length * 0.12 : body.id === 'suv' ? -body.length * 0.21 : -body.length * 0.18
  const glassBottomY = lowerTop + 0.12
  const glassTopY = roof - 0.14
  const frontLength = Math.hypot(frontTopX - frontBottomX, glassTopY - glassBottomY)
  const rearLength = Math.hypot(rearTopX - rearBottomX, glassTopY - glassBottomY)
  const frontAngle = Math.atan2(-(frontTopX - frontBottomX), glassTopY - glassBottomY)
  const rearAngle = Math.atan2(-(rearTopX - rearBottomX), glassTopY - glassBottomY)
  const pillarXs = body.id === 'truck' ? [-body.length * 0.015] : body.id === 'van' ? [body.length * 0.08, -body.length * 0.16] : [body.cabinX]

  return (
    <>
      {[-1, 1].map((side) => (
        <group key={`side-glass-${side}`}>
          <mesh
            geometry={sideGlass}
            position={[0, 0, side * (body.width / 2 + 0.085)]}
            onClick={(event) => { event.stopPropagation(); onSlotClick('windows') }}
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
            <mesh key={`seam-${x}`} position={[x, lowerTop - body.lowerHeight * 0.44, side * (body.width / 2 + 0.113)]}>
              <boxGeometry args={[0.012, body.lowerHeight * 0.84, 0.012]} />
              <meshBasicMaterial color="#212520" transparent opacity={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {/* front and rear laminated glass */}
      <mesh
        position={[(frontBottomX + frontTopX) / 2 + 0.015, (glassBottomY + glassTopY) / 2, 0]}
        rotation={[0, 0, frontAngle]}
        onClick={(event) => { event.stopPropagation(); onSlotClick('windows') }}
      >
        <boxGeometry args={[0.035, frontLength, body.width * 0.8]} />
        {glassMaterial}
      </mesh>
      <mesh position={[(rearBottomX + rearTopX) / 2 - 0.015, (glassBottomY + glassTopY) / 2, 0]} rotation={[0, 0, rearAngle]} onClick={(event) => { event.stopPropagation(); onSlotClick('windows') }}>
        <boxGeometry args={[0.035, rearLength, body.width * 0.76]} />
        {glassMaterial}
      </mesh>

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
  useEffect(() => () => geometry.dispose(), [geometry])
  const lowerTop = body.wheelRadius + body.lowerHeight

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow name={`${body.name}_BodyShell`}>
        <meshPhysicalMaterial color={vehicle.bodyColor} {...paintProperties(vehicle)} />
      </mesh>
      <FenderArches body={body} vehicle={vehicle} />
      {/* dark panoramic roof insert */}
      {body.id !== 'truck' && (
        <RoundedBox args={[body.cabinLength * 0.4, 0.035, body.width * 0.58]} radius={0.1} smoothness={3} position={[body.cabinX - 0.03, lowerTop + body.cabinHeight + 0.045, 0]}>
          <meshPhysicalMaterial color="#172122" metalness={0.35} roughness={0.08} clearcoat={1} />
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
          <meshStandardMaterial color="#cdd2cb" roughness={0.9} metalness={0.04} />
        </mesh>
        <ContactShadows position={[0, -0.015, 0]} scale={12} blur={2.1} opacity={0.54} far={7} resolution={512} color="#252a25" />
        <Grid position={[0, -0.025, 0]} args={[30, 30]} cellSize={0.5} cellThickness={0.38} cellColor="#b3b8b1" sectionSize={2.5} sectionThickness={0.7} sectionColor="#9fa59e" fadeDistance={14} fadeStrength={1.7} infiniteGrid />
        <CameraRig resetKey={props.viewResetKey} />
      </Canvas>
      {!ready && <div className="canvas-loading">Preparing studio…</div>}
    </div>
  )
}
