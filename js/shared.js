// =============================================================================
// shared.js — Code shared between index.html (script.js) and
//             mutationCalculator.html (reverseCalc.js).
// =============================================================================

// -- Mutation data (populated at runtime from the wiki) -----------------------
const groups = {};
const mutationColors = {};
const mutationStyles = {};
const rarityColors = {};

// -- Number formatters --------------------------------------------------------
const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

// -- Item-index state ---------------------------------------------------------
let indexItems = [];
let selectedItem = null;
let renderFrame = null;
const activeAreas = new Set();

// -- Loader tracking state ----------------------------------------------------
let wikiItemsLoaded = false;
let wikiMutationsLoaded = false;

function checkLoadingFinished() {
  if (wikiItemsLoaded && wikiMutationsLoaded) {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
    }
  }
}

// -- Area metadata ------------------------------------------------------------
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

// -- Wiki API URLs ------------------------------------------------------------
const wikiItemApiUrl =
  "https://storagehunters.fandom.com/api.php?action=query&prop=revisions&titles=Module:ItemData&rvprop=content&format=json&origin=*";
const wikiMutationApiUrl =
  "https://storagehunters.fandom.com/api.php?action=query&prop=revisions&titles=Module:MutationData&rvprop=content&format=json&origin=*";

// =============================================================================
// UTILITY HELPERS
// =============================================================================

