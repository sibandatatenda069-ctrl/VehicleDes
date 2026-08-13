import type { ComponentType } from 'react'
import {
  CircleDot,
  Grid2X2,
  LampDesk,
  RectangleHorizontal,
  Sparkles,
  SquareDashed,
} from 'lucide-react'

export type BodyId = 'sports' | 'muscle' | 'sedan' | 'suv' | 'truck' | 'van'
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

export type GenerationStyle = 'classic' | 'revival' | 'modern' | 'race'

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
  generationId?: string
  generationName?: string
  generationYears?: string
  generationStyle?: GenerationStyle
}

export type BodyGeneration = {
  id: string
  name: string
  years: string
  style: GenerationStyle
  description: string
  dimensions: Partial<Pick<BodyDefinition, 'length' | 'width' | 'lowerHeight' | 'cabinHeight' | 'wheelRadius' | 'cabinLength' | 'cabinX'>>
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
  generationId: string
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
  { id: 'muscle', name: 'Vandal R/T', eyebrow: 'Muscle', length: 5.3, width: 2.24, lowerHeight: 0.84, cabinHeight: 0.8, wheelRadius: 0.59, cabinLength: 2.48, cabinX: -0.34 },
  { id: 'sedan', name: 'Linea S', eyebrow: 'Sedan', length: 5.05, width: 2.12, lowerHeight: 0.78, cabinHeight: 0.92, wheelRadius: 0.53, cabinLength: 2.9, cabinX: -0.18 },
  { id: 'suv', name: 'Atlas X', eyebrow: 'SUV', length: 5.15, width: 2.25, lowerHeight: 0.96, cabinHeight: 1.18, wheelRadius: 0.59, cabinLength: 3.35, cabinX: -0.28 },
  { id: 'truck', name: 'Forge 150', eyebrow: 'Truck', length: 5.55, width: 2.23, lowerHeight: 0.94, cabinHeight: 1.15, wheelRadius: 0.62, cabinLength: 2.0, cabinX: 0.65 },
  { id: 'van', name: 'Transit V', eyebrow: 'Van', length: 5.25, width: 2.2, lowerHeight: 1.02, cabinHeight: 1.4, wheelRadius: 0.54, cabinLength: 4.35, cabinX: -0.1 },
]

