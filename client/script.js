const imageInput = document.getElementById("imageInput");
const dropzone = document.getElementById("dropzone");
const browseButton = document.getElementById("browseButton");
const fileNameLabel = document.getElementById("fileName");
const uploadStatus = document.getElementById("uploadStatus");
const overlapInput = document.getElementById("overlap");
const overlapValue = document.getElementById("overlapValue");
const generateButton = document.getElementById("generateButton");
const downloadButton = document.getElementById("downloadButton");
const statusMessage = document.getElementById("statusMessage");
const previewCanvas = document.getElementById("previewCanvas");
const tileSummary = document.getElementById("tileSummary");
const customSizeFields = document.getElementById("customSizeFields");
const includeGuides = document.getElementById("includeGuides");
const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");

let selectedFile = null;
let previewImage = null;
let pdfBlobUrl = null;
const API_BASE = window.location.hostname.endsWith("github.io")
  ? "https://tarpapel.onrender.com"
  : "";
let progressTimer = null;
let progressValue = 0;

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

function getPosterSizeSelection() {
  const selected = document.querySelector("input[name='posterSize']:checked").value;
  if (selected === "custom") {
    const customWidth = Number(document.getElementById("customWidth").value);
    const customHeight = Number(document.getElementById("customHeight").value);
    return { value: selected, widthFt: customWidth, heightFt: customHeight };
  }
  return { value: selected, ...POSTER_PRESETS[selected] };
}

function getPaperSelection() {
  return document.querySelector("input[name='paperSize']:checked").value;
}

function updateCustomFields() {
  const isCustom = document.querySelector("input[name='posterSize']:checked").value === "custom";
  customSizeFields.classList.toggle("hidden", !isCustom);
}

function setStatus(message, tone = "neutral") {
  statusMessage.textContent = message;
  statusMessage.className = "text-sm";
  if (tone === "error") {
    statusMessage.classList.add("text-red-400");
  } else if (tone === "success") {
    statusMessage.classList.add("text-emerald-300");
  } else {
    statusMessage.classList.add("text-slate-300");
  }
}

function updateFileStatus(file) {
  if (!file) {
    uploadStatus.classList.remove("ready");
    fileNameLabel.textContent = "No image selected.";
    return;
  }
  uploadStatus.classList.add("ready");
  fileNameLabel.textContent = file.name;
}

function loadPreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function computeTileLayout() {
  const poster = getPosterSizeSelection();
  const paper = PAPER_SIZES[getPaperSelection()];
  const overlapIn = Number(overlapInput.value || 0);

  if (!poster.widthFt || !poster.heightFt) {
    return { columns: 0, rows: 0 };
  }

  const posterWidthIn = poster.widthFt * 12;
  const posterHeightIn = poster.heightFt * 12;
  const printableWidthIn = paper.widthIn - MARGIN_IN * 2;
  const printableHeightIn = paper.heightIn - MARGIN_IN;

  const stepX = Math.max(0.1, printableWidthIn - overlapIn);
  const stepY = Math.max(0.1, printableHeightIn - overlapIn);

  const columns = Math.ceil((posterWidthIn - overlapIn) / stepX);
  const rows = Math.ceil((posterHeightIn - overlapIn) / stepY);
  return { columns, rows };
}

function renderPreview() {
  const ctx = previewCanvas.getContext("2d");
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  if (!previewImage) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Sora, sans-serif";
    ctx.fillText("Upload an image to preview tiles.", 20, 40);
    tileSummary.textContent = "No tiles yet";
    return;
  }

  const poster = getPosterSizeSelection();
  const layout = computeTileLayout();
  if (!poster.widthFt || !poster.heightFt || !layout.columns || !layout.rows) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Sora, sans-serif";
    ctx.fillText("Enter a valid custom size.", 20, 40);
    tileSummary.textContent = "No tiles yet";
    return;
  }

  const aspect = poster.widthFt / poster.heightFt;
  const canvasAspect = previewCanvas.width / previewCanvas.height;
  let drawWidth = previewCanvas.width * 0.85;
  let drawHeight = drawWidth / aspect;
  if (drawHeight > previewCanvas.height * 0.85) {
    drawHeight = previewCanvas.height * 0.85;
    drawWidth = drawHeight * aspect;
  }
  const offsetX = (previewCanvas.width - drawWidth) / 2;
  const offsetY = (previewCanvas.height - drawHeight) / 2;

  ctx.save();
  ctx.fillStyle = "#111827";
  ctx.fillRect(offsetX, offsetY, drawWidth, drawHeight);
  ctx.drawImage(previewImage, offsetX, offsetY, drawWidth, drawHeight);

  ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
  ctx.lineWidth = 1;
  for (let col = 1; col < layout.columns; col += 1) {
    const x = offsetX + (drawWidth / layout.columns) * col;
    ctx.beginPath();
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + drawHeight);
    ctx.stroke();
  }
  for (let row = 1; row < layout.rows; row += 1) {
    const y = offsetY + (drawHeight / layout.rows) * row;
    ctx.beginPath();
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + drawWidth, y);
    ctx.stroke();
  }
  ctx.restore();

  tileSummary.textContent = `${layout.columns} x ${layout.rows} tiles`;
}

