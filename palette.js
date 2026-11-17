// The ten colours of the instrument. style.css repeats them so the first
// paint matches; app.js writes these values onto the page before anyone clicks.
export const PALETTE = {
  chalk: "#F3F1E9",
  charcoal: "#343936",
  lagoon: "#579B89",
  deepForest: "#244C43",
  sand: "#EBD994",
  sunflower: "#F2D537",
  sky: "#87C8CE",
  coral: "#ED8295",
  terracotta: "#D49A70",
  stone: "#CECFCC",
};

export const SWATCHES = [
  ["lagoon", "Lagoon"],
  ["deepForest", "Deep Forest"],
  ["sand", "Sand"],
  ["sunflower", "Sunflower"],
  ["sky", "Sky"],
  ["coral", "Coral"],
  ["terracotta", "Terracotta"],
  ["chalk", "Chalk"],
  ["stone", "Stone"],
  ["charcoal", "Charcoal"],
];

export function applyPalette(root = document.documentElement) {
  for (const [key, value] of Object.entries(PALETTE)) {
    const name = "--" + key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    root.style.setProperty(name, value);
  }
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

// A mark that stays visible on the tube. Light colours take Charcoal; dark colours take Chalk.
export function markOn(hex) {
  return luminance(hex) > 0.18 ? PALETTE.charcoal : PALETTE.chalk;
}
