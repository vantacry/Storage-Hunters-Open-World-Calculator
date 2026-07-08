// Mutation groups and their multipliers. A range has "min" and "max"; "null" means the value is unknown and the card is disabled.
const groups = {
  "Standard Mutations": {
    Dirty: 0.8,
    Silver: 2,
    Gold: 4,
    Corrupted: 6,
    Diamond: 8,
    Gem: 10,
    Chrome: 12,
    Hologram: 15,
    Black: "Unobtainable",
    Void: 35,
    Secret: 50,
    Rainbow: null,
    Tiny: 2,
    Huge: 2,
  },
  "Event Mutations": {
    "Rain Event": { Wet: 6, Shocked: 6 },
    "Moonlit Event": { Moonlit: 1.5, Firefly: 5 },
  },
  "Washing Mutations": { Pure: 1.875, Spotless: 3.125 },
  "Time Capsule Mutations": {
    Cobwebbed: 1.2,
    Antique: 2,
    Ancient: 5,
    Timeless: 12,
  },
};

// Mutation cards are rendered into this container at startup.
const area = document.getElementById("mutationArea");
// Each mutation gets a matching highlight color for the selected-card glow effect.
const mutationColors = {
  Dirty: "#8b6b4a",
  Pure: "#ffffff",
  Silver: "#cfd8dc",
  Gold: "#ffd700",
  Corrupted: "#39ff14",
  Diamond: "#76c0e6",
  Gem: "#ff007f",
  Chrome: "#e0e0e0",
  Hologram: "#00ffff",
  Black: "#111111",
  Void: "#4b0082",
  Secret: "#ff4b4b",
  Rainbow: "#ff3bd4",
  Huge: "#ffffff",
  Tiny: "#ffffff",
  Moonlit: "#6dd5ed",
  Firefly: "#ffea00",
  Wet: "#00c6ff",
  Shocked: "#ffff00",
  Spotless: "#00e5ff",
  Cobwebbed: "#d6d6d6",
  Antique: "#cd853f",
  Ancient: "#8fbc8f",
  Timeless: "#e6c229",
};

// Number formatters keep money and copied values readable.
const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

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

let indexItems = [];
let selectedItem = null;
let renderFrame = null;
const activeAreas = new Set();
const rarityColors = {
  junk: "#7b5835",
  uncommon: "#62b978",
  rare: "#6e9fe8",
  epic: "#b675e7",
  legendary: "#f0c95d",
  mythical: "#ef78ed",
  lost: "#d58a52",
};

const areaOrder = [
  "Junk Yard",
  "Back Alley",
  "Farmyard",
  "Shipyard",
  "Cargo Ship",
  "Lost",
  "Exclusive",
];
const areaColors = {
  "Junk Yard": "#9b8240",
  "Back Alley": "#8b6be8",
  Farmyard: "#7fd36c",
  Shipyard: "#4f9cff",
  "Cargo Ship": "#ff6846",
  Lost: "#ff8a35",
  Exclusive: "#ff7782",
};

const areaLabels = { "Cargo Ship": "Cargo" };
const wikiApiUrl =
  "https://storagehunters.fandom.com/api.php?action=query&prop=revisions&titles=Module:ItemData&rvprop=content&format=json&origin=*";
// Turns a single multiplier, range, or locked value into readable text.
function formatMutationValue(val) {
  return val && typeof val === "object"
    ? `${val.min}x - ${val.max}x`
    : typeof val === "string"
      ? val
      : `${val}x`;
}

// Adds one mutation card to the given grid and preserves its min/max values for later math.
function addMutationCard(box, m, val) {
  let disabled = val === null || typeof val === "string";
  let min = val && typeof val === "object" ? val.min : disabled ? 0 : val;
  let max = val && typeof val === "object" ? val.max : disabled ? 0 : val;
  box.innerHTML += `<label class="mutation-card" style="--mutation-glow:${mutationColors[m] ?? "#f2d16b"}"><input type="checkbox" value="${min ?? 0}" data-min="${min ?? 0}" data-max="${max ?? 0}" data-name="${m}" ${disabled ? "disabled" : ""} onchange="handleMutationChange(this)"><span class="mutation ${m}">${m} (${val === null ? "?" : formatMutationValue(val)})</span></label>`;
}

