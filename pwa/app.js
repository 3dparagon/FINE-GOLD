const OZ_TO_G = 31.1034768;

const fmt = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const f2 = (n) => fmt.format(n);

const rows = [
  { p: 958, l: "958°", k: "23K" },
  { p: 750, l: "750°", k: "18K" },
  { p: 585, l: "585°", k: "14K" },
  { p: 417, l: "417°", k: "10K" },
  { p: 375, l: "375°", k: "9K" },
];

// DOM
const list = document.getElementById("list");
const mainInput = document.getElementById("main999Input");
const mainSub = document.getElementById("main999Sub");
const eq9999El = document.getElementById("eq9999");
const priceEl = document.getElementById("pricePerGram");
const totalEl = document.getElementById("totalPrice");
const liveStampEl = document.getElementById("liveStamp");

const eurBtn = document.getElementById("eurBtn");
const usdBtn = document.getElementById("usdBtn");
const resetBtn = document.getElementById("resetBtn");

// state
let currency = "EUR";
let activeProbe = 585;
let pricePerGram999 = null;

// cache row elements
const rowEls = new Map();
const rowInputs = new Map();
const rowSubs = new Map();

function toNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// math
function pureFromAlloy(mass, probe) {
  // pure 24K grams inside alloy
  return mass * (probe / 999.9);
}
function alloyFromPure(pureMass, probe) {
  return pureMass * 999.9 / probe;
}
function alloyPricePerGram(purePrice, probe) {
  return purePrice * (probe / 999.9);
}

// dd.mm.yyyy hh:mm
function formatDateTime(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

// price fetch (safe)
async function loadPrice() {
  try {
    const url = `https://data-asg.goldprice.org/dbXRates/${encodeURIComponent(currency)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const xau = Number(data?.items?.[0]?.xauPrice);
    if (!Number.isFinite(xau) || xau <= 0) throw new Error("Bad xauPrice");

    // xauPrice is per troy ounce -> convert to per gram
    pricePerGram999 = xau / OZ_TO_G;

    if (liveStampEl) liveStampEl.textContent = formatDateTime(Date.now());
  } catch (e) {
    pricePerGram999 = null;
    if (liveStampEl) liveStampEl.textContent = "—";
    console.warn("Price load failed:", e);
  }
}

// render
function renderOnce() {
  list.innerHTML = rows.map(r => `
    <div class="item" data-probe="${r.p}">
      <div class="left">
        <span class="probe">${r.l}</span>
        <span class="karat">${r.k}</span>
      </div>
      <div class="right">
        <div class="inputRow">
          <input class="massInput" type="number" step="0.01" value="0.00" />
          <span class="unit">g</span>
        </div>
        <div class="subvalue">0,00 ${currency} / 1 g</div>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".item").forEach(item => {
    const probe = Number(item.dataset.probe);
    const input = item.querySelector(".massInput");
    const sub = item.querySelector(".subvalue");

    rowEls.set(probe, item);
    rowInputs.set(probe, input);
    rowSubs.set(probe, sub);

    item.addEventListener("click", () => {
      setActive(probe);
      input.focus();
      input.select?.();
    });

    input.addEventListener("focus", () => {
      setActive(probe);
      input.select?.();
    });

    input.addEventListener("input", () => {
      if (activeProbe !== probe) return;
      update(probe, toNum(input.value));
    });
  });

  // 999.9
  mainInput.addEventListener("focus", () => {
    setActive(999.9);
    mainInput.select?.();
  });

  mainInput.addEventListener("input", () => {
    if (activeProbe !== 999.9) return;
    update(999.9, toNum(mainInput.value));
  });

  // currency
  eurBtn.addEventListener("click", () => setCurrency("EUR"));
  usdBtn.addEventListener("click", () => setCurrency("USD"));

  // reset
  resetBtn.addEventListener("click", () => {
    mainInput.value = "0.00";
    for (const r of rows) rowInputs.get(r.p).value = "0.00";
    setActive(585);
    update(585, 0);
    rowInputs.get(585).focus();
    rowInputs.get(585).select?.();
  });
}

function setCurrency(cur) {
  currency = cur;

  eurBtn.classList.toggle("active", cur === "EUR");
  usdBtn.classList.toggle("active", cur === "USD");

  pricePerGram999 = null;
  if (liveStampEl) liveStampEl.textContent = "—";

  mainSub.textContent = `0,00 ${currency} / 1 g`;
  for (const r of rows) rowSubs.get(r.p).textContent = `0,00 ${currency} / 1 g`;

  update(activeProbe, getMass(activeProbe));
}

function setActive(probe) {
  activeProbe = probe;

  // 999.9 editable only when active
  mainInput.readOnly = (probe !== 999.9);

  // other rows editable only when active
  for (const r of rows) {
    const p = r.p;
    const item = rowEls.get(p);
    const input = rowInputs.get(p);
    const isActive = (p === probe);

    item.classList.toggle("active", isActive);
    input.readOnly = !isActive;
  }
}

function getMass(probe) {
  if (probe === 999.9) return toNum(mainInput.value);
  return toNum(rowInputs.get(probe)?.value);
}

async function update(fromProbe, fromMass) {
  if (pricePerGram999 === null) {
    await loadPrice();
  }

  const pureMass = pureFromAlloy(fromMass, fromProbe);

  // footer numbers
  eq9999El.textContent = `${f2(pureMass)} g`;

  if (pricePerGram999 === null) {
    priceEl.textContent = "нет данных";
    totalEl.textContent = "нет данных";
  } else {
    priceEl.textContent = `${f2(pricePerGram999)} ${currency}`;
    totalEl.textContent = `${f2(pureMass * pricePerGram999)} ${currency}`;
  }

  // update 999.9 field
  const mass999 = alloyFromPure(pureMass, 999.9);
  if (fromProbe !== 999.9) mainInput.value = mass999.toFixed(2);

  // 999.9 price per gram
  mainSub.textContent = (pricePerGram999 === null)
    ? `0,00 ${currency} / 1 g`
    : `${f2(pricePerGram999)} ${currency} / 1 g`;

  // update rows
  for (const r of rows) {
    const p = r.p;
    const outMass = alloyFromPure(pureMass, p);
    if (fromProbe !== p) rowInputs.get(p).value = outMass.toFixed(2);

    rowSubs.get(p).textContent = (pricePerGram999 === null)
      ? `0,00 ${currency} / 1 g`
      : `${f2(alloyPricePerGram(pricePerGram999, p))} ${currency} / 1 g`;
  }
}

// init
renderOnce();
setActive(585);
mainInput.readOnly = true;
if (liveStampEl) liveStampEl.textContent = "—";
update(585, 0);
