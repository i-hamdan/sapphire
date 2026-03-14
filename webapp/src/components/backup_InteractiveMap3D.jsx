import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import vectorsData from '../assets/full_map_vectors.json';
import { generateRoadGeometries } from '../utils/RoadGenerator';
import { Farmhouse } from './Farmhouse';
import { DEFAULT_MAP_CONFIG, hexToThreeColor } from '../config/mapConfig';
import './InteractiveMap.css';

// New precision map image size
const viewWidth = 1696;
const viewHeight = 2514;
// Scaling for 3D world (adjusted for new dimensions)
const SCALE = 0.08;

// --- Plot Orientation Utility ---
const INTERSECTION_PLOTS = new Set(['5', '54', '9', '22', '23', '36', '37', '43', '46', '49']);

// Computes the angle (in radians) from a plot center to the nearest arterial road edge
const computePlotFacingData = (data) => {
  const roads = data.filter(d => d.type === 'road');
  const plots = data.filter(d => d.type === 'plot');
  const result = {};

  plots.forEach(plot => {
    const { cx, cy } = createGeometry(plot.points, true, false);
    const isIntersection = INTERSECTION_PLOTS.has(String(plot.label).replace(/^Plot /, ''));

    const pts3D = plot.points.map(p => ({
      x: (p[0] - viewWidth / 2) * SCALE,
      y: -(p[1] - viewHeight / 2) * SCALE
    }));

    const n = pts3D.length;
    const isClosed =
      Math.abs(pts3D[0].x - pts3D[n - 1].x) < 0.001 &&
      Math.abs(pts3D[0].y - pts3D[n - 1].y) < 0.001;
    const edgeCount = isClosed ? n - 1 : n;

    // Collect ALL road contacts: { dist, angle, edgeIdx }
    const contacts = [];

    roads.forEach(road => {
      road.points.forEach((rp, i) => {
        if (i >= road.points.length - 1) return;
        const ax = (road.points[i][0] - viewWidth / 2) * SCALE;
        const ay = -(road.points[i][1] - viewHeight / 2) * SCALE;
        const bx = (road.points[i + 1][0] - viewWidth / 2) * SCALE;
        const by = -(road.points[i + 1][1] - viewHeight / 2) * SCALE;

        const dx = bx - ax, dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        const t = lenSq > 0
          ? Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lenSq))
          : 0;

        const closestX = ax + t * dx;
        const closestY = ay + t * dy;
        const dist = Math.hypot(cx - closestX, cy - closestY);
        const angle = Math.atan2(closestY - cy, closestX - cx);

        // Find which plot edge is closest to this road contact
        let bestEdgeDist = Infinity;
        let bestEdgeIdx = 0;
        for (let j = 0; j < edgeCount; j++) {
          const pA = pts3D[j];
          const pB = pts3D[(j + 1) % edgeCount];
          const mx = (pA.x + pB.x) / 2;
          const my = (pA.y + pB.y) / 2;
          const d = Math.hypot(mx - closestX, my - closestY);
          if (d < bestEdgeDist) {
            bestEdgeDist = d;
            bestEdgeIdx = j;
          }
        }

        contacts.push({ dist, angle, edgeIdx: bestEdgeIdx });
      });
    });

    // Sort by distance — primary is the closest
    contacts.sort((a, b) => a.dist - b.dist);

    const primary = contacts[0] ?? { angle: 0, edgeIdx: 0 };

    let secondaryEdgeIdx = -1;

    if (isIntersection) {
      // Find the next contact that:
      // (a) maps to a different plot edge
      // (b) approaches from a meaningfully different direction (>60°)
      const MIN_ANGLE_DIFF = Math.PI / 3; // 60 degrees

      for (const c of contacts) {
        if (c.edgeIdx === primary.edgeIdx) continue;

        const angleDiff = Math.abs(
          ((c.angle - primary.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        );

        if (angleDiff > MIN_ANGLE_DIFF) {
          secondaryEdgeIdx = c.edgeIdx;
          break;
        }
      }
    }

    result[plot.label] = {
      angle: primary.angle,
      gateEdgeIdx: primary.edgeIdx,
      secondGateEdgeIdx: secondaryEdgeIdx, // -1 if not an intersection plot
    };
  });

  return result;
};


