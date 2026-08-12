import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Grid, Html, OrbitControls, RoundedBox } from '@react-three/drei'
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

function materialProps(vehicle: VehicleState) {
  if (vehicle.finish === 'matte') return { roughness: 0.82, metalness: 0.04 }
  if (vehicle.finish === 'satin') return { roughness: 0.46, metalness: 0.14 }
  return { roughness: 0.22, metalness: 0.24 }
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
  const spokes = id === 'wheel_mesh' ? 10 : id === 'wheel_classic' ? 5 : 7
  const width = isOffroad ? 0.34 : 0.26
  const side = position[2] > 0 ? 1 : -1

  return (
    <group position={position} onClick={(event) => { event.stopPropagation(); onClick() }}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, width, isOffroad ? 18 : 48]} />
        <meshStandardMaterial color="#111310" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0, side * (width / 2 + 0.008)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.68, radius * 0.68, 0.035, 48]} />
        <meshStandardMaterial color={isDisc ? '#c7cfcc' : '#1d211f'} metalness={0.75} roughness={0.28} emissive={selected ? '#9ddb37' : '#000000'} emissiveIntensity={selected ? 0.22 : 0} />
      </mesh>
      {!isDisc && Array.from({ length: spokes }).map((_, index) => {
        const angle = (index / spokes) * Math.PI * 2
        return (
          <mesh key={index} position={[0, 0, side * (width / 2 + 0.034)]} rotation={[0, 0, angle]}>
            <boxGeometry args={[radius * 0.68, radius * 0.075, 0.045]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
          </mesh>
        )
      })}
      <mesh position={[0, 0, side * (width / 2 + 0.06)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.13, radius * 0.13, 0.05, 28]} />
        <meshStandardMaterial color="#aeb8b4" metalness={0.9} roughness={0.18} />
      </mesh>
    </group>
  )
}

function Headlight({ position, id, selected, onClick }: { position: [number, number, number]; id?: string; selected: boolean; onClick: () => void }) {
  const round = id === 'light_round' || id === 'light_classic'
  return (
    <group position={position} onClick={(event) => { event.stopPropagation(); onClick() }}>
      <mesh rotation={[0, 0, Math.PI / 2]} scale={round ? [1, 0.8, 0.8] : [1, 1.15, 0.58]}>
        {round ? <sphereGeometry args={[0.18, 24, 18]} /> : <boxGeometry args={[0.1, 0.28, 0.42]} />}
        <meshStandardMaterial color="#dffaff" emissive="#c9f7ff" emissiveIntensity={selected ? 3 : 1.5} roughness={0.1} />
      </mesh>
      {id === 'light_slash' && (
        <mesh position={[0.03, 0, 0]} rotation={[0.6, 0, 0]}>
          <boxGeometry args={[0.06, 0.04, 0.52]} />
          <meshBasicMaterial color="#ecfdff" />
        </mesh>
      )}
    </group>
  )
}

function Grille({ body, id, color, selected, onClick }: { body: BodyDefinition; id?: string; color: string; selected: boolean; onClick: () => void }) {
  const bars = id === 'grille_bar' ? 7 : id === 'grille_chrome' ? 5 : 4
  return (
    <group position={[body.length / 2 + 0.045, body.wheelRadius + 0.12, 0]} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <mesh>
        <boxGeometry args={[0.1, body.lowerHeight * 0.48, body.width * 0.5]} />
        <meshStandardMaterial color={id === 'grille_chrome' ? '#cfd8d5' : color} metalness={0.72} roughness={0.25} emissive={selected ? '#aeea44' : '#000'} emissiveIntensity={0.2} />
      </mesh>
      {Array.from({ length: bars }).map((_, index) => (
        <mesh key={index} position={[0.058, 0, ((index - (bars - 1) / 2) / bars) * body.width * 0.44]}>
          <boxGeometry args={[0.03, body.lowerHeight * 0.39, 0.025]} />
          <meshStandardMaterial color="#77817d" metalness={0.9} roughness={0.22} />
        </mesh>
      ))}
    </group>
  )
}

