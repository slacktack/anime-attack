"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

function Blob({ tint }: { tint: string }) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = state.clock.elapsedTime * 0.05;
    ref.current.rotation.x = state.clock.elapsedTime * 0.03;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[2.2, 6]} />
      <meshStandardMaterial color={tint} wireframe opacity={0.25} transparent />
    </mesh>
  );
}

export default function HeroScene({ tint }: { tint: string }) {
  return (
    <Canvas camera={{ position: [0, 0, 5] }} dpr={[1, 1.5]} gl={{ antialias: false }}>
      <ambientLight intensity={0.8} />
      <pointLight position={[5, 5, 5]} />
      <Blob tint={tint} />
    </Canvas>
  );
}
