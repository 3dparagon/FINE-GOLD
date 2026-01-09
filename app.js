/* =========================
   Fine Gold
   Stable version (EUR + USD)
========================= */

// ⚠️ ПОМЕНЯТЬ ПЕРЕД ПУБЛИКАЦИЕЙ
const CALL_NUMBER = "+0000000000";
const WHATSAPP_NUMBER = "+0000000000";
const TELEGRAM_USERNAME = "fine_gold_riga"; // без @

// --- CONSTANTS ---
const OUNCE_TO_GRAM = 31.1034768;
const MAIN_PURITY = 999.9;

// --- STATE ---
const state = {
  currency: "EUR",
  goldPerGram999: null,
  lastUpdated: null,
  activeProbe: 999.9,
  activeInput: ""
};

// --- DATA ---
const rows = [
  { probe: 999.9, label: "24K" },
  { probe: 958, label: "23K" },
  { probe: 750, label: "18K" },
  { probe: 585, label: "14K" },
  { probe: 417, label: "10K" },
  { probe: 375, label: "9K" }
];

// --- HELPERS ---
function fmtMoneyEUR(x){
  if (!isFinite(x)) return "—";
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x) + " €";
}

function fmtMoneyUSD(x){
  if (!isFinite(x)) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x) + " $";
}

function fmtNumber(x){
  if (!isFinite(x)) return "";
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
}

function parseNumber(v){
  if (!v) return 0;
  return parseFloat(v.replace(",", "."));
}

function pure999FromAlloy(weight, probe){
  return weight * (probe / 999.9);
}

function alloyFromPure999(pure, probe){
  return pure * (999.9 / probe);
}

// --- DOM ---
const listEl = document.getElementById("list");
const pricePerGEl = document.getElementById("pricePerG");
const pureWeightEl = document.getElementById("pureWeight");
const totalPriceEl = document.getElementById("totalPrice");
const liveUpdateEl = document.getElementById("liveUpdate");
const buySpotEl = document.getElementById("buySpot");
const buyUpdatedEl = document.getElementById("buyUpdated");

// --- RENDER ---
function renderList(){
  listEl.innerHTML = "";
  rows.forEach(r => {
    const el = document.createElement("div");
    el.className = "item";
    el.dataset.probe = r.probe;
    el.innerHTML = `
      <div class="left">${r.probe}° <span>${r.label}</span></div>
      <input class="massInput" type="text" placeholder="0.00">
      <div class="sub" id="sub-${r.probe}">—</div>
    `;
    const input = el.querySelector(".massInput");
    input.addEventListener("input", () => {
      state.activeProbe = r.probe;
      state.activeInput = input.value;
      updateAll();
    });
    listEl.appendChild(el);
  });
}

// --- UPDATE ---
function updateAll(){
  const grams = parseNumber(state.activeInput);
  const pure999 = pure999FromAlloy(grams, state.activeProbe);

  document.querySelectorAll(".item").forEach(item => {
    const probe = parseFloat(item.dataset.probe);
    const input = item.querySelector(".massInput");
    if (probe === state.activeProbe) return;
    if (!grams) {
      input.value = "";
      return;
    }
    input.value = fmtNumber(alloyFromPure999(pure999, probe));
  });

  if (!state.goldPerGram999){
    pricePerGEl.textContent = "—";
    totalPriceEl.textContent = "—";
    buySpotEl.textContent = "—";
    return;
  }

  const price = state.goldPerGram999;
  pricePerGEl.textContent = fmtMoneyEUR(price);
  buySpotEl.textContent = fmtMoneyEUR(price);

  if (!grams){
    pureWeightEl.textContent = "—";
    totalPriceEl.textContent = "—";
  } else {
    pureWeightEl.textContent = fmtNumber(pure999) + " g";
    totalPriceEl.textContent = fmtMoneyEUR(pure999 * price);
  }

  liveUpdateEl.textContent = state.lastUpdated
    ? state.lastUpdated.toLocaleString("de-DE")
    : "—";
}

// --- LOAD PRICE ---
async function loadGoldPrice(){
  try{
    const res = await fetch("https://api.edelmetalle.de/public.json", { cache: "no-store" });
    const data = await res.json();
    const eurPerGram = Number(data.gold_eur) / OUNCE_TO_GRAM;
    state.goldPerGram999 = eurPerGram;
    state.lastUpdated = new Date();
    updateAll();
  } catch {
    updateAll();
  }
}

// --- CONTACTS ---
document.getElementById("tgBtn").href = `https://t.me/${TELEGRAM_USERNAME}`;
document.getElementById("waBtn").href = `https://wa.me/${WHATSAPP_NUMBER.replace("+","")}`;

// --- INIT ---
renderList();
loadGoldPrice();
