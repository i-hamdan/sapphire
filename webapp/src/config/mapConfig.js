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
    fenceRail: "#ffffffff",
    fencePost: "#000000ff",
    water: "#1c5cb6ff",
    mountain: "#9a7160ff"
  },
  geometry: {
    plotDepth: 0.3,
    roadDepth: 0.02,
    highwayDepth: 0.1,
    groundSize: 500
  }
};

export const hexToThreeColor = (hex) => {
  const cleanHex = hex.replace("#", "");
  // Only take the first 6 characters for the RGB color (RRGGBB)
  // Otherwise, 8-digit hex (RRGGBBAA) causes bit-shift issues in Three.js
  return parseInt(cleanHex.substring(0, 6), 16);
};
