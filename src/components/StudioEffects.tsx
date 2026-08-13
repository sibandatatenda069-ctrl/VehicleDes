import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'

/** Deferred cinematic passes. Kept in its own chunk so the editable car appears first. */
export default function StudioEffects() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes quality="high" aoRadius={0.38} distanceFalloff={0.9} intensity={1.3} color="#20251f" />
      <Bloom intensity={0.3} luminanceThreshold={1.08} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette offset={0.38} darkness={0.16} />
      <SMAA />
    </EffectComposer>
  )
}
