const OZ_TO_G = 31.1034768;

// === CONTACTS (потом заменим на твои реальные) ===
const TELEGRAM_LINK = "https://t.me/your_username";
const WHATSAPP_NUMBER = "+37000000000";
const CALL_NUMBER = "+37000000000";

// === SHOP ITEMS (мини-магазин по звонку/мессенджеру) ===
const SHOP_ITEMS = [
  { name: "Gold bar", grams: 1, premiumPct: 4.5 },
  { name: "Gold bar", grams: 2.5, premiumPct: 4.0 },
  { name: "Gold bar", grams: 5, premiumPct: 3.5 },
  { name: "Gold bar", grams: 10, premiumPct: 3.0 },
  { name: "Gold bar", grams: 20, premiumPct: 2.8 },
  { name: "Gold bar", grams: 50, premiumPct: 2.6 },
  { name: "Gold bar", grams: 100, premiumPct: 2.5 },
];

const fmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f2 = (n) => fmt.format(n);

const rows = [
  { p: 958, l: "958°", k: "23K" },
  { p: 750, l: "750°", k: "18K" },
  { p: 585, l: "585°", k: "14K" },
  { p: 417, l: "417°", k: "10K" },
  { p: 375, l: "375°", k: "9K" },
];

// DOM tabs/views
const tabCalc = document.getElementById("tabCalc");
const tabBuy = document.getElementById("tabBuy");
const viewCalc = document.getElementById("viewCalc");
const viewBuy = document.getElementById("viewBuy");

// DOM calculator
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

// DOM buy
const buyLivePrice = document.getElementById("buyLivePrice");
const buyCurrency = document.getElementById("buyCurrency");
const shopList = document.getElementById("shopList");
const tgBtn = document.getElementById("tgBtn");
const waBtn = document.getElementById("waBtn");
const callBtn = document.getElementById("callBtn");
const balticGate = document.getElementById("balticGate");

// state
let currency = "EUR";
let activeProbe = 999.9;
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

// reliable live price (goldprice.org public endpoint)
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

    buyLivePrice.textContent = `${f2(pricePerGram999)} ${currency} / 1 g`;
    buyCurrency.textContent = currency;

    // ВАЖНО: после обновления цены пересчитываем экран по текущему вводу
    updateCalc(activeProbe, getMass(activeProbe));
    renderShop();

  } catch (e) {
    pricePerGram999 = null;
    mainSub.textContent = `— ${currency} / 1 g`;
    liveStampEl.textContent = "—";

    buyLivePrice.textContent = `—`;
    buyCurrency.textContent = currency;

    updateCalc(activeProbe, getMass(activeProbe));
    renderShop();

    console.warn("Price load failed:", e);
  }
}

function renderCalcRows() {
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

  document.querySelectorAll("#list .item").forEach(item => {
    const probe = Number(item.dataset.probe);
    const input = item.querySelector(".massInput");
    const sub = item.querySelector(".subvalue");

    rowEls.set(probe, item);
    rowInputs.set(probe, input);
    rowSubs.set(probe, sub);

    const activate = () => {
      setActive(probe);
      input.focus();
      input.select?.();
    };

    item.addEventListener("click", activate);
    input.addEventListener("focus", activate);

    input.addEventListener("input", () => {
      if (activeProbe !== probe) return;
      updateCalc(probe, toNum(input.value));
    });

    input.addEventListener("blur", () => {
      if (String(input.value).trim() === "") updateCalc(probe, 0);
    });
  });

  // 999.9 row
  const mainRow = document.getElementById("main999");
  mainRow.addEventListener("click", () => {
    setActive(999.9);
    mainInput.focus();
    mainInput.select?.();
  });

  mainInput.addEventListener("focus", () => {
    setActive(999.9);
    mainInput.select?.();
  });

  mainInput.addEventListener("input", () => {
    if (activeProbe !== 999.9) return;
    updateCalc(999.9, toNum(mainInput.value));
  });

  mainInput.addEventListener("blur", () => {
    if (String(mainInput.value).trim() === "") updateCalc(999.9, 0);
  });
}

function setActive(probe) {
  activeProbe = probe;

  document.getElementById("main999").classList.toggle("active", probe === 999.9);
  for (const r of rows) rowEls.get(r.p)?.classList.toggle("active", r.p === probe);

  // editable only active row
  mainInput.readOnly = (probe !== 999.9);
  for (const r of rows) {
    const inp = rowInputs.get(r.p);
    if (inp) inp.readOnly = (r.p !== probe);
  }
}

