import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export const Gazebo = React.memo(({ 
  scale = 1, 
  isVisible = false, 
  config 
}) => {
  const groupRef = useRef();

  // Use config colors if provided, fallback to defaults
  const colors = config?.colors || {
    gazeboFrame: "#1a1a1a",
    gazeboBase: "#a0a0a0",
    gazeboWood: "#8b4513",
    gazeboRoof: "#2a2a2a"
  };

  useFrame((state, delta) => {
    if (groupRef.current) {
      const targetScale = isVisible ? scale * 0.45 : 0;
      const currentScale = groupRef.current.scale.x;

      if (!isVisible && currentScale < 0.01) {
        groupRef.current.visible = false;
      } else {
        groupRef.current.visible = true;
        const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 10 * delta);
        groupRef.current.scale.setScalar(newScale);
        
        const targetY = isVisible ? 0.0 : -1.0;
        groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 10 * delta);
      }
    }
  });

  return (
    <group ref={groupRef} scale={0} position={[0, -1.0, 0]} visible={false}>
      {/* 1. Stone Circular Base */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.55, 0.1, 32]} />
        <meshStandardMaterial color={colors.gazeboBase} roughness={0.9} />
      </mesh>

      {/* 2. Main Posts (8 Posts) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 1.35;
        const px = Math.cos(angle) * radius;
        const pz = Math.sin(angle) * radius;
        return (
          <mesh key={`post-${i}`} position={[px, 0.75, pz]} castShadow>
            <boxGeometry args={[0.1, 1.4, 0.1]} />
            <meshStandardMaterial color={colors.gazeboFrame} roughness={0.3} metalness={0.7} />
          </mesh>
        );
      })}

      {/* 3. Roof Structure */}
      {/* Circular rim */}
      <mesh position={[0, 1.45, 0]}>
        <torusGeometry args={[1.35, 0.05, 8, 32]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color={colors.gazeboFrame} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Conical Canopy */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <coneGeometry args={[1.6, 0.9, 8]} />
        <meshStandardMaterial color={colors.gazeboRoof} roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Roof ribs */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh key={`rib-${i}`} position={[0, 1.85, 0]} rotation={[0, angle, Math.PI / 3.8]}>
            <boxGeometry args={[1.8, 0.02, 0.02]} />
            <meshStandardMaterial color={colors.gazeboFrame} />
          </mesh>
        );
      })}

      {/* 4. Furniture - Curved Benches (4 benches) */}
      {Array.from({ length: 4 }).map((_, i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const radius = 1.0;
        const bx = Math.cos(angle) * radius;
        const bz = Math.sin(angle) * radius;
        return (
          <group key={`bench-${i}`} position={[bx, 0.3, bz]} rotation={[0, -angle + Math.PI / 2, 0]}>
             {/* Bench seat */}
             <mesh castShadow>
                <boxGeometry args={[1.2, 0.05, 0.35]} />
                <meshStandardMaterial color={colors.gazeboWood} roughness={0.85} />
             </mesh>
             {/* Bench legs */}
             <mesh position={[-0.5, -0.15, 0]}>
                <boxGeometry args={[0.05, 0.3, 0.3]} />
                <meshStandardMaterial color={colors.gazeboFrame} />
             </mesh>
             <mesh position={[0.5, -0.15, 0]}>
                <boxGeometry args={[0.05, 0.3, 0.3]} />
                <meshStandardMaterial color={colors.gazeboFrame} />
             </mesh>
             {/* Backrest slats */}
             <group position={[0, 0.25, 0.15]} rotation={[-0.2, 0, 0]}>
                {[0, 0.1, 0.2].map((sy, si) => (
                  <mesh key={si} position={[0, sy, 0]}>
                    <boxGeometry args={[1.2, 0.06, 0.025]} />
                    <meshStandardMaterial color={colors.gazeboWood} />
                  </mesh>
                ))}
                <mesh position={[-0.5, 0.05, -0.05]}>
                   <boxGeometry args={[0.04, 0.4, 0.04]} />
                   <meshStandardMaterial color={colors.gazeboFrame} />
                </mesh>
                <mesh position={[0.5, 0.05, -0.05]}>
                   <boxGeometry args={[0.04, 0.4, 0.04]} />
                   <meshStandardMaterial color={colors.gazeboFrame} />
                </mesh>
             </group>
          </group>
        );
      })}

      {/* 5. Central Table */}
      <group position={[0, 0.3, 0]}>
        {/* Table top */}
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.06, 32]} />
          <meshStandardMaterial color={colors.gazeboWood} roughness={0.7} />
        </mesh>
        {/* Table base */}
        <mesh position={[0, -0.15, 0]}>
           <cylinderGeometry args={[0.35, 0.38, 0.3, 16, 1, true]} />
           <meshStandardMaterial color={colors.gazeboFrame} />
        </mesh>
      </group>
    </group>
  );
});
