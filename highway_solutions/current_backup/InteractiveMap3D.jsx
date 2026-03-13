import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import vectorsData from '../assets/full_map_vectors.json';
import { generateRoadGeometries } from '../utils/RoadGenerator';
import { Farmhouse } from './Farmhouse';
import './InteractiveMap.css';

// New precision map image size
const viewWidth = 1696;
const viewHeight = 2514;
// Scaling for 3D world (adjusted for new dimensions)
const SCALE = 0.08; 

// Colors based on prototype
const SC = {
  plot: 0x937B24, // muted gold
  plotActive: 0xD4A520, // bright gold
  resort: 0x884488, // Pinkish/Purple
  green: 0x3A8030, // Forest Green
  road: 0x1E88E5, // Sapphire Blue
  highway: 0x551111 // Deep Red
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
    />
  );
};

const MapMesh = ({ polygon, isSelected, onClick }) => {
  const isPlot = polygon.type === 'plot';
  const isRoad = polygon.type === 'road';
  
  const { geometry, width, height, cx, cy } = useMemo(() => createGeometry(polygon.points, isPlot, isRoad), [polygon]);

  // Determine color and properties
  const isHighway = polygon.type === 'highway';
  let color = SC[polygon.type] || 0x555555;
  if (isPlot) {
    color = isSelected ? SC.plotActive : SC.plot;
  }

  // Calculate dynamic scale for the farmhouse based on the plot dimensions
  const plotMinDim = Math.min(width, height);
  const houseScale = (plotMinDim * 0.8) / 2.5; 

  // Procedural Dash Logic (Follow Spine)
  const renderDashes = () => {
    if (!polygon.spines || polygon.spines.length === 0) return null;
    if (polygon.type === 'road') return null; // User requested to hide arterial road dashes
    
    const dashes = [];
    const S = SCALE; 
    const VW = viewWidth;
    const VH = viewHeight;

    // For Highway, we build 6 lanes: 
    // - 1 solid line in middle
    // - 2 dashed lines on EACH side
    const laneOffsets = isHighway ? [
        { type: 'dashed', offset: -2/3 },
        { type: 'dashed', offset: -1/3 },
        { type: 'solid',  offset: 0 },
        { type: 'dashed', offset: 1/3 },
        { type: 'dashed', offset: 2/3 }
    ] : [{ type: 'dashed', offset: 0 }];

    polygon.spines.forEach((spine, sIdx) => {
        const interval = isHighway ? 4.0 : 2.0;

        // Ensure we handle both old format (array of points) and new format (object with points and width)
        const spinePoints = Array.isArray(spine) ? spine : spine.points;
        const spineWidthPixels = (spine && spine.width) ? spine.width : 50; // Fallback to 50px if missing
        
        // Convert pixel width to 3D units
        const highwayHalfWidth3D = (spineWidthPixels / 2) * S;
        
        // For highway, we want the lines to sit ON TOP of the mesh (depth is 0.1)
        const zLevel = isHighway ? 0.12 : 0.035;

        laneOffsets.forEach((lane, lIdx) => {
            let distAccum = 0;
            // Spacing for 3 lanes on each side
            const perpOffset = lane.offset * highwayHalfWidth3D * 0.95; // 0.95 to keep lines slightly inside the edges

            for (let i = 0; i < spinePoints.length - 1; i++) {
                const p1 = spinePoints[i];
                const p2 = spinePoints[i+1];
                
                const x1_raw = (p1[0] - VW / 2) * S;
                const y1_raw = -(p1[1] - VH / 2) * S; 
                const x2_raw = (p2[0] - VW / 2) * S;
                const y2_raw = -(p2[1] - VH / 2) * S;

                const dx = x2_raw - x1_raw;
                const dy = y2_raw - y1_raw;
                const segLen = Math.sqrt(dx*dx + dy*dy);
                const angle = Math.atan2(dy, dx);
                const perpAngle = angle + Math.PI / 2;

                const ox = Math.cos(perpAngle) * perpOffset;
                const oy = Math.sin(perpAngle) * perpOffset;

                const x1 = x1_raw + ox;
                const y1 = y1_raw + oy;
                const x2 = x2_raw + ox;
                const y2 = y2_raw + oy;

                if (lane.type === 'solid') {
                    dashes.push(
                        <mesh 
                          key={`solid-${sIdx}-${i}-${lIdx}`} 
                          position={[(x1 + x2) / 2, (y1 + y2) / 2, zLevel]}
                          rotation={[0, 0, angle]}
                        >
                          <planeGeometry args={[segLen, isHighway ? 0.1 : 0.08]} />
                          <meshBasicMaterial color={0xffffff} opacity={0.9} transparent />
                        </mesh>
                    );
                } else {
                    while (distAccum < segLen) {
                        const ratio = distAccum / segLen;
                        const tx = x1 + dx * ratio;
                        const ty = y1 + dy * ratio;

                        dashes.push(
                            <mesh 
                              key={`dash-${sIdx}-${i}-${lIdx}-${distAccum}`} 
                              position={[tx, ty, zLevel]}
                              rotation={[0, 0, angle]}
                            >
                              <planeGeometry args={[1.5, 0.08]} />
                              <meshBasicMaterial color={0xffffff} opacity={0.6} transparent />
                            </mesh>
                        );
                        distAccum += interval;
                    }
                    distAccum -= segLen;
                }
            }
        });
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
        <group position={[cx, cy, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <Farmhouse scale={houseScale} isVisible={isSelected} />
        </group>
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

const InteractiveMap3D = () => {
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [isResetting, setIsResetting] = useState(false);

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
        <color attach="background" args={['#0a1208']} />
        {/* Pushed fog far out so we don't fade into blackness when zooming out */}
        <fog attach="fog" args={['#0a1208', 100, 800]} />

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

        {/* Polygons */}
        <group>
          {cleanMapData.map((polygon, index) => (
            <MapMesh 
              key={polygon.id || index} 
              polygon={polygon} 
              isSelected={selectedPlot?.id === polygon.id}
              onClick={handlePlotClick}
            />
          ))}
        </group>

        {/* Ground Plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshLambertMaterial color={0x2d5020} />
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
      </div>

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