// Builds all mutation categories and cards from the data above.
for (let group in groups) {
  area.innerHTML += `<div class="category">${group}</div>`;
  let items = groups[group];
  let hasSubgroups = Object.values(items).some(
    (x) => x && typeof x === "object" && !("min" in x),
  );
  if (hasSubgroups) {
    for (let subgroup in items) {
      let gridId = `${group}-${subgroup}`.replace(/\s+/g, "-");
      area.innerHTML += `<div class="subcategory">${subgroup}</div><div class="grid" id="${gridId}"></div>`;
      let box = document.getElementById(gridId);
      for (let m in items[subgroup])
        addMutationCard(box, m, items[subgroup][m]);
    }
  } else {
    area.innerHTML += `<div class="grid" id="${group}"></div>`;
    let box = document.getElementById(group);
    for (let m in items) addMutationCard(box, m, items[m]);
  }
}

// Keeps the condition input between 0 and 100 before the main calculation runs.
function clampCondition() {
  const conditionInput = document.getElementById("condition");
  if (conditionInput.value === "") return;
  let current = parseFloat(conditionInput.value);
  if (Number.isNaN(current)) return;
  conditionInput.value = Math.min(100, Math.max(0, current));
}

// Sync the visual selection state and recalculate whenever a mutation checkbox changes.
function handleMutationChange(input) {
  input
    .closest(".mutation-card")
    .classList.toggle("is-selected", input.checked);
  calc();
}

// Returns all checked mutation cards as simple name/value objects.
function getSelectedMutations() {
  return Array.from(
    document.querySelectorAll(".mutation-card input[type=checkbox]:checked"),
  ).map((x) => ({
    name: x.dataset.name,
    value: parseFloat(x.dataset.min),
    max: parseFloat(x.dataset.max),
  }));
}

// Sort selected mutations so the most important entries appear first in the summary and export.
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

function updateSelectedItemOutput() {
  document.getElementById("selectedItemOut").innerText = selectedItem
    ? `${selectedItem.name} (${selectedItem.price})`
    : "Custom Value";
}

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
  let isTrophy = selectedItem && (selectedItem.rarity === "Gavel Trophy" || selectedItem.name.includes("Trophy"));
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

  // Round total multipliers to 4 decimal places to match game formatting/math (fixes issues with .xx5 values rounding differently in JS vs Lua)
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
  muti.innerText =
    multi === multiMax
      ? multi.toLocaleString() + "x"
      : multi.toLocaleString() + "x - " + multiMax.toLocaleString() + "x";
  document.getElementById("markupOut").innerText =
    markup === 25 || markup === 1
      ? markup + "x"
      : markup.toFixed(3) + "x";
  cond.innerText =
    condition === conditionMax
      ? condition.toFixed(3) + "x"
      : condition.toFixed(3) + "x - " + conditionMax.toFixed(3) + "x";
  gradeOut.innerText = grade + "x";
  document.getElementById("total").innerText =
    total === totalMax
      ? total.toFixed(3) + "x"
      : total.toFixed(3) + "x - " + totalMax.toFixed(3) + "x";
  value.innerText =
    final === finalMax
      ? "$" + formatter.format(final)
      : "$" + formatter.format(final) + " - $" + formatter.format(finalMax);
}

