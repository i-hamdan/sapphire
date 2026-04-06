import React, { useRef, useCallback, useEffect, useState } from 'react';

// ─────────────────────────────────────────────
// ZOOM SLIDER  — vertical slider on right edge
// ─────────────────────────────────────────────
const ZoomSlider = ({ value, min, max, onChange }) => {
  const trackRef = useRef(null);
  const dragging = useRef(false);
  const [localValue, setLocalValue] = useState(null);

  // Use localValue during drag, otherwise prop value
  const displayValue = localValue !== null ? localValue : value;
  const pct = ((displayValue - min) / (max - min)) * 100;

  const updateFromY = useCallback((clientY) => {
    const rect = trackRef.current.getBoundingClientRect();
    // Top of track = min zoom (far), bottom = max zoom (close)
    // Wait, let's check the labels. - is top (zoom out), + is bottom (zoom in).
    // So top = min, bottom = max.
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const newVal = min + ratio * (max - min);
    setLocalValue(newVal);
    onChange(newVal);
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
    setLocalValue(null);
  }, []);

  return (
    <div className="mc-zoom-slider" title="Zoom">
      <div className="mc-zoom-icon mc-zoom-icon-minus">−</div>
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
      <div className="mc-zoom-icon mc-zoom-icon-plus">+</div>
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
const RotationBar = ({ value, onChange }) => {
  const barRef = useRef(null);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const [localValue, setLocalValue] = useState(null);

  const displayValue = localValue !== null ? localValue : value;
  const angle = ((displayValue % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const TAPE_WIDTH = 320;
  const offset = -(angle / (Math.PI * 2)) * TAPE_WIDTH;

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    lastX.current = e.clientX;
    barRef.current.setPointerCapture(e.pointerId);
    setLocalValue(value);
  }, [value]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    const delta = dx * (Math.PI * 2 / TAPE_WIDTH);
    setLocalValue(prev => (prev !== null ? prev + delta : value + delta));
    onChange(displayValue + delta);
  }, [displayValue, onChange, value]);

  const onPointerUp = useCallback((e) => {
    dragging.current = false;
    if (barRef.current) barRef.current.releasePointerCapture(e.pointerId);
    setLocalValue(null);
  }, []);

  return (
    <div className="mc-dial-container" title="Rotate horizontally">
      <div className="mc-dial-label">ROTATE</div>
      <div
        ref={barRef}
        className="mc-rotation-bar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mc-bar-track">
          {/* We repeat the markings to allow "infinite" feel during the move */}
          <div 
            className="mc-bar-tape" 
            style={{ transform: `translateX(${offset}px)` }}
          >
            <div className="mc-tape-segment"><span>N</span><span>NW</span><span>W</span><span>SW</span><span>S</span><span>SE</span><span>E</span><span>NE</span></div>
            <div className="mc-tape-segment"><span>N</span><span>NW</span><span>W</span><span>SW</span><span>S</span><span>SE</span><span>E</span><span>NE</span></div>
            <div className="mc-tape-segment"><span>N</span><span>NW</span><span>W</span><span>SW</span><span>S</span><span>SE</span><span>E</span><span>NE</span></div>
          </div>
        </div>
        {/* Center fixed marker */}
        <div className="mc-bar-center-mark" />
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────
// ELEVATION DIAL  — vertical (polar) angle
// ─────────────────────────────────────────────
const ElevationBar = ({ value, min, max, onChange }) => {
  const barRef = useRef(null);
  const dragging = useRef(false);
  const lastY = useRef(0);
  const [localValue, setLocalValue] = useState(null);

  const displayValue = localValue !== null ? localValue : value;
  const pct = ((displayValue - min) / (max - min)) * 100;

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    lastY.current = e.clientY;
    barRef.current.setPointerCapture(e.pointerId);
    setLocalValue(value);
  }, [value]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const dy = e.clientY - lastY.current;
    lastY.current = e.clientY;
    const delta = dy * 0.005;
    const newVal = Math.max(min, Math.min(max, (localValue !== null ? localValue : value) + delta));
    setLocalValue(newVal);
    onChange(newVal);
  }, [localValue, value, min, max, onChange]);

  const onPointerUp = useCallback((e) => {
    dragging.current = false;
    if (barRef.current) barRef.current.releasePointerCapture(e.pointerId);
    setLocalValue(null);
  }, []);

  return (
    <div className="mc-elev-container" title="Tilt camera angle">
      <div className="mc-dial-label">TILT</div>
      <div
        ref={barRef}
        className="mc-elevation-bar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mc-elev-track-v">
          <div className="mc-elev-fill-v" style={{ height: `${pct}%` }} />
          <div className="mc-elev-thumb-v" style={{ bottom: `${pct}%` }} />
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

      {/* Bottom control group repositioned to right side in CSS */}
      <div className="mc-bottom-group">
        <div className="mc-dials-row">
          <ElevationBar
            value={localCam.elevation}
            min={elevationRange[0]}
            max={elevationRange[1]}
            onChange={handleElevationChange}
          />
          <RotationBar
            value={localCam.azimuth}
            onChange={handleAzimuthChange}
          />
          <PanPad onPan={handlePan} />
        </div>
      </div>
    </div>
  );
};

export default MapControls;
