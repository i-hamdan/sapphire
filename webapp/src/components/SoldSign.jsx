import React from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

export const SoldSign = ({ scale = 1 }) => {
  return (
    <group scale={scale}>
      {/* 1. Ornate L-Post */}
      {/* Vertical Post */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[0.08, 1.5, 0.08]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Horizontal Arm */}
      <mesh position={[0.9, 1.45, 0]} castShadow>
        <boxGeometry args={[1.8, 0.06, 0.06]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Arm End Cap */}
      <mesh position={[1.8, 1.45, 0]} castShadow>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* 2. Hanging Board */}
      <group position={[0.9, 1.05, 0]}>
        {/* Connection Chains/Hooks */}
        <mesh position={[-0.45, 0.35, 0]} castShadow>
          <boxGeometry args={[0.02, 0.2, 0.02]} />
          <meshStandardMaterial color="#333" metalness={0.8} />
        </mesh>
        <mesh position={[0.45, 0.35, 0]} castShadow>
          <boxGeometry args={[0.02, 0.2, 0.02]} />
          <meshStandardMaterial color="#333" metalness={0.8} />
        </mesh>

        {/* The Main Board */}
        <mesh castShadow>
          <boxGeometry args={[1.6, 0.6, 0.06]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
        
        {/* Red Banner Overlay (Covering full board) */}
        <mesh position={[0, 0, -0.032]} rotation={[0, Math.PI, 0]} castShadow>
          <boxGeometry args={[1.6, 0.6, 0.01]} />
          <meshStandardMaterial color="#d32f2f" />
        </mesh>

        {/* Giant SOLD Text */}
        <Text
          position={[0, 0, -0.04]}
          rotation={[0, Math.PI, 0]}
          fontSize={0.4}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          SOLD
        </Text>
      </group>
    </group>
  );
};
