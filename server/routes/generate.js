const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { generateTiledPdf } = require("../services/tileGenerator");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

router.post("/generate", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required." });
    }

    const posterSize = req.body.posterSize;
    const paperSize = req.body.paperSize;
    const overlap = Number(req.body.overlap || 0);
    const customWidth = Number(req.body.customWidth || 0);
    const customHeight = Number(req.body.customHeight || 0);
    const includeGuides = req.body.includeGuides !== "false";

    if (!posterSize || !paperSize) {
      return res.status(400).json({ error: "Poster size and paper size are required." });
    }

    const pdfBuffer = await generateTiledPdf({
      imagePath: req.file.path,
      posterSize,
      paperSize,
      overlap,
      customWidth,
      customHeight,
      includeGuides
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=tarpapel_tiles.pdf");
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF." });
    }
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }
  }
});

module.exports = router;
