'use client';

import { Canvas } from '@react-three/fiber';
import Scene from './scene';
import { EffectComposer } from './effects';
import { Suspense } from 'react';

export default function Home() {
	return (
		<div style={{ height: '100vh', width: '100vw' }}>
			<Canvas dpr={[1, 1.5]}>
				<Suspense fallback={null}>
					<Scene />
					<EffectComposer />
				</Suspense>
			</Canvas>
		</div>
	);
}
