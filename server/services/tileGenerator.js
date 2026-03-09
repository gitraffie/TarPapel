const { PDFDocument, rgb } = require("pdf-lib");
const sharp = require("sharp");
const {
  feetToPixels,
  inchesToPixels,
  resizeToPoster
} = require("./imageProcessor");

const PAPER_SIZES = {
  A4: { widthIn: 8.27, heightIn: 11.69 },
  A3: { widthIn: 11.69, heightIn: 16.54 },
  Letter: { widthIn: 8.5, heightIn: 11 },
  Legal: { widthIn: 8.5, heightIn: 14 },
  Tabloid: { widthIn: 11, heightIn: 17 }
};

const POSTER_PRESETS = {
  "2x3": { widthFt: 2, heightFt: 3 },
  "3x4": { widthFt: 3, heightFt: 4 },
  "4x6": { widthFt: 4, heightFt: 6 }
};

const MARGIN_IN = 0.2;

function getPosterDimensions(posterSize, customWidth, customHeight) {
  if (posterSize === "custom") {
    if (!customWidth || !customHeight) {
      throw new Error("Custom width and height are required.");
    }
    return { widthFt: customWidth, heightFt: customHeight };
  }
  const preset = POSTER_PRESETS[posterSize];
  if (!preset) {
    throw new Error("Invalid poster size.");
  }
  return preset;
}

function getPaperDimensions(paperSize) {
  const paper = PAPER_SIZES[paperSize];
  if (!paper) {
    throw new Error("Invalid paper size.");
  }
  return paper;
}

function clampOverlap(overlapIn, baseWidthIn, baseHeightIn) {
  const maxOverlap = Math.min(baseWidthIn, baseHeightIn) * 0.45;
  return Math.max(0, Math.min(overlapIn, maxOverlap));
}

function getTileLayout(posterWidthPx, posterHeightPx, baseWidthPx, baseHeightPx, overlapPx) {
  const stepX = Math.max(1, baseWidthPx - overlapPx);
  const stepY = Math.max(1, baseHeightPx - overlapPx);
  const columns = Math.ceil((posterWidthPx - overlapPx) / stepX);
  const rows = Math.ceil((posterHeightPx - overlapPx) / stepY);
  return { columns, rows, stepX, stepY };
}

async function createTileBuffer(sourceBuffer, posterWidthPx, posterHeightPx, x, y, tileWidthPx, tileHeightPx) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(posterWidthPx, left + tileWidthPx);
  const bottom = Math.min(posterHeightPx, top + tileHeightPx);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);

  const base = sharp({
    create: {
      width: tileWidthPx,
      height: tileHeightPx,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  });

  if (width === 0 || height === 0) {
    return base.png().toBuffer();
  }

  const extracted = await sharp(sourceBuffer, { limitInputPixels: false })
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  return base
    .composite([{ input: extracted, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

function drawMarginGuides(page, paperWidthPt, paperHeightPt, marginsPt) {
  const lineColor = rgb(0.65, 0.65, 0.65);
  const lineWidth = 0.6;

  const left = marginsPt.left;
  const right = paperWidthPt - marginsPt.right;
  const top = paperHeightPt - marginsPt.top;

  if (left > 0) {
    page.drawLine({
      start: { x: left, y: 0 },
      end: { x: left, y: paperHeightPt },
      color: lineColor,
      thickness: lineWidth
    });
  }

  if (marginsPt.right > 0) {
    page.drawLine({
      start: { x: right, y: 0 },
      end: { x: right, y: paperHeightPt },
      color: lineColor,
      thickness: lineWidth
    });
  }

  if (marginsPt.top > 0) {
    page.drawLine({
      start: { x: 0, y: top },
      end: { x: paperWidthPt, y: top },
      color: lineColor,
      thickness: lineWidth
    });
  }
}

function getTileMargins(rowIndex, colIndex, rows, columns) {
  const isTopRow = rowIndex === 0;
  const isBottomRow = rowIndex === rows - 1;
  const isLeftCol = colIndex === 0;
  const isRightCol = colIndex === columns - 1;

  const margins = { top: 0, left: 0, right: 0 };

  if (!isTopRow || isBottomRow) {
    margins.top = MARGIN_IN;
  }

  if (isLeftCol) {
    margins.right = MARGIN_IN;
  } else if (isRightCol) {
    margins.left = MARGIN_IN;
  } else {
    margins.left = MARGIN_IN;
    margins.right = MARGIN_IN;
  }

  return margins;
}

async function generateTiledPdf({
  imagePath,
  posterSize,
  paperSize,
  overlap,
  customWidth,
  customHeight,
  includeGuides = true
}) {
  const posterDims = getPosterDimensions(posterSize, customWidth, customHeight);
  const paperDims = getPaperDimensions(paperSize);

  const baseContentWidthIn = paperDims.widthIn - MARGIN_IN * 2;
  const baseContentHeightIn = paperDims.heightIn - MARGIN_IN;

  const overlapIn = clampOverlap(overlap, baseContentWidthIn, baseContentHeightIn);

  const posterWidthPx = feetToPixels(posterDims.widthFt);
  const posterHeightPx = feetToPixels(posterDims.heightFt);
  const baseContentWidthPx = inchesToPixels(baseContentWidthIn);
  const baseContentHeightPx = inchesToPixels(baseContentHeightIn);
  const overlapPx = inchesToPixels(overlapIn);

  const resizedBuffer = await resizeToPoster(imagePath, posterWidthPx, posterHeightPx);
  const layout = getTileLayout(posterWidthPx, posterHeightPx, baseContentWidthPx, baseContentHeightPx, overlapPx);

  const pdfDoc = await PDFDocument.create();
  const paperWidthPt = paperDims.widthIn * 72;
  const paperHeightPt = paperDims.heightIn * 72;
  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.columns; col += 1) {
      const tileMarginsIn = getTileMargins(row, col, layout.rows, layout.columns);
      const contentWidthIn = paperDims.widthIn - tileMarginsIn.left - tileMarginsIn.right;
      const contentHeightIn = paperDims.heightIn - tileMarginsIn.top;
      const contentWidthPx = inchesToPixels(contentWidthIn);
      const contentHeightPx = inchesToPixels(contentHeightIn);

      const x = col * layout.stepX;
      const y = row * layout.stepY;
      const tileBuffer = await createTileBuffer(
        resizedBuffer,
        posterWidthPx,
        posterHeightPx,
        x,
        y,
        contentWidthPx,
        contentHeightPx
      );

      const page = pdfDoc.addPage([paperWidthPt, paperHeightPt]);
      const embedded = await pdfDoc.embedPng(tileBuffer);
      page.drawImage(embedded, {
        x: tileMarginsIn.left * 72,
        y: 0,
        width: contentWidthIn * 72,
        height: contentHeightIn * 72
      });

      if (includeGuides) {
        drawMarginGuides(page, paperWidthPt, paperHeightPt, {
          top: tileMarginsIn.top * 72,
          left: tileMarginsIn.left * 72,
          right: tileMarginsIn.right * 72
        });
      }
    }
  }

  return pdfDoc.save();
}

module.exports = {
  generateTiledPdf
};
