import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

export const PhotoPin = React.memo(({ position, onClick, config }) => {
  const groupRef = useRef();
  const innerRef = useRef();
  
  const style = config?.photoPinStyle || {};
  const {
    isVisible = true,
    accentColor = "#4CAF50",
    iconColor = "#ffffff",
    baseHeight = 0.8,
    floatAmplitude = 0.25,
    floatSpeed = 1.8,
    swayAmplitude = 0.12,
    swaySpeed = 0.5,
    pinScale = 1.0,
    matteMode = false,
    showShadow = true,
    shadowOpacity = 0.25
  } = style;

  // THREE.Color doesn't handle 8-digit hex (RRGGBBAA). We must strip the alpha if present.
  const cleanColor = (hex) => {
    if (typeof hex !== 'string') return hex;
    const clean = hex.replace("#", "");
    return clean.length === 8 ? `#${clean.substring(0, 6)}` : hex;
  };

  const activeAccentColor = cleanColor(accentColor);
  const activeIconColor = cleanColor(iconColor);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (groupRef.current && isVisible) {
      // Float along the Z-axis (which is World UP)
      groupRef.current.position.z = position[2] + Math.sin(time * floatSpeed) * floatAmplitude;
    }
    
    if (innerRef.current && isVisible) {
      // Swivel around the local vertical axis
      innerRef.current.rotation.y = Math.sin(time * swaySpeed) * swayAmplitude;
    }
  });

  const { darkColor, highlightColor } = useMemo(() => {
    if (!isVisible) return { darkColor: null, highlightColor: null };
    const bColor = new THREE.Color(activeAccentColor);
    return {
      darkColor: bColor.clone().multiplyScalar(0.78),
      highlightColor: bColor.clone().lerp(new THREE.Color("#ffffff"), 0.35)
    };
  }, [activeAccentColor, isVisible]);

  if (!isVisible) return null;

  // Matte vs Glossy material properties
  const roughness = matteMode ? 0.92 : 0.08;
  const metalness = matteMode ? 0.02 : 0.22;
  const envMapIntensity = matteMode ? 0.3 : 1.2;

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1], position[2]]}
      scale={[pinScale, pinScale, pinScale]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* ── Drop shadow disc (remains flat and static on the ground) ── */}
      {showShadow && (
        <mesh position={[0, 0, -position[2] + 0.02]} rotation={[0, 0, 0]}>
          <circleGeometry args={[0.42, 32]} />
          <meshStandardMaterial
            color="#000000"
            transparent
            opacity={shadowOpacity}
            roughness={1}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* ── Vertical Content Group ── */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        {/* Inner group for local swaying/swiveling */}
        <group ref={innerRef}>
          {/* ── Tail / pointer (Tip points DOWN) ── */}
          <mesh position={[0, -0.62, 0.0]} rotation={[Math.PI, Math.PI / 4, 0]}>
            <coneGeometry args={[0.19, 0.38, 4, 1]} />
            <meshStandardMaterial
              color={darkColor}
              roughness={roughness}
              metalness={metalness}
            />
          </mesh>

          {/* ── Main rounded-square bubble body ── */}
          <RoundedBox
            args={[1.0, 1.0, 0.28]}
            radius={0.18}
            smoothness={6}
            castShadow
          >
            <meshStandardMaterial
              color={activeAccentColor}
              roughness={roughness}
              metalness={metalness}
              envMapIntensity={envMapIntensity}
            />
          </RoundedBox>

          {/* ── Top-left gloss highlight (Hidden in matte mode) ── */}
          {!matteMode && (
            <mesh position={[-0.18, 0.2, 0.148]} rotation={[0.18, 0.08, 0]}>
              <planeGeometry args={[0.42, 0.22]} />
              <meshStandardMaterial
                color={highlightColor}
                transparent
                opacity={0.38}
                roughness={0}
                metalness={0}
                depthWrite={false}
              />
            </mesh>
          )}

          {/* ── Camera icon group ── */}
          <group position={[0, 0.02, 0.16]} scale={0.78}>
            <RoundedBox args={[0.52, 0.36, 0.04]} radius={0.06} smoothness={4}>
              <meshStandardMaterial color={activeIconColor} roughness={matteMode ? 0.8 : 0.25} metalness={0.05} />
            </RoundedBox>
            <mesh position={[-0.08, 0.22, 0]}>
              <RoundedBox args={[0.18, 0.1, 0.04]} radius={0.03} smoothness={4}>
                <meshStandardMaterial color={activeIconColor} roughness={matteMode ? 0.8 : 0.25} metalness={0.05} />
              </RoundedBox>
            </mesh>
            <mesh position={[0, 0, 0.025]}>
              <torusGeometry args={[0.105, 0.025, 12, 32]} />
              <meshStandardMaterial color={activeAccentColor} roughness={roughness} metalness={metalness} />
            </mesh>
            <mesh position={[0, 0, 0.028]}>
              <circleGeometry args={[0.078, 32]} />
              <meshStandardMaterial color="#1a1a2e" roughness={0.05} metalness={0.6} />
            </mesh>
            <mesh position={[0.03, 0.03, 0.04]}>
              <circleGeometry args={[0.022, 16]} />
              <meshStandardMaterial
                color="#ffffff"
                transparent
                opacity={0.7}
                roughness={0}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0.2, 0.1, 0.025]}>
              <circleGeometry args={[0.028, 16]} />
              <meshStandardMaterial color={activeAccentColor} roughness={roughness} />
            </mesh>
          </group>

          {/* ── Soft fill light (Reduced in matte mode) ── */}
          <pointLight
            position={[0, 0.1, 0.6]}
            color={activeAccentColor}
            intensity={matteMode ? 0.4 : 0.9}
            distance={2.5}
            decay={2}
          />
        </group>
      </group>
    </group>
  );
});