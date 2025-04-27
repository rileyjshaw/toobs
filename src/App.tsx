'use client';

import { Canvas } from '@react-three/fiber';
import { Primary, Rings, Toobs } from './scenes';
import { EffectComposer } from './effects';
import { Suspense, useState, useEffect } from 'react';

const scenes = [Toobs, Rings, Primary];

export default function Home() {
	const [sceneIdx, setSceneIdx] = useState<number>(0);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'ArrowLeft') {
				setSceneIdx(prev => (prev + scenes.length - 1) % scenes.length);
			} else if (e.key === 'ArrowRight') {
				setSceneIdx(prev => (prev + 1) % scenes.length);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);

	const Scene = scenes[sceneIdx];

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
