// =============================================================================
// reverseCalc.js — Mutation Finder page (mutationCalculator.html)
// Depends on shared.js which must be loaded first.
// =============================================================================

// Sync the visual selection state and trigger reverse calc whenever a
// mutation checkbox changes.
function handleMutationChange(input) {
  input.closest(".mutation-card").classList.toggle("is-selected", input.checked);
  reverseCalc();
}

// =============================================================================
// FORWARD FORMULA EVALUATOR
//
// Replicates the exact same math as calc() in script.js so that Newton's
// method can evaluate it at arbitrary unknown multiplier values.
// =============================================================================


function computeSellPrice(base, conditionPercent, grade, knownMulti, unknownMulti, isTrophy, smooth = false) {
  // 1. Markup — always applied since there is at least the unknown mutation
  let totalMulti = knownMulti * unknownMulti;
  let markup;
  if (isTrophy) {
    markup = 1;
  } else if (base <= 1) {
    markup = 25;
  } else if (base <= 100) {
    markup = 25 / Math.pow(base, 1 - Math.log10(2));
  } else {
    markup = 1;
  }

  let effBase = base * markup;

  // 2. Mutated base
  let mutatedBase = effBase * totalMulti;

  // 3. Dynamic floor
  let floor = mutatedBase >= 1000 ? 0.6 : 0.25 + 0.00035 * mutatedBase;

  // 4. Condition factor
  let condition = floor + (1 - floor) * (conditionPercent / 100);

  // 5. Total multiplier
  let total = markup * totalMulti * condition * grade;
  if (!smooth) {
    total = Math.round(total * 10000) / 10000;
  }

  // 6. Final value
  let final = base * total;
  if (final > 0) final -= 1e-9;

  return { final, markup, condition };
}

// =============================================================================
// REVERSE CALCULATION
//
// Given a known sell price and selected known mutations the user picks,
// Newton's method iteratively solves for the unknown mutation's multiplier.
// =============================================================================

function reverseCalc() {
  clampCondition();
  let base = parseFloat(document.getElementById("base").value) || 0;
  let c = document.getElementById("condition").value;
  let conditionPercent = c === "" ? 100 : parseFloat(c);
  let grade = parseFloat(document.getElementById("grade").value);
  let sellPrice = parseFloat(document.getElementById("sellPrice").value) || 0;

  let mutations = getSelectedMutations();
  let knownMulti = mutations.reduce((total, item) => total * item.value, 1);
  let knownMultiMax = mutations.reduce((total, item) => total * item.max, 1);

  let isTrophy =
    selectedItem &&
    (selectedItem.rarity === "Gavel Trophy" ||
      selectedItem.name.includes("Trophy"));

  // Update static display fields
  updateSelectedItemOutput();
  document.getElementById("knownMutationsOut").innerText =
    mutations.length > 0 ? mutations.map((m) => m.name).join(", ") : "None";
  document.getElementById("knownMultiOut").innerText =
    knownMulti === knownMultiMax
      ? knownMulti + "x"
      : knownMulti + "x - " + knownMultiMax + "x";
  document.getElementById("gradeOut").innerText = grade + "x";

  if (base <= 0 || sellPrice <= 0) {
    document.getElementById("unknownMulti").innerText = "?";
    document.getElementById("markupOut").innerText = "?";
    document.getElementById("cond").innerText = "?";
    return;
  }

  // --- Newton's method solver ---
  function solve(knownM) {
    let u = 1.0;
    const maxIter = 100;
    for (let i = 0; i < maxIter; i++) {
      const result = computeSellPrice(base, conditionPercent, grade, knownM, u, isTrophy, true);
      const f = result.final - sellPrice;
      if (Math.abs(f) < 0.005) break;

      const du = Math.max(u * 0.0001, 1e-8);
      const resultPlus = computeSellPrice(base, conditionPercent, grade, knownM, u + du, isTrophy, true);
      const fPrime = (resultPlus.final - result.final) / du;
      if (Math.abs(fPrime) < 1e-12) break;

      u = u - f / fPrime;
      if (u < 0) u = 0.01;
    }
    return u;
  }

  const u = solve(knownMulti);
  const uMax = knownMulti !== knownMultiMax ? solve(knownMultiMax) : u;

  const solved = computeSellPrice(base, conditionPercent, grade, knownMulti, u, isTrophy);

  document.getElementById("markupOut").innerText =
    solved.markup === 25 || solved.markup === 1
      ? solved.markup + "x"
      : solved.markup.toFixed(3) + "x";
  document.getElementById("cond").innerText = solved.condition.toFixed(3) + "x";

  const roundedU = Math.round(u * 10000) / 10000;
  const roundedUMax = Math.round(uMax * 10000) / 10000;

  if (roundedU === roundedUMax || knownMulti === knownMultiMax) {
    document.getElementById("unknownMulti").innerText = roundedU.toFixed(4) + "x";
  } else {
    const lo = Math.min(roundedU, roundedUMax);
    const hi = Math.max(roundedU, roundedUMax);
    document.getElementById("unknownMulti").innerText =
      lo.toFixed(4) + "x - " + hi.toFixed(4) + "x";
  }
}

// Clear all inputs and reset the page.
function resetCalc() {
  document.getElementById("customToggle").checked = false;
  document.getElementById("customValueContainer").style.display = "none";
  document.getElementById("base").value = "";
  document.getElementById("sellPrice").value = "";
  document.getElementById("condition").value = "";
  document.getElementById("grade").value = "1";
  selectedItem = null;
  document
    .querySelectorAll(".mutation-card input[type=checkbox]")
    .forEach((x) => {
      x.checked = false;
      x.closest(".mutation-card").classList.remove("is-selected");
    });
  updateItemSelectionStyles();
  reverseCalc();
}

// =============================================================================
// WIKI MUTATION LOADING
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
          }
        }
      });
      renderMutations();
      reverseCalc();
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

wireSharedItemIndexEvents(reverseCalc);
wireSharedInputEvents(reverseCalc);

document.getElementById("sellPrice").addEventListener("input", reverseCalc);

document.getElementById("mutationArea").innerHTML =
  `<div class="item-empty">Loading live mutations...</div>`;
loadWikiMutations();
loadItemIndex();
reverseCalc();
