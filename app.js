const OZ_TO_G = 31.1034768;

const fmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

// cache
const rowEls = new Map();
const rowInputs = new Map();
const rowSubs = new Map();

function toNum(v) {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// math
function pureFromAlloy(mass, probe) {
  return mass * (probe / 999.9);
}
function alloyFromPure(pureMass, probe) {
  return pureMass * 999.9 / probe;
}
function alloyPricePerGram(purePrice, probe) {
  return purePrice * (probe / 999.9);
}

function formatDateTime(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

async function loadPrice() {
  try {
    const url = `https://data-asg.goldprice.org/dbXRates/${encodeURIComponent(currency)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const xau = Number(data?.items?.[0]?.xauPrice);
    if (!Number.isFinite(xau) || xau <= 0) throw new Error("Bad xauPrice");

    pricePerGram999 = xau / OZ_TO_G;
    mainSub.textContent = `${f2(pricePerGram999)} ${currency} / 1 g`;
    liveStampEl.textContent = formatDateTime(Date.now());
  } catch (e) {
    pricePerGram999 = null;
    mainSub.textContent = `— ${currency} / 1 g`;
    liveStampEl.textContent = "—";
    console.warn("Price load failed:", e);
  }
}

function clearIfZero(input) {
  const v = String(input.value || "").trim();
  if (v === "0" || v === "0.0" || v === "0.00" || v === "0,00") input.value = "";
}

function renderOnce() {
  list.innerHTML = rows.map(r => `
    <div class="item" data-probe="${r.p}">
      <div class="left">
        <span class="probe">${r.l}</span>
        <span class="karat">${r.k}</span>
      </div>
      <div class="right">
        <div class="inputRow">
          <input class="massInput" type="number" inputmode="decimal" step="any" placeholder="" />
          <span class="unit">g</span>
        </div>
        <div class="subvalue">— ${currency} / 1 g</div>
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
      clearIfZero(input);
      input.focus();
      input.select?.();
    });

    input.addEventListener("focus", () => {
      setActive(probe);
      clearIfZero(input);
      input.select?.();
    });

    input.addEventListener("input", () => {
      if (activeProbe !== probe) return;
      update(probe, toNum(input.value));
    });

    input.addEventListener("blur", () => {
      if (String(input.value).trim() === "") update(probe, 0);
    });
  });

  // 999.9
  mainInput.addEventListener("focus", () => {
    setActive(999.9);
    clearIfZero(mainInput);
    mainInput.select?.();
  });

  mainInput.addEventListener("input", () => {
    if (activeProbe !== 999.9) return;
    update(999.9, toNum(mainInput.value));
  });

  mainInput.addEventListener("blur", () => {
    if (String(mainInput.value).trim() === "") update(999.9, 0);
  });

  // currency
  eurBtn.addEventListener("click", () => setCurrency("EUR"));
  usdBtn.addEventListener("click", () => setCurrency("USD"));

  // reset
  resetBtn.addEventListener("click", () => {
    mainInput.value = "";
    for (const r of rows) rowInputs.get(r.p).value = "";
    setActive(585);
    update(585, 0);
    rowInputs.get(585).focus();
  });
}

function setCurrency(cur) {
  currency = cur;
  eurBtn.classList.toggle("active", cur === "EUR");
  usdBtn.classList.toggle("active", cur === "USD");

  pricePerGram999 = null;
  mainSub.textContent = `— ${currency} / 1 g`;
  for (const r of rows) rowSubs.get(r.p).textContent = `— ${currency} / 1 g`;
  priceEl.textContent = "—";
  totalEl.textContent = "—";
  liveStampEl.textContent = "—";

  update(activeProbe, getMass(activeProbe));
}

function setActive(probe) {
  activeProbe = probe;

  // подсветка активной строки можно оставить, но визуально всё равно “активно”
  for (const r of rows) {
    const item = rowEls.get(r.p);
    item.classList.toggle("active", r.p === probe);
  }

  // чтобы ввод был только в выбранной строке
  mainInput.readOnly = (probe !== 999.9);

  for (const r of rows) {
    const input = rowInputs.get(r.p);
    input.readOnly = (r.p !== probe);
  }
}

function getMass(probe) {
  if (probe === 999.9) return toNum(mainInput.value);
  return toNum(rowInputs.get(probe)?.value);
}

async function update(fromProbe, fromMass) {
  if (pricePerGram999 === null) await loadPrice();

  const pureMass = pureFromAlloy(fromMass, fromProbe);

  eq9999El.textContent = `${f2(pureMass)} g`;

  if (pricePerGram999 === null) {
    priceEl.textContent = "нет данных";
    totalEl.textContent = "нет данных";
  } else {
    priceEl.textContent = `${f2(pricePerGram999)} ${currency}`;
    totalEl.textContent = `${f2(pureMass * pricePerGram999)} ${currency}`;
  }

  const mass999 = alloyFromPure(pureMass, 999.9);
  if (fromProbe !== 999.9) mainInput.value = mass999 ? mass999.toFixed(2) : "";

  mainSub.textContent = (pricePerGram999 === null)
    ? `— ${currency} / 1 g`
    : `${f2(pricePerGram999)} ${currency} / 1 g`;

  for (const r of rows) {
    const p = r.p;
    const outMass = alloyFromPure(pureMass, p);
    if (fromProbe !== p) rowInputs.get(p).value = outMass ? outMass.toFixed(2) : "";

    rowSubs.get(p).textContent = (pricePerGram999 === null)
      ? `— ${currency} / 1 g`
      : `${f2(alloyPricePerGram(pricePerGram999, p))} ${currency} / 1 g`;
  }
}

// init
renderOnce();
setActive(585);
mainInput.readOnly = true;
mainInput.value = "";
update(585, 0);
