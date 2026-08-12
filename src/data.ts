import type { ComponentType } from 'react'
import {
  CircleDot,
  Grid2X2,
  LampDesk,
  RectangleHorizontal,
  Sparkles,
  SquareDashed,
} from 'lucide-react'

export type BodyId = 'sports' | 'sedan' | 'suv' | 'truck' | 'van'
export type CategoryId = 'wheels' | 'lights' | 'grilles' | 'spoilers' | 'bumpers' | 'windows'
export type SlotId =
  | 'wheel_fl'
  | 'wheel_fr'
  | 'wheel_rl'
  | 'wheel_rr'
  | 'headlight_l'
  | 'headlight_r'
  | 'grille'
  | 'spoiler'
  | 'bumper_front'
  | 'bumper_rear'
  | 'windows'

export type BodyDefinition = {
  id: BodyId
  name: string
  eyebrow: string
  length: number
  width: number
  lowerHeight: number
  cabinHeight: number
  wheelRadius: number
  cabinLength: number
  cabinX: number
}

export type PartDefinition = {
  id: string
  name: string
  category: CategoryId
  meta: string
  accent: string
}

export type CategoryDefinition = {
  id: CategoryId
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
  count: number
}

export type VehicleState = {
  bodyId: BodyId
  bodyColor: string
  trimColor: string
  glassColor: string
  finish: 'gloss' | 'satin' | 'matte'
  parts: Partial<Record<SlotId, string>>
  partColors: Partial<Record<SlotId, string>>
  projectName: string
}

export const bodies: BodyDefinition[] = [
  { id: 'sports', name: 'Apex GT', eyebrow: 'Sports', length: 5.2, width: 2.18, lowerHeight: 0.7, cabinHeight: 0.78, wheelRadius: 0.57, cabinLength: 2.65, cabinX: -0.2 },
  { id: 'sedan', name: 'Linea S', eyebrow: 'Sedan', length: 5.05, width: 2.12, lowerHeight: 0.78, cabinHeight: 0.92, wheelRadius: 0.53, cabinLength: 2.9, cabinX: -0.18 },
  { id: 'suv', name: 'Atlas X', eyebrow: 'SUV', length: 5.15, width: 2.25, lowerHeight: 0.96, cabinHeight: 1.18, wheelRadius: 0.59, cabinLength: 3.35, cabinX: -0.28 },
  { id: 'truck', name: 'Forge 150', eyebrow: 'Truck', length: 5.55, width: 2.23, lowerHeight: 0.94, cabinHeight: 1.15, wheelRadius: 0.62, cabinLength: 2.0, cabinX: 0.65 },
  { id: 'van', name: 'Transit V', eyebrow: 'Van', length: 5.25, width: 2.2, lowerHeight: 1.02, cabinHeight: 1.4, wheelRadius: 0.54, cabinLength: 4.35, cabinX: -0.1 },
]

export const categories: CategoryDefinition[] = [
  { id: 'wheels', label: 'Wheels', icon: CircleDot, count: 8 },
  { id: 'lights', label: 'Lights', icon: LampDesk, count: 6 },
  { id: 'grilles', label: 'Grilles', icon: Grid2X2, count: 5 },
  { id: 'spoilers', label: 'Spoilers', icon: Sparkles, count: 4 },
  { id: 'bumpers', label: 'Bumpers', icon: RectangleHorizontal, count: 5 },
  { id: 'windows', label: 'Windows', icon: SquareDashed, count: 4 },
]