// Turns a single multiplier, range, or locked value into readable text.
function formatMutationValue(val) {
  return val && typeof val === "object"
    ? `${val.min}x - ${val.max}x`
    : typeof val === "string"
      ? val
      : `${val}x`;
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

// =============================================================================
// MUTATION CARD RENDERING
// =============================================================================

// Adds one mutation card to the given grid and preserves its min/max values for later math.
function addMutationCard(box, m, val, customStyle) {
  let disabled = val === null || typeof val === "string";
  let min = val && typeof val === "object" ? val.min : disabled ? 0 : val;
  let max = val && typeof val === "object" ? val.max : disabled ? 0 : val;
  let spanStyle = customStyle ? `style="${customStyle}"` : "";
  box.innerHTML += `<label class="mutation-card" style="--mutation-glow:${mutationColors[m] ?? "#f2d16b"}"><input type="checkbox" value="${min ?? 0}" data-min="${min ?? 0}" data-max="${max ?? 0}" data-name="${m}" ${disabled ? "disabled" : ""} onchange="handleMutationChange(this)"><span class="mutation ${m}" ${spanStyle}>${m} (${val === null ? "?" : formatMutationValue(val)})</span></label>`;
}

// Builds all mutation categories and cards, hiding 1x and null multipliers.
function renderMutations() {
  const area = document.getElementById("mutationArea");

  const checkedNames = Array.from(
    document.querySelectorAll(".mutation-card input[type=checkbox]:checked"),
  ).map((el) => el.getAttribute("data-name"));

  area.innerHTML = "";

  function isShownMutation(val) {
    if (val === null || val === undefined) return false;
    if (typeof val === "string") return false;
    if (typeof val === "number") return val !== 1;
    if (typeof val === "object" && "min" in val)
      return val.min !== 1 || val.max !== 1;
    return true;
  }

  for (let group in groups) {
    let items = groups[group];
    let hasSubgroups = Object.values(items).some(
      (x) => x && typeof x === "object" && !("min" in x),
    );

    if (hasSubgroups) {
      let groupHasAnyShown = false;
      let htmlBuffer = "";
      for (let subgroup in items) {
        let shownInSub = Object.keys(items[subgroup]).filter((m) =>
          isShownMutation(items[subgroup][m]),
        );
        if (shownInSub.length > 0) {
          groupHasAnyShown = true;
          let gridId = `${group}-${subgroup}`.replace(/\s+/g, "-");
          htmlBuffer += `<div class="subcategory">${subgroup}</div><div class="grid" id="${gridId}"></div>`;
        }
      }
      if (groupHasAnyShown) {
        area.innerHTML += `<div class="category">${group}</div>` + htmlBuffer;
        for (let subgroup in items) {
          let gridId = `${group}-${subgroup}`.replace(/\s+/g, "-");
          let box = document.getElementById(gridId);
          if (box) {
            for (let m in items[subgroup]) {
              const val = items[subgroup][m];
              if (isShownMutation(val))
                addMutationCard(box, m, val, mutationStyles[m]);
            }
          }
        }
      }
    } else {
      let shownInGroup = Object.keys(items).filter((m) =>
        isShownMutation(items[m]),
      );
      if (shownInGroup.length > 0) {
        area.innerHTML += `<div class="category">${group}</div><div class="grid" id="${group}"></div>`;
        let box = document.getElementById(group);
        for (let m in items) {
          const val = items[m];
          if (isShownMutation(val))
            addMutationCard(box, m, val, mutationStyles[m]);
        }
      }
    }
  }

  if (checkedNames.length > 0) {
    document
      .querySelectorAll(".mutation-card input[type=checkbox]")
      .forEach((el) => {
        if (checkedNames.includes(el.getAttribute("data-name"))) {
          el.checked = true;
          const card = el.closest(".mutation-card");
          if (card) card.classList.add("is-selected");
        }
      });
  }
}

// =============================================================================
// CONDITION / GRADE HELPERS
// =============================================================================

// Keeps the condition input between 0 and 100 before the main calculation runs.
function clampCondition() {
  const conditionInput = document.getElementById("condition");
  if (conditionInput.value === "") return;
  let current = parseFloat(conditionInput.value);
  if (Number.isNaN(current)) return;
  conditionInput.value = Math.min(100, Math.max(0, current));
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

// =============================================================================
// ITEM INDEX HELPERS
// =============================================================================

function updateSelectedItemOutput() {
  document.getElementById("selectedItemOut").innerText = selectedItem
    ? `${selectedItem.name} (${selectedItem.price})`
    : "Unknown/Custom Item";
}

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

function isKnownItem(item) {
  return item.name.trim() !== "?" && item.price.trim() !== "?";
}

function itemMatchesSearch(item, query) {
  return query === "" || item.name.toLowerCase().includes(query);
}

function getVisibleIndexItems() {
  return indexItems.filter((item) => areaOrder.includes(item.location));
}

function getAreaStats(areaName) {
  const areaItems = indexItems.filter((item) => item.location === areaName);
  const known = areaItems.filter(isKnownItem).length;
  return { known, total: areaItems.length };
}

function updateAreaCounts() {
  document.querySelectorAll(".area-filter").forEach((filter) => {
    const areaName = filter.querySelector("input").value;
    const stats = getAreaStats(areaName);
    filter.querySelector(".area-count").innerText =
      `${stats.known}/${stats.total}`;
  });
}

function setActiveArea(areaName, shouldActivate) {
  activeAreas.clear();
  document.querySelectorAll(".area-filter input").forEach((input) => {
    const isActive = shouldActivate && input.value === areaName;
    input.checked = isActive;
    if (isActive) activeAreas.add(input.value);
  });
  queueRenderItemIndex();
}

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

function isSelectedItem(item) {
  return (
    selectedItem &&
    selectedItem.name === item.name &&
    selectedItem.location === item.location
  );
}

// Get Fandom image URL for an item name.
function getItemImageUrl(name) {
  if (!name || name === "?") return "";
  const cleanName = name.trim().replace(/\s+/g, "_");
  return `https://storagehunters.fandom.com/wiki/Special:FilePath/${encodeURIComponent(cleanName)}.png`;
}

// Render one search result card with the right state and accessible fallback markup.
function renderItemCard(item) {
  const known = isKnownItem(item);
  const rarityKey = item.rarity.toLowerCase();
  const color = known ? rarityColors[rarityKey] || "#9e9e9e" : "#555";
  const selected = known && isSelectedItem(item) ? " is-selected" : "";
  const common = `class="item-card${selected}${known ? "" : " is-unknown"}" style="--rarity-color:${color}" data-value="${item.value ?? ""}" data-name="${escapeHtml(item.name)}" data-location="${escapeHtml(item.location)}" data-price="${escapeHtml(item.price)}" data-rarity="${escapeHtml(item.rarity)}"`;

  const imgUrl = getItemImageUrl(item.name);
  const imgHtml =
    known && imgUrl
      ? `<div class="item-image-wrapper"><img src="${imgUrl}" class="item-image" alt="${escapeHtml(item.name)}" loading="lazy" /></div>`
      : `<div class="item-image-wrapper"><span style="font-size:20px; opacity:0.4;">?</span></div>`;

  const body = `${imgHtml}<div class="item-details"><span class="item-name">${escapeHtml(item.name)}</span><span class="item-price">${escapeHtml(item.price)}</span></div>`;

  return known
    ? `<button ${common} type="button">${body}</button>`
    : `<div ${common} aria-disabled="true">${body}</div>`;
}

function getIndexScope(query) {
  if (activeAreas.size)
    return getVisibleIndexItems().filter((item) =>
      activeAreas.has(item.location),
    );
  return query ? indexItems : [];
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

// Preload all item images at startup so they are instantly cached.
function preloadItemImages(items) {
  items.forEach((item) => {
    if (item.name && item.name !== "?") {
      const img = new Image();
      img.src = getItemImageUrl(item.name);
    }
  });
}

// Drop the index selection whenever the user starts typing a custom value.
function clearSelectedItem() {
  if (!selectedItem) return;
  selectedItem = null;
  updateSelectedItemOutput();
  updateItemSelectionStyles();
}

// =============================================================================
// WIKI PARSING
// =============================================================================

// Extract the latest wiki module text from the API response shape.
function getWikiModuleContent(data) {
  const pages = data?.query?.pages || {};
  const page = pages[Object.keys(pages)[0]];
  const revision = page?.revisions?.[0] || {};
  return revision["*"] || revision.slots?.main?.["*"] || "";
}

// Parse rarity colors from the Module:ItemData text.
function parseRarityColors(luaText) {
  const startIdx = luaText.indexOf("local rarityColors = {");
  if (startIdx === -1) return null;
  const endIdx = luaText.indexOf("}", startIdx);
  if (endIdx === -1) return null;
  const block = luaText.slice(startIdx, endIdx);
  const parsed = {};
  const pattern = /\["([^"]+)"\]\s*=\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(block)) !== null) {
    parsed[match[1]] = match[2];
  }
  return parsed;
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

// Parses mutation records out of the wiki module Lua content.
function parseWikiMutations(luaText) {
  const startIdx = luaText.indexOf("p.mutations = {");
  if (startIdx === -1) return [];
  let endIdx = luaText.indexOf("function p.get");
  if (endIdx === -1) endIdx = luaText.length;
  const mutationsText = luaText.slice(startIdx, endIdx);
  const blockRegex = /\{[^{}]+\}/g;
  const blocks = mutationsText.match(blockRegex) || [];
  const parsed = [];
  for (const block of blocks) {
    const item = {};
    const nameMatch = block.match(/name\s*=\s*["']([^"']+)["']/);
    const multMatch = block.match(
      /multiplier\s*=\s*(["']([^"']+)["']|([\d.]+))/,
    );
    const catMatch = block.match(/category\s*=\s*["']([^"']+)["']/);
    const styleMatch = block.match(/style\s*=\s*["']([^"']+)["']/);
    if (nameMatch) item.name = nameMatch[1];
    if (multMatch) {
      const valStr = multMatch[2] || multMatch[3];
      const valNum = parseFloat(valStr);
      item.multiplier = isNaN(valNum) ? valStr : valNum;
    }
    if (catMatch) item.category = catMatch[1];
    if (styleMatch) item.style = styleMatch[1];
    if (item.name) parsed.push(item);
  }
  return parsed;
}

// Extract hex/rgba/word colors from standard CSS style rules to build gradients and glow.
function extractColorsFromStyle(style) {
  if (!style) return null;
  const gradientMatch = style.match(/linear-gradient\(([^)]+)\)/);
  if (gradientMatch) {
    const parts = gradientMatch[1].split(",");
    return parts
      .map((p) => p.trim())
      .filter(
        (p) => !p.startsWith("to ") && !p.endsWith("deg") && !/^\d+$/.test(p),
      )
      .map((p) => p.split(" ")[0]);
  }
  const colorMatch = style.match(/color\s*:\s*([^;]+)/);
  if (colorMatch) return [colorMatch[1].trim()];
  return null;
}

// Fetch the live wiki data and turn it into parsed item records.
async function fetchWikiItems() {
  const response = await fetch(wikiItemApiUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("Wiki API could not be loaded");
  const moduleText = getWikiModuleContent(await response.json());

  const parsedRarities = parseRarityColors(moduleText);
  if (parsedRarities) {
    for (const key in rarityColors) delete rarityColors[key];
    Object.assign(rarityColors, parsedRarities);
  }

  const items = parseItemsFile(moduleText);
  if (!items.length) throw new Error("Wiki API did not return item data");
  return items;
}

// Fetch the live wiki data and turn it into parsed mutation records.
async function fetchWikiMutations() {
  const response = await fetch(wikiMutationApiUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("Mutation Wiki API could not be loaded");
  const moduleText = getWikiModuleContent(await response.json());
  if (!moduleText) throw new Error("Wiki API did not return mutation data");
  return parseWikiMutations(moduleText);
}

// =============================================================================
// ITEM INDEX LOADING
// =============================================================================

// Load the item index, then populate the filters and grid once data is available.
async function loadItemIndex() {
  const grid = document.getElementById("itemGrid");
  try {
    indexItems = await fetchWikiItems();
    createAreaFilters();
    renderItemIndex();
    preloadItemImages(indexItems);
  } catch (error) {
    grid.innerHTML = `<div class="item-empty">Live Wiki data could not be loaded right now.</div>`;
  } finally {
    wikiItemsLoaded = true;
    checkLoadingFinished();
  }
}

// =============================================================================
// SHARED EVENT WIRING (called by each page script after DOM is ready)
// =============================================================================

function wireSharedItemIndexEvents(onItemSelect) {
  document.getElementById("itemGrid").addEventListener("click", (event) => {
    const card = event.target.closest("button.item-card");
    if (!card) return;
    if (card.dataset.value === "") return;
    selectedItem = {
      name: card.dataset.name,
      location: card.dataset.location,
      price: card.dataset.price,
      rarity: card.dataset.rarity,
      value: parseFloat(card.dataset.value),
    };
    document.getElementById("customToggle").checked = false;
    document.getElementById("customValueContainer").style.display = "none";
    document.getElementById("base").value = selectedItem.value;
    updateItemSelectionStyles();
    onItemSelect();
  });

  document
    .getElementById("itemSearch")
    .addEventListener("input", queueRenderItemIndex);
}

function wireSharedInputEvents(onCalc) {
  document.getElementById("base").addEventListener("input", () => {
    clearSelectedItem();
    onCalc();
  });

  document.getElementById("customToggle").addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    document.getElementById("customValueContainer").style.display = isChecked
      ? "block"
      : "none";
    if (isChecked) {
      clearSelectedItem();
      document.getElementById("base").value = "";
      document.getElementById("base").focus();
    } else {
      document.getElementById("base").value = selectedItem
        ? selectedItem.value
        : "";
    }
    onCalc();
  });

  ["condition", "grade"].forEach((id) =>
    document.getElementById(id).addEventListener("input", onCalc),
  );
}
