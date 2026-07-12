// =============================================================================
// script.js — Value Calculator page (index.html)
// Depends on shared.js which must be loaded first.
// =============================================================================

// Canvas font for the share image export.
const canvasFont = '"Montserrat", Arial, sans-serif';

// Stores the newest calculation so the copy button can reuse it.
let latestResult = {
  base: 0,
  condition: 1,
  grade: 1,
  mutations: [],
  multi: 1,
  multiMax: 1,
  total: 1,
  totalMax: 1,
  final: 0,
  finalMax: 0,
};

// Canvas mutation gradients (populated alongside mutationColors in shared.js loadWikiMutations).
const canvasMutationGradients = {};

// =============================================================================
// MUTATION DISPLAY HELPERS
// =============================================================================

// Sort selected mutations so the most important entries appear first.
function sortMutations(mutations) {
  return [...mutations].sort((a, b) => {
    if (a.name === "Dirty" && b.name !== "Dirty") return -1;
    if (b.name === "Dirty" && a.name !== "Dirty") return 1;
    return b.max - a.max || b.value - a.value || a.name.localeCompare(b.name);
  });
}

function getMutationValueText(mutation) {
  return mutation.value === mutation.max
    ? `${mutation.value}x`
    : `${mutation.value}x - ${mutation.max}x`;
}

function getMutationDisplayText(mutation) {
  return `${mutation.name} (${getMutationValueText(mutation)})`;
}

// Mirror the selected mutations into the result panel as compact text tokens.
function renderActiveMultipliers(mutations) {
  const holder = document.getElementById("activeMultipliers");
  const sorted = sortMutations(mutations);
  holder.innerHTML = sorted
    .map(
      (mutation) =>
        `<span class="active-mutation-token"><span class="mutation ${escapeHtml(mutation.name)}">${escapeHtml(getMutationDisplayText(mutation))}</span></span>`,
    )
    .join("");
}

// Sync the visual selection state and recalculate whenever a mutation checkbox changes.
function handleMutationChange(input) {
  input.closest(".mutation-card").classList.toggle("is-selected", input.checked);
  calc();
}

// =============================================================================
// CANVAS SHARE IMAGE HELPERS
// =============================================================================

// Draw a rounded rectangle used by the share image panels.
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatRange(min, max, digits = 2) {
  return min === max
    ? min.toLocaleString("en-US", { maximumFractionDigits: digits }) + "x"
    : min.toLocaleString("en-US", { maximumFractionDigits: digits }) +
        "x - " +
        max.toLocaleString("en-US", { maximumFractionDigits: digits }) +
        "x";
}

// Keep text rendering consistent across the share-image layout.
function setCanvasFont(ctx, weight, size) {
  ctx.font = `${weight} ${size}px ${canvasFont}`;
}

function drawFittedText(ctx, text, x, y, maxWidth, weight, size, color, minSize = 18) {
  let current = size;
  do {
    setCanvasFont(ctx, weight, current);
  } while (ctx.measureText(text).width > maxWidth && --current >= minSize);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  return current;
}

// Draw one value box in the exported result card.
function drawStatBox(ctx, label, value, x, y, w, h) {
  roundedRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = "#101827";
  ctx.fill();
  ctx.strokeStyle = "#2f3a56";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#a6a6a6";
  setCanvasFont(ctx, 900, 17);
  ctx.fillText(label.toUpperCase(), x + 18, y + 30);
  drawFittedText(ctx, value, x + 18, y + 69, w - 36, 900, 26, "#fff", 14);
}

// Use gradients on the canvas so the export matches the styled on-screen mutation labels.
function getCanvasMutationFill(ctx, name, x, width) {
  const stops = canvasMutationGradients[name];
  if (!stops)
    return name === "Black" ? "#151515" : mutationColors[name] || "#f2d16b";
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
  stops.forEach((color, index) =>
    gradient.addColorStop(
      stops.length === 1 ? 0 : index / (stops.length - 1),
      color,
    ),
  );
  return gradient;
}

// Recreate the glow tint used by the selected mutation chips in the export image.
function getCanvasMutationGlow(name) {
  if (name === "Hologram") return "#00ffff";
  if (name === "Firefly") return "#ffea00";
  if (name === "Spotless") return "#00e5ff";
  if (name === "Pure") return "#ffffff";
  if (name === "Black") return "#aaaaaa";
  if (name === "Moonlit") return "#6dd5ed";
  if (name === "Void") return "#7b2cff";
  if (name === "Dirty") return "#b98658";
  if (name === "Corrupted") return "#39ff14";
  return "";
}