function Spoiler({ body, id, color, selected, onClick }: { body: BodyDefinition; id?: string; color: string; selected: boolean; onClick: () => void }) {
  const lip = id === 'spoiler_lip'
  const height = lip ? 0.08 : id === 'spoiler_heritage' ? 0.28 : 0.4
  const x = -body.length / 2 + 0.28
  const y = body.wheelRadius + body.lowerHeight + height
  return (
    <group position={[x, y, 0]} onClick={(e) => { e.stopPropagation(); onClick() }}>
      {!lip && [-0.62, 0.62].map((z) => (
        <mesh key={z} position={[0, -height / 2, z]}>
          <boxGeometry args={[0.08, height, 0.07]} />
          <meshStandardMaterial color={color} metalness={0.35} roughness={0.32} />
        </mesh>
      ))}
      <mesh rotation={[0, 0, id === 'spoiler_split' ? -0.12 : 0]}>
        <boxGeometry args={[lip ? 0.22 : 0.34, 0.07, body.width * (lip ? 0.72 : 0.9)]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.25} emissive={selected ? '#aeea44' : '#000'} emissiveIntensity={0.14} />
      </mesh>
    </group>
  )
}

function Bumper({ body, rear, id, color, selected, onClick }: { body: BodyDefinition; rear?: boolean; id?: string; color: string; selected: boolean; onClick: () => void }) {
  const x = (rear ? -1 : 1) * (body.length / 2 + 0.09)
  const rally = id === 'bumper_rally'
  return (
    <group position={[x, body.wheelRadius * 0.63, 0]} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <mesh>
        <boxGeometry args={[rally ? 0.18 : 0.14, rally ? 0.3 : 0.2, body.width * 0.91]} />
        <meshStandardMaterial color={color} metalness={rally ? 0.7 : 0.2} roughness={0.38} emissive={selected ? '#aeea44' : '#000'} emissiveIntensity={0.12} />
      </mesh>
      {!rear && id === 'bumper_sport' && [-0.68, 0.68].map((z) => (
        <mesh key={z} position={[0.08, -0.13, z]} rotation={[0, 0, z > 0 ? -0.22 : 0.22]}>
          <boxGeometry args={[0.38, 0.06, 0.32]} />
          <meshStandardMaterial color="#131614" roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function SlotMarker({ position, label, onClick }: { position: [number, number, number]; label: string; onClick: () => void }) {
  const ref = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.09
      ref.current.scale.setScalar(s)
    }
  })
  return (
    <group position={position} name="EditorSlotGuide" userData={{ editorOnly: true }}>
      <mesh ref={ref} onClick={(event) => { event.stopPropagation(); onClick() }}>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshBasicMaterial color="#b4f34b" transparent opacity={0.9} depthTest={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.24, 20, 20]} />
        <meshBasicMaterial color="#b4f34b" transparent opacity={0.12} depthTest={false} />
      </mesh>
      <Html center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <span className="slot-tag">{label}</span>
      </Html>
    </group>
  )
}

function slotPosition(slot: SlotId, body: BodyDefinition): [number, number, number] {
  const frontX = body.length * 0.31
  const rearX = -body.length * 0.32
  const sideZ = body.width / 2 + 0.2
  const wheelY = body.wheelRadius
  const map: Record<SlotId, [number, number, number]> = {
    wheel_fl: [frontX, wheelY, sideZ],
    wheel_fr: [frontX, wheelY, -sideZ],
    wheel_rl: [rearX, wheelY, sideZ],
    wheel_rr: [rearX, wheelY, -sideZ],
    headlight_l: [body.length / 2 + 0.14, wheelY + body.lowerHeight * 0.5, body.width * 0.32],
    headlight_r: [body.length / 2 + 0.14, wheelY + body.lowerHeight * 0.5, -body.width * 0.32],
    grille: [body.length / 2 + 0.22, wheelY + 0.1, 0],
    spoiler: [-body.length / 2 + 0.3, wheelY + body.lowerHeight + 0.42, 0],
    bumper_front: [body.length / 2 + 0.24, wheelY * 0.62, 0],
    bumper_rear: [-body.length / 2 - 0.24, wheelY * 0.62, 0],
    windows: [body.cabinX, wheelY + body.lowerHeight + body.cabinHeight * 0.56, body.width / 2 + 0.13],
  }
  return map[slot]
}

function CarBody({ vehicle, body, selectedSlot, onSlotClick }: { vehicle: VehicleState; body: BodyDefinition; selectedSlot?: SlotId; onSlotClick: (slot: SlotId) => void }) {
  const mat = materialProps(vehicle)
  const baseY = body.wheelRadius + body.lowerHeight / 2
  const cabinY = body.wheelRadius + body.lowerHeight + body.cabinHeight / 2 - 0.08
  const glassId = vehicle.parts.windows
  const glassOpacity = glassId === 'window_clear' ? 0.45 : glassId === 'window_dark' ? 0.88 : glassId === 'window_bronze' ? 0.72 : 0.65
  const glassColor = glassId === 'window_bronze' ? '#695945' : vehicle.glassColor

  return (
    <>
      <RoundedBox args={[body.length, body.lowerHeight, body.width]} radius={body.id === 'sports' ? 0.3 : 0.22} smoothness={5} position={[0, baseY, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={vehicle.bodyColor} {...mat} />
      </RoundedBox>

      {body.id === 'truck' ? (
        <>
          <RoundedBox args={[body.cabinLength, body.cabinHeight, body.width * 0.9]} radius={0.16} smoothness={4} position={[body.cabinX, cabinY, 0]} castShadow>
            <meshStandardMaterial color={vehicle.bodyColor} {...mat} />
          </RoundedBox>
          <RoundedBox args={[2.2, 0.58, body.width * 0.92]} radius={0.12} smoothness={3} position={[-1.55, body.wheelRadius + body.lowerHeight + 0.12, 0]} castShadow>
            <meshStandardMaterial color={vehicle.bodyColor} {...mat} />
          </RoundedBox>
        </>
      ) : (
        <RoundedBox args={[body.cabinLength, body.cabinHeight, body.width * 0.88]} radius={body.id === 'van' ? 0.18 : 0.34} smoothness={5} position={[body.cabinX, cabinY, 0]} castShadow>
          <meshStandardMaterial color={vehicle.bodyColor} {...mat} />
        </RoundedBox>
      )}

      {/* side glass panels */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox
            args={[body.cabinLength * 0.68, body.cabinHeight * 0.57, 0.035]}
            radius={0.12}
            smoothness={3}
            position={[body.cabinX, cabinY + 0.03, side * body.width * 0.445]}
            onClick={(e) => { e.stopPropagation(); onSlotClick('windows') }}
          >
            <meshPhysicalMaterial color={glassColor} transparent opacity={glassOpacity} roughness={0.08} metalness={0.1} emissive={selectedSlot === 'windows' ? '#588d27' : '#000'} emissiveIntensity={0.2} />
          </RoundedBox>
          <mesh position={[body.cabinX, cabinY + 0.03, side * (body.width * 0.465)]}>
            <boxGeometry args={[0.085, body.cabinHeight * 0.61, 0.045]} />
            <meshStandardMaterial color={vehicle.trimColor} roughness={0.32} />
          </mesh>
        </group>
      ))}

      {/* hood character lines */}
      {[-0.53, 0.53].map((z) => (
        <mesh key={z} position={[body.length * 0.33, body.wheelRadius + body.lowerHeight + 0.012, z]}>
          <boxGeometry args={[body.length * 0.24, 0.018, 0.025]} />
          <meshStandardMaterial color={vehicle.trimColor} transparent opacity={0.42} />
        </mesh>
      ))}
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
      <CarBody vehicle={vehicle} body={body} selectedSlot={selectedSlot} onSlotClick={onSlotClick} />

      {wheelSlots.map((slot) => vehicle.parts[slot] && (
        <Wheel
          key={slot}
          id={vehicle.parts[slot]}
          color={vehicle.partColors[slot] ?? '#9ca6a2'}
          radius={body.wheelRadius * (vehicle.parts[slot] === 'wheel_offroad' ? 1.08 : 1)}
          position={slotPosition(slot, body)}
          selected={selectedSlot === slot}
          onClick={() => onSlotClick(slot)}
        />
      ))}

      {(['headlight_l', 'headlight_r'] as SlotId[]).map((slot) => vehicle.parts[slot] && (
        <Headlight key={slot} id={vehicle.parts[slot]} position={slotPosition(slot, body)} selected={selectedSlot === slot} onClick={() => onSlotClick(slot)} />
      ))}

      {vehicle.parts.grille && <Grille body={body} id={vehicle.parts.grille} color={vehicle.partColors.grille ?? vehicle.trimColor} selected={selectedSlot === 'grille'} onClick={() => onSlotClick('grille')} />}
      {vehicle.parts.spoiler && <Spoiler body={body} id={vehicle.parts.spoiler} color={vehicle.partColors.spoiler ?? vehicle.trimColor} selected={selectedSlot === 'spoiler'} onClick={() => onSlotClick('spoiler')} />}
      {vehicle.parts.bumper_front && <Bumper body={body} id={vehicle.parts.bumper_front} color={vehicle.partColors.bumper_front ?? vehicle.trimColor} selected={selectedSlot === 'bumper_front'} onClick={() => onSlotClick('bumper_front')} />}
      {vehicle.parts.bumper_rear && <Bumper rear body={body} id={vehicle.parts.bumper_rear} color={vehicle.partColors.bumper_rear ?? vehicle.trimColor} selected={selectedSlot === 'bumper_rear'} onClick={() => onSlotClick('bumper_rear')} />}

      {showSlots && compatibleSlots.map((slot) => (
        <SlotMarker key={slot} position={slotPosition(slot, body)} label={slot.replace(/_/g, ' ')} onClick={() => onSlotClick(slot)} />
      ))}
    </group>
  )
}

function CameraRig({ resetKey }: { resetKey: number }) {
  const controls = useRef<any>(null)
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(7.2, 4.2, 7.8)
    controls.current?.target.set(0, 0.8, 0)
    controls.current?.update()
  }, [camera, resetKey])
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={5.2} maxDistance={13} minPolarAngle={0.35} maxPolarAngle={Math.PI / 2.06} target={[0, 0.8, 0]} />
}

