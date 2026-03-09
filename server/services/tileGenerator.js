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

function getTileMargins(rowIndex, colIndex, rows, columns, extraOverlapIn) {
  const isTopRow = rowIndex === 0;
  const isBottomRow = rowIndex === rows - 1;
  const isLeftCol = colIndex === 0;
  const isRightCol = colIndex === columns - 1;
  const marginValue = MARGIN_IN + extraOverlapIn;

  const margins = { top: 0, left: 0, right: 0 };

  if (!isTopRow || isBottomRow) {
    margins.top = marginValue;
  }

  if (isLeftCol) {
    margins.right = marginValue;
  } else if (isRightCol) {
    margins.left = marginValue;
  } else {
    margins.left = marginValue;
    margins.right = marginValue;
  }

  return margins;
}

function buildTileStarts(posterSizePx, paperSizePx, columns, rows, extraOverlapIn) {
  const colStarts = [0];
  for (let col = 1; col < columns; col += 1) {
    const prevMargins = getTileMargins(0, col - 1, rows, columns, extraOverlapIn);
    const currMargins = getTileMargins(0, col, rows, columns, extraOverlapIn);
    const step = paperSizePx.width - inchesToPixels(prevMargins.right + currMargins.left);
    colStarts[col] = colStarts[col - 1] + step;
  }

  const rowStarts = [0];
  for (let row = 1; row < rows; row += 1) {
    const currMargins = getTileMargins(row, 0, rows, columns, extraOverlapIn);
    const step = paperSizePx.height - inchesToPixels(currMargins.top);
    rowStarts[row] = rowStarts[row - 1] + step;
  }

  return { colStarts, rowStarts };
}

function computeTileLayout(posterWidthPx, posterHeightPx, paperSizePx, extraOverlapIn) {
  const baseStepX = paperSizePx.width - inchesToPixels((MARGIN_IN + extraOverlapIn) * 2);
  const baseStepY = paperSizePx.height - inchesToPixels(MARGIN_IN + extraOverlapIn);

  let columns = Math.max(1, Math.ceil(posterWidthPx / baseStepX));
  let rows = Math.max(1, Math.ceil(posterHeightPx / baseStepY));

  while (true) {
    const { colStarts, rowStarts } = buildTileStarts(
      { width: posterWidthPx, height: posterHeightPx },
      paperSizePx,
      columns,
      rows,
      extraOverlapIn
    );
    const totalWidth = colStarts[colStarts.length - 1] + paperSizePx.width;
    const totalHeight = rowStarts[rowStarts.length - 1] + paperSizePx.height;

    const needsMoreCols = totalWidth < posterWidthPx;
    const needsMoreRows = totalHeight < posterHeightPx;

    if (!needsMoreCols && !needsMoreRows) {
      return { columns, rows, colStarts, rowStarts };
    }
    if (needsMoreCols) columns += 1;
    if (needsMoreRows) rows += 1;
  }
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
  const overlapIn = clampOverlap(overlap, paperDims.widthIn, paperDims.heightIn);

  const posterWidthPx = feetToPixels(posterDims.widthFt);
  const posterHeightPx = feetToPixels(posterDims.heightFt);
  const paperWidthPx = inchesToPixels(paperDims.widthIn);
  const paperHeightPx = inchesToPixels(paperDims.heightIn);

  const resizedBuffer = await resizeToPoster(imagePath, posterWidthPx, posterHeightPx);
  const layout = computeTileLayout(
    posterWidthPx,
    posterHeightPx,
    { width: paperWidthPx, height: paperHeightPx },
    overlapIn
  );

  const pdfDoc = await PDFDocument.create();
  const paperWidthPt = paperDims.widthIn * 72;
  const paperHeightPt = paperDims.heightIn * 72;
  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.columns; col += 1) {
      const tileMarginsIn = getTileMargins(row, col, layout.rows, layout.columns, overlapIn);
      const x = layout.colStarts[col];
      const y = layout.rowStarts[row];
      const tileBuffer = await createTileBuffer(
        resizedBuffer,
        posterWidthPx,
        posterHeightPx,
        x,
        y,
        paperWidthPx,
        paperHeightPx
      );

      const page = pdfDoc.addPage([paperWidthPt, paperHeightPt]);
      const embedded = await pdfDoc.embedPng(tileBuffer);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: paperDims.widthIn * 72,
        height: paperDims.heightIn * 72
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