async function handleFile(file) {
  if (!file) return;
  selectedFile = file;
  updateFileStatus(file);
  try {
    previewImage = await loadPreview(file);
    renderPreview();
  } catch (error) {
    setStatus("Unable to load preview. Try another image.", "error");
  }
}

function clearDownload() {
  if (pdfBlobUrl) {
    URL.revokeObjectURL(pdfBlobUrl);
    pdfBlobUrl = null;
  }
  downloadButton.disabled = true;
}

function startProgress() {
  progressValue = 5;
  progressBar.style.width = `${progressValue}%`;
  progressLabel.textContent = "Processing image...";
  progressWrap.classList.remove("hidden");
  progressTimer = setInterval(() => {
    progressValue = Math.min(progressValue + Math.random() * 12, 90);
    progressBar.style.width = `${progressValue}%`;
    progressLabel.textContent = "Rendering tiles...";
  }, 700);
}

function finishProgress() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  progressBar.style.width = "100%";
  progressLabel.textContent = "Finalizing PDF...";
  setTimeout(() => {
    progressWrap.classList.add("hidden");
    progressBar.style.width = "0%";
    progressLabel.textContent = "Preparing...";
  }, 800);
}

function failProgress() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  progressWrap.classList.add("hidden");
  progressBar.style.width = "0%";
  progressLabel.textContent = "Preparing...";
}

function getFormPayload() {
  const poster = getPosterSizeSelection();
  const paperSize = getPaperSelection();
  return {
    posterSize: poster.value,
    paperSize,
    overlap: overlapInput.value,
    customWidth: poster.widthFt || "",
    customHeight: poster.heightFt || "",
    includeGuides: includeGuides.checked
  };
}

browseButton.addEventListener("click", () => imageInput.click());

dropzone.addEventListener("click", () => imageInput.click());

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const file = event.dataTransfer.files[0];
  handleFile(file);
});

imageInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  handleFile(file);
});

document.querySelectorAll("input[name='posterSize']").forEach((radio) => {
  radio.addEventListener("change", () => {
    updateCustomFields();
    renderPreview();
  });
});

document.querySelectorAll("input[name='paperSize']").forEach((radio) => {
  radio.addEventListener("change", renderPreview);
});

document.getElementById("customWidth").addEventListener("input", renderPreview);
document.getElementById("customHeight").addEventListener("input", renderPreview);

overlapInput.addEventListener("input", () => {
  overlapValue.textContent = overlapInput.value;
  renderPreview();
});

includeGuides.addEventListener("change", renderPreview);

generateButton.addEventListener("click", async () => {
  clearDownload();
  if (!selectedFile) {
    setStatus("Please upload an image first.", "error");
    return;
  }

  const poster = getPosterSizeSelection();
  if (poster.value === "custom" && (!poster.widthFt || !poster.heightFt)) {
    setStatus("Enter both custom width and height.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("image", selectedFile);
  const payload = getFormPayload();
  Object.entries(payload).forEach(([key, value]) => formData.append(key, value));

  setStatus("Generating PDF. This may take a minute for large posters.");
  generateButton.disabled = true;
  startProgress();

  try {
    const response = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "PDF generation failed.");
    }

    const blob = await response.blob();
    pdfBlobUrl = URL.createObjectURL(blob);
    downloadButton.disabled = false;
    finishProgress();
    setStatus("PDF ready! Click download to save it.", "success");
  } catch (error) {
    failProgress();
    setStatus(error.message, "error");
  } finally {
    generateButton.disabled = false;
  }
});

downloadButton.addEventListener("click", () => {
  if (!pdfBlobUrl) return;
  const link = document.createElement("a");
  link.href = pdfBlobUrl;
  link.download = "tarpapel_tiles.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

updateCustomFields();
renderPreview();
setStatus("");