// Generate an ExtrudeGeometry from polygon points
const createGeometry = (points, isPlot, isRoad) => {
  const shape = new THREE.Shape();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  points.forEach((p, i) => {
    let x, y;
    if (p.length === 2 && Array.isArray(p)) {
      x = (p[0] - viewWidth / 2) * SCALE;
      y = -(p[1] - viewHeight / 2) * SCALE;
    } else {
      x = p[0];
      y = p[1];
    }

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });

  const extrudeSettings = {
    depth: isPlot ? 0.3 : (isRoad ? 0.02 : 0.1), // Plots pop up higher, roads very flat
    bevelEnabled: isPlot,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02
  };

  return {
    geometry: new THREE.ExtrudeGeometry(shape, extrudeSettings),
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2
  };
};

// Use the precise vectorized data directly
const cleanMapData = vectorsData;

// Compute angles once (Must be after cleanMapData and createGeometry)
const plotFacingData = computePlotFacingData(cleanMapData);

// --- Farmhouse Orientation Config ---
// Which direction is the "front" of the house model? 
// Adjust this to face the road correctly. 
// Options: 0, Math.PI / 2, Math.PI, -Math.PI / 2
const HOUSE_FRONT_OFFSET = -Math.PI / 2;

// Cinematic Camera Controller
const CameraController = ({ selectedPlot, isResetting, onResetComplete }) => {
  const { camera } = useThree();
  const controlsRef = useRef();

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    let targetPos = new THREE.Vector3();
    let targetLook = new THREE.Vector3();

    if (selectedPlot) {
      // Find the plot in the map data to get its center
      const tempGeom = createGeometry(selectedPlot.points, true, false);
      const cx = tempGeom.cx;
      const cy = tempGeom.cy;
      const plotCenter = new THREE.Vector3(cx, 0, -cy);

      const rotationSpeed = 0.4;
      const radius = 50;
      const angle = state.clock.elapsedTime * rotationSpeed;

      const offsetX = Math.sin(angle) * radius;
      const offsetZ = Math.cos(angle) * radius;
      targetPos.copy(plotCenter).add(new THREE.Vector3(offsetX, 35, offsetZ));

      const framingOffset = 18;
      const lookOffset = new THREE.Vector3(
        Math.sin(angle) * framingOffset,
        0,
        Math.cos(angle) * framingOffset
      );
      targetLook.copy(plotCenter).add(lookOffset);

      // Continuous lock for selected plot
      camera.position.lerp(targetPos, 3 * delta);
      controlsRef.current.target.lerp(targetLook, 3 * delta);
    } else if (isResetting) {
      // Return to default birds-eye view
      targetPos.set(0, 100, 50);
      targetLook.set(0, 0, 0);

      camera.position.lerp(targetPos, 3 * delta);
      controlsRef.current.target.lerp(targetLook, 3 * delta);

      // Check if we are close enough to stop "resetting" and allow free movement
      if (camera.position.distanceTo(targetPos) < 0.5 && controlsRef.current.target.distanceTo(targetLook) < 0.5) {
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
      minDistance={5}
      maxDistance={300}
      maxPolarAngle={Math.PI / 2.1} // Prevent going below ground
      touches={{
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_ROTATE
      }}
    />
  );
};

const MapMesh = ({ polygon, isSelected, onClick, config }) => {
  const isPlot = polygon.type === 'plot';
  const isRoad = polygon.type === 'road';

  const { geometry, width, height, cx, cy } = useMemo(() => createGeometry(polygon.points, isPlot, isRoad), [polygon]);

  // Determine color and properties
  const isHighway = polygon.type === 'highway';
  let colorHex = config.colors[polygon.type] || "#555555";
  if (isPlot) {
    colorHex = isSelected ? config.colors.plotActive : config.colors.plot;
  }
  const color = hexToThreeColor(colorHex);

  // Calculate dynamic scale for the farmhouse based on the plot dimensions
  const plotMinDim = Math.min(width, height);
  const houseScale = (plotMinDim * 0.8) / 2.5;

  // Procedural Dash Logic (Follow Spine)
  const renderDashes = () => {
    if (!polygon.spines || polygon.spines.length === 0) return null;
    if (polygon.type === 'road') return null; // HIDDEN for arterial roads

    const { points: spinePoints, width: spineWidth } = polygon.spines[0];
    const S = SCALE;
    const VW = viewWidth;
    const VH = viewHeight;

    // Set 2 Configuration
    const laneOffsets = isHighway ? [
      { type: 'edge', offset: -1.0 }, // Left road edge (solid)
      { type: 'dashed', offset: -0.66 }, // Left outer lane divider
      { type: 'dashed', offset: -0.33 }, // Left inner lane divider
      { type: 'solid', offset: 0 }, // ← CENTER MEDIAN (thick yellow)
      { type: 'dashed', offset: 0.33 }, // Right inner lane divider
      { type: 'dashed', offset: 0.66 }, // Right outer lane divider
      { type: 'edge', offset: 1.0 }, // Right road edge (solid)
    ] : [{ type: 'dashed', offset: 0 }];

    const markingWidth = {
      solid: 0.18,  // thick yellow median
      dashed: 0.07,  // thin white dashes
      edge: 0.07,  // thin white edge lines
    };

    const markingColor = {
      solid: '#FFD700', // yellow center median
      dashed: 'white',
      edge: 'white',
    };

    const DASH_LEN = 0.9;
    const GAP_LEN = 0.6;
    const halfWidth = (spineWidth / 2) * S * 0.92;

    const dashes = [];

    laneOffsets.forEach((lane, laneIdx) => {
      let dashAccum = 0; // accumulates distance along road
      let drawing = true; // start with a dash

      for (let i = 0; i < spinePoints.length - 1; i++) {
        const p1 = spinePoints[i];
        const p2 = spinePoints[i + 1];

        const x1 = (p1[0] - VW / 2) * S;
        const y1 = -(p1[1] - VH / 2) * S;
        const x2 = (p2[0] - VW / 2) * S;
        const y2 = -(p2[1] - VH / 2) * S;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        if (segLen < 0.01) continue;

        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;

        const ox = Math.cos(perpAngle) * (lane.offset * halfWidth);
        const oy = Math.sin(perpAngle) * (lane.offset * halfWidth);

        const tx = (x1 + x2) / 2 + ox;
        const ty = (y1 + y2) / 2 + oy;

        // Solid lines and edges
        if (lane.type === 'solid' || lane.type === 'edge') {
          dashes.push(
            <mesh key={`${laneIdx}-${i}`} position={[tx, ty, 0.12]} rotation={[0, 0, angle]}>
              <planeGeometry args={[segLen + 0.01, markingWidth[lane.type]]} />
              <meshBasicMaterial
                color={markingColor[lane.type]}
                transparent
                opacity={lane.type === 'solid' ? 0.95 : 0.7}
              />
            </mesh>
          );
          continue;
        }

        // Dashed lines: proper dash/gap rhythm
        dashAccum += segLen;
        const threshold = drawing ? DASH_LEN : GAP_LEN;

        if (dashAccum >= threshold) {
          dashAccum = 0;
          drawing = !drawing;
        }

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

  return (
    <group
      // Lay the shape flat on the XZ plane (rotate around X by -90 deg)
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => {
        if (isPlot) {
          e.stopPropagation(); // Only select this, don't cascade
          onClick(polygon);
        }
      }}
      // Float active plots, sink roads slightly below plots
      position={[0, isSelected ? 0.5 : (isRoad ? 0.01 : 0), 0]}
    >
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={color}
          roughness={isRoad ? 0.9 : 0.8}
          emissive={isSelected ? color : 0x000000}
          emissiveIntensity={isSelected ? 0.4 : 0}
        />
      </mesh>

      {/* Procedural dashes for all road types */}
      {(isRoad || isHighway) && renderDashes()}

      {/* Render the Farmhouse if it's a plot */}
      {isPlot && (
        <group
          position={[cx, cy, 0.3]}
          rotation={[Math.PI / 2, (plotFacingData[polygon.label]?.angle || 0) + HOUSE_FRONT_OFFSET, 0]}
        >
          <Farmhouse scale={houseScale} isVisible={isSelected} />
        </group>
      )}

      {/* Fence & Details — only visible when plot is selected */}
      {isPlot && isSelected && (
        <>
          <PlotFence
            polygon={polygon}
            gateEdgeIdx={plotFacingData[polygon.label]?.gateEdgeIdx ?? -1}
            secondGateEdgeIdx={plotFacingData[polygon.label]?.secondGateEdgeIdx ?? -1}
            config={config}
          />
          <PlotDetails
            polygon={polygon}
            gateEdgeIdx={plotFacingData[polygon.label]?.gateEdgeIdx ?? -1}
            secondGateEdgeIdx={plotFacingData[polygon.label]?.secondGateEdgeIdx ?? -1}
            cx={cx}
            cy={cy}
            config={config}
          />
        </>
      )}

      {isPlot && polygon.id_num && (
        <Text
          position={[cx, cy, 0.35]}
          fontSize={0.8}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {polygon.id_num}
        </Text>
      )}
    </group>
  );
};

// --- 3D Traffic System ---

const MovingCar = ({ path, speed, initialOffset, color, reverse = false }) => {
  const meshRef = useRef();
  const [curve] = useState(() => {
    // Convert 2D points to 3D curve (Y inversion for world Z)
    const v3Points = path.map(p => new THREE.Vector3(p[0], 0.25, -p[1]));
    return new THREE.CatmullRomCurve3(v3Points);
  });

  useFrame((state) => {
    if (!meshRef.current) return;

    // Smooth looping animation
    const time = state.clock.elapsedTime * speed + initialOffset;
    const t = (time % 1);
    const actualT = reverse ? 1 - t : t;

    const pos = curve.getPointAt(actualT);
    const tangent = curve.getTangentAt(actualT);

    meshRef.current.position.copy(pos);

    // Rotation lookAt
    const lookAtPos = pos.clone().add(tangent.clone().multiplyScalar(reverse ? -1 : 1));
    meshRef.current.lookAt(lookAtPos);
  });

  return (
    <group ref={meshRef}>
      {/* Car Body */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.6, 0.4, 1.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.5, -0.1]}>
        <boxGeometry args={[0.5, 0.3, 0.6]} />
        <meshStandardMaterial color={color} opacity={0.8} transparent />
      </mesh>
      {/* Headlights */}
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
  const highwaySegments = useMemo(() => {
    return vectorsData.filter(d => d.type === 'highway' && d.spines && d.spines.length > 0);
  }, []);

  const carColors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#34495e', '#ecf0f1'];

  const trafficNodes = [];

  highwaySegments.forEach((highway, segIdx) => {
    const spine = highway.spines[0];
    const spinePoints = spine.points;
    const spineWidth = spine.width;
    const S = SCALE;
    const VW = viewWidth;
    const VH = viewHeight;

    const halfWidth = (spineWidth / 2) * S * 0.92;

    // Center offsets for the 6 lanes
    // Lane 1-3 (Bottom/Left of median), Lane 4-6 (Top/Right of median)
    const laneCenters = [
      { offset: -0.83, reverse: false }, // Outer bottom (L-to-R)
      { offset: -0.5, reverse: false }, // Middle bottom (L-to-R)
      { offset: -0.16, reverse: false }, // Inner bottom (L-to-R)
      { offset: 0.16, reverse: true },  // Inner top (R-to-L)
      { offset: 0.5, reverse: true },  // Middle top (R-to-L)
      { offset: 0.83, reverse: true },  // Outer top (R-to-L)
    ];

    laneCenters.forEach((lane, lIdx) => {
      // Create path for this specific lane
      const lanePath = [];
      for (let i = 0; i < spinePoints.length - 1; i++) {
        const p1 = spinePoints[i];
        const p2 = spinePoints[i + 1];

        // Exact same mapping as renderDashes
        const x1 = (p1[0] - VW / 2) * S;
        const y1 = -(p1[1] - VH / 2) * S;
        const x2 = (p2[0] - VW / 2) * S;
        const y2 = -(p2[1] - VH / 2) * S;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.01) continue;

        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;

        const laneOffsetAmount = lane.offset * halfWidth;
        const ox = Math.cos(perpAngle) * laneOffsetAmount;
        const oy = Math.sin(perpAngle) * laneOffsetAmount;

        lanePath.push([x1 + ox, y1 + oy]);
        if (i === spinePoints.length - 2) {
          lanePath.push([x2 + ox, y2 + oy]);
        }
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

const FENCE_POST_H = 0.45;
const FENCE_POST_W = 0.07;
const FENCE_POST_GAP = 0.9;   // distance between posts
const FENCE_SURFACE_Z = 0.31; // just above plot surface

const FenceSegment = ({ x1, y1, x2, y2, railColor = "#7a5c2e", postColor = "#5c3d1a" }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.15) return null;

  const angle = Math.atan2(dy, dx);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  const numPosts = Math.max(2, Math.round(len / FENCE_POST_GAP) + 1);
  const elements = [];

  // Two horizontal rails
  [0.15, 0.35].forEach((rz, ri) => {
    elements.push(
      <mesh key={`rail-${ri}`} position={[mx, my, FENCE_SURFACE_Z + rz]} rotation={[0, 0, angle]}>
        <boxGeometry args={[len, 0.05, 0.04]} />
        <meshStandardMaterial color={railColor} roughness={0.9} />
      </mesh>
    );
  });

  // Vertical posts
  for (let i = 0; i < numPosts; i++) {
    const t = numPosts === 1 ? 0.5 : i / (numPosts - 1);
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    elements.push(
      <mesh key={`post-${i}`} position={[px, py, FENCE_SURFACE_Z + FENCE_POST_H / 2]}>
        <boxGeometry args={[FENCE_POST_W, FENCE_POST_W, FENCE_POST_H]} />
        <meshStandardMaterial color={postColor} roughness={0.95} />
      </mesh>
    );
  }

  return <>{elements}</>;
};

const GATE_OPENING_RATIO = 0.38; // 38% of the gate edge is open

const PlotFence = ({ polygon, gateEdgeIdx, secondGateEdgeIdx = -1, config }) => {
  const pts = polygon.points.map(p => ({
    x: (p[0] - viewWidth / 2) * SCALE,
    y: -(p[1] - viewHeight / 2) * SCALE
  }));

  // Deduplicate: if last point == first point, drop it (we handle closure manually)
  const cleanPts = (
    pts.length > 1 &&
    Math.abs(pts[0].x - pts[pts.length - 1].x) < 0.001 &&
    Math.abs(pts[0].y - pts[pts.length - 1].y) < 0.001
  ) ? pts.slice(0, -1) : pts;

  const n = cleanPts.length;
  const gateEdges = new Set(
    [gateEdgeIdx, secondGateEdgeIdx].filter(idx => idx !== -1)
  );
  const segments = [];

  for (let i = 0; i < n; i++) {
    const p1 = cleanPts[i];
    const p2 = cleanPts[(i + 1) % n]; // ✅ wraps last→first

    if (gateEdges.has(i)) {
      // Split this edge: fence on both sides, gap in the middle
      const gapStart = (1 - GATE_OPENING_RATIO) / 2;
      const gapEnd = 1 - gapStart;

      const lx2 = p1.x + gapStart * (p2.x - p1.x);
      const ly2 = p1.y + gapStart * (p2.y - p1.y);
      const rx1 = p1.x + gapEnd * (p2.x - p1.x);
      const ry1 = p1.y + gapEnd * (p2.y - p1.y);

      segments.push(
        <FenceSegment
          key={`f-${i}-L`}
          x1={p1.x} y1={p1.y}
          x2={lx2} y2={ly2}
          railColor={config.colors.fenceRail}
          postColor={config.colors.fencePost}
        />,
        <FenceSegment
          key={`f-${i}-R`}
          x1={rx1} y1={ry1}
          x2={p2.x} y2={p2.y}
          railColor={config.colors.fenceRail}
          postColor={config.colors.fencePost}
        />
      );
    } else {
      segments.push(
        <FenceSegment
          key={`f-${i}`}
          x1={p1.x} y1={p1.y}
          x2={p2.x} y2={p2.y}
          railColor={config.colors.fenceRail}
          postColor={config.colors.fencePost}
        />
      );
    }
  }

  return <>{segments}</>;
};

// --- NEW DECORATIVE COMPONENTS ---

const PlotTree = ({ x, y, size = 1.0, variant = 0 }) => {
  const TRUNK_H = 1.1 * size;
  const FOLI_R = 0.7 * size;
  const BASE_Z = 0.32;
  const greens = ['#2a6e2a', '#3d8c3d', '#1a5c1a', '#4a9e4a', '#2e7d32'];
  const c1 = greens[variant % greens.length];
  const c2 = greens[(variant + 2) % greens.length];

  return (
    <group>
      {/* Trunk */}
      <mesh position={[x, y, BASE_Z + TRUNK_H / 2]}>
        <boxGeometry args={[0.1 * size, 0.1 * size, TRUNK_H]} />
        <meshStandardMaterial color="#5c3d1a" roughness={0.95} />
      </mesh>
      {/* Foliage — 3 layered cones */}
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

const FLOWER_OFFSETS = [
  [-0.55, -0.22], [0.0, 0.25], [0.52, -0.12],
  [-0.28, 0.30], [0.35, 0.18]
];
const FLOWER_COLORS = ['#e74c3c', '#f39c12', '#9b59b6', '#e91e8c', '#e74c3c'];

const PlotDetails = ({ polygon, gateEdgeIdx, secondGateEdgeIdx = -1, cx, cy, config }) => {
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

  const gp1 = cleanPts[gateEdgeIdx];
  const gp2 = cleanPts[(gateEdgeIdx + 1) % n];
  const gateCx = (gp1.x + gp2.x) / 2;
  const gateCy = (gp1.y + gp2.y) / 2;

  const pathDx = cx - gateCx;
  const pathDy = cy - gateCy;
  const pathLen = Math.sqrt(pathDx * pathDx + pathDy * pathDy);
  const pathAngle = Math.atan2(pathDy, pathDx);
  const pathMidX = (gateCx + cx) / 2;
  const pathMidY = (gateCy + cy) / 2;
  const pathW = 1.1;

  const perpX = Math.cos(pathAngle + Math.PI / 2);
  const perpY = Math.sin(pathAngle + Math.PI / 2);

  const INSET = 0.9;
  const cornerTrees = cleanPts.map((pt, i) => {
    const toCx = cx - pt.x;
    const toCy = cy - pt.y;
    const dist = Math.hypot(toCx, toCy) || 1;
    const isGateCorner = (i === gateEdgeIdx || i === (gateEdgeIdx + 1) % n);
    return {
      x: pt.x + (toCx / dist) * INSET,
      y: pt.y + (toCy / dist) * INSET,
      isGate: isGateCorner,
      idx: i,
    };
  });

  const stoneCount = Math.max(2, Math.floor(pathLen / 0.75));
  const stoneAlternate = 0.18;

  const bedInset = 1.6;
  const bedSideOff = 1.5;
  const gardenBeds = [1, -1].map(side => ({
    x: cx + Math.cos(pathAngle) * (-bedInset) + perpX * bedSideOff * side,
    y: cy + Math.sin(pathAngle) * (-bedInset) + perpY * bedSideOff * side,
    side,
  }));

  const lampOff = pathW * 0.72;

  return (
    <>
      <mesh position={[pathMidX, pathMidY, 0.315]} rotation={[0, 0, pathAngle]}>
        <planeGeometry args={[pathLen, pathW]} />
        <meshStandardMaterial color="#c8a870" roughness={0.97} />
      </mesh>

      {Array.from({ length: stoneCount }).map((_, i) => {
        const t = (i + 0.5) / stoneCount;
        const sx = gateCx + t * pathDx;
        const sy = gateCy + t * pathDy;
        const alt = (i % 2 === 0 ? stoneAlternate : -stoneAlternate);
        const twist = (i % 3 - 1) * 0.15;
        return (
          <mesh
            key={`stone-${i}`}
            position={[sx + perpX * alt, sy + perpY * alt, 0.323]}
            rotation={[0, 0, pathAngle + twist]}
          >
            <planeGeometry args={[0.42, 0.28]} />
            <meshStandardMaterial color="#dcc494" roughness={0.99} />
          </mesh>
        );
      })}

      {[1, -1].map((side, si) => {
        const lx = gateCx + perpX * lampOff * side;
        const ly = gateCy + perpY * lampOff * side;
        return (
          <group key={`lamp-${si}`}>
            <mesh position={[lx, ly, 0.32 + 0.55]}>
              <boxGeometry args={[0.07, 0.07, 1.1]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[lx, ly, 0.32 + 1.12]}>
              <boxGeometry args={[0.18, 0.07, 0.05]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[lx, ly, 0.32 + 1.28]}>
              <sphereGeometry args={[0.13, 10, 10]} />
              <meshStandardMaterial
                color="#fff8dc"
                emissive="#ffd966"
                emissiveIntensity={2.0}
                roughness={0.1}
              />
            </mesh>
          </group>
        );
      })}

      {/* Secondary gate lamps — intersection plots only */}
      {secondGateEdgeIdx !== -1 && secondGateEdgeIdx < n && (() => {
        const sg1 = cleanPts[secondGateEdgeIdx];
        const sg2 = cleanPts[(secondGateEdgeIdx + 1) % n];
        const sgCx = (sg1.x + sg2.x) / 2;
        const sgCy = (sg1.y + sg2.y) / 2;

        // Perpendicular to the second gate edge
        const sgDx = sg2.x - sg1.x;
        const sgDy = sg2.y - sg1.y;
        const sgAngle = Math.atan2(sgDy, sgDx);
        const sgPerpX = Math.cos(sgAngle + Math.PI / 2);
        const sgPerpY = Math.sin(sgAngle + Math.PI / 2);

        return [1, -1].map((side, si) => {
          const lx = sgCx + sgPerpX * lampOff * side;
          const ly = sgCy + sgPerpY * lampOff * side;
          return (
            <group key={`lamp2-${si}`}>
              <mesh position={[lx, ly, 0.32 + 0.55]}>
                <boxGeometry args={[0.07, 0.07, 1.1]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.6} />
              </mesh>
              <mesh position={[lx, ly, 0.32 + 1.12]}>
                <boxGeometry args={[0.18, 0.07, 0.05]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.6} />
              </mesh>
              <mesh position={[lx, ly, 0.32 + 1.28]}>
                <sphereGeometry args={[0.13, 10, 10]} />
                <meshStandardMaterial color="#fff8dc" emissive="#ffd966"
                  emissiveIntensity={2.0} roughness={0.1} />
              </mesh>
            </group>
          );
        });
      })()}

      <mesh position={[pathMidX, pathMidY, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.42, 0.18, 10]} />
        <meshStandardMaterial color="#a08060" roughness={0.9} />
      </mesh>
      <mesh position={[pathMidX, pathMidY, 0.415]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.06, 10]} />
        <meshStandardMaterial color="#2a7a4a" roughness={0.6} />
      </mesh>

      {gardenBeds.map(({ x: bx, y: by, side }) => (
        <group key={`bed-${side}`}>
          <mesh position={[bx, by, 0.315]} rotation={[0, 0, pathAngle]}>
            <planeGeometry args={[1.9, 0.85]} />
            <meshStandardMaterial color="#2d5a1b" roughness={0.98} />
          </mesh>
          {FLOWER_OFFSETS.map(([fo, fs], fi) => (
            <mesh
              key={fi}
              position={[
                bx + Math.cos(pathAngle) * fo + perpX * fs * 0.5,
                by + Math.sin(pathAngle) * fo + perpY * fs * 0.5,
                0.34
              ]}
            >
              <sphereGeometry args={[0.09, 6, 6]} />
              <meshBasicMaterial color={FLOWER_COLORS[fi]} />
            </mesh>
          ))}
        </group>
      ))}

      {cornerTrees.map((ct) => (
        <PlotTree
          key={`tree-${ct.idx}`}
          x={ct.x}
          y={ct.y}
          size={ct.isGate ? 0.55 : 0.95}
          variant={ct.idx}
        />
      ))}
    </>
  );
};

const InteractiveMap3D = () => {
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [mapConfig, setMapConfig] = useState(DEFAULT_MAP_CONFIG);

  const handleColorChange = (key, value) => {
    setMapConfig(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: value
      }
    }));
  };

  const handlePlotClick = (plot) => {
    setSelectedPlot(plot);
    setIsResetting(false);
  };

  const resetCamera = () => {
    setSelectedPlot(null);
    setIsResetting(true);
  };

  return (
    <div className="map-container" style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0a1208' }}>

      {/* Brand Overlay */}
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

      {/* Three.js Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 100, 50], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <color attach="background" args={[mapConfig.colors.background]} />
        {/* Pushed fog far out so we don't fade into blackness when zooming out */}
        <fog attach="fog" args={[mapConfig.colors.fog, 100, 800]} />

        {/* Lighting configuration optimized for both close-up and birds-eye zoom */}
        <ambientLight color={0x7aaa5a} intensity={1.5} />

        {/* Main Sun Light */}
        <directionalLight
          castShadow
          color={0xfff3d0}
          intensity={2.5}
          position={[20, 80, 20]}
          shadow-mapSize={[2048, 2048]}
        >
          {/* Extremely wide shadow camera bounds to ensure shadows don't clip when zoomed out */}
          <orthographicCamera attach="shadow-camera" args={[-200, 200, 200, -200, 0.5, 300]} />
        </directionalLight>

        {/* Secondary Fill Light */}
        <directionalLight color={0x3a6a8a} intensity={1.0} position={[-40, 40, -40]} />

        {/* Hemisphere light for soft environmental ground light */}
        <hemisphereLight args={[0x4a8a3a, 0x1a3010, 1.2]} />

        {/* Cinematic Camera Controller replaces standard OrbitControls */}
        <CameraController
          selectedPlot={selectedPlot}
          isResetting={isResetting}
          onResetComplete={() => setIsResetting(false)}
        />

        <Traffic config={mapConfig} />

        {/* Polygons */}
        <group>
          {cleanMapData.map((polygon, index) => (
            <MapMesh
              key={polygon.label || `poly-${index}`}
              polygon={polygon}
              isSelected={selectedPlot && selectedPlot.label === polygon.label}
              onClick={handlePlotClick}
              config={mapConfig}
            />
          ))}
        </group>

        {/* Ground Plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[mapConfig.geometry.groundSize, mapConfig.geometry.groundSize]} />
          <meshLambertMaterial color={hexToThreeColor(mapConfig.colors.ground)} />
        </mesh>
      </Canvas>

      {/* View Presets Panel */}
      <div className="view-controls">
        <button
          className={`view-btn icon-btn ${!selectedPlot ? 'active' : ''}`}
          onClick={resetCamera}
          title="Default View"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>

        {/* Theme Config Toggle */}
        <button
          className={`view-btn icon-btn ${showConfig ? 'active' : ''}`}
          onClick={() => setShowConfig(!showConfig)}
          title="Map Configuration"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
            <path d="M12 8v4" /><path d="M12 16h.01" />
          </svg>
        </button>
      </div>

      {/* Theme Configuration Editor */}
      {showConfig && (
        <div className="theme-editor-overlay">
          <div className="theme-editor-header">
            <h3>MAP AESTHETICS</h3>
            <button onClick={() => setShowConfig(false)}>✕</button>
          </div>
          <div className="theme-editor-scroll">
            {Object.entries(mapConfig.colors).map(([key, value]) => (
              <div key={key} className="theme-editor-item">
                <label>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</label>
                <input
                  type="color"
                  value={value}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HTML Overlay Panel */}
      <div className={`panel ${selectedPlot ? 'open' : ''}`}>
        <div className="panel-drag"></div>
        <div className="panel-header">
          <div>
            <div className="plot-name" id="pName">
              Farm {selectedPlot ? selectedPlot.label : ''}
            </div>
            <div className="plot-status status-available" id="pStatus">Available</div>
          </div>
          <button className="btn-close" onClick={resetCamera}>✕</button>
        </div>
        <div className="plot-price" id="pPrice">Price on Request</div>
        <div className="plot-stats">
          <div className="stat-box">
            <div className="stat-val">{selectedPlot ? selectedPlot.area || 'N/A' : '—'}</div>
            <div className="stat-lbl">Sq. Ft</div>
          </div>
          <div className="stat-box"><div className="stat-val" id="pFacing">East</div><div class="stat-lbl">Facing</div></div>
          <div className="stat-box"><div className="stat-val">{selectedPlot ? selectedPlot.label : '—'}</div><div className="stat-lbl">Farm No.</div></div>
        </div>
        <div className="plot-features">
          <span className="feature-tag">Premium</span>
          <span className="feature-tag">Park Facing</span>
        </div>
        <div className="cta-row">
          <a
            href={`https://api.whatsapp.com/send?phone=919644271804&text=I'm interested in Farm ${selectedPlot ? selectedPlot.label : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            Enquire Now
          </a>
          <a
            href="tel:+919644271804"
            className="btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            📞
          </a>
        </div>
      </div>

    </div>
  );
};

export default InteractiveMap3D;
