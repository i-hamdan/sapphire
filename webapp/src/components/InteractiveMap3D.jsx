import React, { useMemo, useState, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import vectorsData from '../assets/full_map_vectors.json';
import campusPerimeterData from '../assets/campus_perimeter.json';

import { generateRoadGeometries } from '../utils/RoadGenerator';
import { Farmhouse } from './Farmhouse';
import { Gazebo } from './Gazebo';
import { SoldSign } from './SoldSign';
import { MainGate } from './MainGate';
import { DEFAULT_MAP_CONFIG, hexToThreeColor } from '../config/mapConfig';
import plotDetails from '../assets/plot_details.json';
import plotFacingData from '../assets/plot_facing_data.json';
import './InteractiveMap.css';

const viewWidth = 1696;
const viewHeight = 2514;
const SCALE = 0.08;

// ─────────────────────────────────────────────
// INTERSECTION PLOT SET
// ─────────────────────────────────────────────
const INTERSECTION_PLOTS = new Set(['5', '54', '9', '22', '23', '36', '37', '43', '46', '49']);

// ─────────────────────────────────────────────
// GEOMETRY HELPER
// ─────────────────────────────────────────────
const createGeometry = (points, type) => {
  const shape = new THREE.Shape();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  if (!points || !Array.isArray(points) || points.length === 0) {
    return { geometry: new THREE.BufferGeometry(), width: 0, height: 0, cx: 0, cy: 0 };
  }

  points.forEach((p, i) => {
    let x, y;
    if (p.length === 2 && Array.isArray(p)) {
      x = (p[0] - viewWidth / 2) * SCALE;
      y = -(p[1] - viewHeight / 2) * SCALE;
    } else { x = p[0]; y = p[1]; }

    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  });

  const isPlot = type === 'plot';
  const isRoad = type === 'road' || type === 'highway';

  const depth = isPlot ? DEFAULT_MAP_CONFIG.geometry.plotDepth :
    (type === 'road' ? DEFAULT_MAP_CONFIG.geometry.roadDepth :
      (type === 'highway' ? DEFAULT_MAP_CONFIG.geometry.highwayDepth :
        (type === 'mountain' ? DEFAULT_MAP_CONFIG.geometry.mountainDepth :
          (type === 'water' ? DEFAULT_MAP_CONFIG.geometry.waterDepth : 0.08))));

  const extrudeSettings = {
    depth: depth,
    bevelEnabled: isPlot || type === 'mountain',
    bevelSegments: type === 'mountain' ? 5 : 2,
    steps: type === 'mountain' ? 2 : 1,
    bevelSize: type === 'mountain' ? 0.8 : 0.02,
    bevelThickness: type === 'mountain' ? 1.5 : 0.02,
  };

  return {
    geometry: new THREE.ExtrudeGeometry(shape, extrudeSettings),
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
};

const cleanMapData = vectorsData;
const HOUSE_FRONT_OFFSET = -Math.PI / 2;

// ─────────────────────────────────────────────
// CAMERA CONTROLLER
// ─────────────────────────────────────────────
const CameraController = ({ selectedPlot, isResetting, onResetComplete }) => {
  const { camera } = useThree();
  const controlsRef = useRef();

  useFrame((state, delta) => {
    if (!controlsRef.current) return;
    let targetPos = new THREE.Vector3();
    let targetLook = new THREE.Vector3();

    if (selectedPlot) {
      const tempGeom = createGeometry(selectedPlot.points, true, false);
      const plotCenter = new THREE.Vector3(tempGeom.cx, 0, -tempGeom.cy);
      const rotationSpeed = 0.4;
      const radius = 50;
      const angle = state.clock.elapsedTime * rotationSpeed;
      const offsetX = Math.sin(angle) * radius;
      const offsetZ = Math.cos(angle) * radius;
      targetPos.copy(plotCenter).add(new THREE.Vector3(offsetX, 35, offsetZ));
      const framingOffset = 18;
      const lookOffset = new THREE.Vector3(Math.sin(angle) * framingOffset, 0, Math.cos(angle) * framingOffset);
      targetLook.copy(plotCenter).add(lookOffset);
      camera.position.lerp(targetPos, 3 * delta);
      controlsRef.current.target.lerp(targetLook, 3 * delta);
    } else if (isResetting) {
      targetPos.set(0, 100, 50);
      targetLook.set(0, 0, 0);
      camera.position.lerp(targetPos, 2 * delta);
      controlsRef.current.target.lerp(targetLook, 2 * delta);
      if (camera.position.distanceTo(targetPos) < 1.0 && controlsRef.current.target.distanceTo(targetLook) < 1.0) {
        onResetComplete();
      }
    }
    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={selectedPlot ? 2 : 0.1}
      maxDistance={selectedPlot ? 800 : 10000}
      maxPolarAngle={selectedPlot ? Math.PI / 2.1 : Math.PI / 1.5}
      makeDefault
    />

  );
};

// ─────────────────────────────────────────────
// PLOT BOUNDARY WALL — grey concrete + metal slat plates
// ─────────────────────────────────────────────
const PlotWallSegment = ({ x1, y1, x2, y2, config }) => {
  const pb = config.plotBoundary;
  const colors = config.colors;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.15) return null;
  const angle = Math.atan2(dy, dx);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const baseZ = pb.surfaceZ;
  const elements = [];

  // Concrete wall panel
  elements.push(
    <mesh key="wall" position={[mx, my, baseZ + pb.wallHeight / 2]} rotation={[0, 0, angle]}>
      <boxGeometry args={[len, pb.wallThickness, pb.wallHeight]} />
      <meshStandardMaterial color={colors.plotWall} roughness={0.85} />
    </mesh>
  );

  // Horizontal metal slat plates above wall
  const slatStartZ = baseZ + pb.wallHeight + pb.slatGap;
  for (let i = 0; i < pb.slatCount; i++) {
    const slatZ = slatStartZ + i * (pb.slatHeight + pb.slatGap) + pb.slatHeight / 2;
    elements.push(
      <mesh key={`slat-${i}`} position={[mx, my, slatZ]} rotation={[0, 0, angle]}>
        <boxGeometry args={[len, pb.wallThickness * 0.5, pb.slatHeight]} />
        <meshStandardMaterial color={colors.plotSlat} roughness={0.3} metalness={0.7} />
      </mesh>
    );
  }

  // Concrete pillars at regular intervals
  const totalHeight = pb.wallHeight + pb.slatCount * (pb.slatHeight + pb.slatGap) + pb.slatGap;
  const numPillars = Math.max(2, Math.round(len / pb.pillarSpacing) + 1);
  for (let i = 0; i < numPillars; i++) {
    const t = numPillars === 1 ? 0.5 : i / (numPillars - 1);
    const px = x1 + t * dx, py = y1 + t * dy;
    // Pillar body
    elements.push(
      <mesh key={`pillar-${i}`} position={[px, py, baseZ + totalHeight / 2]}>
        <boxGeometry args={[pb.pillarWidth, pb.pillarWidth, totalHeight]} />
        <meshStandardMaterial color={colors.plotPillar} roughness={0.8} />
      </mesh>
    );
    // Pillar cap
    elements.push(
      <mesh key={`cap-${i}`} position={[px, py, baseZ + totalHeight + 0.015]}>
        <boxGeometry args={[pb.pillarWidth * 1.4, pb.pillarWidth * 1.4, 0.03]} />
        <meshStandardMaterial color={colors.plotPillarCap} roughness={0.6} />
      </mesh>
    );
  }

  return <>{elements}</>;
};

const PlotBoundaryWall = ({ polygon, gateEdgeIdx, secondGateEdgeIdx = -1, config }) => {
  const pb = config.plotBoundary;
  const pts = polygon.points.map(p => ({
    x: (p[0] - viewWidth / 2) * SCALE,
    y: -(p[1] - viewHeight / 2) * SCALE,
  }));

  const cleanPts = (
    pts.length > 1 &&
    Math.abs(pts[0].x - pts[pts.length - 1].x) < 0.001 &&
    Math.abs(pts[0].y - pts[pts.length - 1].y) < 0.001
  ) ? pts.slice(0, -1) : pts;

  const n = cleanPts.length;
  const gateEdges = new Set([gateEdgeIdx, secondGateEdgeIdx].filter(i => i !== -1));
  const segments = [];

  for (let i = 0; i < n; i++) {
    const p1 = cleanPts[i], p2 = cleanPts[(i + 1) % n];

    if (gateEdges.has(i)) {
      const gapStart = (1 - pb.gateOpeningRatio) / 2;
      const gapEnd = 1 - gapStart;
      const lx2 = p1.x + gapStart * (p2.x - p1.x), ly2 = p1.y + gapStart * (p2.y - p1.y);
      const rx1 = p1.x + gapEnd * (p2.x - p1.x), ry1 = p1.y + gapEnd * (p2.y - p1.y);
      segments.push(
        <PlotWallSegment key={`w-${i}-L`} x1={p1.x} y1={p1.y} x2={lx2} y2={ly2} config={config} />,
        <PlotWallSegment key={`w-${i}-R`} x1={rx1} y1={ry1} x2={p2.x} y2={p2.y} config={config} />
      );
    } else {
      segments.push(
        <PlotWallSegment key={`w-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} config={config} />
      );
    }
  }
  return <>{segments}</>;
};

// ─────────────────────────────────────────────
// CAMPUS BOUNDARY — convex hull + cream wall + mesh fence
// ─────────────────────────────────────────────
const computeCampusBoundary = (data, padding) => {
  const allPoints = [];
  data.forEach(d => {
    // Only include plots and internal roads to keep the boundary tight to the main development
    if (['plot', 'road'].includes(d.type)) {
      d.points.forEach(p => {
        allPoints.push({
          x: (p[0] - viewWidth / 2) * SCALE,
          y: -(p[1] - viewHeight / 2) * SCALE,
        });
      });
    }
  });

  if (allPoints.length < 3) return [];

  // Andrew's monotone chain convex hull
  allPoints.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  const lower = [];
  for (const p of allPoints) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = allPoints.length - 1; i >= 0; i--) {
    const p = allPoints[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  const hull = lower.concat(upper);

  // Offset outward by padding
  if (padding > 0 && hull.length >= 3) {
    const n = hull.length;
    const offsetHull = [];
    for (let i = 0; i < n; i++) {
      const prev = hull[(i - 1 + n) % n];
      const curr = hull[i];
      const next = hull[(i + 1) % n];
      
      const e1x = curr.x - prev.x, e1y = curr.y - prev.y;
      const e2x = next.x - curr.x, e2y = next.y - curr.y;
      const len1 = Math.hypot(e1x, e1y), len2 = Math.hypot(e2x, e2y);
      
      const n1x = -e1y / len1, n1y = e1x / len1;
      const n2x = -e2y / len2, n2y = e2x / len2;
      const nx = n1x + n2x, ny = n1y + n2y;
      const nLen = Math.hypot(nx, ny) || 1;
      
      offsetHull.push({ x: curr.x + (nx / nLen) * padding, y: curr.y + (ny / nLen) * padding });
    }
    return offsetHull;
  }
  return hull;
};

// Initial campus boundary from high-fidelity OpenCV extraction
const campusHull = campusPerimeterData[0].points.map(p => ({
  x: (p[0] - viewWidth / 2) * SCALE,
  y: -(p[1] - viewHeight / 2) * SCALE,
}));


const CampusBoundarySegment = ({ x1, y1, x2, y2, config }) => {
  const cb = config.campusBoundary;
  const colors = config.colors;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.2) return null;
  const angle = Math.atan2(dy, dx);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const baseZ = cb.surfaceZ;
  const elements = [];

  // Cream concrete base wall
  elements.push(
    <mesh key="base" position={[mx, my, baseZ + cb.wallHeight / 2]} rotation={[0, 0, angle]}>
      <boxGeometry args={[len, cb.wallThickness, cb.wallHeight]} />
      <meshStandardMaterial color={colors.campusWall} roughness={0.88} metalness={0.05} />
    </mesh>
  );

  // Dark metal posts at regular intervals
  const numPosts = Math.max(2, Math.round(len / cb.postSpacing) + 1);
  for (let i = 0; i < numPosts; i++) {
    const t = numPosts === 1 ? 0.5 : i / (numPosts - 1);
    const px = x1 + t * dx, py = y1 + t * dy;
    elements.push(
      <mesh key={`post-${i}`} position={[px, py, baseZ + cb.postHeight / 2]}>
        <boxGeometry args={[cb.postWidth, cb.postWidth, cb.postHeight]} />
        <meshStandardMaterial color={colors.campusPost} roughness={0.35} metalness={0.85} />
      </mesh>
    );
  }

  // Horizontal rails — top and bottom of mesh area
  const railBottomZ = baseZ + cb.wallHeight + 0.02;
  const railTopZ = baseZ + cb.postHeight - cb.railThickness;
  [railBottomZ, railTopZ].forEach((rz, ri) => {
    elements.push(
      <mesh key={`rail-${ri}`} position={[mx, my, rz + cb.railThickness / 2]} rotation={[0, 0, angle]}>
        <boxGeometry args={[len, cb.railThickness, cb.railThickness]} />
        <meshStandardMaterial color={colors.campusRail} roughness={0.35} metalness={0.85} />
      </mesh>
    );
  });

  // Semi-transparent mesh panel between rails
  const meshHeight = railTopZ - railBottomZ - cb.railThickness;
  if (meshHeight > 0) {
    elements.push(
      <mesh key="mesh" position={[mx, my, railBottomZ + cb.railThickness + meshHeight / 2]} rotation={[0, 0, angle]}>
        <boxGeometry args={[len, cb.wallThickness * 0.3, meshHeight]} />
        <meshStandardMaterial
          color={colors.campusMesh}
          roughness={0.5}
          metalness={0.7}
          transparent
          opacity={cb.meshOpacity}
        />
      </mesh>
    );
  }

  return <>{elements}</>;
};

const CampusBoundary = ({ config }) => {
  const entranceMarkers = useMemo(() => {
    // Gap coordinates from campus_perimeter.json Points 2 and 3
    const p1 = { x: (1097 - viewWidth / 2) * SCALE, y: -(298 - viewHeight / 2) * SCALE };
    const p2 = { x: (1065 - viewWidth / 2) * SCALE, y: -(298 - viewHeight / 2) * SCALE };
    return { p1, p2 };
  }, []);

  const segments = useMemo(() => {
    if (!campusHull || campusHull.length < 3) return [];
    const result = [];
    const ep1 = entranceMarkers.p1;
    const ep2 = entranceMarkers.p2;

    for (let i = 0; i < campusHull.length; i++) {
      const p1 = campusHull[i];
      const p2 = campusHull[(i + 1) % campusHull.length];
      
      // Check if this is the entrance segment
      const isEntrance = (
        (Math.abs(p1.x - ep1.x) < 0.01 && Math.abs(p1.y - ep1.y) < 0.01 && Math.abs(p2.x - ep2.x) < 0.01 && Math.abs(p2.y - ep2.y) < 0.01) ||
        (Math.abs(p1.x - ep2.x) < 0.01 && Math.abs(p1.y - ep2.y) < 0.01 && Math.abs(p2.x - ep1.x) < 0.01 && Math.abs(p2.y - ep1.y) < 0.01)
      );

      if (!isEntrance) {
        result.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      }
    }
    return result;
  }, [entranceMarkers]);

  return (
    <group>
      {segments.map((seg, i) => (
        <CampusBoundarySegment key={i} {...seg} config={config} />
      ))}
      <MainGate 
        x1={entranceMarkers.p1.x} 
        y1={entranceMarkers.p1.y} 
        x2={entranceMarkers.p2.x} 
        y2={entranceMarkers.p2.y} 
        config={config} 
      />
    </group>
  );
};



// ─────────────────────────────────────────────
// STONE PATH  — uniform, centered stones
// ─────────────────────────────────────────────
const StonePath = ({ x1, y1, x2, y2, pathW = 1.1 }) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.1) return null;
  const angle = Math.atan2(dy, dx);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const stoneCount = Math.max(2, Math.floor(len / 0.62));

  return (
    <>
      {/* Sandy base */}
      <mesh position={[mx, my, 0.315]} rotation={[0, 0, angle]}>
        <planeGeometry args={[len, pathW]} />
        <meshStandardMaterial color="#c2a26a" roughness={0.97} />
      </mesh>

      {/* Uniform stone slabs — centered on path, slight deterministic twist */}
      {Array.from({ length: stoneCount }).map((_, i) => {
        const t = (i + 0.5) / stoneCount;
        const sx = x1 + t * dx;
        const sy = y1 + t * dy;
        // Deterministic variation — no Math.random()
        const twist = ((i * 13) % 7 - 3) * 0.025;
        const wScale = 0.88 + ((i * 5) % 4) * 0.04;
        const hScale = 0.78 + ((i * 3) % 3) * 0.04;
        return (
          <mesh key={i} position={[sx, sy, 0.323]} rotation={[0, 0, angle + twist]}>
            <planeGeometry args={[0.54 * wScale, pathW * 0.78 * hScale]} />
            <meshStandardMaterial color="#d8be96" roughness={0.99} />
          </mesh>
        );
      })}
    </>
  );
};

// ─────────────────────────────────────────────
// GATE LAMPS — fixed crossbar rotation
// ─────────────────────────────────────────────
const GateLamps = ({ gateCx, gateCy, perpX, perpY, pathAngle, lampOff = 0.8 }) => {
  return (
    <>
      {[1, -1].map((side, si) => {
        const lx = gateCx + perpX * lampOff * side;
        const ly = gateCy + perpY * lampOff * side;
        const POST_BASE = 0.32;

        return (
          <group key={si}>
            {/* Iron post — vertical along Z */}
            <mesh position={[lx, ly, POST_BASE + 0.55]}>
              <boxGeometry args={[0.07, 0.07, 1.1]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.7} />
            </mesh>

            {/* Crossbar arm — rotated to point along path direction (toward/away road) */}
            <mesh position={[lx, ly, POST_BASE + 1.1]} rotation={[0, 0, pathAngle]}>
              <boxGeometry args={[0.22, 0.06, 0.05]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.7} />
            </mesh>

            {/* Pendant drop from arm end */}
            <mesh position={[
              lx + Math.cos(pathAngle) * 0.09,
              ly + Math.sin(pathAngle) * 0.09,
              POST_BASE + 1.05
            ]}>
              <boxGeometry args={[0.04, 0.04, 0.12]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.7} />
            </mesh>

            {/* Glowing orb */}
            <mesh position={[
              lx + Math.cos(pathAngle) * 0.09,
              ly + Math.sin(pathAngle) * 0.09,
              POST_BASE + 0.97
            ]}>
              <sphereGeometry args={[0.14, 10, 10]} />
              <meshStandardMaterial
                color="#fff8dc"
                emissive="#ffcc44"
                emissiveIntensity={3.0}
                roughness={0.05}
              />
            </mesh>

            {/* Warm point light from bulb */}
            <pointLight
              position={[
                lx + Math.cos(pathAngle) * 0.09,
                ly + Math.sin(pathAngle) * 0.09,
                POST_BASE + 0.97
              ]}
              color="#ffdd66"
              intensity={3.5}
              distance={9}
              decay={2}
            />
          </group>
        );
      })}
    </>
  );
};

// ─────────────────────────────────────────────
// TREE
// ─────────────────────────────────────────────
const PlotTree = ({ x, y, size = 1.0, variant = 0 }) => {
  const TRUNK_H = 1.1 * size;
  const FOLI_R = 0.7 * size;
  const BASE_Z = 0.32;
  const greens = ['#2a6e2a', '#3d8c3d', '#1a5c1a', '#4a9e4a', '#2e7d32'];
  const c1 = greens[variant % greens.length];
  const c2 = greens[(variant + 2) % greens.length];

  return (
    <group>
      <mesh position={[x, y, BASE_Z + TRUNK_H / 2]}>
        <boxGeometry args={[0.1 * size, 0.1 * size, TRUNK_H]} />
        <meshStandardMaterial color="#5c3d1a" roughness={0.95} />
      </mesh>
      <mesh position={[x, y, BASE_Z + TRUNK_H + FOLI_R * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[FOLI_R, FOLI_R * 1.6, 8]} />
        <meshStandardMaterial color={c1} roughness={0.8} />
      </mesh>
      <mesh position={[x, y, BASE_Z + TRUNK_H + FOLI_R * 0.95]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[FOLI_R * 0.68, FOLI_R * 1.2, 8]} />
        <meshStandardMaterial color={c2} roughness={0.8} />
      </mesh>
      <mesh position={[x, y, BASE_Z + TRUNK_H + FOLI_R * 1.35]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[FOLI_R * 0.38, FOLI_R * 0.85, 8]} />
        <meshStandardMaterial color={c1} roughness={0.8} />
      </mesh>
    </group>
  );
};

// ─────────────────────────────────────────────
// GREEN AREA FOREST
// ─────────────────────────────────────────────

// Deterministic hash — no Math.random, same result every render
const h = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const h2 = (a, b) => h(a * 1619 + b * 31337);

// Ray-casting point-in-polygon (2D)
const pointInPoly = (px, py, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
};

// ── Tree Species ──────────────────────────────

// 0: Tall Pine — narrow stacked cones, very tall
const TallPine = ({ x, y, size }) => {
  const BZ = 0.12;
  const trunkH = 1.8 * size, trunkW = 0.08 * size;
  const foliR = 0.55 * size;
  const layers = 5;
  const colors = ['#1a4a1a', '#245c24', '#1e5a1e', '#2a6e2a', '#1c501c'];
  return (
    <group>
      <mesh position={[x, y, BZ + trunkH / 2]}>
        <boxGeometry args={[trunkW, trunkW, trunkH]} />
        <meshStandardMaterial color="#4a2e0a" roughness={0.98} />
      </mesh>
      {Array.from({ length: layers }).map((_, i) => {
        const t = i / (layers - 1);
        const r = foliR * (1.0 - t * 0.55);
        const ht = foliR * (1.0 - t * 0.3) * 1.4;
        const z = BZ + trunkH * 0.45 + i * foliR * 0.55;
        return (
          <mesh key={i} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[r, ht, 7]} />
            <meshStandardMaterial color={colors[i % colors.length]} roughness={0.85} />
          </mesh>
        );
      })}
    </group>
  );
};

// 1: Round Deciduous — trunk + soft sphere cluster
const RoundTree = ({ x, y, size }) => {
  const BZ = 0.12;
  const trunkH = 1.1 * size;
  const cr = 0.72 * size;
  const offsets = [
    [0, 0, 0], [cr * 0.45, 0, cr * 0.25], [-cr * 0.38, cr * 0.2, cr * 0.2],
    [0, -cr * 0.42, cr * 0.18], [cr * 0.2, cr * 0.35, cr * 0.3],
  ];
  const greens = ['#3d8c3d', '#4a9e4a', '#2e7d32', '#5aab3a', '#388e3c'];
  return (
    <group>
      <mesh position={[x, y, BZ + trunkH / 2]}>
        <boxGeometry args={[0.11 * size, 0.11 * size, trunkH]} />
        <meshStandardMaterial color="#5c3a0a" roughness={0.97} />
      </mesh>
      {offsets.map(([ox, oy, oz], i) => (
        <mesh key={i} position={[x + ox, y + oy, BZ + trunkH + cr * 0.55 + oz]}>
          <sphereGeometry args={[cr * (0.72 - i * 0.06), 7, 6]} />
          <meshStandardMaterial color={greens[i % greens.length]} roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
};

// 2: Low Bushy Shrub — almost no trunk, dense wide skirt
const BushyTree = ({ x, y, size }) => {
  const BZ = 0.12;
  const w = 0.85 * size, h2c = 0.5 * size;
  const colors = ['#4caf50', '#66bb6a', '#388e3c', '#57a85b'];
  return (
    <group>
      {/* Wide base layer */}
      <mesh position={[x, y, BZ + h2c * 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[w, h2c * 0.8, 8]} />
        <meshStandardMaterial color={colors[0]} roughness={0.88} />
      </mesh>
      {/* Mid layer */}
      <mesh position={[x, y, BZ + h2c * 0.75]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[w * 0.7, h2c * 0.7, 7]} />
        <meshStandardMaterial color={colors[1]} roughness={0.88} />
      </mesh>
      {/* Cap */}
      <mesh position={[x, y, BZ + h2c * 1.1]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[w * 0.38, h2c * 0.55, 6]} />
        <meshStandardMaterial color={colors[2]} roughness={0.88} />
      </mesh>
    </group>
  );
};

// 3: Cypress — slim pencil shape, very tall
const CypressTree = ({ x, y, size }) => {
  const BZ = 0.12;
  const trunkH = 0.4 * size;
  const layers = 8;
  const totalH = 2.6 * size;
  return (
    <group>
      <mesh position={[x, y, BZ + trunkH / 2]}>
        <boxGeometry args={[0.07 * size, 0.07 * size, trunkH]} />
        <meshStandardMaterial color="#3d2008" roughness={0.97} />
      </mesh>
      {Array.from({ length: layers }).map((_, i) => {
        const t = i / (layers - 1);
        const r = 0.28 * size * (1 - t * 0.6);
        const z = BZ + trunkH + (totalH * t);
        const colors = ['#1e5a1e', '#245c24', '#1a4a1a', '#2a6420'];
        return (
          <mesh key={i} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[r, totalH / layers * 1.6, 6]} />
            <meshStandardMaterial color={colors[i % colors.length]} roughness={0.84} />
          </mesh>
        );
      })}
    </group>
  );
};

// 4: Broad Canopy — squat, wide, tropical feel
const BroadTree = ({ x, y, size }) => {
  const BZ = 0.12;
  const trunkH = 0.9 * size;
  const capR = 0.95 * size;
  return (
    <group>
      <mesh position={[x, y, BZ + trunkH / 2]}>
        <boxGeometry args={[0.14 * size, 0.14 * size, trunkH]} />
        <meshStandardMaterial color="#4a2e0a" roughness={0.97} />
      </mesh>
      {/* Wide flat canopy */}
      <mesh position={[x, y, BZ + trunkH + capR * 0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[capR, capR * 0.6, 9]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.8} />
      </mesh>
      {/* Second mid layer */}
      <mesh position={[x, y, BZ + trunkH + capR * 0.62]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[capR * 0.68, capR * 0.55, 8]} />
        <meshStandardMaterial color="#388e3c" roughness={0.8} />
      </mesh>
      {/* Top tuft */}
      <mesh position={[x, y, BZ + trunkH + capR * 0.95]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[capR * 0.32, capR * 0.45, 7]} />
        <meshStandardMaterial color="#43a047" roughness={0.8} />
      </mesh>
    </group>
  );
};

const TREE_SPECIES = [TallPine, RoundTree, () => null, CypressTree, BroadTree];

// ── Main forest scatter component ────────────
const GreenAreaForest = ({ polygon }) => {
  const trees = useMemo(() => {
    const pts3D = polygon.points.map(p => ({
      x: (p[0] - viewWidth / 2) * SCALE,
      y: -(p[1] - viewHeight / 2) * SCALE,
    }));

    // Deduplicate closed polygon
    const cleanPts = (
      pts3D.length > 1 &&
      Math.hypot(pts3D[0].x - pts3D[pts3D.length - 1].x, pts3D[0].y - pts3D[pts3D.length - 1].y) < 0.01
    ) ? pts3D.slice(0, -1) : pts3D;

    const xs = cleanPts.map(p => p.x), ys = cleanPts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const SPACING = 1.2;  // Increased density (3x) from 2.1
    const JITTER = 0.43; // Proportional jitter from 0.75
    const result = [];
    let idx = 0;

    for (let gx = minX; gx <= maxX; gx += SPACING) {
      for (let gy = minY; gy <= maxY; gy += SPACING) {
        const seed = idx++;
        // Deterministic jitter
        const jx = (h2(seed, 1) - 0.5) * 2 * JITTER;
        const jy = (h2(seed, 2) - 0.5) * 2 * JITTER;
        const px = gx + jx, py = gy + jy;

        if (!pointInPoly(px, py, cleanPts)) continue;

        // Deterministic species, size, rotation
        const species = Math.floor(h2(seed, 3) * TREE_SPECIES.length);
        const baseSize = 0.6 + h2(seed, 4) * 0.85; // 0.6 → 1.45
        // Edge trees slightly larger for natural forest-edge look
        const edgeDist = Math.min(
          px - minX, maxX - px, py - minY, maxY - py
        );
        const sizeBoost = edgeDist < 3 ? 0.85 : 1.0;

        result.push({ px, py, species, size: baseSize * sizeBoost, seed });
      }
    }
    return result;
  }, [polygon]);

  return (
    <>
      {trees.map(({ px, py, species, size, seed }) => {
        const Species = TREE_SPECIES[species];
        return <Species key={seed} x={px} y={py} size={size} />;
      })}
    </>
  );
};
const FLOWER_OFFSETS = [[-0.55, -0.22], [0.0, 0.25], [0.52, -0.12], [-0.28, 0.30], [0.35, 0.18]];
const FLOWER_COLORS = ['#e74c3c', '#f39c12', '#9b59b6', '#e91e8c', '#ff6b35'];


// ─────────────────────────────────────────────
// PREMIUM WATER REDESIGN
// ─────────────────────────────────────────────

const WATER_SURFACE_Z = 0.16;

const halton2 = (i, b) => {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
};

const ShorelineFoam = ({ points }) => {
  const foamPoints = useMemo(() => {
    if (!points || points.length < 3) return null;
    return points.map(p => new THREE.Vector3(p.x, p.y, WATER_SURFACE_Z + 0.001));
  }, [points]);

  const curve = useMemo(() => (foamPoints ? new THREE.CatmullRomCurve3(foamPoints, true) : null), [foamPoints]);
  const geometry = useMemo(() => (curve ? new THREE.TubeGeometry(curve, points.length * 2, 0.35, 12, true) : null), [curve, points]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#ffffff" transparent opacity={0.6} emissive="#ffffff" emissiveIntensity={0.4} />
    </mesh>
  );
};

const WaterReflections = ({ cx, cy, bw, bh, pts3D }) => {
  const reflections = useMemo(() => {
    const res = [];
    for (let i = 0; i < 15; i++) {
      const rx = cx + (halton2(i, 11) - 0.5) * bw * 0.85;
      const ry = cy + (halton2(i, 12) - 0.5) * bh * 0.85;
      if (pointInPoly(rx, ry, pts3D)) {
        res.push({ x: rx, y: ry, s: 0.8 + halton2(i, 13) * 1.8, id: i });
      }
    }
    return res;
  }, [cx, cy, bw, bh, pts3D]);

  return (
    <>
      {reflections.map((r) => (
        <ReflectionGlint key={r.id} x={r.x} y={r.y} size={r.s} index={r.id} />
      ))}
    </>
  );
};

const WaterGradient = ({ cx, cy, bw, bh, pts3D }) => {
  const patches = useMemo(() => {
    const res = [];
    for (let i = 0; i < 10; i++) {
      const rx = cx + (halton2(i, 14) - 0.5) * bw * 0.7;
      const ry = cy + (halton2(i, 15) - 0.5) * bh * 0.7;
      if (pointInPoly(rx, ry, pts3D)) {
        res.push({
          x: rx, y: ry,
          sx: 5 + halton2(i, 16) * 15,
          sy: 3 + halton2(i, 17) * 10,
          color: i % 2 === 0 ? DEFAULT_MAP_CONFIG.colors.waterDeep : DEFAULT_MAP_CONFIG.colors.waterShallow,
          id: i
        });
      }
    }
    return res;
  }, [cx, cy, bw, bh, pts3D]);

  return patches.map(p => (
    <mesh
      key={p.id}
      position={[p.x, p.y, WATER_SURFACE_Z - 0.02]}
      rotation={[0, 0, p.id * 1.1]}
      scale={[p.sx, p.sy, 1]}
    >
      <circleGeometry args={[1, 32]} />
      <meshBasicMaterial color={p.color} transparent opacity={0.25} />
    </mesh>
  ));
};

const SingleRipple = ({ x, y, index, delay = 0 }) => {
  const meshRef = useRef();
  useFrame(({ clock }) => {
    if (!meshRef.current || !meshRef.current.material) return;
    const t = (clock.elapsedTime * 0.4 + delay) % 1;
    meshRef.current.scale.setScalar(0.5 + t * 4.5);
    meshRef.current.material.opacity = (1 - t) * 0.25;
  });
  return (
    <mesh ref={meshRef} position={[x, y, WATER_SURFACE_Z + 0.005]}>
      <ringGeometry args={[0.48, 0.52, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0} />
    </mesh>
  );
};

const WaterRipples = ({ cx, cy, bw, bh, pts3D }) => {
  const ripples = useMemo(() => {
    const res = [];
    for (let i = 0; i < 12; i++) {
      const rx = cx + (halton2(i, 19) - 0.5) * bw * 0.88;
      const ry = cy + (halton2(i, 20) - 0.5) * bh * 0.88;
      if (pointInPoly(rx, ry, pts3D)) {
        res.push({ x: rx, y: ry, delay: halton2(i, 21), id: i });
      }
    }
    return res;
  }, [cx, cy, bw, bh, pts3D]);

  return ripples.map(r => <SingleRipple key={r.id} x={r.x} y={r.y} index={r.id} delay={r.delay} />);
};

const ReflectionGlint = ({ x, y, size, index }) => {
  const meshRef = useRef();
  useFrame(({ clock }) => {
    if (!meshRef.current || !meshRef.current.material) return;
    const t = clock.elapsedTime + index * 2.2;
    meshRef.current.scale.setScalar(size * (1 + Math.sin(t) * 0.2));
    meshRef.current.material.opacity = 0.15 + Math.sin(t * 1.5) * 0.1;
  });

  return (
    <mesh ref={meshRef} position={[x, y, WATER_SURFACE_Z + 0.005]}>
      <planeGeometry args={[1.5, 0.1]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.2} />
    </mesh>
  );
};

const PremiumBoat = ({ path, speed, initialOffset, color }) => {
  const groupRef = useRef();
  const rippleRef = useRef();
  const curve = useMemo(() => {
    if (!path || path.length < 2) return null;
    return new THREE.CatmullRomCurve3(
      path.map(p => new THREE.Vector3(p[0], p[1], WATER_SURFACE_Z + 0.1)),
      true
    );
  }, [path]);

  useFrame(({ clock }) => {
    if (!groupRef.current || !curve) return;
    const t = (clock.elapsedTime * speed + initialOffset) % 1;
    if (isNaN(t)) return;
    const pos = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    if (!pos || !tangent) return;
    groupRef.current.position.copy(pos);
    groupRef.current.rotation.z = Math.atan2(tangent.y, tangent.x);
    // Subtle rocking
    groupRef.current.rotation.x = Math.sin(clock.elapsedTime * 2 + initialOffset) * 0.1;

    // Wake ripples
    if (rippleRef.current && rippleRef.current.material) {
      const rt = (clock.elapsedTime * 1.5) % 1;
      rippleRef.current.scale.set(1 + rt * 2, 1 + rt * 1, 1);
      rippleRef.current.material.opacity = (1 - rt) * 0.4;
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        {/* Detailed Hull */}
        <mesh>
          <boxGeometry args={[1.4, 0.5, 0.3]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.4} />
        </mesh>
        {/* Bow */}
        <mesh position={[0.7, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.35, 0.35, 0.3]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Cabin */}
        <mesh position={[-0.2, 0, 0.25]}>
          <boxGeometry args={[0.5, 0.35, 0.25]} />
          <meshStandardMaterial color="#f0f0f0" />
        </mesh>
        {/* Wake trail */}
        <mesh ref={rippleRef} position={[-0.8, 0, -0.08]} rotation={[0, 0, -Math.PI / 2]}>
          <ringGeometry args={[0.8, 1.0, 32, 1, 0, Math.PI]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
};

const WaterDetails = ({ polygon }) => {
  const pts3D = useMemo(() => {
    const pts = polygon.points.map(p => ({
      x: (p[0] - viewWidth / 2) * SCALE,
      y: -(p[1] - viewHeight / 2) * SCALE,
    }));
    return (
      pts.length > 1 &&
      Math.abs(pts[0].x - pts[pts.length - 1].x) < 0.001 &&
      Math.abs(pts[0].y - pts[pts.length - 1].y) < 0.001
    ) ? pts.slice(0, -1) : pts;
  }, [polygon]);

  const { cx, cy, bw, bh } = useMemo(() => {
    const xs = pts3D.map(p => p.x), ys = pts3D.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return {
      cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
      bw: maxX - minX, bh: maxY - minY,
    };
  }, [pts3D]);

  const boatPath = useMemo(() => {
    const res = [];
    const N = 48;
    const margin = 2.2; // Safe distance for hull + wake
    const centers = pts3D.length > 0 ? pts3D : [{ x: cx, y: cy }];

    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let px = cx + Math.cos(a) * bw * 0.5;
      let py = cy + Math.sin(a) * bh * 0.5;

      let step = 0;
      while (step < 60) {
        const isInside = pointInPoly(px, py, centers);
        const hasMargin = isInside &&
          pointInPoly(px + margin, py, centers) &&
          pointInPoly(px - margin, py, centers) &&
          pointInPoly(px, py + margin, centers) &&
          pointInPoly(px, py - margin, centers);
        if (hasMargin) break;
        px = px * 0.94 + cx * 0.06;
        py = py * 0.94 + cy * 0.06;
        step++;
      }
      res.push([px, py]);
    }
    return res;
  }, [cx, cy, bw, bh, pts3D]);

  return (
    <group>
      <ShorelineFoam points={pts3D} />
      <WaterGradient cx={cx} cy={cy} bw={bw} bh={bh} pts3D={pts3D} />
      <WaterRipples cx={cx} cy={cy} bw={bw} bh={bh} pts3D={pts3D} />
      <WaterReflections cx={cx} cy={cy} bw={bw} bh={bh} pts3D={pts3D} />
      <PremiumBoat path={boatPath} speed={0.0055} initialOffset={0} color="#8b0000" />
      <PremiumBoat path={boatPath} speed={0.0035} initialOffset={0.5} color="#000080" />
    </group>
  );
};

// ─────────────────────────────────────────────
// MOUNTAIN RANGE — rugged 3D peaks
// ─────────────────────────────────────────────

const SinglePeak = ({ x, y, baseR, height, seed, config }) => {
  const peakColor = config.colors.mountainPeak;
  const snowColor = config.colors.snow;

  return (
    <group position={[x, y, 0]}>
      {/* Mountain Base */}
      <mesh position={[0, 0, height / 2]} rotation={[Math.PI / 2, 0, seed]}>
        <coneGeometry args={[baseR, height, 4 + (seed % 3)]} />
        <meshStandardMaterial color={peakColor} roughness={0.9} flatShading />
      </mesh>
      {/* Snow Cap */}
      <mesh position={[0, 0, height * 0.82]} rotation={[Math.PI / 2, 0, seed]}>
        <coneGeometry args={[baseR * 0.38, height * 0.32, 4 + (seed % 3)]} />
        <meshStandardMaterial color={snowColor} roughness={0.4} emissive={snowColor} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
};

const MountainRange = ({ polygon, config }) => {
  const pts3D = useMemo(() => {
    const pts = polygon.points.map(p => ({
      x: (p[0] - viewWidth / 2) * SCALE,
      y: -(p[1] - viewHeight / 2) * SCALE,
    }));
    return (
      pts.length > 1 &&
      Math.abs(pts[0].x - pts[pts.length - 1].x) < 0.001 &&
      Math.abs(pts[0].y - pts[pts.length - 1].y) < 0.001
    ) ? pts.slice(0, -1) : pts;
  }, [polygon]);

  const peaks = useMemo(() => {
    const res = [];
    const xs = pts3D.map(p => p.x), ys = pts3D.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const SPACING = 5.5; // Spread peaks out a bit
    for (let gx = minX; gx <= maxX; gx += SPACING) {
      for (let gy = minY; gy <= maxY; gy += SPACING) {
        const seed = Math.floor((gx + 1000) * 13 + (gy + 1000) * 17);
        const px = gx + (halton2(seed % 100, 2) - 0.5) * SPACING * 0.85;
        const py = gy + (halton2(seed % 100, 3) - 0.5) * SPACING * 0.85;

        if (pointInPoly(px, py, pts3D)) {
          res.push({
            x: px, y: py,
            baseR: 4.5 + halton2(seed % 100, 4) * 6.5,
            height: 7.0 + halton2(seed % 100, 5) * 18.0,
            seed
          });
        }
      }
    }
    return res;
  }, [pts3D]);

  return (
    <group>
      {peaks.map((p, i) => (
        <SinglePeak key={i} {...p} config={config} />
      ))}
    </group>
  );
};

// ─────────────────────────────────────────────
// PLOT DETAILS (paths, lamps, trees, garden)
// ─────────────────────────────────────────────
const PlotDetails = ({ polygon, gateEdgeIdx, secondGateEdgeIdx = -1, cx, cy, config }) => {
  // --- Reconstruct clean points ---
  const pts = polygon.points.map(p => ({
    x: (p[0] - viewWidth / 2) * SCALE,
    y: -(p[1] - viewHeight / 2) * SCALE,
  }));
  const cleanPts = (
    pts.length > 1 &&
    Math.abs(pts[0].x - pts[pts.length - 1].x) < 0.001 &&
    Math.abs(pts[0].y - pts[pts.length - 1].y) < 0.001
  ) ? pts.slice(0, -1) : pts;
  const n = cleanPts.length;

  if (gateEdgeIdx < 0 || gateEdgeIdx >= n) return null;

  // ── Primary gate ──
  const gp1 = cleanPts[gateEdgeIdx];
  const gp2 = cleanPts[(gateEdgeIdx + 1) % n];
  const gateCx = (gp1.x + gp2.x) / 2;
  const gateCy = (gp1.y + gp2.y) / 2;

  // Path from primary gate → house center
  const pathDx = cx - gateCx, pathDy = cy - gateCy;
  const pathAngle = Math.atan2(pathDy, pathDx);
  const pathMidX = (gateCx + cx) / 2, pathMidY = (gateCy + cy) / 2;
  const pathW = 1.1;

  // Perpendicular to path (= along gate edge) — used for lamp placement
  const perpX = Math.cos(pathAngle + Math.PI / 2);
  const perpY = Math.sin(pathAngle + Math.PI / 2);
  const lampOff = pathW * 0.72;

  // ── Secondary gate (intersection plots) ──
  let sg1, sg2, sgCx, sgCy, sgPathAngle, sgPerpX, sgPerpY;
  const hasSecondGate = secondGateEdgeIdx !== -1 && secondGateEdgeIdx < n;

  if (hasSecondGate) {
    sg1 = cleanPts[secondGateEdgeIdx];
    sg2 = cleanPts[(secondGateEdgeIdx + 1) % n];
    sgCx = (sg1.x + sg2.x) / 2;
    sgCy = (sg1.y + sg2.y) / 2;
    const sgDx = cx - sgCx, sgDy = cy - sgCy;
    sgPathAngle = Math.atan2(sgDy, sgDx);
    sgPerpX = Math.cos(sgPathAngle + Math.PI / 2);
    sgPerpY = Math.sin(sgPathAngle + Math.PI / 2);
  }

  // ── Corner trees — flag gate corners for both gates ──
  const gateCorners = new Set([
    gateEdgeIdx,
    (gateEdgeIdx + 1) % n,
    ...(hasSecondGate ? [secondGateEdgeIdx, (secondGateEdgeIdx + 1) % n] : []),
  ]);

  const INSET = 0.9;
  const cornerTrees = cleanPts.map((pt, i) => {
    const toCx = cx - pt.x, toCy = cy - pt.y;
    const dist = Math.hypot(toCx, toCy) || 1;
    return {
      x: pt.x + (toCx / dist) * INSET,
      y: pt.y + (toCy / dist) * INSET,
      isGate: gateCorners.has(i),
      idx: i,
    };
  });

  // ── Garden beds flanking house ──
  const bedInset = 1.6, bedSideOff = 1.5;
  const gardenBeds = [1, -1].map(side => ({
    x: cx + Math.cos(pathAngle) * (-bedInset) + perpX * bedSideOff * side,
    y: cy + Math.sin(pathAngle) * (-bedInset) + perpY * bedSideOff * side,
    side,
  }));

  return (
    <>
      {/* ── Primary stone path (gate → house) ── */}
      <StonePath x1={gateCx} y1={gateCy} x2={cx} y2={cy} pathW={pathW} />

      {/* ── Secondary stone path (second gate → house) ── */}
      {hasSecondGate && (
        <StonePath x1={sgCx} y1={sgCy} x2={cx} y2={cy} pathW={pathW} />
      )}

      {/* ── Primary gate lamps ── */}
      <GateLamps
        gateCx={gateCx}
        gateCy={gateCy}
        perpX={perpX}
        perpY={perpY}
        pathAngle={pathAngle}
        lampOff={lampOff}
      />

      {/* ── Secondary gate lamps ── */}
      {hasSecondGate && (
        <GateLamps
          gateCx={sgCx}
          gateCy={sgCy}
          perpX={sgPerpX}
          perpY={sgPerpY}
          pathAngle={sgPathAngle}
          lampOff={lampOff}
        />
      )}

      {/* ── Centrepiece planter at primary path midpoint ── */}
      <mesh position={[pathMidX, pathMidY, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.38, 0.45, 0.20, 12]} />
        <meshStandardMaterial color="#a08060" roughness={0.88} />
      </mesh>
      <mesh position={[pathMidX, pathMidY, 0.43]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.30, 0.30, 0.07, 12]} />
        <meshStandardMaterial color="#2a7a4a" roughness={0.55} />
      </mesh>
      {/* Subtle ambient glow from planter */}
      <pointLight
        position={[pathMidX, pathMidY, 0.7]}
        color="#88ffaa"
        intensity={0.6}
        distance={4}
        decay={2}
      />

      {/* ── Garden beds flanking the house ── */}
      {gardenBeds.map(({ x: bx, y: by, side }) => (
        <group key={`bed-${side}`}>
          <mesh position={[bx, by, 0.315]} rotation={[0, 0, pathAngle]}>
            <planeGeometry args={[2.0, 0.9]} />
            <meshStandardMaterial color="#2d5a1b" roughness={0.98} />
          </mesh>
          {/* Low border around bed */}
          <mesh position={[bx, by, 0.33]} rotation={[0, 0, pathAngle]}>
            <planeGeometry args={[2.04, 0.94]} />
            <meshStandardMaterial color="#8b6914" roughness={0.99} transparent opacity={0.35} />
          </mesh>
          {FLOWER_OFFSETS.map(([fo, fs], fi) => (
            <mesh
              key={fi}
              position={[
                bx + Math.cos(pathAngle) * fo + perpX * fs * 0.45,
                by + Math.sin(pathAngle) * fo + perpY * fs * 0.45,
                0.355,
              ]}
            >
              <sphereGeometry args={[0.10, 7, 7]} />
              <meshStandardMaterial
                color={FLOWER_COLORS[fi]}
                emissive={FLOWER_COLORS[fi]}
                emissiveIntensity={0.15}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── Corner trees ── */}
      {cornerTrees.map((ct) => (
        <PlotTree
          key={`tree-${ct.idx}`}
          x={ct.x}
          y={ct.y}
          size={ct.isGate ? 0.5 : 1.0}
          variant={ct.idx}
        />
      ))}
    </>
  );
};

// ─────────────────────────────────────────────
// MAP MESH
// ─────────────────────────────────────────────
const MapMesh = ({ polygon, isSelected, onClick, config }) => {
  // FIX: Some background areas are labeled "Plot ???" but should be treated as mountains
  const polyType = (polygon.label === 'Plot ???') ? 'mountain' : polygon.type;

  const isPlot = polyType === 'plot' && polygon.id_num && polygon.id_num !== '???';
  const isRoad = polyType === 'road';
  const isHighway = polyType === 'highway';

  const { geometry, width, height, cx, cy } = useMemo(
    () => createGeometry(polygon.points, polyType), [polygon, polyType]
  );

  let colorHex = config.colors[polyType] || '#555555';
  
  const details = isPlot ? plotDetails[polygon.id_num] : null;

  if (isPlot) {
    if (isSelected) {
      colorHex = config.colors.plotActive;
    } else if (details?.isSold) {
      colorHex = config.colors.plotSold;
    } else if (details?.isHighInterest) {
      colorHex = config.colors.plotHighInterest;
    } else {
      colorHex = config.colors.plot;
    }
  }
  const color = hexToThreeColor(colorHex);

  const plotMinDim = Math.min(width, height);
  const houseScale = (plotMinDim * 0.8) / 2.5;

  // ── Highway / road markings ──
  const renderDashes = () => {
    if (!polygon.spines || polygon.spines.length === 0) return null;
    if (polygon.type === 'road') return null;

    const { points: spinePoints, width: spineWidth } = polygon.spines[0];
    const S = SCALE, VW = viewWidth, VH = viewHeight;

    const laneOffsets = isHighway ? [
      { type: 'edge', offset: -1.0 },
      { type: 'dashed', offset: -0.66 },
      { type: 'dashed', offset: -0.33 },
      { type: 'solid', offset: 0 },
      { type: 'dashed', offset: 0.33 },
      { type: 'dashed', offset: 0.66 },
      { type: 'edge', offset: 1.0 },
    ] : [{ type: 'dashed', offset: 0 }];

    const markingWidth = { solid: 0.18, dashed: 0.07, edge: 0.07 };
    const markingColor = { solid: '#FFD700', dashed: 'white', edge: 'white' };
    const DASH_LEN = 0.9, GAP_LEN = 0.6;
    const halfWidth = (spineWidth / 2) * S * 0.92;
    const dashes = [];

    laneOffsets.forEach((lane, laneIdx) => {
      let dashAccum = 0, drawing = true;

      for (let i = 0; i < spinePoints.length - 1; i++) {
        const p1 = spinePoints[i], p2 = spinePoints[i + 1];
        const x1 = (p1[0] - VW / 2) * S, y1 = -(p1[1] - VH / 2) * S;
        const x2 = (p2[0] - VW / 2) * S, y2 = -(p2[1] - VH / 2) * S;
        const dx = x2 - x1, dy = y2 - y1;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        if (segLen < 0.01) continue;

        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;
        const ox = Math.cos(perpAngle) * (lane.offset * halfWidth);
        const oy = Math.sin(perpAngle) * (lane.offset * halfWidth);
        const tx = (x1 + x2) / 2 + ox, ty = (y1 + y2) / 2 + oy;

        if (lane.type === 'solid' || lane.type === 'edge') {
          dashes.push(
            <mesh key={`${laneIdx}-${i}`} position={[tx, ty, 0.12]} rotation={[0, 0, angle]}>
              <planeGeometry args={[segLen + 0.01, markingWidth[lane.type]]} />
              <meshBasicMaterial color={markingColor[lane.type]} transparent
                opacity={lane.type === 'solid' ? 0.95 : 0.7} />
            </mesh>
          );
          continue;
        }

        dashAccum += segLen;
        if (dashAccum >= (drawing ? DASH_LEN : GAP_LEN)) { dashAccum = 0; drawing = !drawing; }
        if (drawing) {
          dashes.push(
            <mesh key={`${laneIdx}-${i}`} position={[tx, ty, 0.12]} rotation={[0, 0, angle]}>
              <planeGeometry args={[segLen, markingWidth.dashed]} />
              <meshBasicMaterial color="white" transparent opacity={0.65} />
            </mesh>
          );
        }
      }
    });
    return dashes;
  };

  // Layering order (Y-index)
  let yPos = 0;
  if (isSelected) yPos = 0.5;
  else if (isRoad || isHighway) yPos = 0.01;
  else if (polyType === 'water') yPos = 0.005;
  else if (polyType === 'mountain') yPos = 0.0;

  return (
    <group
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => { 
        if (isPlot && !details?.isSold) { 
          e.stopPropagation(); 
          onClick(polygon); 
        } 
      }}
      position={[0, yPos, 0]}
    >
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          color={color}
          roughness={isRoad || isHighway ? 0.95 : (polyType === 'water' ? 0.1 : 0.8)}
          metalness={polyType === 'water' ? 0.4 : 0.1}
          emissive={isSelected ? color : (polyType === 'water' ? color : 0x000000)}
          emissiveIntensity={isSelected ? 0.35 : (polyType === 'water' ? 0.15 : 0)}
          transparent={polyType === 'water'}
          opacity={polyType === 'water' ? 0.85 : 1.0}
          flatShading={polyType === 'mountain'}
        />
      </mesh>

      {(isRoad || isHighway) && renderDashes()}
      {/* Dense forest for green areas */}
      {polygon.type === 'green' && <GreenAreaForest polygon={polygon} />}

      {polygon.type === 'water' && <WaterDetails polygon={polygon} />}
      {/* {polyType === 'mountain' && <MountainRange polygon={polygon} config={config} />} */}

      {isPlot && !details?.isSold && (
        <group
          position={[cx, cy, 0.3]}
          rotation={[Math.PI / 2, (plotFacingData[polygon.label]?.angle || 0) + HOUSE_FRONT_OFFSET, 0]}
        >
          {config.plotFeature?.type === 'house' ? (
            <Farmhouse 
              scale={houseScale * (config.plotFeature.houseScale || 1)} 
              isVisible={isSelected} 
            />
          ) : (
            <Gazebo 
              scale={houseScale * (config.plotFeature.gazeboScale || 1.25)} 
              isVisible={isSelected} 
              config={config}
            />
          )}
        </group>
      )}

      {isPlot && details?.isSold && (
        <group
          position={[cx + 1.5, cy + 1.5, 0.3]} // Offset from center
          rotation={[Math.PI / 2, -1.555 + HOUSE_FRONT_OFFSET, 0]}
        >
          <SoldSign scale={houseScale * 0.8} />
        </group>
      )}

      {isPlot && (config.plotBoundary.showAllPlots || isSelected) && config.plotBoundary.isVisible && (
        <PlotBoundaryWall
          polygon={polygon}
          gateEdgeIdx={plotFacingData[polygon.label]?.gateEdgeIdx ?? -1}
          secondGateEdgeIdx={plotFacingData[polygon.label]?.secondGateEdgeIdx ?? -1}
          config={config}
        />
      )}
      {isPlot && isSelected && (
        <PlotDetails
          polygon={polygon}
          gateEdgeIdx={plotFacingData[polygon.label]?.gateEdgeIdx ?? -1}
          secondGateEdgeIdx={plotFacingData[polygon.label]?.secondGateEdgeIdx ?? -1}
          cx={cx}
          cy={cy}
          config={config}
        />
      )}


      {isPlot && polygon.id_num && (
        <Text position={[cx, cy, 0.35]} fontSize={0.8} color="white" anchorX="center" anchorY="middle">
          {polygon.id_num}
        </Text>
      )}
    </group>
  );
};

// ─────────────────────────────────────────────
// TRAFFIC
// ─────────────────────────────────────────────
const MovingCar = ({ path, speed, initialOffset, color, reverse = false }) => {
  const meshRef = useRef();
  const [curve] = useState(() => {
    const v3Points = path.map(p => new THREE.Vector3(p[0], 0.25, -p[1]));
    return new THREE.CatmullRomCurve3(v3Points);
  });

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = ((state.clock.elapsedTime * speed + initialOffset) % 1);
    const actualT = reverse ? 1 - t : t;
    const pos = curve.getPointAt(actualT);
    const tangent = curve.getTangentAt(actualT);
    meshRef.current.position.copy(pos);
    meshRef.current.lookAt(pos.clone().add(tangent.clone().multiplyScalar(reverse ? -1 : 1)));
  });

  return (
    <group ref={meshRef}>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.6, 0.4, 1.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.5, -0.1]}>
        <boxGeometry args={[0.5, 0.3, 0.6]} />
        <meshStandardMaterial color={color} opacity={0.8} transparent />
      </mesh>
      <mesh position={[0.2, 0.2, 0.6]}>
        <boxGeometry args={[0.1, 0.1, 0.05]} />
        <meshBasicMaterial color="yellow" />
      </mesh>
      <mesh position={[-0.2, 0.2, 0.6]}>
        <boxGeometry args={[0.1, 0.1, 0.05]} />
        <meshBasicMaterial color="yellow" />
      </mesh>
    </group>
  );
};

const Traffic = ({ config }) => {
  const highwaySegments = useMemo(() =>
    vectorsData.filter(d => d.type === 'highway' && d.spines?.length > 0), []);

  const carColors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#34495e', '#ecf0f1'];
  const trafficNodes = [];

  highwaySegments.forEach((highway, segIdx) => {
    const { points: spinePoints, width: spineWidth } = highway.spines[0];
    const S = SCALE, VW = viewWidth, VH = viewHeight;
    const halfWidth = (spineWidth / 2) * S * 0.92;

    const laneCenters = [
      { offset: -0.83, reverse: false },
      { offset: -0.5, reverse: false },
      { offset: -0.16, reverse: false },
      { offset: 0.16, reverse: true },
      { offset: 0.5, reverse: true },
      { offset: 0.83, reverse: true },
    ];

    laneCenters.forEach((lane, lIdx) => {
      const lanePath = [];
      for (let i = 0; i < spinePoints.length - 1; i++) {
        const p1 = spinePoints[i], p2 = spinePoints[i + 1];
        const x1 = (p1[0] - VW / 2) * S, y1 = -(p1[1] - VH / 2) * S;
        const x2 = (p2[0] - VW / 2) * S, y2 = -(p2[1] - VH / 2) * S;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.01) continue;
        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;
        const ox = Math.cos(perpAngle) * lane.offset * halfWidth;
        const oy = Math.sin(perpAngle) * lane.offset * halfWidth;
        lanePath.push([x1 + ox, y1 + oy]);
        if (i === spinePoints.length - 2) lanePath.push([x2 + ox, y2 + oy]);
      }
      if (lanePath.length < 2) return;

      const carsPerLane = 3 + Math.floor(Math.random() * 2);
      for (let c = 0; c < carsPerLane; c++) {
        trafficNodes.push(
          <MovingCar
            key={`car-${segIdx}-${lIdx}-${c}`}
            path={lanePath}
            speed={0.04 + Math.random() * 0.02}
            initialOffset={Math.random()}
            color={carColors[Math.floor(Math.random() * carColors.length)]}
            reverse={lane.reverse}
          />
        );
      }
    });
  });

  return <group>{trafficNodes}</group>;
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
const InteractiveMap3D = () => {
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [mapConfig, setMapConfig] = useState(DEFAULT_MAP_CONFIG);

  const handleColorChange = (key, value) =>
    setMapConfig(prev => ({ ...prev, colors: { ...prev.colors, [key]: value } }));

  const handleToggleChange = (category, key, value) =>
    setMapConfig(prev => ({ ...prev, [category]: { ...prev[category], [key]: value } }));

  const handlePlotClick = (plot) => {
    if (selectedPlot && selectedPlot.label === plot.label) {
      resetCamera();
    } else {
      setSelectedPlot(plot);
      setIsResetting(false);
    }
  };
  const resetCamera = () => { setSelectedPlot(null); setIsResetting(true); };


  return (
    <div className="map-container" style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0a1208' }}>

      <div className="brand-overlay">
        <div className="brand-badge">
          <div className="lotus-icon">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 20C55 35 75 40 85 50C75 60 55 65 50 80C45 65 25 60 15 50C25 40 45 35 50 20Z" stroke="#c8d96a" strokeWidth="2" />
              <path d="M50 35C53 45 65 48 72 54C65 60 53 63 50 73C47 63 35 60 28 54C35 48 47 45 50 35Z" stroke="#c8d96a" strokeWidth="1.5" opacity="0.7" />
              <path d="M50 10V90M10 50H90" stroke="#c8d96a" strokeWidth="0.5" opacity="0.3" />
            </svg>
          </div>
          <div className="brand-names">
            <h1 className="brand-main">SAPPHIRE</h1>
            <h2 className="brand-sub">Farms</h2>
          </div>
        </div>
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 100, 50], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <color attach="background" args={[mapConfig.colors.background]} />
        <fog attach="fog" args={[mapConfig.colors.fog, 100, 800]} />

        <ambientLight color={0x7aaa5a} intensity={1.5} />
        <directionalLight castShadow color={0xfff3d0} intensity={2.5} position={[20, 80, 20]} shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-200, 200, 200, -200, 0.5, 300]} />
        </directionalLight>
        <directionalLight color={0x3a6a8a} intensity={1.0} position={[-40, 40, -40]} />
        <hemisphereLight args={[0x4a8a3a, 0x1a3010, 1.2]} />

        <CameraController
          selectedPlot={selectedPlot}
          isResetting={isResetting}
          onResetComplete={() => setIsResetting(false)}
        />

        <Traffic config={mapConfig} />

        <group>
          {cleanMapData.map((polygon, index) => (
            <MapMesh
              key={`${polygon.label || 'poly'}-${index}`}
              polygon={polygon}
              isSelected={selectedPlot && selectedPlot.label === polygon.label}
              onClick={handlePlotClick}
              config={mapConfig}
            />
          ))}
        </group>

        <group rotation={[-Math.PI / 2, 0, 0]}>
          {mapConfig.campusBoundary.isVisible && <CampusBoundary config={mapConfig} />}
        </group>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[mapConfig.geometry.groundSize, mapConfig.geometry.groundSize]} />
          <meshLambertMaterial color={hexToThreeColor(mapConfig.colors.ground)} />
        </mesh>

      </Canvas>

      <div className="view-controls">
        <button className={`view-btn icon-btn ${!selectedPlot ? 'active' : ''}`} onClick={resetCamera} title="Default View">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
        <button className={`view-btn icon-btn ${showConfig ? 'active' : ''}`} onClick={() => setShowConfig(!showConfig)} title="Map Configuration">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
            <path d="M12 8v4" /><path d="M12 16h.01" />
          </svg>
        </button>
      </div>

      {showConfig && (
        <div className="theme-editor-overlay">
          <div className="theme-editor-header">
            <h3>MAP AESTHETICS</h3>
            <button onClick={() => setShowConfig(false)}>✕</button>
          </div>
          <div className="theme-editor-scroll">
            <div className="theme-editor-section">
              <h4>VISIBILITY</h4>
              <div className="theme-editor-item toggle">
                <label>PLOT BOUNDARIES</label>
                <input
                  type="checkbox"
                  checked={mapConfig.plotBoundary.isVisible}
                  onChange={(e) => handleToggleChange('plotBoundary', 'isVisible', e.target.checked)}
                />
              </div>
              <div className="theme-editor-item toggle">
                <label>CAMPUS BOUNDARY</label>
                <input
                  type="checkbox"
                  checked={mapConfig.campusBoundary.isVisible}
                  onChange={(e) => handleToggleChange('campusBoundary', 'isVisible', e.target.checked)}
                />
              </div>
            </div>

            <div className="theme-editor-section">
              <h4>COLORS</h4>
              {Object.entries(mapConfig.colors).map(([key, value]) => (
                <div key={key} className="theme-editor-item">
                  <label>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</label>
                  <input type="color" value={value} onChange={(e) => handleColorChange(key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`panel ${selectedPlot ? 'open' : ''}`}>
        <div className="panel-drag"></div>
        <div className="panel-header">
          <div>
            <div className="plot-name" id="pName">Farm {selectedPlot ? selectedPlot.id_num : ''}</div>
            <div className={`plot-status ${selectedPlot && plotDetails[selectedPlot.id_num]?.isSold ? 'status-sold' : 'status-available'}`} id="pStatus">
              {selectedPlot && plotDetails[selectedPlot.id_num]?.isSold ? 'Sold Out' : 'Available'}
            </div>
          </div>
          <button className="btn-close" onClick={resetCamera}>✕</button>
        </div>
        <div className="plot-price" id="pPrice">
          {selectedPlot && plotDetails[selectedPlot.id_num]?.isHighInterest ? '🔥🔥 High interest' : 'Price on Request'}
        </div>
        <div className="plot-stats">
          <div className="stat-box">
            <div className="stat-val">{selectedPlot ? selectedPlot.area || 'N/A' : '—'}</div>
            <div className="stat-lbl">Sq. Ft</div>
          </div>
          <div className="stat-box">
            <div className="stat-val" id="pFacing">
              {selectedPlot && plotDetails[selectedPlot.id_num] 
                ? `${plotDetails[selectedPlot.id_num].length_ft}' x ${plotDetails[selectedPlot.id_num].breadth_ft}'`
                : '—'}
            </div>
            <div className="stat-lbl">Dimensions</div>
          </div>
          <div className="stat-box"><div className="stat-val" id="pFacing">East</div><div className="stat-lbl">Facing</div></div>
        </div>
        <div className="plot-features">
          <span className="feature-tag">Premium</span>
          {selectedPlot && plotDetails[selectedPlot.id_num]?.isHighInterest && (
            <span className="feature-tag" style={{ background: '#ffd700', color: '#000' }}>High interest</span>
          )}
          <span className="feature-tag">Park Facing</span>
        </div>
        <div className="cta-row">
          <a
            href={`https://api.whatsapp.com/send?phone=919644271804&text=I'm interested in Farm ${selectedPlot ? selectedPlot.label : ''}`}
            target="_blank" rel="noopener noreferrer"
            className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center' }}
          >Enquire Now</a>
          <a href="tel:+919644271804" className="btn-secondary" style={{ textDecoration: 'none' }}>📞</a>
        </div>
      </div>
    </div>
  );
};

export default InteractiveMap3D;