function getMass(probe) {
  if (probe === 999.9) return toNum(mainInput.value);
  return toNum(rowInputs.get(probe)?.value);
}

function updateCalc(fromProbe, fromMass) {
  const pureMass = pureFromAlloy(fromMass, fromProbe);

  eq9999El.textContent = `${f2(pureMass)} g`;

  if (pricePerGram999 == null) {
    priceEl.textContent = "—";
    totalEl.textContent = "—";
  } else {
    priceEl.textContent = `${f2(pricePerGram999)} ${currency}`;
    totalEl.textContent = `${f2(pureMass * pricePerGram999)} ${currency}`;
  }

  // update 999.9 field if not source
  if (fromProbe !== 999.9) {
    const mass999 = alloyFromPure(pureMass, 999.9);
    mainInput.value = pureMass === 0 ? "" : mass999.toFixed(2);
  }

  mainSub.textContent = (pricePerGram999 == null)
    ? `— ${currency} / 1 g`
    : `${f2(pricePerGram999)} ${currency} / 1 g`;

  // other probes
  for (const r of rows) {
    const p = r.p;
    const outMass = alloyFromPure(pureMass, p);

    if (fromProbe !== p) {
      rowInputs.get(p).value = pureMass === 0 ? "" : outMass.toFixed(2);
    }

    rowSubs.get(p).textContent = (pricePerGram999 == null)
      ? `— ${currency} / 1 g`
      : `${f2(alloyPricePerGram(pricePerGram999, p))} ${currency} / 1 g`;
  }
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

  buyCurrency.textContent = currency;
  buyLivePrice.textContent = "—";

  updateCalc(activeProbe, getMass(activeProbe));
  renderShop();
}

// Baltic gate (простая проверка по языку/таймзоне)
function isLikelyBaltic() {
  const lang = (navigator.language || "").toLowerCase();
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
  return lang.startsWith("lt") || lang.startsWith("lv") || lang.startsWith("et")
    || tz.includes("vilnius") || tz.includes("riga") || tz.includes("tallinn");
}

function renderShop() {
  const baltic = isLikelyBaltic();
  balticGate.style.display = baltic ? "none" : "block";

  buyCurrency.textContent = currency;

  shopList.innerHTML = SHOP_ITEMS.map(it => {
    let est = "—";
    let sub = "Waiting for live price…";

    if (Number.isFinite(pricePerGram999) && pricePerGram999 > 0) {
      const base = pricePerGram999 * it.grams;
      const estPrice = base * (1 + it.premiumPct / 100);
      est = `${f2(estPrice)} ${currency}`;
      sub = `≈ ${f2(base)} ${currency} + premium ${it.premiumPct}%`;
    }

    return `
      <div class="shopItem">
        <div class="shopTop">
          <div>
            <div class="shopName">${it.name} ${it.grams}g • 999.9</div>
            <div class="shopGram">Investment gold bar</div>
          </div>
          <div class="shopPrice">${est}</div>
        </div>
        <div class="shopSub">
          <span>${sub}</span>
          <span>Order by call/message</span>
        </div>
      </div>
    `;
  }).join("");
}

function showView(name) {
  const isCalc = name === "calc";
  viewCalc.classList.toggle("active", isCalc);
  viewBuy.classList.toggle("active", !isCalc);
  tabCalc.classList.toggle("active", isCalc);
  tabBuy.classList.toggle("active", !isCalc);

  if (!isCalc) renderShop();
}

function initControls() {
  eurBtn.addEventListener("click", () => setCurrency("EUR"));
  usdBtn.addEventListener("click", () => setCurrency("USD"));

  resetBtn.addEventListener("click", () => {
    mainInput.value = "";
    for (const r of rows) rowInputs.get(r.p).value = "";
    setActive(999.9);
    updateCalc(999.9, 0);
    mainInput.focus();
  });

  tabCalc.addEventListener("click", () => showView("calc"));
  tabBuy.addEventListener("click", () => showView("buy"));

  tgBtn.href = TELEGRAM_LINK;
  waBtn.href = `https://wa.me/${WHATSAPP_NUMBER.replace(/[^\d]/g, "")}`;
  callBtn.href = `tel:${CALL_NUMBER}`;
}

// init
renderCalcRows();
initControls();
setActive(999.9);
updateCalc(999.9, 0);
renderShop();
showView("calc");

// авто-обновление цены каждые 60 секунд
loadPrice();
setInterval(loadPrice, 60_000);
