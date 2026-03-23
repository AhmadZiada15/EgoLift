'use client';

import { useRef } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import type { Group } from 'three';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type SleeveProps = {
  side: -1 | 1;
};

function Sleeve({ side }: SleeveProps) {
  const offset = side * 2.12;

  return (
    <group position={[offset, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[side * 0.28, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.56, 32]} />
        <meshStandardMaterial color="#e6ddd2" metalness={0.96} roughness={0.12} />
      </mesh>

      <mesh rotation={[0, 0, Math.PI / 2]} position={[side * 0.6, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 32]} />
        <meshStandardMaterial color="#f5ede0" metalness={0.82} roughness={0.18} />
      </mesh>
    </group>
  );
}

type PlateProps = {
  side: -1 | 1;
  offset: number;
  radius: number;
  width: number;
  color: string;
};

function Plate({ side, offset, radius, width, color }: PlateProps) {
  return (
    <mesh rotation={[0, 0, Math.PI / 2]} position={[side * offset, 0, 0]}>
      <cylinderGeometry args={[radius, radius, width, 48]} />
      <meshStandardMaterial color={color} metalness={0.35} roughness={0.22} />
    </mesh>
  );
}

function LoadedBarbell() {
  const barbellRef = useRef<Group>(null);
  const dragStateRef = useRef({
    active: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
  });
  const dragRotationRef = useRef({ x: 0, y: 0 });
  const dragTargetRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    dragStateRef.current.active = true;
    dragStateRef.current.pointerId = event.pointerId;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;
    const target = event.target as
      | (EventTarget & { setPointerCapture?: (pointerId: number) => void })
      | null;
    target?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragStateRef.current.active) {
      return;
    }

    event.stopPropagation();
    const deltaX = event.clientX - dragStateRef.current.lastX;
    const deltaY = event.clientY - dragStateRef.current.lastY;

    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;

    dragTargetRef.current.x = clamp(dragTargetRef.current.x + deltaY * 0.0035, -0.32, 0.32);
    dragTargetRef.current.y = clamp(dragTargetRef.current.y + deltaX * 0.0045, -0.5, 0.5);
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current.active = false;
    dragStateRef.current.pointerId = -1;
    const target = event.target as
      | (EventTarget & { releasePointerCapture?: (pointerId: number) => void })
      | null;
    target?.releasePointerCapture?.(event.pointerId);
  };

  useFrame((state) => {
    if (!barbellRef.current) {
      return;
    }

    const time = state.clock.getElapsedTime();

    if (!dragStateRef.current.active) {
      dragTargetRef.current.x *= 0.94;
      dragTargetRef.current.y *= 0.94;
    }

    dragRotationRef.current.x += (dragTargetRef.current.x - dragRotationRef.current.x) * 0.12;
    dragRotationRef.current.y += (dragTargetRef.current.y - dragRotationRef.current.y) * 0.12;

    barbellRef.current.rotation.x = -0.1 + Math.sin(time * 0.24) * 0.012 + dragRotationRef.current.x;
    barbellRef.current.rotation.y = -0.16 + Math.cos(time * 0.18) * 0.028 + dragRotationRef.current.y;
    barbellRef.current.rotation.z =
      -0.04 +
      Math.sin(time * 0.32) * 0.014 +
      dragRotationRef.current.y * 0.22 +
      dragRotationRef.current.x * 0.12;
    barbellRef.current.position.y = Math.sin(time * 0.42) * 0.05;
  });

  return (
    <Float speed={1} rotationIntensity={0.08} floatIntensity={0.25}>
      <group
        ref={barbellRef}
        scale={0.92}
        position={[0, -0.02, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.065, 0.065, 4.2, 48]} />
          <meshStandardMaterial color="#f5ede0" metalness={0.98} roughness={0.1} />
        </mesh>

        <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, -0.04]}>
          <cylinderGeometry args={[0.036, 0.036, 4.26, 48]} />
          <meshStandardMaterial color="#ccb9ac" metalness={0.98} roughness={0.08} />
        </mesh>

        <Sleeve side={-1} />
        <Sleeve side={1} />

        <Plate side={-1} offset={2.74} radius={1.02} width={0.18} color="#7a4057" />
        <Plate side={-1} offset={2.94} radius={0.88} width={0.16} color="#c97b8e" />
        <Plate side={-1} offset={3.12} radius={0.72} width={0.14} color="#8d5068" />
        <Plate side={-1} offset={3.28} radius={0.56} width={0.12} color="#f0e4d6" />

        <Plate side={1} offset={2.74} radius={1.02} width={0.18} color="#7a4057" />
        <Plate side={1} offset={2.94} radius={0.88} width={0.16} color="#c97b8e" />
        <Plate side={1} offset={3.12} radius={0.72} width={0.14} color="#8d5068" />
        <Plate side={1} offset={3.28} radius={0.56} width={0.12} color="#f0e4d6" />
      </group>
    </Float>
  );
}

export function LandingScene() {
  return (
    <div className="landing-scene-shell" aria-hidden="true">
      <Canvas camera={{ position: [0, 0.08, 12.2], fov: 32 }} dpr={[1, 1.5]}>
        <ambientLight intensity={1.05} />
        <directionalLight position={[5, 4, 6]} intensity={2.3} color="#f5ede0" />
        <directionalLight position={[-5, -3, 4]} intensity={1.05} color="#c97b8e" />
        <pointLight position={[0, 1.5, 5]} intensity={1.05} color="#fff7f0" />
        <LoadedBarbell />
      </Canvas>
      <div className="landing-scene-glow landing-scene-glow-a" />
      <div className="landing-scene-glow landing-scene-glow-b" />
    </div>
  );
}
