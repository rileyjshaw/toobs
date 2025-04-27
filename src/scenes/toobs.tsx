'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Fog, Vector3, Mesh, PointLight } from 'three';
import { PerspectiveCamera } from '@react-three/drei';

const COLORS = {
	background: '#000',
	light: '#ffe0b3',
	lines: ['#19011a', '#5c4cbf', '#4f67ff', '#ffebd8', '#ffb366', '#ff7f00'],
};

const LINE_WIDTH = 1;
const MIN_LINE_LENGTH = 4;
const MAX_LINE_LENGTH = 50;
const MIN_XY_DISTANCE_FROM_CAMERA = 2;
const MAX_XY_DISTANCE_FROM_CAMERA = 20;
const MAX_Z_REGEN_DISTANCE_FROM_CAMERA = 60;
const LINE_COUNT = 80;
const CAMERA_PATH_AVOIDANCE_ANGLE = Math.PI / 8;
const CAMERA_SPEED = 10;
const CAMERA_FRAME_HISTORY = 20;
const D_FOG_MIN = 20;
const D_FOG_MAX = 40;

// Derived.
const Z_LOOKBEHIND = MAX_Z_REGEN_DISTANCE_FROM_CAMERA - 1 - D_FOG_MAX;
const TUBE_PLACEMENT_RANGE_Z = MAX_Z_REGEN_DISTANCE_FROM_CAMERA + Z_LOOKBEHIND;

interface LineProps {
	position: [number, number, number];
	rotation: [number, number, number];
	length: number;
	color: string;
	zOffset: number;
}

function Line({ position, rotation, length, color, zOffset }: LineProps) {
	const meshRef = useRef<Mesh>(null);

	useFrame(({ camera }) => {
		if (!meshRef.current) return;

		const lineZ = meshRef.current.position.z;
		const cameraZ = camera.position.z;

		// If the line is behind the camera, respawn it in front.
		if (lineZ > cameraZ + Z_LOOKBEHIND) {
			const z = Math.floor(cameraZ / TUBE_PLACEMENT_RANGE_Z) * TUBE_PLACEMENT_RANGE_Z - zOffset;
			const [x, y, r] = generateSafeLineMidpoint(z);

			meshRef.current.position.set(x, y, z);
			meshRef.current.rotation.set(0, 0, r);
		}
	});

	return (
		<mesh ref={meshRef} position={position} rotation={rotation}>
			<cylinderGeometry args={[LINE_WIDTH / 2, LINE_WIDTH / 2, length, 8]} />
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

function getXYFromZ(z: number) {
	return [Math.sin(z / 31 - Math.PI / 4) * 40, Math.sin(z / 30 - Math.PI / 4) * 40];
}

// Generate a midpoint position and rotation that won’t intersect the camera path.
function generateSafeLineMidpoint(z: number) {
	const [eventualCameraX, eventualCameraY] = getXYFromZ(z);

	// Draw the line's midpoint at a random angle and distance from the camera's path, then
	// pick the line's angle so it's not perpendicular to the angle from the camera's path to
	// the midpoint (or else it'll intersect the camera's path)
	const midpointDistance =
		MIN_XY_DISTANCE_FROM_CAMERA + Math.random() * (MAX_XY_DISTANCE_FROM_CAMERA - MIN_XY_DISTANCE_FROM_CAMERA);
	const midpointAngle = Math.random() * Math.PI * 2;
	const lineAngle =
		midpointAngle + CAMERA_PATH_AVOIDANCE_ANGLE + Math.random() * (Math.PI - CAMERA_PATH_AVOIDANCE_ANGLE * 2);

	const midpointX = eventualCameraX + Math.cos(midpointAngle) * midpointDistance;
	const midpointY = eventualCameraY + Math.sin(midpointAngle) * midpointDistance;

	// Adjust the rotation angle for correct cylinder rotation.
	return [midpointX, midpointY, lineAngle - Math.PI / 2];
}

interface LineData extends LineProps {
	key: number;
}

function LineCollection({ count = LINE_COUNT }) {
	// Generate initial lines.
	const lineProps = useMemo<LineData[]>(
		() =>
			Array.from({ length: count }, (_, i) => {
				const length = MIN_LINE_LENGTH + Math.random() * (MAX_LINE_LENGTH - MIN_LINE_LENGTH);
				const zOffset = TUBE_PLACEMENT_RANGE_Z * Math.random() - Z_LOOKBEHIND;
				const z = -zOffset;

				const [x, y, r] = generateSafeLineMidpoint(z);
				const colorIndex = Math.floor(Math.random() * COLORS.lines.length);
				const color = COLORS.lines[colorIndex];

				return {
					key: i,
					position: [x, y, z],
					rotation: [0, 0, r],
					length: length,
					color: color,
					zOffset,
				};
			}),
		[count]
	);

	return (
		<group>
			{lineProps.map(props => (
				<Line {...props} />
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
		const futureZ = -futureTime * CAMERA_SPEED;
		const [futureX, futureY] = getXYFromZ(futureZ);
		lightRef.current.position.set(futureX, futureY, futureZ);
	});

	return <pointLight ref={lightRef} color={COLORS.light} intensity={intensity} distance={30} decay={1} />;
}

function CameraController() {
	const { camera } = useThree();
	// Store your last 5 positions in a ring buffer; the camera will look from
	// where you were 5 frames ago to where you are now.
	const prevPositions = useRef(Array.from({ length: CAMERA_FRAME_HISTORY }, () => new Vector3(...getXYFromZ(0), 0)));
	// Initial direction is looking into the screen.
	const direction = useRef(new Vector3(0, 0, -1));
	const lookAtTarget = useRef(new Vector3());

	let frameCount = 0;
	useFrame((state, delta) => {
		if (delta > 2) {
			prevPositions.current.forEach(pos => pos.copy(camera.position));
			return;
		}

		const t = state.clock.elapsedTime;
		const prevPosition = prevPositions.current[frameCount % CAMERA_FRAME_HISTORY];

		const z = -t * CAMERA_SPEED;
		const [x, y] = getXYFromZ(z);
		camera.position.x = x;
		camera.position.y = y;
		camera.position.z = z;

		direction.current.subVectors(camera.position, prevPosition).normalize();
		lookAtTarget.current.copy(camera.position).add(direction.current);
		camera.lookAt(lookAtTarget.current);

		++frameCount;
		prevPosition.copy(camera.position);
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
			<PerspectiveCamera makeDefault position={[0, 0, 0]} fov={75} near={0.1} far={100} />
			<CameraController />
			<LeadingLight intensity={1} />
			<ambientLight intensity={0.6} />
			<LineCollection count={LINE_COUNT} />
		</>
	);
}
