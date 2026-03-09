const sharp = require("sharp");

const DPI = 300;
const FEET_TO_INCHES = 12;

function feetToPixels(feet) {
  return Math.round(feet * FEET_TO_INCHES * DPI);
}

function inchesToPixels(inches) {
  return Math.round(inches * DPI);
}

async function resizeToPoster(imagePath, widthPx, heightPx) {
  return sharp(imagePath, { limitInputPixels: false })
    .resize(widthPx, heightPx, {
      fit: "cover",
      position: "center"
    })
    .png()
    .toBuffer();
}

module.exports = {
  DPI,
  FEET_TO_INCHES,
  feetToPixels,
  inchesToPixels,
  resizeToPoster
};