// Clear user overrides and return the calculator to its default state.
function resetCalc() {
  base.value = "";
  condition.value = "";
  grade.value = "1";
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

function drawFittedText(
  ctx,
  text,
  x,
  y,
  maxWidth,
  weight,
  size,
  color,
  minSize = 18,
) {
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
  ctx.fillStyle = "#151515";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#a6a6a6";
  setCanvasFont(ctx, 900, 17);
  ctx.fillText(label.toUpperCase(), x + 18, y + 30);
  drawFittedText(ctx, value, x + 18, y + 69, w - 36, 900, 26, "#fff", 14);
}

const canvasMutationGradients = {
  Dirty: ["#b98658", "#8b6b4a", "#6b4a2f"],
  Silver: ["#cfd8dc", "#b0bec5", "#eceff1"],
  Gold: ["#ffd700", "#ffa500", "#fff7c2"],
  Corrupted: ["#0d5f15", "#050505", "#39ff14"],
  Diamond: ["#b9e3de", "#76c0e6", "#ffffff"],
  Gem: ["#ff007f", "#70011d", "#ff5252"],
  Chrome: ["#e0e0e0", "#ffffff", "#9e9e9e"],
  Void: ["#35105f", "#7b2cff", "#230047"],
  Secret: ["#ff4b4b", "#ee4b2b", "#59110b"],
  Rainbow: ["#ff0000", "#ffa500", "#ffff00", "#00aa00", "#006aff", "#8a2be2"],
  Moonlit: ["#7b5cff", "#6dd5ed", "#b8f4ff"],
  Antique: ["#8b5a2b", "#cd853f", "#eedc82"],
  Ancient: ["#556b2f", "#8fbc8f", "#2f4f4f"],
  Timeless: ["#b8860b", "#e6c229", "#b8860b"],
  Wet: ["#00c6ff", "#0072ff"],
  Shocked: ["#ffff00", "#ffa500"],
};

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
  let x = 0,
    y = 0;
  const gap = 16,
    rowHeight = 34;
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
  const x = originX + chip.x,
    y = originY + chip.y;
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
  const width = 1080,
    pad = 56,
    inner = width - pad * 2;
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
  const height = mutations.length
    ? Math.max(itemMeta ? 610 : 586, mutationPanelTop + chipLayout.height + 56)
    : itemMeta
      ? 590
      : 566;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0f0f0f";
  ctx.fillRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#252525");
  bg.addColorStop(0.55, "#181818");
  bg.addColorStop(1, "#101010");
  roundedRect(ctx, 28, 28, width - 56, height - 56, 22);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(242,209,107,.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#8cff9f";
  setCanvasFont(ctx, 900, 20);
  ctx.fillText("Storage Hunters Calculator", pad, 78);
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
  ctx.fillStyle = "#0d0d0f";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#a6a6a6";
  setCanvasFont(ctx, 900, 18);
  ctx.fillText("FINAL VALUE", pad + 24, finalTop + 34);
  drawFittedText(
    ctx,
    finalValue,
    pad + 24,
    finalTop + 84,
    inner - 48,
    900,
    46,
    "#f2d16b",
    24,
  );
  const statGap = 14,
    statW = (inner - statGap * 3) / 4;
  drawStatBox(
    ctx,
    latestResult.selectedItem ? "Base" : "Custom Value",
    "$" + wholeFormatter.format(latestResult.base),
    pad,
    statY,
    statW,
    92,
  );
  drawStatBox(
    ctx,
    "Multiplier",
    formatRange(latestResult.multi, latestResult.multiMax, 2),
    pad + (statW + statGap),
    statY,
    statW,
    92,
  );
  drawStatBox(
    ctx,
    "Condition",
    latestResult.condition.toFixed(3) + "x",
    pad + (statW + statGap) * 2,
    statY,
    statW,
    92,
  );
  drawStatBox(
    ctx,
    "Grade",
    latestResult.grade + "x",
    pad + (statW + statGap) * 3,
    statY,
    statW,
    92,
  );
  ctx.fillStyle = "#d6c486";
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

// Copies a styled result image, with a download fallback for browsers that block image clipboard writes.
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

// Escape user-visible text before injecting it into dynamically generated markup.
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

// Extract a numeric value from the wiki price string when the item is known.
function parseItemValue(price) {
  const clean = (price || "").replace(/[^\d.]/g, "");
  return clean ? parseFloat(clean) : null;
}

// Pull item records out of the wiki module text using a strict pattern match.
function parseItemsFile(text) {
  const itemPattern =
    /\{\s*name\s*=\s*"([^"]*)",\s*price\s*=\s*"([^"]*)",\s*rarity\s*=\s*"([^"]*)",\s*location\s*=\s*"([^"]*)"\s*\}/g;
  return Array.from(text.matchAll(itemPattern), (m) => ({
    name: m[1],
    price: m[2],
    rarity: m[3],
    location: m[4],
    value: parseItemValue(m[2]),
  }));
}

// Treat question-mark entries as unknown so they can be styled and filtered differently.
function isKnownItem(item) {
  return item.name.trim() !== "?" && item.price.trim() !== "?";
}

// Search only against the item name because that is the user-facing lookup field.
function itemMatchesSearch(item, query) {
  return query === "" || item.name.toLowerCase().includes(query);
}

// Restrict the index to areas that belong in the in-game item list.
function getVisibleIndexItems() {
  return indexItems.filter((item) => areaOrder.includes(item.location));
}

// Count how many items in one area are known versus total entries.
function getAreaStats(areaName) {
  const areaItems = indexItems.filter((item) => item.location === areaName);
  const known = areaItems.filter(isKnownItem).length;
  return { known, total: areaItems.length };
}

// Refresh the area badges so each filter shows live known/total counts.
function updateAreaCounts() {
  document.querySelectorAll(".area-filter").forEach((filter) => {
    const areaName = filter.querySelector("input").value;
    const stats = getAreaStats(areaName);
    filter.querySelector(".area-count").innerText =
      `${stats.known}/${stats.total}`;
  });
}

// Keep only one area active at a time and trigger a rerender of the item grid.
function setActiveArea(areaName, shouldActivate) {
  activeAreas.clear();
  document.querySelectorAll(".area-filter input").forEach((input) => {
    const isActive = shouldActivate && input.value === areaName;
    input.checked = isActive;
    if (isActive) activeAreas.add(input.value);
  });
  queueRenderItemIndex();
}

// Build the area filter chips from the configured area list.
function createAreaFilters() {
  const holder = document.getElementById("areaFilters");
  activeAreas.clear();
  holder.innerHTML = areaOrder
    .map(
      (areaName) =>
        `<label class="area-filter" style="--area-color:${areaColors[areaName]}"><input type="checkbox" value="${escapeHtml(areaName)}"><span class="area-card"><span class="area-name">${escapeHtml(areaLabels[areaName] || areaName)}</span><span class="area-count">0/0</span></span></label>`,
    )
    .join("");
  holder
    .querySelectorAll("input")
    .forEach((input) =>
      input.addEventListener("change", () =>
        setActiveArea(input.value, input.checked),
      ),
    );
}

// Compare the current selection against a rendered item row.
function isSelectedItem(item) {
  return (
    selectedItem &&
    selectedItem.name === item.name &&
    selectedItem.location === item.location
  );
}

// Keep the selected card highlighted when the base value changes elsewhere.
function updateItemSelectionStyles() {
  document.querySelectorAll(".item-card").forEach((card) => {
    card.classList.toggle(
      "is-selected",
      selectedItem &&
        card.dataset.name === selectedItem.name &&
        card.dataset.location === selectedItem.location,
    );
  });
}

// Load a known item from the index into the calculator and mark it as selected.
function selectIndexItem(card) {
  if (card.dataset.value === "") return;
  selectedItem = {
    name: card.dataset.name,
    location: card.dataset.location,
    price: card.dataset.price,
    rarity: card.dataset.rarity,
    value: parseFloat(card.dataset.value),
  };
  document.getElementById("base").value = selectedItem.value;
  document.getElementById("copyStatus").innerText =
    `${selectedItem.name} value loaded.`;
  updateItemSelectionStyles();
  calc();
}

// Drop the index selection whenever the user starts typing a custom value.
function clearSelectedItem() {
  if (!selectedItem) return;
  selectedItem = null;
  updateSelectedItemOutput();
  updateItemSelectionStyles();
}

// Decide whether the search should show the full dataset or only the active-area subset.
function getIndexScope(query) {
  if (activeAreas.size)
    return getVisibleIndexItems().filter((item) =>
      activeAreas.has(item.location),
    );
  return query ? indexItems : [];
}

// Render one search result card with the right state and accessible fallback markup.
function renderItemCard(item) {
  const known = isKnownItem(item);
  const rarityKey = item.rarity.toLowerCase();
  const color = known ? rarityColors[rarityKey] || "#9e9e9e" : "#555";
  const selected = known && isSelectedItem(item) ? " is-selected" : "";
  const common = `class="item-card${selected}${known ? "" : " is-unknown"}" style="--rarity-color:${color}" data-value="${item.value ?? ""}" data-name="${escapeHtml(item.name)}" data-location="${escapeHtml(item.location)}" data-price="${escapeHtml(item.price)}" data-rarity="${escapeHtml(item.rarity)}"`;
  const body = `<span class="item-name">${escapeHtml(item.name)}</span><span class="item-meta"><span>${escapeHtml(item.location)}</span><span class="item-rarity">${escapeHtml(item.rarity)}</span></span><span class="item-price">${escapeHtml(item.price)}</span>`;
  return known
    ? `<button ${common} type="button">${body}</button>`
    : `<div ${common} aria-disabled="true">${body}</div>`;
}

// Apply filters, refresh counts, and render the current item index view.
function renderItemIndex() {
  const query = document
    .getElementById("itemSearch")
    .value.trim()
    .toLowerCase();
  const grid = document.getElementById("itemGrid");
  const filtered = getIndexScope(query).filter((item) =>
    itemMatchesSearch(item, query),
  );
  updateAreaCounts();
  if (!activeAreas.size && !query) {
    grid.innerHTML = "";
    return;
  }
  if (!filtered.length) {
    grid.innerHTML = `<div class="item-empty">No matching items.</div>`;
    return;
  }
  grid.innerHTML = filtered.map(renderItemCard).join("");
}

// Coalesce repeated input events into a single animation-frame render.
function queueRenderItemIndex() {
  if (renderFrame) cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(() => {
    renderFrame = null;
    renderItemIndex();
  });
}

// Extract the latest wiki module text from the API response shape.
function getWikiModuleContent(data) {
  const pages = data?.query?.pages || {};
  const page = pages[Object.keys(pages)[0]];
  const revision = page?.revisions?.[0] || {};
  return revision["*"] || revision.slots?.main?.["*"] || "";
}

// Fetch the live wiki data and turn it into parsed item records.
async function fetchWikiItems() {
  const response = await fetch(wikiApiUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("Wiki API could not be loaded");
  const moduleText = getWikiModuleContent(await response.json());
  const items = parseItemsFile(moduleText);
  if (!items.length) throw new Error("Wiki API did not return item data");
  return items;
}

// Show whether the item index is live or operating from an offline fallback.
function setItemSource(text, isLive) {
  document.getElementById("itemSource").innerHTML =
    `<span class="live-dot" aria-hidden="true"></span><span>${escapeHtml(text)}</span>`;
  document.getElementById("itemSource").classList.toggle("is-offline", !isLive);
}

// Load the item index, then populate the filters and grid once data is available.
async function loadItemIndex() {
  const grid = document.getElementById("itemGrid");
  try {
    indexItems = await fetchWikiItems();
    setItemSource("Wiki live", true);
    createAreaFilters();
    renderItemIndex();
  } catch (error) {
    setItemSource("Wiki unavailable", false);
    grid.innerHTML = `<div class="item-empty">Live Wiki data could not be loaded right now.</div>`;
  }
}

// Recalculate whenever the user changes an input, and run once on page load.
document.getElementById("copyResult").addEventListener("click", copyResult);
document.getElementById("itemGrid").addEventListener("click", (event) => {
  const card = event.target.closest("button.item-card");
  if (card) selectIndexItem(card);
});
document
  .getElementById("itemSearch")
  .addEventListener("input", queueRenderItemIndex);
document.getElementById("base").addEventListener("input", () => {
  clearSelectedItem();
  document.getElementById("copyStatus").innerText = "";
  calc();
});
["condition", "grade"].forEach((id) =>
  document.getElementById(id).addEventListener("input", calc),
);
loadItemIndex();
calc();