function getMutationChipText(mutation) {
  return getMutationDisplayText(mutation);
}

// Break selected mutations into wrapped rows that fit the export canvas width.
function layoutMutationChips(ctx, mutations, maxWidth) {
  setCanvasFont(ctx, 900, 21);
  const chips = [];
  let x = 0, y = 0;
  const gap = 16, rowHeight = 34;
  mutations.forEach((mutation) => {
    const text = getMutationChipText(mutation);
    const width = Math.min(maxWidth, ctx.measureText(text).width + 2);
    if (x && x + width > maxWidth) {
      x = 0;
      y += rowHeight;
    }
    chips.push({ mutation, text, x, y, width });
    x += width + gap;
  });
  return { chips, height: chips.length ? y + 26 : 30 };
}

// Paint one selected mutation chip into the export image.
function drawResultMutationChip(ctx, chip, originX, originY) {
  const x = originX + chip.x, y = originY + chip.y;
  setCanvasFont(ctx, 900, 20);
  const glow = getCanvasMutationGlow(chip.mutation.name);
  ctx.shadowColor = glow || "transparent";
  ctx.shadowBlur = glow ? 10 : 0;
  ctx.fillStyle = getCanvasMutationFill(ctx, chip.mutation.name, x, chip.width);
  ctx.fillText(chip.text, x, y + 22);
  ctx.shadowBlur = 0;
}

// Build the shareable PNG from the latest calculator state.
function createResultCanvas() {
  const width = 1080, pad = 56, inner = width - pad * 2;
  const mutations = sortMutations(latestResult.mutations);
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  const chipLayout = layoutMutationChips(measureCtx, mutations, inner);
  const itemName = latestResult.selectedItem
    ? latestResult.selectedItem.name
    : "Custom Value";
  const itemMeta = latestResult.selectedItem
    ? `${latestResult.selectedItem.location} \u2022 ${latestResult.selectedItem.rarity}`
    : "";
  const finalTop = itemMeta ? 212 : 188;
  const statY = finalTop + 140;
  const mutationsTitleY = statY + 128;
  const mutationPanelTop = mutationsTitleY + 14;
  const noneY = mutationsTitleY + 42;
  const height =
    (mutations.length
      ? Math.max(
          itemMeta ? 610 : 586,
          mutationPanelTop + chipLayout.height + 56,
        )
      : itemMeta
        ? 590
        : 566) + 40;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, width, height);
  roundedRect(ctx, 28, 28, width - 56, height - 56, 22);
  ctx.fillStyle = "#161921";
  ctx.fill();
  ctx.strokeStyle = "#2f3a56";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffc500";
  setCanvasFont(ctx, 900, 20);
  ctx.fillText("Storage Hunters: Open World Mutation Calculator", pad, 78);
  drawFittedText(ctx, itemName, pad, 142, inner, 900, 56, "#fff", 30);
  if (itemMeta)
    drawFittedText(ctx, itemMeta, pad, 180, inner, 900, 22, "#c7c7c7", 16);
  const finalValue =
    latestResult.final === latestResult.finalMax
      ? "$" + formatter.format(latestResult.final)
      : "$" +
        formatter.format(latestResult.final) +
        " - $" +
        formatter.format(latestResult.finalMax);
  roundedRect(ctx, pad, finalTop, inner, 108, 14);
  ctx.fillStyle = "#101827";
  ctx.fill();
  ctx.strokeStyle = "#2f3a56";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#a6a6a6";
  setCanvasFont(ctx, 900, 18);
  ctx.fillText("FINAL VALUE", pad + 24, finalTop + 34);
  drawFittedText(ctx, finalValue, pad + 24, finalTop + 84, inner - 48, 900, 46, "#ffc500", 24);
  const statGap = 14, statW = (inner - statGap * 3) / 4;
  drawStatBox(
    ctx,
    latestResult.selectedItem ? "Base" : "Custom Value",
    "$" + wholeFormatter.format(latestResult.base),
    pad, statY, statW, 92,
  );
  drawStatBox(
    ctx, "Multiplier",
    formatRange(latestResult.multi, latestResult.multiMax, 2),
    pad + (statW + statGap), statY, statW, 92,
  );
  drawStatBox(
    ctx, "Condition",
    latestResult.condition.toFixed(3) + "x",
    pad + (statW + statGap) * 2, statY, statW, 92,
  );
  drawStatBox(
    ctx, "Grade",
    latestResult.grade + "x",
    pad + (statW + statGap) * 3, statY, statW, 92,
  );
  ctx.fillStyle = "#ffc500";
  setCanvasFont(ctx, 900, 20);
  ctx.fillText("MUTATIONS", pad, mutationsTitleY);
  if (!mutations.length) {
    ctx.fillStyle = "#a6a6a6";
    setCanvasFont(ctx, 900, 22);
    ctx.fillText("None", pad, noneY);
  } else {
    chipLayout.chips.forEach((chip) =>
      drawResultMutationChip(ctx, chip, pad, mutationPanelTop),
    );
  }
  ctx.fillStyle = "#8a8a8a";
  setCanvasFont(ctx, 800, 13);
  ctx.textAlign = "center";
  ctx.fillText(
    "Created by FieryWolfLevi & vantacry  \u2022  v0.3.5  \u2022  github.com/vantacry/Storage-Hunters-Open-World-Calculator",
    width / 2,
    height - 48,
  );
  ctx.textAlign = "left";
  return canvas;
}

