/* =========================
   CONFIG (REMINDER)
   Before Google Play:
   update CALL_NUMBER & WHATSAPP_NUMBER
========================= */
const CALL_NUMBER = "+37000000000";
const WHATSAPP_NUMBER = "+37000000000";
const TELEGRAM_USERNAME = "yourtelegram"; // without @

const CURRENCY_SYMBOL = "€";

// Probes list
const ROWS = [
  { label: "999.9°", karat: "24K", probe: 999.9 },
  { label: "958°",   karat: "23K", probe: 958 },
  { label: "750°",   karat: "18K", probe: 750 },
  { label: "585°",   karat: "14K", probe: 585 },
  { label: "417°",   karat: "10K", probe: 417 },
  { label: "375°",   karat: "9K",  probe: 375 },
];

// Demo shop list
const SHOP_ITEMS = [
  { name: "Gold bar", grams: 1 },
  { name: "Gold bar", grams: 2 },
  { name: "Gold bar", grams: 5 },
  { name: "Gold bar", grams: 10 },
];

// ====== DOM ======
const listEl = document.getElementById("list");
const pricePerGramEl = document.getElementById("pricePerGram");
const pureWeightEl = document.getElementById("pureWeight");
const totalPriceEl = document.getElementById("totalPrice");
const liveUpdateEl = document.getElementById("liveUpdate");

const buyBasePriceEl = document.getElementById("buyBasePrice");
const buyUpdateEl = document.getElementById("buyUpdate");
const shopListEl = document.getElementById("shopList");

const resetBtn = document.getElementById("resetBtn");

const tgBtn = document.getElementById("tgBtn");
const waBtn = document.getElementById("waBtn");

const tabBtns = document.querySelectorAll(".tabBtn");
const viewCalc = document.getElementById("view-calc");
const viewBuy = document.getElementById("view-buy");

// Terms modal
const termsOverlay = document.getElementById("termsOverlay");
const openTermsBtn = document.getElementById("openTerms");
const closeTermsBtn = document.getElementById("closeTerms");

// ====== STATE ======
let baseEurPerGram999 = null; // EUR per 1g of 999.9
let activeProbe = 999.9;      // which row user is typing in
let pure999Weight = 0;        // computed pure gold weight (999.9)

// ====== HELPERS ======
function toNumber(val) {
  if (val == null) return 0;
  const s = String(val).trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + CURRENCY_SYMBOL;
}

function fmtGram(n) {
  if (!Number.isFinite(n)) return "0,00 g";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " g";
}

function fmtPerGram(n) {
  if (!Number.isFinite(n)) return "— " + CURRENCY_SYMBOL + " / 1g";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + CURRENCY_SYMBOL + " / 1g";
}

function nowStamp() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

// ====== UI RENDER ======
function renderRows() {
  listEl.innerHTML = "";

  ROWS.forEach(r => {
    const item = document.createElement("div");
    item.className = "item";
    item.dataset.probe = String(r.probe);

    const left = document.createElement("div");
    left.className = "left";
    left.innerHTML = `
      <div class="probe">${r.label}</div>
      <div class="karat">${r.karat}</div>
    `;

    const right = document.createElement("div");
    right.className = "right";

    const inputRow = document.createElement("div");
    inputRow.className = "inputRow";

    const input = document.createElement("input");
    input.className = "massInput";
    input.type = "text";
    input.inputMode = "decimal";
    input.placeholder = ""; // no 0.00
    input.value = "";

    const unit = document.createElement("div");
    unit.className = "unit";
    unit.textContent = "g";

    inputRow.appendChild(input);
    inputRow.appendChild(unit);

    const sub = document.createElement("div");
    sub.className = "subvalue";
    sub.textContent = "— " + CURRENCY_SYMBOL + " / 1g";

    right.appendChild(inputRow);
    right.appendChild(sub);

    item.appendChild(left);
    item.appendChild(right);
    listEl.appendChild(item);

    // click -> active row
    item.addEventListener("click", () => setActive(r.probe));

    // focus -> active row
    input.addEventListener("focus", () => setActive(r.probe));

    // input -> recalc from this probe
    input.addEventListener("input", () => {
      const w = toNumber(input.value);
      activeProbe = r.probe;
      pure999Weight = w * (r.probe / 999.9);
      updateAllFields();
    });
  });

  setActive(activeProbe);
}

function setActive(probe) {
  activeProbe = probe;

  [...document.querySelectorAll(".item")].forEach(el => {
    const p = Number(el.dataset.probe);
    el.classList.toggle("active", p === probe);
  });
}

// ====== PRICES ======
async function fetchGoldPriceEurPerGram999() {
  try {
    // IMPORTANT: if you have your own endpoint, replace only this URL.
    // Expected JSON: { "eurPerGram999": 123.45 }
    const res = await fetch("https://3dparagon.github.io/FINE-GOLD/pwa/price.json", { cache: "no-store" });
    if (!res.ok) throw new Error("price fetch failed");
    const data = await res.json();

    const v = Number(data.eurPerGram999);
    if (!Number.isFinite(v) || v <= 0) throw new Error("bad price format");

    baseEurPerGram999 = v;
    return true;
  } catch (e) {
    // keep previous (do not break UI)
    return false;
  }
}

