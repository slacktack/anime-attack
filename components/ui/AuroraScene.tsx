"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import { useRef } from "react";
import type { Mesh } from "three";

const TINTS = ["#7C3AED", "#3B82F6", "#DC2626"];

function AuroraBlob({
  color,
  position,
  scale,
  speed,
}: {
  color: string;
  position: [number, number, number];
  scale: number;
  speed: number;
}) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * speed * 0.1;
    ref.current.rotation.x = state.clock.elapsedTime * speed * 0.06;
  });

  return (
    <Float speed={speed} rotationIntensity={0.4} floatIntensity={1.2}>
      <mesh ref={ref} position={position} scale={scale}>
        <icosahedronGeometry args={[1.6, 8]} />
        <MeshDistortMaterial
          color={color}
          distort={0.35}
          speed={1.5}
          roughness={0.4}
          metalness={0.1}
          transparent
          opacity={0.22}
        />
      </mesh>
    </Float>
  );
}

export default function AuroraScene({ tint }: { tint?: string }) {
  const colors = tint ? [tint, ...TINTS.filter((c) => c !== tint)] : TINTS;

  return (
    <Canvas camera={{ position: [0, 0, 6] }} dpr={[1, 1.5]} gl={{ antialias: false }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-5, -3, 2]} intensity={0.5} color={colors[1]} />
      <AuroraBlob color={colors[0]} position={[-1.8, 0.6, 0]} scale={1.3} speed={0.6} />
      <AuroraBlob color={colors[1]} position={[1.6, -0.4, -1]} scale={1.6} speed={0.4} />
      <AuroraBlob color={colors[2]} position={[0.3, 1.2, -2]} scale={1.1} speed={0.8} />
    </Canvas>
  );
}
