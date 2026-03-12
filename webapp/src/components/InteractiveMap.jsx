import React, { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import vectorsData from '../assets/full_map_vectors.json';
import './InteractiveMap.css';

const InteractiveMap = () => {
  const [selectedPlot, setSelectedPlot] = useState(null);
  
  // We extracted the exact viewBox from the original 3180x4181 pixel map
  const viewWidth = 3180;
  const viewHeight = 4181;

  const handlePolygonClick = (polygon) => {
    if (polygon.type === 'plot') {
      setSelectedPlot(polygon);
    }
  };

  return (
    <div className="map-container">
      <TransformWrapper
        initialScale={1}
        minScale={0.3}
        maxScale={5}
        centerOnInit={true}
        wheel={{ step: 0.1 }}
      >
        <TransformComponent wrapperClass="map-transform-wrapper" contentClass="map-transform-content">
          <div className="map-wrapper">
            <svg 
              className="map-svg-overlay" 
              viewBox={`0 0 ${viewWidth} ${viewHeight}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '1200px', height: 'auto', display: 'block' }}
            >
              {vectorsData.filter(p => p.type === 'plot').map((polygon, index) => (
                <polygon
                  key={polygon.id || index}
                  points={polygon.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                  className={`polygon-${polygon.type} ${selectedPlot?.id === polygon.id ? 'active' : ''}`}
                  onClick={() => handlePolygonClick(polygon)}
                />
              ))}
              
              {/* Optional: Add text labels for plots so users can see the numbers directly */}
              {vectorsData.filter(p => p.type === 'plot').map((polygon, index) => {
                 if (polygon.label) {
                   // Calculate approximate center for standard bounding box
                   let minX = viewWidth, maxX = 0, minY = viewHeight, maxY = 0;
                   polygon.points.forEach(p => {
                     if (p[0] < minX) minX = p[0];
                     if (p[0] > maxX) maxX = p[0];
                     if (p[1] < minY) minY = p[1];
                     if (p[1] > maxY) maxY = p[1];
                   });
                   const cx = (minX + maxX) / 2;
                   const cy = (minY + maxY) / 2;
                   
                   return (
                     <text 
                       key={`label-${index}`} 
                       x={cx} 
                       y={cy} 
                       className="plot-label"
                       pointerEvents="none"
                     >
                       {polygon.label}
                     </text>
                   );
                 }
                 return null;
              })}
            </svg>
          </div>
        </TransformComponent>
      </TransformWrapper>

      {selectedPlot && (
        <div className="plot-info-panel active">
          <button className="close-btn" onClick={() => setSelectedPlot(null)}>×</button>
          <h2>Plot {selectedPlot.label}</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Area</span>
              <span className="value">{selectedPlot.area || 'N/A'} SqFt</span>
            </div>
            <div className="info-item">
              <span className="label">Status</span>
              <span className="value available">Available</span>
            </div>
          </div>
          <button className="action-btn">Enquire Now</button>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;
