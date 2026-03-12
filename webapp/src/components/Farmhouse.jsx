import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Materials for the house
const materials = {
  wall: new THREE.MeshPhongMaterial({ color: 0xF5EDD8, shininess: 20 }),
  wallDark: new THREE.MeshPhongMaterial({ color: 0xEDE0C2, shininess: 15 }),
  trim: new THREE.MeshPhongMaterial({ color: 0xFFFBF2, shininess: 60 }),
  roof: new THREE.MeshPhongMaterial({ color: 0xB0420E, shininess: 12 }),
  roofDark: new THREE.MeshPhongMaterial({ color: 0x7A2E08, shininess: 10 }),
  stone: new THREE.MeshPhongMaterial({ color: 0xD2BFA2, shininess: 25 }),
  stoneDark: new THREE.MeshPhongMaterial({ color: 0xBFAD90, shininess: 18 }),
  door: new THREE.MeshPhongMaterial({ color: 0x3D1A08, shininess: 30 }),
  glass: new THREE.MeshLambertMaterial({ color: 0x8FC5D8, transparent: true, opacity: 0.74 }),
  gold: new THREE.MeshPhongMaterial({ color: 0xD4A830, shininess: 80 }),
  brick: new THREE.MeshPhongMaterial({ color: 0x9B4521, shininess: 10 })
};

export const Farmhouse = ({ scale = 1, isVisible = false }) => {
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      const targetScale = isVisible ? scale * 0.4 : 0;
      const currentScale = groupRef.current.scale.x;
      
      // Optimization: hide completely if shrunk to save draw calls
      if (!isVisible && currentScale < 0.01) {
        groupRef.current.visible = false;
      } else {
        groupRef.current.visible = true;
        
        // Smoothly interpolate scale and Y position
        const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 10 * delta);
        groupRef.current.scale.setScalar(newScale);
        
        // Rises from underground (-1) up to surface (0)
        const targetY = isVisible ? 0.0 : -1.0;
        groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 10 * delta);
      }
    }
  });

  return (
    <group ref={groupRef} scale={0} position={[0, -1.0, 0]} visible={false}>
      {/* 1. Foundation */}
      <mesh position={[0, 0.11, 0.05]} material={materials.stone} castShadow receiveShadow>
        <boxGeometry args={[2.50, 0.22, 2.02]} />
      </mesh>
      <mesh position={[0, 0.28, 0.05]} material={materials.stoneDark} castShadow receiveShadow>
        <boxGeometry args={[2.30, 0.12, 1.86]} />
      </mesh>

      {/* 2. Ground Floor Main Body (GF = 0.33) */}
      <mesh position={[0, 0.89, 0.05]} material={materials.wall} castShadow receiveShadow>
        <boxGeometry args={[2.10, 1.12, 1.72]} />
      </mesh>
      
      {/* Side wings */}
      <mesh position={[-1.05, 0.78, 0.38]} material={materials.wallDark} castShadow receiveShadow>
        <boxGeometry args={[0.30, 0.90, 0.58]} />
      </mesh>
      <mesh position={[1.05, 0.78, 0.38]} material={materials.wallDark} castShadow receiveShadow>
        <boxGeometry args={[0.30, 0.90, 0.58]} />
      </mesh>

      {/* Belt course */}
      <mesh position={[0, 1.48, 0.05]} material={materials.stone} castShadow receiveShadow>
        <boxGeometry args={[2.12, 0.060, 1.74]} />
      </mesh>

      {/* 3. Portico / Front Porch */}
      <mesh position={[0, 0.37, -1.08]} material={materials.stoneDark} castShadow receiveShadow>
        <boxGeometry args={[2.10, 0.08, 0.48]} />
      </mesh>
      <mesh position={[0, 1.49, -1.08]} material={materials.stoneDark} castShadow receiveShadow>
        <boxGeometry args={[2.10, 0.08, 0.48]} />
      </mesh>

      {/* 4 Columns at Z = -1.29 */}
      {[-0.78, -0.26, 0.26, 0.78].map((px, i) => (
        <group key={i}>
          <mesh position={[px, 0.365, -1.29]} material={materials.stone} castShadow receiveShadow>
            <boxGeometry args={[0.14, 0.07, 0.14]} />
          </mesh>
          <mesh position={[px, 0.96, -1.29]} material={materials.trim} castShadow>
            <cylinderGeometry args={[0.057, 0.072, 1.12, 16]} />
          </mesh>
          <mesh position={[px, 1.485, -1.29]} material={materials.stone} castShadow receiveShadow>
            <boxGeometry args={[0.16, 0.07, 0.16]} />
          </mesh>
        </group>
      ))}

      {/* 4. Upper Floor (UF = 1.45) */}
      <mesh position={[0, 1.86, 0.05]} material={materials.wall} castShadow receiveShadow>
        <boxGeometry args={[1.82, 0.82, 1.40]} />
      </mesh>

      {/* 5. Roofs (RB = 2.27) */}
      <mesh position={[0, 2.71, 0.05]} rotation={[0, Math.PI / 4, 0]} material={materials.roof} castShadow>
        <cylinderGeometry args={[0.20, 1.33, 0.88, 4]} />
      </mesh>
      
      {/* Portico Roof */}
      <mesh position={[0, 1.67, -1.08]} rotation={[0, Math.PI / 4, 0]} material={materials.roof} castShadow>
        <cylinderGeometry args={[0.06, 1.08, 0.44, 4]} />
      </mesh>

      {/* Side Wing Roofs */}
      {[-1.05, 1.05].map((px, i) => (
        <mesh key={i} position={[px, 1.39, 0.39]} rotation={[0, Math.PI / 4, 0]} material={materials.roof} castShadow>
          <cylinderGeometry args={[0.04, 0.32, 0.32, 4]} />
        </mesh>
      ))}

      {/* 6. Chimney */}
      <mesh position={[0.55, 2.41, 0.30]} material={materials.brick} castShadow>
        <boxGeometry args={[0.21, 0.92, 0.21]} />
      </mesh>
      <mesh position={[0.55, 2.91, 0.30]} material={materials.stone} castShadow>
        <boxGeometry args={[0.28, 0.062, 0.28]} />
      </mesh>

      {/* 7. Door (Z = -0.81) */}
      <mesh position={[0, 0.65, -0.81]} material={materials.door} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.62, 0.06]} />
      </mesh>
      
    </group>
  );
};