export const bodyGenerations: Record<BodyId, BodyGeneration[]> = {
  sports: [
    { id: 'apex_g1', name: 'Wedge', years: '1989–1998', style: 'classic', description: 'Compact proportions, pop-up-era nose and a low glasshouse.', dimensions: { length: 4.72, width: 1.94, lowerHeight: 0.64, cabinHeight: 0.62, wheelRadius: 0.49, cabinLength: 2.25, cabinX: -0.08 } },
    { id: 'apex_g2', name: 'Road GT', years: '1999–2012', style: 'revival', description: 'Rounded grand-tourer surfacing with a longer, calmer roofline.', dimensions: { length: 4.96, width: 2.04, lowerHeight: 0.68, cabinHeight: 0.72, wheelRadius: 0.53, cabinLength: 2.5, cabinX: -0.15 } },
    { id: 'apex_g3', name: 'Aero', years: '2013–2026', style: 'modern', description: 'Wide-track modern aero with sharp lighting and a cab-rearward stance.', dimensions: {} },
    { id: 'apex_g4', name: 'GT Competition', years: '2024–2026', style: 'race', description: 'Full competition body with boxed arches, pressure vents, deep aero and a stripped GT cabin.', dimensions: { length: 5.18, width: 2.3, lowerHeight: 0.72, cabinHeight: 0.7, wheelRadius: 0.6, cabinLength: 2.42, cabinX: -0.16 } },
  ],
  muscle: [
    { id: 'vandal_g1', name: 'Golden Era', years: '1967–1973', style: 'classic', description: 'Long hood, short deck, upright glass and chrome-era presence.', dimensions: { length: 5.18, width: 2.08, lowerHeight: 0.8, cabinHeight: 0.7, wheelRadius: 0.54, cabinLength: 2.28, cabinX: -0.38 } },
    { id: 'vandal_g2', name: 'Revival', years: '2008–2014', style: 'revival', description: 'Retro-modern shoulders, heavy quarters and a chopped greenhouse.', dimensions: { length: 5.25, width: 2.18, lowerHeight: 0.84, cabinHeight: 0.76, wheelRadius: 0.57, cabinLength: 2.4, cabinX: -0.36 } },
    { id: 'vandal_g3', name: 'Supercharged', years: '2015–2026', style: 'modern', description: 'Wide-body muscle with modern aero and an aggressive power dome.', dimensions: {} },
  ],
  sedan: [
    { id: 'linea_g1', name: 'Executive', years: '1992–2001', style: 'classic', description: 'Formal three-box proportions with slim pillars and restrained surfacing.', dimensions: { length: 4.82, width: 1.91, lowerHeight: 0.74, cabinHeight: 0.84, wheelRadius: 0.48, cabinLength: 2.62, cabinX: -0.12 } },
    { id: 'linea_g2', name: 'Dynamic', years: '2002–2015', style: 'revival', description: 'Longer wheelbase, rising beltline and rounded premium forms.', dimensions: { length: 4.96, width: 2.02, lowerHeight: 0.77, cabinHeight: 0.88, wheelRadius: 0.51, cabinLength: 2.8, cabinX: -0.16 } },
    { id: 'linea_g3', name: 'Digital', years: '2016–2026', style: 'modern', description: 'Fastback-inspired glass, wide track and crisp technical detailing.', dimensions: {} },
  ],
  suv: [
    { id: 'atlas_g1', name: 'Utility', years: '1994–2005', style: 'classic', description: 'Upright off-road stance with compact overhangs and squared glass.', dimensions: { length: 4.7, width: 2.05, lowerHeight: 0.92, cabinHeight: 1.1, wheelRadius: 0.56, cabinLength: 3.05, cabinX: -0.16 } },
    { id: 'atlas_g2', name: 'Urban', years: '2006–2017', style: 'revival', description: 'Softer crossover surfacing with more cabin space and road presence.', dimensions: { length: 4.92, width: 2.16, lowerHeight: 0.94, cabinHeight: 1.14, wheelRadius: 0.58, cabinLength: 3.2, cabinX: -0.22 } },
    { id: 'atlas_g3', name: 'Performance', years: '2018–2026', style: 'modern', description: 'Wide performance SUV with tapered glass and strong shoulder lines.', dimensions: {} },
  ],
  truck: [
    { id: 'forge_g1', name: 'Squarebody', years: '1973–1987', style: 'classic', description: 'Straight beltline, single cab and a simple long utility bed.', dimensions: { length: 5.35, width: 2.08, lowerHeight: 0.9, cabinHeight: 1.05, wheelRadius: 0.57, cabinLength: 1.82, cabinX: 0.7 } },
    { id: 'forge_g2', name: 'Workhorse', years: '1988–2014', style: 'revival', description: 'Broader cab, deeper bed and rounded heavy-duty fenders.', dimensions: { length: 5.48, width: 2.17, lowerHeight: 0.92, cabinHeight: 1.1, wheelRadius: 0.6, cabinLength: 1.92, cabinX: 0.67 } },
    { id: 'forge_g3', name: 'Heavy Duty', years: '2015–2026', style: 'modern', description: 'Tall grille, muscular body sides and a wide modern track.', dimensions: {} },
  ],
  van: [
    { id: 'transit_g1', name: 'Panel', years: '1980–1995', style: 'classic', description: 'Short nose, flat roof and honest commercial proportions.', dimensions: { length: 4.82, width: 2.02, lowerHeight: 0.94, cabinHeight: 1.25, wheelRadius: 0.49, cabinLength: 3.95, cabinX: -0.02 } },
    { id: 'transit_g2', name: 'Tourer', years: '1996–2013', style: 'revival', description: 'Rounded cab-forward body with larger glass and passenger comfort.', dimensions: { length: 5.05, width: 2.12, lowerHeight: 0.98, cabinHeight: 1.33, wheelRadius: 0.52, cabinLength: 4.15, cabinX: -0.06 } },
    { id: 'transit_g3', name: 'E-Transit', years: '2014–2026', style: 'modern', description: 'Tall modern body with flush details and a clean technical face.', dimensions: {} },
  ],
}

