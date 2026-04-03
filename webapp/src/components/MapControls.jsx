import React, { useRef, useCallback, useEffect, useState } from 'react';

// ─────────────────────────────────────────────
// ZOOM SLIDER  — vertical slider on right edge
// ─────────────────────────────────────────────
const ZoomSlider = ({ value, min, max, onChange }) => {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  const pct = ((value - min) / (max - min)) * 100;

  const updateFromY = useCallback((clientY) => {
    const rect = trackRef.current.getBoundingClientRect();
    // Top of track = max zoom (close), bottom = min zoom (far)
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onChange(min + ratio * (max - min));
  }, [min, max, onChange]);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    trackRef.current.setPointerCapture(e.pointerId);
    updateFromY(e.clientY);
  }, [updateFromY]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    e.preventDefault();
    updateFromY(e.clientY);
  }, [updateFromY]);

  const onPointerUp = useCallback((e) => {
    dragging.current = false;
    if (trackRef.current) trackRef.current.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div className="mc-zoom-slider" title="Zoom">
      <div className="mc-zoom-icon mc-zoom-icon-plus">+</div>
      <div
        ref={trackRef}
        className="mc-zoom-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mc-zoom-fill" style={{ height: `${pct}%` }} />
        <div className="mc-zoom-thumb" style={{ bottom: `${pct}%` }} />
      </div>
      <div className="mc-zoom-icon mc-zoom-icon-minus">−</div>
    </div>
  );
};


