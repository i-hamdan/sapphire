export const DEFAULT_MAP_CONFIG = {
  colors: {
    plot: "#6b6bf0ff", // muted purple/blue
    plotActive: "#047a1dff", // bright gold
    resort: "#884488", // Pinkish/Purple
    green: "#0d6402ff", // Forest Green
    road: "#333333", // Asphalt Dark Gray
    highway: "#222222", // Deeper Asphalt
    background: "#0a1208",
    fog: "#0a1208",
    sunlight: "#fff3d0",
    ambientLight: "#7aaa5a",
    fillLight: "#3a6a8a",
    ground: "#f4ca90eb",
    water: "#1a73e8", // Premium Google Blue
    waterDeep: "#0d47a1", // Deep blue
    waterShallow: "#4285f4", // Lighter blue
    mountain: "#3c4043", // Graphite Gray
    mountainPeak: "#2c2f33", // Darker peak
    snow: "#f8f9fa", // Bright snow cap
    foam: "#ffffff",
    // Plot boundary wall
    plotWall: "#b0b0b0", // Grey concrete wall
    plotPillar: "#909090", // Darker grey pillars
    plotPillarCap: "#c8c8c8", // Light grey pillar caps
    plotSlat: "#4a4a4a", // Dark metal slat plates
    // Campus boundary wall
    campusWall: "#e8dcc8", // Cream/beige concrete
    campusPost: "#2c2c2c", // Dark metal posts
    campusMesh: "#1a1a1a", // Black chain-link mesh
    campusRail: "#2c2c2c", // Dark metal rails
  },
  geometry: {
    plotDepth: 0.3,
    roadDepth: 0.02,
    highwayDepth: 0.1,
    mountainDepth: 2.5,
    waterDepth: 0.15,
    groundSize: 1000
  },
  // Plot boundary wall — grey concrete + horizontal metal slat plates
  plotBoundary: {
    isVisible: true,         // Toggle visibility
    wallHeight: 0.4,         // Concrete wall height
    wallThickness: 0.08,     // Wall depth/thickness
    pillarWidth: 0.14,       // Pillar cross-section size
    pillarSpacing: 1.0,      // Distance between pillars
    slatCount: 4,            // Number of horizontal metal plates above wall
    slatHeight: 0.025,       // Each slat plate thickness
    slatGap: 0.03,           // Vertical gap between slats
    surfaceZ: 0.31,          // Base Z (ground surface level)
    gateOpeningRatio: 0.38,  // Gate gap as fraction of edge length
  },
  // Campus boundary wall — cream concrete base + dark metal mesh
  campusBoundary: {
    isVisible: true,         // Toggle visibility
    wallHeight: 0.45,        // Cream base wall height
    wallThickness: 0.12,     // Base wall depth/thickness
    postWidth: 0.15,         // Metal post cross-section
    postHeight: 0.9,         // Total post height (above surfaceZ)
    postSpacing: 3.0,        // Distance between posts
    meshOpacity: 0.25,       // Chain-link mesh transparency
    railThickness: 0.05,     // Horizontal rail cross-section
    padding: 4.5,            // Outward offset from development perimeter
    surfaceZ: 0.01,          // Base Z position
  },
};

export const hexToThreeColor = (hex) => {
  if (typeof hex !== 'string') return 0x555555;
  const cleanHex = hex.replace("#", "");
  // Only take the first 6 characters for the RGB color (RRGGBB)
  // Otherwise, 8-digit hex (RRGGBBAA) causes bit-shift issues in Three.js
  return parseInt(cleanHex.substring(0, 6), 16);
};
