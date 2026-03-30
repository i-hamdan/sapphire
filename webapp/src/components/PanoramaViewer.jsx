import React, { useState, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, Loader } from '@react-three/drei';
import * as THREE from 'three';

const PanoramaSphere = ({ url }) => {
  const texture = useLoader(THREE.TextureLoader, url);
  texture.mapping = THREE.EquirectangularReflectionMapping;

  return (
    <mesh>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
};

export const PanoramaViewer = ({ isOpen, onClose, photoUrl, label }) => {
  if (!isOpen) return null;

  return (
    <div className="panorama-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header / Info bar */}
      <div className="panorama-header" style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        padding: '20px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            letterSpacing: '1px'
          }}>
            SAPPHIRE PANORAMA
          </div>
          <div style={{ 
            fontSize: '14px', 
            opacity: 0.8,
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '4px 12px',
            borderRadius: '20px',
            backdropFilter: 'blur(5px)',
            border: '1px border solid rgba(255,255,255,0.2)'
          }}>
            {label || '360° View'}
          </div>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
            outline: 'none'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.25)'}
          onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.15)'}
        >
          ✕
        </button>
      </div>

      {/* Main 3D Viewer */}
      <div style={{ flex: 1, cursor: 'grab' }}>
        <Canvas>
          <Suspense fallback={
            <Html center>
              <div style={{ color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', marginBottom: '10px' }}>Loading 360 View...</div>
                <div className="loading-bar-container" style={{ width: '200px', height: '4px', backgroundColor: '#333', borderRadius: '2px' }}>
                  <div className="loading-bar" style={{ width: '60%', height: '100%', backgroundColor: '#ffd700', borderRadius: '2px' }}></div>
                </div>
              </div>
            </Html>
          }>
            <PerspectiveCamera makeDefault position={[0, 0, 0.1]} fov={75} />
            <PanoramaSphere url={photoUrl} />
            <OrbitControls 
              enableZoom={true} 
              enablePan={false} 
              rotateSpeed={-0.4} // Negative to fix inversion
              autoRotate={true}
              autoRotateSpeed={0.5}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Footer / Interaction Hint */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        opacity: 0.6,
        fontSize: '13px',
        pointerEvents: 'none',
        textAlign: 'center',
        zIndex: 5,
        textShadow: '0 1px 2px rgba(0,0,0,0.8)'
      }}>
        DRAG TO EXPLORE • SCROLL TO ZOOM
      </div>
    </div>
  );
};