export function defaultGeneration(bodyId: BodyId) {
  const generations = bodyGenerations[bodyId]
  return generations[generations.length - 1]
}

export const categories: CategoryDefinition[] = [
  { id: 'wheels', label: 'Wheels', icon: CircleDot, count: 21 },
  { id: 'lights', label: 'Lights', icon: LampDesk, count: 17 },
  { id: 'grilles', label: 'Grilles', icon: Grid2X2, count: 17 },
  { id: 'spoilers', label: 'Spoilers', icon: Sparkles, count: 17 },
  { id: 'bumpers', label: 'Bumpers', icon: RectangleHorizontal, count: 16 },
  { id: 'windows', label: 'Windows', icon: SquareDashed, count: 14 },
]

export const parts: PartDefinition[] = [
  { id: 'wheel_turbine', name: 'Turbine S', category: 'wheels', meta: '20 in', accent: '#c8d0d0' },
  { id: 'wheel_forged', name: 'Forged V', category: 'wheels', meta: '21 in', accent: '#b3ff3f' },
  { id: 'wheel_classic', name: 'Heritage 5', category: 'wheels', meta: '19 in', accent: '#d6c29d' },
  { id: 'wheel_deepdish', name: 'Magnum Deep', category: 'wheels', meta: '20 in · Wide', accent: '#d8ddd9' },
  { id: 'wheel_offroad', name: 'Terrain X', category: 'wheels', meta: '22 in', accent: '#8f958d' },
  { id: 'wheel_disc', name: 'Aero Disc', category: 'wheels', meta: '20 in', accent: '#dfe8e6' },
  { id: 'wheel_mesh', name: 'Mesh RS', category: 'wheels', meta: '21 in', accent: '#9f886f' },
  { id: 'wheel_concave', name: 'Concave R10', category: 'wheels', meta: '21 in · Forged', accent: '#aeb8b4' },
  { id: 'wheel_steelie', name: 'Utility Steel', category: 'wheels', meta: '17 in · Heavy duty', accent: '#59605c' },
  { id: 'wheel_beadlock', name: 'Beadlock Pro', category: 'wheels', meta: '20 in · Off-road', accent: '#d2aa5d' },
  { id: 'wheel_centerlock', name: 'GT Centerlock', category: 'wheels', meta: '19 in · Magnesium', accent: '#9d8865' },
  { id: 'wheel_rally', name: 'Rally Gravel', category: 'wheels', meta: '18 in · Reinforced', accent: '#eceee9' },
  { id: 'wheel_retro_turbo', name: 'Turbo Fan 88', category: 'wheels', meta: '18 in · Heritage', accent: '#d8ddd9' },
  { id: 'wheel_monoblock', name: 'Mono 6', category: 'wheels', meta: '20 in · Monoblock', accent: '#adb5b1' },
  { id: 'wheel_split5', name: 'Split Five', category: 'wheels', meta: '21 in · Two-piece', accent: '#c9cfcc' },
  { id: 'wheel_carbon', name: 'Carbon Aero', category: 'wheels', meta: '21 in · Carbon', accent: '#343a37' },
  { id: 'wheel_drag', name: 'Drag Star', category: 'wheels', meta: '17 in · Lightweight', accent: '#d1b36f' },
  { id: 'wheel_lowrider', name: 'Wire 100', category: 'wheels', meta: '18 in · Chrome wire', accent: '#ecf1ef' },
  { id: 'wheel_dakar', name: 'Dakar HD', category: 'wheels', meta: '19 in · Desert', accent: '#8f7c58' },
  { id: 'wheel_aeroring', name: 'Aero Ring', category: 'wheels', meta: '20 in · EV', accent: '#a9c1c1' },
  { id: 'wheel_luxury', name: 'Crown 15', category: 'wheels', meta: '22 in · Luxury', accent: '#dce2df' },
  { id: 'light_matrix', name: 'Matrix Beam', category: 'lights', meta: 'Adaptive LED', accent: '#dffcff' },
  { id: 'light_round', name: 'Halo Round', category: 'lights', meta: 'LED ring', accent: '#fff5b0' },
  { id: 'light_slash', name: 'Slash DRL', category: 'lights', meta: 'Laser LED', accent: '#b8f2ff' },
  { id: 'light_classic', name: 'Classic Twin', category: 'lights', meta: 'Projector', accent: '#fff1ce' },
  { id: 'light_quad', name: 'Quad Fire', category: 'lights', meta: 'Dual projector', accent: '#fff3c4' },
  { id: 'light_projector', name: 'Bi-Xenon Duo', category: 'lights', meta: 'Projector + DRL', accent: '#d8f6ff' },
  { id: 'light_vertical', name: 'Vertical Stack', category: 'lights', meta: 'Four-element LED', accent: '#e4fbff' },
  { id: 'light_rally', name: 'Rally Pod', category: 'lights', meta: 'High-output round', accent: '#fff0bd' },
  { id: 'light_raceblade', name: 'GT Lightblade', category: 'lights', meta: 'Six-element race LED', accent: '#d9fbff' },
  { id: 'light_pixel', name: 'Pixel Matrix 12', category: 'lights', meta: 'Twelve-element LED', accent: '#dcfbff' },
  { id: 'light_boxtype', name: 'Box Beam', category: 'lights', meta: 'Sealed rectangular', accent: '#fff2c9' },
  { id: 'light_popups', name: 'Pop-up Heritage', category: 'lights', meta: 'Raised projector', accent: '#fff0c2' },
  { id: 'light_diamond', name: 'Diamond Laser', category: 'lights', meta: 'Crystal laser LED', accent: '#d3f8ff' },
  { id: 'light_endurance', name: 'Endurance Bar', category: 'lights', meta: 'Le Mans array', accent: '#e8fdff' },
  { id: 'light_neon', name: 'Neon Outline', category: 'lights', meta: 'Continuous OLED', accent: '#b9f4ff' },
  { id: 'light_split', name: 'Split DRL', category: 'lights', meta: 'Two-tier LED', accent: '#d6faff' },
  { id: 'light_classic_round', name: '7-inch Classic', category: 'lights', meta: 'Halogen reflector', accent: '#ffe5aa' },
  { id: 'grille_hex', name: 'Hex Flow', category: 'grilles', meta: 'Open mesh', accent: '#5d6563' },
  { id: 'grille_bar', name: 'Linear 7', category: 'grilles', meta: 'Satin alloy', accent: '#c1cac7' },
  { id: 'grille_black', name: 'Blackout', category: 'grilles', meta: 'Closed panel', accent: '#252927' },
  { id: 'grille_chrome', name: 'Signature', category: 'grilles', meta: 'Chrome', accent: '#e5eceb' },
  { id: 'grille_billet', name: 'Billet 12', category: 'grilles', meta: 'Polished alloy', accent: '#cbd1ce' },
  { id: 'grille_honeycomb', name: 'Honeycomb GT', category: 'grilles', meta: 'Open performance mesh', accent: '#343a37' },
  { id: 'grille_vertical', name: 'Monument 9', category: 'grilles', meta: 'Vertical chrome vanes', accent: '#d9dfdc' },
  { id: 'grille_ev', name: 'EV Shield', category: 'grilles', meta: 'Closed aero panel', accent: '#60706f' },
  { id: 'grille_race', name: 'GT Ram Air', category: 'grilles', meta: 'Maximum cooling mesh', accent: '#171b19' },
  { id: 'grille_mesh_fine', name: 'Micro Mesh', category: 'grilles', meta: 'Fine stainless weave', accent: '#67706c' },
  { id: 'grille_twin', name: 'Twin Port', category: 'grilles', meta: 'Dual intake', accent: '#2c322f' },
  { id: 'grille_crosshair', name: 'Crosshair', category: 'grilles', meta: 'Four-quadrant', accent: '#b5bdb9' },
  { id: 'grille_slat', name: 'Wide Slat', category: 'grilles', meta: 'Horizontal alloy', accent: '#c6ceca' },
  { id: 'grille_turbine', name: 'Turbine Intake', category: 'grilles', meta: 'Radial vanes', accent: '#5a635f' },
  { id: 'grille_heritage_mesh', name: 'Heritage Mesh', category: 'grilles', meta: 'Chrome diamond', accent: '#d8dfdc' },
  { id: 'grille_louvered', name: 'Louvered Face', category: 'grilles', meta: 'Aero shutters', accent: '#3b4440' },
  { id: 'grille_splitter', name: 'Split Intake', category: 'grilles', meta: 'Triple cooling port', accent: '#202522' },
  { id: 'spoiler_wing', name: 'Circuit Wing', category: 'spoilers', meta: 'High downforce', accent: '#202321' },
  { id: 'spoiler_lip', name: 'Ducktail', category: 'spoilers', meta: 'Low profile', accent: '#b3ff3f' },
  { id: 'spoiler_split', name: 'Aero Split', category: 'spoilers', meta: 'Carbon', accent: '#4f5552' },
  { id: 'spoiler_heritage', name: 'Heritage RS', category: 'spoilers', meta: 'Touring', accent: '#d4d8d6' },
  { id: 'spoiler_muscle', name: 'Street Ducktail', category: 'spoilers', meta: 'Muscle profile', accent: '#313633' },
  { id: 'spoiler_active', name: 'Active Aero', category: 'spoilers', meta: 'Deployable blade', accent: '#242927' },
  { id: 'spoiler_pedestal', name: 'Track Pedestal', category: 'spoilers', meta: 'GT-height wing', accent: '#4c5350' },
  { id: 'spoiler_roof', name: 'Roof Extension', category: 'spoilers', meta: 'SUV / hatch profile', accent: '#9ba29e' },
  { id: 'spoiler_gt3', name: 'GT3 Swan Wing', category: 'spoilers', meta: 'Chassis-mounted carbon', accent: '#171b19' },
  { id: 'spoiler_timeattack', name: 'Time Attack XL', category: 'spoilers', meta: 'Maximum downforce', accent: '#141816' },
  { id: 'spoiler_touring', name: 'Touring Car', category: 'spoilers', meta: 'Medium pedestal', accent: '#313733' },
  { id: 'spoiler_double', name: 'Dual Element', category: 'spoilers', meta: 'Two-stage wing', accent: '#202522' },
  { id: 'spoiler_shark', name: 'Shark Fin Blade', category: 'spoilers', meta: 'Central aero blade', accent: '#515955' },
  { id: 'spoiler_rallyroof', name: 'Rally Roof', category: 'spoilers', meta: 'Roof-edge wing', accent: '#3a413d' },
  { id: 'spoiler_drag', name: 'Drag Wicker', category: 'spoilers', meta: 'Straight-line lip', accent: '#272d29' },
  { id: 'spoiler_endurance', name: 'Endurance Swan', category: 'spoilers', meta: 'Long-stint aero', accent: '#191d1b' },
  { id: 'spoiler_cleanlip', name: 'Clean Deck Lip', category: 'spoilers', meta: 'OEM plus', accent: '#9da5a1' },
  { id: 'bumper_sport', name: 'Sport Aero', category: 'bumpers', meta: 'Street', accent: '#2f3431' },
  { id: 'bumper_clean', name: 'Clean Line', category: 'bumpers', meta: 'Minimal', accent: '#aeb4b1' },
  { id: 'bumper_rally', name: 'Rally Guard', category: 'bumpers', meta: 'Reinforced', accent: '#4b514e' },
  { id: 'bumper_chrome', name: 'Chrome Blade', category: 'bumpers', meta: 'Heritage steel', accent: '#dbe1de' },
  { id: 'bumper_gt', name: 'GT Diffuser', category: 'bumpers', meta: 'Aero channels', accent: '#202522' },
  { id: 'bumper_classic', name: 'Classic Overrider', category: 'bumpers', meta: 'Chrome + rubber', accent: '#cdd4d1' },
  { id: 'bumper_offroad', name: 'Trail Armor', category: 'bumpers', meta: 'Steel recovery points', accent: '#59615d' },
  { id: 'bumper_race', name: 'GT Aero Package', category: 'bumpers', meta: 'Splitter + dive planes', accent: '#111512' },
  { id: 'bumper_timeattack', name: 'Time Attack', category: 'bumpers', meta: 'Extreme splitter', accent: '#111512' },
  { id: 'bumper_touring', name: 'Touring Aero', category: 'bumpers', meta: 'Brake ducts', accent: '#252a27' },
  { id: 'bumper_drift', name: 'Drift Cutout', category: 'bumpers', meta: 'High-clearance', accent: '#303632' },
  { id: 'bumper_street', name: 'Street Plus', category: 'bumpers', meta: 'Subtle lip', accent: '#505854' },
  { id: 'bumper_retro', name: 'Retro Rubber', category: 'bumpers', meta: 'Period impact strip', accent: '#aeb5b1' },
  { id: 'bumper_utility', name: 'Utility Step', category: 'bumpers', meta: 'Integrated step', accent: '#626a66' },
  { id: 'bumper_safari', name: 'Safari Bar', category: 'bumpers', meta: 'Lamp guard', accent: '#4c5550' },
  { id: 'bumper_endurance', name: 'Endurance Aero', category: 'bumpers', meta: 'Quick-release package', accent: '#171b19' },
  { id: 'window_clear', name: 'Crystal', category: 'windows', meta: 'Clear glass', accent: '#9dd9df' },
  { id: 'window_smoke', name: 'Smoke 30', category: 'windows', meta: '30% tint', accent: '#4f6a6b' },
  { id: 'window_dark', name: 'Night', category: 'windows', meta: '70% tint', accent: '#202b2c' },
  { id: 'window_bronze', name: 'Bronze', category: 'windows', meta: 'Warm tint', accent: '#796b58' },
  { id: 'window_privacy', name: 'Privacy Plus', category: 'windows', meta: 'Factory rear privacy', accent: '#172526' },
  { id: 'window_blue', name: 'Solar Blue', category: 'windows', meta: 'Heat-reflective glass', accent: '#4d7d8d' },
  { id: 'window_green', name: 'Classic Green', category: 'windows', meta: 'Period safety glass', accent: '#547469' },
  { id: 'window_amber', name: 'Amber Solar', category: 'windows', meta: 'Warm UV filter', accent: '#8b6d42' },
  { id: 'window_mirror', name: 'Mirror Chrome', category: 'windows', meta: 'Reflective show tint', accent: '#9eaaaa' },
  { id: 'window_race', name: 'Race Polycarbonate', category: 'windows', meta: 'Lightweight clear', accent: '#9bc4ca' },
  { id: 'window_lightblue', name: 'Aqua Clear', category: 'windows', meta: 'Light blue OEM', accent: '#71a6b1' },
  { id: 'window_factory', name: 'Factory Shade', category: 'windows', meta: 'Subtle OEM tint', accent: '#52696a' },
  { id: 'window_limo', name: 'Limo Black', category: 'windows', meta: 'Maximum privacy', accent: '#0d1516' },
  { id: 'window_gradient', name: 'Gradient Blue', category: 'windows', meta: 'Blue-top windscreen', accent: '#365b70' },
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
  generationId: 'apex_g4',
  bodyColor: '#e4322d',
  trimColor: '#151816',
  glassColor: '#294548',
  finish: 'gloss',
  projectName: 'Untitled concept',
  parts: {
    wheel_fl: 'wheel_centerlock',
    wheel_fr: 'wheel_centerlock',
    wheel_rl: 'wheel_centerlock',
    wheel_rr: 'wheel_centerlock',
    headlight_l: 'light_raceblade',
    headlight_r: 'light_raceblade',
    grille: 'grille_race',
    spoiler: 'spoiler_gt3',
    bumper_front: 'bumper_race',
    bumper_rear: 'bumper_gt',
    windows: 'window_smoke',
  },
  partColors: {},
}

export const paintSwatches = ['#b4f34b', '#ff5c45', '#f1f0e9', '#202321', '#4268e8', '#d39a42', '#7d5bc7', '#9caaa7', '#294f3a', '#6d7473', '#542c32', '#183147']

export function bodyById(id: BodyId, generationId?: string) {
  const base = bodies.find((body) => body.id === id) ?? bodies[0]
  const generations = bodyGenerations[base.id]
  const generation = generations.find((item) => item.id === generationId) ?? defaultGeneration(base.id)
  return {
    ...base,
    ...generation.dimensions,
    generationId: generation.id,
    generationName: generation.name,
    generationYears: generation.years,
    generationStyle: generation.style,
  }
}

export function partById(id?: string) {
  return parts.find((part) => part.id === id)
}
