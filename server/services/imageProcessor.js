const sharp = require("sharp");

const DPI = 300;
const FEET_TO_INCHES = 12;

function feetToPixels(feet) {
  return Math.round(feet * FEET_TO_INCHES * DPI);
}

function inchesToPixels(inches) {
  return Math.round(inches * DPI);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function resizeToPoster(imagePath, widthPx, heightPx, focalX = 0, focalY = 0) {
  const image = sharp(imagePath, { limitInputPixels: false });
  const metadata = await image.metadata();
  const srcWidth = metadata.width || widthPx;
  const srcHeight = metadata.height || heightPx;

  const targetAspect = widthPx / heightPx;
  const srcAspect = srcWidth / srcHeight;

  let cropWidth = srcWidth;
  let cropHeight = srcHeight;

  if (srcAspect > targetAspect) {
    cropWidth = Math.round(srcHeight * targetAspect);
  } else {
    cropHeight = Math.round(srcWidth / targetAspect);
  }

  const centerX = clamp((focalX + 1) / 2, 0, 1) * srcWidth;
  const centerY = clamp((focalY + 1) / 2, 0, 1) * srcHeight;

  let left = Math.round(centerX - cropWidth / 2);
  let top = Math.round(centerY - cropHeight / 2);

  left = clamp(left, 0, Math.max(0, srcWidth - cropWidth));
  top = clamp(top, 0, Math.max(0, srcHeight - cropHeight));

  return image
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(widthPx, heightPx)
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