// Convert the generated canvas into a PNG blob for clipboard or download use.
function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// Fall back to a file download when the browser blocks image clipboard writes.
function downloadBlob(blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "storage-hunters-result.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Copies a styled result image, with a download fallback.
async function copyResult() {
  const status = document.getElementById("copyStatus");
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  const canvas = createResultCanvas();
  const blob = await canvasToBlob(canvas);
  if (!blob) {
    status.innerText = "Could not create image.";
    return;
  }
  try {
    if (!window.ClipboardItem) throw new Error("Image clipboard unavailable");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    status.innerText = "Result image copied!";
  } catch (error) {
    downloadBlob(blob);
    status.innerText = "Result image downloaded. Browser blocked image copy.";
  }
}

// =============================================================================
// MAIN CALCULATION
// =============================================================================

// Main calculation: base value * mutation multiplier * condition factor * grade factor.
function calc() {
  clampCondition();
  let base = parseFloat(document.getElementById("base").value) || 0;
  let c = document.getElementById("condition").value;
  let conditionPercent = c === "" ? 100 : parseFloat(c);
  let grade = parseFloat(document.getElementById("grade").value);

  let mutations = getSelectedMutations();
  let multi = mutations.reduce((total, item) => total * item.value, 1);
  let multiMax = mutations.reduce((total, item) => total * item.max, 1);

  // 1. Apply the low value markup factor (boosts lower value items, but trophies have no markup)
  let isTrophy =
    selectedItem &&
    (selectedItem.rarity === "Gavel Trophy" ||
      selectedItem.name.includes("Trophy"));
  let markup;
  if (isTrophy) {
    markup = 1;
  } else if (mutations.length > 0) {
    if (base <= 1) {
      markup = 25;
    } else if (base <= 100) {
      markup = 25 / Math.pow(base, 1 - Math.log10(2));
    } else {
      markup = 1;
    }
  } else {
    markup = 1;
  }
  let effBase = base * markup;

  // 2. Calculate the Mutated Base Value using the marked up base value
  let mutatedBase = effBase * multi;
  let mutatedBaseMax = effBase * multiMax;

  // 3. Calculate the dynamic floor using the MUTATED values
  let floor = mutatedBase >= 1000 ? 0.6 : 0.25 + 0.00035 * mutatedBase;
  let floorMax = mutatedBaseMax >= 1000 ? 0.6 : 0.25 + 0.00035 * mutatedBaseMax;

  // 4. Calculate final condition factor based on those floors
  let condition = floor + (1 - floor) * (conditionPercent / 100);
  let conditionMax = floorMax + (1 - floorMax) * (conditionPercent / 100);

  // 5. Calculate total multipliers
  let total = markup * multi * condition * grade;
  let totalMax = markup * multiMax * conditionMax * grade;

  // Round total multipliers to 4 decimal places to match game formatting/math
  total = Math.round(total * 10000) / 10000;
  totalMax = Math.round(totalMax * 10000) / 10000;

  // 6. Calculate final display values
  let final = base * total;
  let finalMax = base * totalMax;

  // Subtract epsilon to align rounding of .xx5 values with game
  if (final > 0) final -= 1e-9;
  if (finalMax > 0) finalMax -= 1e-9;

  // Save state for the canvas copy function
  latestResult = {
    base,
    condition,
    grade,
    mutations,
    multi,
    multiMax,
    total,
    totalMax,
    final,
    finalMax,
    selectedItem,
  };

  updateSelectedItemOutput();
  renderActiveMultipliers(mutations);

  // Output to UI
  document.getElementById("muti").innerText =
    multi === multiMax
      ? multi.toLocaleString() + "x"
      : multi.toLocaleString() + "x - " + multiMax.toLocaleString() + "x";
  document.getElementById("markupOut").innerText =
    markup === 25 || markup === 1 ? markup + "x" : markup.toFixed(3) + "x";
  document.getElementById("cond").innerText =
    condition === conditionMax
      ? condition.toFixed(3) + "x"
      : condition.toFixed(3) + "x - " + conditionMax.toFixed(3) + "x";
  document.getElementById("gradeOut").innerText = grade + "x";
  document.getElementById("total").innerText =
    total === totalMax
      ? total.toFixed(3) + "x"
      : total.toFixed(3) + "x - " + totalMax.toFixed(3) + "x";
  document.getElementById("value").innerText =
    final === finalMax
      ? "$" + formatter.format(final)
      : "$" + formatter.format(final) + " - $" + formatter.format(finalMax);
}

// Clear user overrides and return the calculator to its default state.
function resetCalc() {
  document.getElementById("customToggle").checked = false;
  document.getElementById("customValueContainer").style.display = "none";
  document.getElementById("base").value = "";
  document.getElementById("condition").value = "";
  document.getElementById("grade").value = "1";
  selectedItem = null;
  document
    .querySelectorAll(".mutation-card input[type=checkbox]")
    .forEach((x) => {
      x.checked = false;
      x.closest(".mutation-card").classList.remove("is-selected");
    });
  document.getElementById("copyStatus").innerText = "";
  updateItemSelectionStyles();
  calc();
}

// =============================================================================
// WIKI MUTATION LOADING (page-specific: populates canvasMutationGradients)
// =============================================================================

async function loadWikiMutations() {
  const area = document.getElementById("mutationArea");
  try {
    const parsedMutations = await fetchWikiMutations();
    if (parsedMutations && parsedMutations.length > 0) {
      for (const key in groups) delete groups[key];

      parsedMutations.forEach((m) => {
        const cat = m.category || "Standard";
        if (cat.endsWith("Event")) {
          if (!groups["Event Mutations"]) groups["Event Mutations"] = {};
          if (!groups["Event Mutations"][cat]) groups["Event Mutations"][cat] = {};
          groups["Event Mutations"][cat][m.name] = m.multiplier;
        } else {
          const groupName = cat + " Mutations";
          if (!groups[groupName]) groups[groupName] = {};
          groups[groupName][m.name] = m.multiplier;
        }

        if (m.style) {
          mutationStyles[m.name] = m.style;
          const colors = extractColorsFromStyle(m.style);
          if (colors && colors.length > 0) {
            mutationColors[m.name] = colors[colors.length - 1];
            if (colors.length > 1) {
              canvasMutationGradients[m.name] = colors;
            }
          }
        }
      });
      renderMutations();
      calc();
    }
  } catch (error) {
    console.error("Mutation Wiki API could not be loaded:", error);
    area.innerHTML = `<div class="item-empty">Live Mutation data could not be loaded right now.</div>`;
  } finally {
    wikiMutationsLoaded = true;
    checkLoadingFinished();
  }
}

// =============================================================================
// EVENT LISTENERS & INIT
// =============================================================================

document.getElementById("copyResult").addEventListener("click", copyResult);

wireSharedItemIndexEvents(() => {
  document.getElementById("copyStatus").innerText =
    `${selectedItem.name} value loaded.`;
  calc();
});

wireSharedInputEvents(calc);

document.getElementById("mutationArea").innerHTML =
  `<div class="item-empty">Loading live mutations...</div>`;
loadWikiMutations();
loadItemIndex();
calc();
