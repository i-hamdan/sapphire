import React from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

export const MainGate = ({ x1, y1, x2, y2, config }) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  
  const pillarW = 0.6;
  const pillarH = 3.5;
  const archH = 4.2;
  const colors = config.colors;

  return (
    <group position={[mx, my, 0]} rotation={[0, 0, angle]}>
      {/* 1. Stone Pillars */}
      {/* Left Pillar */}
      <group position={[-len/2, 0, 0]}>
        <mesh position={[0, 0, pillarH/2]} castShadow>
          <boxGeometry args={[pillarW, pillarW, pillarH]} />
          <meshStandardMaterial color={config.colors.gatePillar} roughness={0.9} />
        </mesh>
        {/* Pillar Cap */}
        <mesh position={[0, 0, pillarH + 0.1]} castShadow>
          <boxGeometry args={[pillarW * 1.3, pillarW * 1.3, 0.2]} />
          <meshStandardMaterial color={config.colors.gatePillarCap} />
        </mesh>
        {/* Lantern */}
        <mesh position={[0, 0, pillarH + 0.4]}>
          <cylinderGeometry args={[0.15, 0.15, 0.4, 6]} rotation={[Math.PI/2, 0, 0]} />
          <meshStandardMaterial color="#ffcc44" emissive="#ffaa00" emissiveIntensity={2} />
        </mesh>
      </group>

      {/* Right Pillar */}
      <group position={[len/2, 0, 0]}>
        <mesh position={[0, 0, pillarH/2]} castShadow>
          <boxGeometry args={[pillarW, pillarW, pillarH]} />
          <meshStandardMaterial color={config.colors.gatePillar} roughness={0.9} />
        </mesh>
        {/* Pillar Cap */}
        <mesh position={[0, 0, pillarH + 0.1]} castShadow>
          <boxGeometry args={[pillarW * 1.3, pillarW * 1.3, 0.2]} />
          <meshStandardMaterial color={config.colors.gatePillarCap} />
        </mesh>
        {/* Lantern */}
        <mesh position={[0, 0, pillarH + 0.4]}>
          <cylinderGeometry args={[0.15, 0.15, 0.4, 6]} rotation={[Math.PI/2, 0, 0]} />
          <meshStandardMaterial color="#ffcc44" emissive="#ffaa00" emissiveIntensity={2} />
        </mesh>
      </group>

      {/* 2. Overarching Structure */}
      {/* Main Arch Beam */}
      <mesh position={[0, 0, archH]} castShadow>
        <boxGeometry args={[len + 0.2, 0.15, 0.4]} />
        <meshStandardMaterial color={config.colors.gateArch} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Decorative Arch (curved part) */}
      <mesh position={[0, 0, archH - 0.5]} rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[len/2, 0.05, 16, 100, Math.PI]} />
        <meshStandardMaterial color={config.colors.gateArch} metalness={0.8} />
      </mesh>

      {/* 3. Signage */}
      <group position={[0, 0, archH + 0.3]}>
        {/* Backboard for text - Thicker to prevent bleed-through */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[len * 0.7, 0.2, 0.6]} />
          <meshStandardMaterial color={config.colors.gateSign} metalness={0.5} roughness={0.5} />
        </mesh>
        
        {/* Text Front (facing highway) */}
        <Text
          position={[0, 0.11, 0]}
          fontSize={0.22}
          color={config.colors.gateText}
          anchorX="center"
          anchorY="middle"
          rotation={[Math.PI/2, 0, 0]}
        >
          SAPPHIRE FARMS
        </Text>
        
        {/* Text Back (facing plots) */}
        <Text
          position={[0, -0.11, 0]}
          fontSize={0.22}
          color={config.colors.gateText}
          anchorX="center"
          anchorY="middle"
          rotation={[Math.PI/2, Math.PI, 0]}
        >
          WELCOME HOME
        </Text>
      </group>

      {/* 4. Support Filigree */}
      {[1, -1].map((side) => (
        <group key={side} position={[side * (len/2 - 0.4), 0, archH - 0.2]}>
          <mesh rotation={[0, 0, Math.PI/4]}>
            <boxGeometry args={[0.6, 0.04, 0.04]} />
            <meshStandardMaterial color={config.colors.gateArch} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