function updateRowPricesOnly() {
  const items = [...document.querySelectorAll(".item")];

  items.forEach(el => {
    const probe = Number(el.dataset.probe);
    const sub = el.querySelector(".subvalue");

    if (Number.isFinite(baseEurPerGram999)) {
      const perGram = baseEurPerGram999 * (probe / 999.9);
      sub.textContent = fmtPerGram(perGram);
    } else {
      sub.textContent = "— " + CURRENCY_SYMBOL + " / 1g";
    }
  });

  if (Number.isFinite(baseEurPerGram999)) {
    pricePerGramEl.textContent = fmtMoney(baseEurPerGram999);
  } else {
    pricePerGramEl.textContent = "—";
  }
}

function updateAllFields() {
  // weights in all rows (based on pure999Weight)
  const items = [...document.querySelectorAll(".item")];

  items.forEach(el => {
    const probe = Number(el.dataset.probe);
    const input = el.querySelector(".massInput");

    // m_alloy = pure999Weight * 999.9 / probe
    const alloyW = pure999Weight * (999.9 / probe);

    if (probe === activeProbe) {
      // keep user typing
    } else {
      input.value = pure999Weight > 0
        ? alloyW.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";
    }
  });

  // bottom card
  pureWeightEl.textContent = fmtGram(pure999Weight);

  if (Number.isFinite(baseEurPerGram999) && pure999Weight > 0) {
    const total = pure999Weight * baseEurPerGram999;
    totalPriceEl.textContent = fmtMoney(total);
  } else if (pure999Weight === 0) {
    totalPriceEl.textContent = "—";
  } else {
    totalPriceEl.textContent = "—";
  }

  // prices never disappear
  updateRowPricesOnly();

  // buy view update
  updateBuyGold();
}

function updateBuyGold() {
  buyUpdateEl.textContent = liveUpdateEl.textContent || "—";

  if (Number.isFinite(baseEurPerGram999)) {
    buyBasePriceEl.textContent = fmtMoney(baseEurPerGram999) + " / 1g";
  } else {
    buyBasePriceEl.textContent = "—";
  }

  shopListEl.innerHTML = "";

  SHOP_ITEMS.forEach(it => {
    const box = document.createElement("div");
    box.className = "shopItem";

    const top = document.createElement("div");
    top.className = "shopTop";

    const name = document.createElement("div");
    name.className = "shopName";
    name.textContent = it.name;

    const gram = document.createElement("div");
    gram.className = "shopGram";
    gram.textContent = `${it.grams} g (999.9)`;

    top.appendChild(name);
    top.appendChild(gram);

    const price = document.createElement("div");
    price.className = "shopPrice";
    price.textContent = Number.isFinite(baseEurPerGram999)
      ? fmtMoney(it.grams * baseEurPerGram999)
      : "—";

    const sub = document.createElement("div");
    sub.className = "shopSub";
    sub.innerHTML = `
      <div>Per gram</div>
      <div>${Number.isFinite(baseEurPerGram999) ? fmtPerGram(baseEurPerGram999) : "— " + CURRENCY_SYMBOL + " / 1g"}</div>
    `;

    box.appendChild(top);
    box.appendChild(price);
    box.appendChild(sub);

    shopListEl.appendChild(box);
  });
}

// ====== TABS ======
function setupTabs() {
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      if (tab === "calc") {
        viewCalc.classList.add("active");
        viewBuy.classList.remove("active");
      } else {
        viewBuy.classList.add("active");
        viewCalc.classList.remove("active");
      }

      updateBuyGold();
    });
  });
}

// ====== CONTROLS ======
function setupControls() {
  resetBtn.addEventListener("click", () => {
    pure999Weight = 0;

    [...document.querySelectorAll(".massInput")].forEach(inp => inp.value = "");
    setActive(999.9);

    updateAllFields();
  });
}

// ====== CONTACT LINKS ======
function setupContacts() {
  tgBtn.href = `https://t.me/${encodeURIComponent(TELEGRAM_USERNAME)}`;
  waBtn.href = `https://wa.me/${encodeURIComponent(WHATSAPP_NUMBER.replace(/\+/g,""))}`;
}

// ====== TERMS MODAL ======
function setupTerms() {
  function open() {
    termsOverlay.classList.add("show");
    termsOverlay.setAttribute("aria-hidden", "false");
  }
  function close() {
    termsOverlay.classList.remove("show");
    termsOverlay.setAttribute("aria-hidden", "true");
  }

  openTermsBtn.addEventListener("click", open);
  closeTermsBtn.addEventListener("click", close);

  // click outside modal closes
  termsOverlay.addEventListener("click", (e) => {
    if (e.target === termsOverlay) close();
  });

  // esc closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

// ====== LIVE UPDATE LOOP ======
async function tick() {
  liveUpdateEl.textContent = nowStamp();
  await fetchGoldPriceEurPerGram999();
  updateAllFields();
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

// ====== INIT ======
(function init(){
  renderRows();
  setupTabs();
  setupControls();
  setupContacts();
  setupTerms();
  registerSW();

  // first update now, then every 60 seconds
  tick();
  setInterval(tick, 60_000);

  // ensure UI stable
  updateRowPricesOnly();
  updateAllFields();
})();
