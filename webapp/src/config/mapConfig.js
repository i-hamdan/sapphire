export const DEFAULT_MAP_CONFIG = {
  colors: {
    plot: "#06440dff", // muted purple/blue
    plotActive: "#047a1dff", // bright gold
    plotSold: "#777575ff", // Dark gray for sold
    plotHighInterest: "#ffd700", // Gold for high interest
    resort: "#884a04ff", // Pinkish/Purple
    green: "#179607ff", // Forest Green
    road: "#87480aff", // Asphalt Dark Gray
    highway: "#222222", // Deeper Asphalt
    background: "#0a1208",
    fog: "#0a1208",
    sunlight: "#fff3d0",
    ambientLight: "#7aaa5a",
    fillLight: "#3a6a8a",
    ground: "#abbaa6eb",
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
    // Main Gate
    gatePillar: "#1e12c3ff",
    gatePillarCap: "#a8a39d",
    gateArch: "#1a1a1a",
    gateSign: "#0b1704",
    gateText: "#c8d96a",
    // Gazebo colors
    gazeboFrame: "#1a1a1a", // Deep black metal
    gazeboBase: "#a0a0a0", // Stone grey
    gazeboWood: "#8b4513", // Saddle brown wood
    gazeboRoof: "#4f4e4cff", // Dark graphite roof
  },
  geometry: {
    plotDepth: 0.3,
    roadDepth: 0.02,
    highwayDepth: 0.1,
    mountainDepth: 2.5,
    waterDepth: 0.15,
    groundSize: 300
  },
  // Plot boundary wall — grey concrete + horizontal metal slat plates
  plotBoundary: {
    isVisible: true,         // Toggle visibility
    showAllPlots: false,      // Show all plot walls by default
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
  // Feature toggle and common settings
  plotFeature: {
    type: 'gazebo',          // 'house' or 'gazebo'
    houseScale: 1.0,         // Overall scale for house
    gazeboScale: 0.8,       // Overall scale for gazebo
  },
  // Floating photo pins for specific plots
  photoPins: [
    {
      plotId: "9",
      photoUrl: "/assets/panoramic.jpg",
      label: "Main Campus View"
    }
  ],
  photoPinStyle: {
    isVisible: true,
    accentColor: "#f93b0bff",   // Main bubble color
    iconColor: "#ffffffff",     // Camera body color
    baseHeight: 2.8,          // Distance from the plot surface
    floatAmplitude: 0.18,     // Vertical floating range
    floatSpeed: 1.8,          // Vertical floating speed
    swayAmplitude: 0.12,      // Side-to-side swivel range
    swaySpeed: 0.5,           // Side-to-side swivel speed
    pinScale: 3.0,            // Overall scale
    matteMode: true,         // Toggle between glossy and matte-flat texture
    showShadow: true,         // Toggle drop shadow
    shadowOpacity: 0.25       // Darkness of the floor shadow
  },
  brandOverlay: {
    isVisible: false,          // Toggle brand logo visibility
    logoWidth: "200px",       // Width of the logo in the overlay
  },
  cameraControl: {
    reverseZoom: true,        // Default + top, - bottom
    reverseRotation: false,    // Default N-E-S-W
    reverseTilt: true,        // Default up tilts up
    reversePan: true,         // Default drag right moves right
  }
};

export const hexToThreeColor = (hex) => {
  if (typeof hex !== 'string') return 0x555555;
  const cleanHex = hex.replace("#", "");
  // Only take the first 6 characters for the RGB color (RRGGBB)
  // Otherwise, 8-digit hex (RRGGBBAA) causes bit-shift issues in Three.js
  return parseInt(cleanHex.substring(0, 6), 16);
};
