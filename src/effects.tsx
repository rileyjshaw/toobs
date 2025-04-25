'use client';

import { EffectComposer as PostProcessingEffectComposer, Bloom, SMAA } from '@react-three/postprocessing';

// Add anti-aliasing and bloom.
export function EffectComposer() {
	return (
		<PostProcessingEffectComposer multisampling={0}>
			<SMAA />
			<Bloom intensity={2} luminanceThreshold={0.2} luminanceSmoothing={1} />
		</PostProcessingEffectComposer>
	);
}