export const parts: PartDefinition[] = [
  { id: 'wheel_turbine', name: 'Turbine S', category: 'wheels', meta: '20 in', accent: '#c8d0d0' },
  { id: 'wheel_forged', name: 'Forged V', category: 'wheels', meta: '21 in', accent: '#b3ff3f' },
  { id: 'wheel_classic', name: 'Heritage 5', category: 'wheels', meta: '19 in', accent: '#d6c29d' },
  { id: 'wheel_offroad', name: 'Terrain X', category: 'wheels', meta: '22 in', accent: '#8f958d' },
  { id: 'wheel_disc', name: 'Aero Disc', category: 'wheels', meta: '20 in', accent: '#dfe8e6' },
  { id: 'wheel_mesh', name: 'Mesh RS', category: 'wheels', meta: '21 in', accent: '#9f886f' },
  { id: 'light_matrix', name: 'Matrix Beam', category: 'lights', meta: 'Adaptive LED', accent: '#dffcff' },
  { id: 'light_round', name: 'Halo Round', category: 'lights', meta: 'LED ring', accent: '#fff5b0' },
  { id: 'light_slash', name: 'Slash DRL', category: 'lights', meta: 'Laser LED', accent: '#b8f2ff' },
  { id: 'light_classic', name: 'Classic Twin', category: 'lights', meta: 'Projector', accent: '#fff1ce' },
  { id: 'grille_hex', name: 'Hex Flow', category: 'grilles', meta: 'Open mesh', accent: '#5d6563' },
  { id: 'grille_bar', name: 'Linear 7', category: 'grilles', meta: 'Satin alloy', accent: '#c1cac7' },
  { id: 'grille_black', name: 'Blackout', category: 'grilles', meta: 'Closed panel', accent: '#252927' },
  { id: 'grille_chrome', name: 'Signature', category: 'grilles', meta: 'Chrome', accent: '#e5eceb' },
  { id: 'spoiler_wing', name: 'Circuit Wing', category: 'spoilers', meta: 'High downforce', accent: '#202321' },
  { id: 'spoiler_lip', name: 'Ducktail', category: 'spoilers', meta: 'Low profile', accent: '#b3ff3f' },
  { id: 'spoiler_split', name: 'Aero Split', category: 'spoilers', meta: 'Carbon', accent: '#4f5552' },
  { id: 'spoiler_heritage', name: 'Heritage RS', category: 'spoilers', meta: 'Touring', accent: '#d4d8d6' },
  { id: 'bumper_sport', name: 'Sport Aero', category: 'bumpers', meta: 'Street', accent: '#2f3431' },
  { id: 'bumper_clean', name: 'Clean Line', category: 'bumpers', meta: 'Minimal', accent: '#aeb4b1' },
  { id: 'bumper_rally', name: 'Rally Guard', category: 'bumpers', meta: 'Reinforced', accent: '#4b514e' },
  { id: 'window_clear', name: 'Crystal', category: 'windows', meta: 'Clear glass', accent: '#9dd9df' },
  { id: 'window_smoke', name: 'Smoke 30', category: 'windows', meta: '30% tint', accent: '#4f6a6b' },
  { id: 'window_dark', name: 'Night', category: 'windows', meta: '70% tint', accent: '#202b2c' },
  { id: 'window_bronze', name: 'Bronze', category: 'windows', meta: 'Warm tint', accent: '#796b58' },
]

export const categorySlots: Record<CategoryId, SlotId[]> = {
  wheels: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'],
  lights: ['headlight_l', 'headlight_r'],
  grilles: ['grille'],
  spoilers: ['spoiler'],
  bumpers: ['bumper_front', 'bumper_rear'],
  windows: ['windows'],
}

export const initialVehicle: VehicleState = {
  bodyId: 'sports',
  bodyColor: '#b4f34b',
  trimColor: '#151816',
  glassColor: '#294548',
  finish: 'gloss',
  projectName: 'Untitled concept',
  parts: {
    wheel_fl: 'wheel_forged',
    wheel_fr: 'wheel_forged',
    wheel_rl: 'wheel_forged',
    wheel_rr: 'wheel_forged',
    headlight_l: 'light_matrix',
    headlight_r: 'light_matrix',
    grille: 'grille_black',
    bumper_front: 'bumper_sport',
    bumper_rear: 'bumper_sport',
    windows: 'window_smoke',
  },
  partColors: {},
}

export const paintSwatches = ['#b4f34b', '#ff5c45', '#f1f0e9', '#202321', '#4268e8', '#d39a42', '#7d5bc7', '#9caaa7']

export function bodyById(id: BodyId) {
  return bodies.find((body) => body.id === id) ?? bodies[0]
}

export function partById(id?: string) {
  return parts.find((part) => part.id === id)
}
