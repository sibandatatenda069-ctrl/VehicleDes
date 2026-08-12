import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'

/** Deferred cinematic passes. Kept in its own chunk so the editable car appears first. */
export default function StudioEffects() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes quality="medium" aoRadius={0.42} distanceFalloff={0.85} intensity={1.45} color="#20251f" />
      <Bloom intensity={0.38} luminanceThreshold={1.05} luminanceSmoothing={0.22} mipmapBlur />
      <Vignette offset={0.35} darkness={0.2} />
      <SMAA />
    </EffectComposer>
  )
}