// ─────────────────────────────────────────────
// PAN PAD  — 2D draggable area, moves XZ camera target
// ─────────────────────────────────────────────
const PanPad = ({ onPan }) => {
  const padRef = useRef(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    padRef.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };

    // Clamp visual offset for the knob indicator
    setOffset(prev => ({
      x: Math.max(-28, Math.min(28, prev.x + dx)),
      y: Math.max(-28, Math.min(28, prev.y + dy)),
    }));

    // Emit pan delta (normalized -1 to 1 sensitivity)
    onPan(dx * 0.5, dy * 0.5);
  }, [onPan]);

  const onPointerUp = useCallback((e) => {
    dragging.current = false;
    if (padRef.current) padRef.current.releasePointerCapture(e.pointerId);
    // Spring back the knob
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div className="mc-pan-pad" title="Pan (drag to move)">
      <div className="mc-pan-label">PAN</div>
      <div
        ref={padRef}
        className="mc-pan-area"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Crosshair */}
        <div className="mc-pan-crosshair-h" />
        <div className="mc-pan-crosshair-v" />
        {/* Knob */}
        <div
          className="mc-pan-knob"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            transition: dragging.current ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
        {/* Direction arrows */}
        <div className="mc-pan-arrow mc-pan-arrow-n">▲</div>
        <div className="mc-pan-arrow mc-pan-arrow-s">▼</div>
        <div className="mc-pan-arrow mc-pan-arrow-e">▶</div>
        <div className="mc-pan-arrow mc-pan-arrow-w">◀</div>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────
// ROTATION DIAL  — horizontal (azimuth) rotation
// ─────────────────────────────────────────────
const RotationDial = ({ value, onChange }) => {
  const dialRef = useRef(null);
  const dragging = useRef(false);
  const lastX = useRef(0);

  // Normalize angle for display (0-360)
  const degrees = ((value * 180 / Math.PI) % 360 + 360) % 360;

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    lastX.current = e.clientX;
    dialRef.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    // Map horizontal drag to azimuth change
    onChange(value + dx * 0.008);
  }, [value, onChange]);

  const onPointerUp = useCallback((e) => {
    dragging.current = false;
    if (dialRef.current) dialRef.current.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div className="mc-dial-container" title="Rotate horizontally">
      <div className="mc-dial-label">ROTATE</div>
      <div
        ref={dialRef}
        className="mc-dial-ring"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Cardinal marks */}
        <div className="mc-dial-mark mc-dial-mark-n">N</div>
        <div className="mc-dial-mark mc-dial-mark-e">E</div>
        <div className="mc-dial-mark mc-dial-mark-s">S</div>
        <div className="mc-dial-mark mc-dial-mark-w">W</div>
        {/* Rotating indicator */}
        <div
          className="mc-dial-indicator"
          style={{ transform: `rotate(${degrees}deg)` }}
        >
          <div className="mc-dial-dot" />
        </div>
        {/* Center icon */}
        <div className="mc-dial-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────
// ELEVATION DIAL  — vertical (polar) angle
// ─────────────────────────────────────────────
const ElevationDial = ({ value, min, max, onChange }) => {
  const dialRef = useRef(null);
  const dragging = useRef(false);
  const lastY = useRef(0);

  // Map elevation to a visual percentage (0=flat, 100=top-down)
  const pct = ((value - min) / (max - min)) * 100;

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    lastY.current = e.clientY;
    dialRef.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const dy = e.clientY - lastY.current;
    lastY.current = e.clientY;
    // Drag down = more top-down, drag up = more flat
    const newVal = Math.max(min, Math.min(max, value + dy * 0.005));
    onChange(newVal);
  }, [value, min, max, onChange]);

  const onPointerUp = useCallback((e) => {
    dragging.current = false;
    if (dialRef.current) dialRef.current.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div className="mc-elev-container" title="Tilt camera angle">
      <div className="mc-dial-label">TILT</div>
      <div
        ref={dialRef}
        className="mc-elev-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Arc background */}
        <div className="mc-elev-arc">
          <svg viewBox="0 0 64 40" width="64" height="40">
            {/* Background arc */}
            <path
              d="M 4 36 A 28 28 0 0 1 60 36"
              fill="none"
              stroke="rgba(200, 217, 106, 0.15)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Active arc */}
            <path
              d="M 4 36 A 28 28 0 0 1 60 36"
              fill="none"
              stroke="rgba(200, 217, 106, 0.6)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${pct * 0.88} 100`}
            />
          </svg>
          {/* Thumb on arc */}
          <div
            className="mc-elev-thumb"
            style={{
              left: `${8 + pct * 0.48 * 64 / 100}%`,
              bottom: `${10 + Math.sin(pct / 100 * Math.PI) * 55}%`,
            }}
          />
        </div>
        {/* Labels */}
        <div className="mc-elev-labels">
          <span>◁ Flat</span>
          <span>Top ▷</span>
        </div>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────
// MAIN MapControls  — assembles all widgets
// ─────────────────────────────────────────────
const MapControls = ({
  camRef,
  isVisible,
  zoomRange = [15, 250],
  elevationRange = [0.15, Math.PI / 2.1],
}) => {
  const [localCam, setLocalCam] = useState({ zoom: 112, azimuth: 0, elevation: 0.46 });

  // Sync visual UI with the shared ref without lagging the 3D map
  useEffect(() => {
    let frameId;
    const loop = () => {
      if (camRef.current) {
        setLocalCam({
          zoom: camRef.current.zoom,
          azimuth: camRef.current.azimuth,
          elevation: camRef.current.elevation,
        });
      }
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, [camRef]);

  if (!isVisible) return null;

  const handleZoomChange = (v) => { if (camRef.current) camRef.current.zoom = v; };
  const handleAzimuthChange = (v) => { if (camRef.current) camRef.current.azimuth = v; };
  const handleElevationChange = (v) => { if (camRef.current) camRef.current.elevation = v; };
  
  const handlePan = (dx, dy) => {
    if (!camRef.current) return;
    const cosA = Math.cos(camRef.current.azimuth);
    const sinA = Math.sin(camRef.current.azimuth);
    const panSpeed = camRef.current.zoom * 0.003;
    camRef.current.panX -= (dx * cosA + dy * sinA) * panSpeed;
    camRef.current.panZ -= (-dx * sinA + dy * cosA) * panSpeed;
  };

  return (
    <div className="mc-controls-wrapper">
      {/* Right edge — Zoom */}
      <ZoomSlider
        value={localCam.zoom}
        min={zoomRange[0]}
        max={zoomRange[1]}
        onChange={handleZoomChange}
      />

      {/* Bottom-left group */}
      <div className="mc-bottom-group">
        <PanPad onPan={handlePan} />
        <div className="mc-dials-row">
          <RotationDial
            value={localCam.azimuth}
            onChange={handleAzimuthChange}
          />
          <ElevationDial
            value={localCam.elevation}
            min={elevationRange[0]}
            max={elevationRange[1]}
            onChange={handleElevationChange}
          />
        </div>
      </div>
    </div>
  );
};

export default MapControls;