export default function VehicleScene(props: SceneProps) {
  const [ready, setReady] = useState(false)
  const background = useMemo(() => new THREE.Color('#d9ddd7'), [])

  return (
    <div className="canvas-shell">
      <Canvas
        shadows
        dpr={[1, 1.8]}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ fov: 34, position: [7.2, 4.2, 7.8], near: 0.1, far: 100 }}
        onCreated={({ gl }) => { gl.setClearColor(background); setReady(true) }}
      >
        <fog attach="fog" args={['#d9ddd7', 10, 20]} />
        <ambientLight intensity={1.7} />
        <hemisphereLight args={['#ffffff', '#8b9188', 1.8]} />
        <directionalLight position={[5, 9, 6]} intensity={3.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
        <directionalLight position={[-4, 3, -5]} intensity={1.4} color="#c7d9df" />
        <VehicleModel {...props} />
        <ContactShadows position={[0, -0.01, 0]} scale={12} blur={2.4} opacity={0.42} far={7} resolution={512} color="#3b3f39" />
        <Grid position={[0, -0.025, 0]} args={[30, 30]} cellSize={0.5} cellThickness={0.45} cellColor="#b8bdb6" sectionSize={2.5} sectionThickness={0.8} sectionColor="#a7aca5" fadeDistance={13} fadeStrength={1.5} infiniteGrid />
        <CameraRig resetKey={props.viewResetKey} />
      </Canvas>
      {!ready && <div className="canvas-loading">Preparing studio…</div>}
    </div>
  )
}
