'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Fog, Vector3, Group, Mesh, PointLight, Quaternion, Euler } from 'three';
import { MeshTransmissionMaterial, PerspectiveCamera } from '@react-three/drei';

const COLORS = {
	background: '#000',
	light: '#ffe0b3',
	rings: [
		'#3ee0db',
		'#20a1bf',
		'#04358d',
		'#250a57',
		'#5e49b4',
		'#c36cc9',
		'#f78a90',
		'#ffae36',
		'#ffdb7f',
		'#fff9e5',
		'#d6ef10',
		'#69c32c',
	],
};

// Config.
const PERIOD_S = 120;
const RING_COUNT = 180;
const D_FOG_MIN = 20;
const D_FOG_MAX = 40;
const N_LEADING_SPHERES = 8;
const SPHERE_PASSING_PERIOD_S = 8;
const SPHERE_SPACING = 0.5;

// Constants.
const { PI } = Math;
const PI2 = PI * 2;
const PI_OVER_4 = PI * 0.25;

interface RingProps {
	position: [number, number, number];
	quaternion: [number, number, number, number];
	color: string;
}

function getPosition(distanceAlongTrack: number): [number, number, number] {
	const progress = distanceAlongTrack * PI2;
	return [
		Math.sin(progress / 2 - PI_OVER_4) * 400,
		Math.sin(progress / 3 + PI_OVER_4) * 400,
		Math.cos(progress / 5) * 400,
	];
}

function getPositionFromTime(t: number) {
	return getPosition(getDistanceAlongTrackFromTime(t));
}

function getDistanceAlongTrackFromTime(t: number) {
	return (t % PERIOD_S) / PERIOD_S;
}

function Ring({ position, quaternion, color }: RingProps) {
	const meshRef = useRef<Mesh>(null);

	return (
		<mesh ref={meshRef} position={position} quaternion={quaternion}>
			<torusGeometry args={[2, 0.3, 16, 100]} />
			<meshPhysicalMaterial
				color={color}
				metalness={0.1}
				roughness={0.2}
				clearcoat={0.5}
				clearcoatRoughness={0.1}
				reflectivity={0.2}
			/>
		</mesh>
	);
}

interface RingData extends RingProps {
	key: number;
}

function RingCollection({ count = RING_COUNT }) {
	// Reuse these to avoid allocations in the loop
	const up = new Vector3(0, 0, 1);
	const q = new Quaternion();

	const ringPositions = useMemo<[number, number, number][]>(
		() =>
			Array.from({ length: count }, (_, i) => {
				const distanceAlongTrack = i / count;
				return getPosition(distanceAlongTrack);
			}),
		[count]
	);

	const ringProps = useMemo<RingData[]>(
		() =>
			Array.from({ length: count }, (_, i) => {
				const color = COLORS.rings[i % COLORS.rings.length];

				const prevPosition = ringPositions[(i + count - 1) % count];
				const position = ringPositions[i];

				const direction = new Vector3()
					.set(position[0] - prevPosition[0], position[1] - prevPosition[1], position[2] - prevPosition[2])
					.normalize();

				// Build a quaternion that rotates up → direction
				q.setFromUnitVectors(up, direction);

				return {
					key: i,
					position,
					quaternion: [q.x, q.y, q.z, q.w],
					color: color,
				};
			}),
		[count, ringPositions]
	);

	return (
		<group>
			{ringProps.map(props => (
				<Ring {...props} />
			))}
		</group>
	);
}

// Point light that stays ahead of the camera.
function LeadingLight({ intensity }: { intensity: number }) {
	const lightRef = useRef<PointLight>(null);

	useFrame(state => {
		if (!lightRef.current) return;
		const futureTime = state.clock.elapsedTime + 0.5;
		const position = getPositionFromTime(futureTime);
		lightRef.current.position.set(...position);
	});

	return <pointLight ref={lightRef} color={COLORS.light} intensity={intensity} distance={30} decay={1} />;
}

function LeadingSpheres() {
	const groupRef = useRef<Group>(null);
	const spheresRef = useRef<Mesh[]>([]);

	useFrame(state => {
		const t = state.clock.elapsedTime;
		if (!groupRef.current) return;
		spheresRef.current.forEach((sphere, i) => {
			if (!sphere) return;
			const nSpheresPassed = Math.floor(t / SPHERE_PASSING_PERIOD_S);
			const n = (i + nSpheresPassed) % N_LEADING_SPHERES; // Consistent ID for spheres, since they’re re-rendered in a ring.

			const distFromNextSphere = (t % SPHERE_PASSING_PERIOD_S) / SPHERE_PASSING_PERIOD_S;
			const futureTime = t + SPHERE_SPACING * i - distFromNextSphere * SPHERE_SPACING;
			const [x, y, z] = getPositionFromTime(futureTime);
			const xOffset = Math.cos(Math.PI * 2 * (distFromNextSphere + n / N_LEADING_SPHERES)) * 0.25;
			const yOffset = Math.sin(Math.PI * 2 * (distFromNextSphere + n / N_LEADING_SPHERES)) * 0.25;
			sphere.position.set(x + xOffset, y + yOffset, z);
			sphere.rotation.set(0, t, 0);
		});
	});

	return (
		<group ref={groupRef}>
			{Array.from({ length: N_LEADING_SPHERES }).map((_, i) => (
				<mesh key={i} ref={el => (spheresRef.current[i] = el!)}>
					<sphereGeometry args={[0.1, 32, 32]} />
					<MeshTransmissionMaterial
						thickness={2}
						chromaticAberration={1}
						anisotropicBlur={0.1}
						iridescence={1}
						iridescenceIOR={1}
						iridescenceThicknessRange={[800, 1400]}
						clearcoatRoughness={1}
						clearcoat={0.5}
						envMapIntensity={1}
					/>
				</mesh>
			))}
		</group>
	);
}

function CameraController() {
	const { camera } = useThree();

	useFrame(state => {
		const t = state.clock.elapsedTime;
		const nextPosition = getPositionFromTime(t + 0.1);
		const position = getPositionFromTime(t);
		camera.position.set(...position);
		camera.lookAt(...nextPosition);
	});

	return null;
}

export default function Scene() {
	const { clock, scene } = useThree();

	useEffect(() => {
		clock.elapsedTime = 0;
	}, []);

	useEffect(() => {
		scene.background = new Color(COLORS.background);
		scene.fog = new Fog(COLORS.background, D_FOG_MIN, D_FOG_MAX);
		return () => {
			scene.fog = null;
		};
	}, [scene]);

	return (
		<>
			<PerspectiveCamera makeDefault position={[0, 0, 10]} fov={75} near={0.1} far={1000} />
			<CameraController />
			<LeadingLight intensity={0.03} />
			<ambientLight intensity={0.6} />
			<LeadingSpheres />
			<RingCollection count={RING_COUNT} />
		</>
	);
}
