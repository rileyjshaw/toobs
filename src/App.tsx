'use client';

import { Canvas } from '@react-three/fiber';
import handleTouch from './util/handleTouch';
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
		<div
			ref={element => {
				if (!element) return;

				const cleanupFn = handleTouch(element, (direction, diff) => {
					if (direction === 'x') {
						if (diff > 0) {
							// Right swipe
							setSceneIdx(prev => (prev + scenes.length - 1) % scenes.length);
						} else {
							// Left swipe
							setSceneIdx(prev => (prev + 1) % scenes.length);
						}
						return { skip: true }; // Only process one swipe at a time
					}
				});

				return cleanupFn;
			}}
			style={{ height: '100dvh', width: '100dvw' }}
		>
			<Canvas dpr={[1, 1.5]}>
				<Suspense fallback={null}>
					<Scene />
					<EffectComposer />
				</Suspense>
			</Canvas>
		</div>
	);
}
