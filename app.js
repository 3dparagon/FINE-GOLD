/* =========================
   Fine Gold — EUR only
   Prices source: https://api.edelmetalle.de/public.json
   (gold_eur is per troy ounce; convert to EUR/gram)
========================= */

const CALL_NUMBER = "+0000000000";      // TODO: поменяй перед публикацией
const WHATSAPP_NUMBER = "+0000000000";  // TODO: поменяй перед публикацией
const TELEGRAM_USERNAME = "your_telegram"; // без @

const OUNCE_TO_GRAM = 31.1034768;
const MAIN_PURITY = 999.9;

const rows = [
  { probe: 999.9, label: "999.9°", karat: "24K" },
  { probe: 958.0, label: "958°",   karat: "23K" },
  { probe: 750.0, label: "750°",   karat: "18K" },
  { probe: 585.0, label: "585°",   karat: "14K" },
  { probe: 417.0, label: "417°",   karat: "10K" },
  { probe: 375.0, label: "375°",   karat: "9K"  },
];

const state = {
  activeProbe: 999.9,
  activeInput: "",         // строка (чтобы не мешать вводу)
  goldPerGram999: null,    // EUR per gram of 999.9
  lastUpdated: null,
};

const $ = (id) => document.getElementById(id);

const listEl = $("list");
const pricePerGEl = $("pricePerG");
const pureWeightEl = $("pureWeight");
const totalPriceEl = $("totalPrice");
const liveUpdateEl = $("liveUpdate");

const buySpotEl = $("buySpot");
const buyUpdatedEl = $("buyUpdated");

const tabCalc = $("tabCalc");
const tabBuy = $("tabBuy");
const viewCalc = $("viewCalc");
const viewBuy = $("viewBuy");

const resetBtn = $("resetBtn");

const termsBtn = $("termsBtn");
const termsModal = $("termsModal");
const termsOverlay = $("termsOverlay");
const termsClose = $("termsClose");
const termsOk = $("termsOk");

const tgBtn = $("tgBtn");
const waBtn = $("waBtn");

function fmtMoneyEUR(x){
  if (x == null || !isFinite(x)) return "—";
  // de-DE даёт запятую как на твоих скринах
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x) + " €";
}

function fmtNumber(x){
  if (x == null || !isFinite(x)) return "—";
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
}

function fmtGram(x){
  if (x == null || !isFinite(x)) return "—";
  return fmtNumber(x) + " g";
}

function fmtDateTime(d){
  if (!d) return "—";
  const dd = new Intl.DateTimeFormat("de-DE", {
    day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  }).format(d);
  return dd;
}

/* -------- UI rendering -------- */

function renderList(){
  listEl.innerHTML = rows.map(r => `
    <div class="item ${r.probe === state.activeProbe ? "active" : ""}" data-probe="${r.probe}">
      <div class="left">
        <div class="probe">${r.label}</div>
        <div class="karat">${r.karat}</div>
      </div>

      <div class="right">
        <div class="inputRow">
          <input
            class="massInput"
            inputmode="decimal"
            type="number"
            step="0.01"
            min="0"
            placeholder=""
            value="${r.probe === state.activeProbe ? escapeHtml(state.activeInput) : ""}"
          />
          <div class="unit">g</div>
        </div>
        <div class="subvalue" id="sub-${r.probe}">— € / 1g</div>
      </div>
    </div>
  `).join("");

  // events
  const items = Array.from(listEl.querySelectorAll(".item"));
  for (const item of items){
    const probe = parseFloat(item.dataset.probe);
    const input = item.querySelector(".massInput");

    // click row => make active
    item.addEventListener("click", (e) => {
      // если клик по самому input — не мешаем
      if (e.target && e.target.classList && e.target.classList.contains("massInput")) return;
      setActiveProbe(probe);
    });

    // focus => make active
    input.addEventListener("focus", () => setActiveProbe(probe));

    // input => update
    input.addEventListener("input", () => {
      if (probe !== state.activeProbe) return;
      state.activeInput = input.value; // сохраняем как строку
      updateAll();
    });
  }
}

function setActiveProbe(probe){
  state.activeProbe = probe;
  // перерисуем, чтобы подсветка/значение было только в активной строке
  renderList();
  updateAll();
}

/* -------- Logic -------- */

function getActiveGrams(){
  const v = parseFloat(String(state.activeInput).replace(",", "."));
  if (!isFinite(v) || v <= 0) return 0;
  return v;
}

function pure999FromAlloy(gramsAlloy, probe){
  // сколько чистого 999.9 содержит этот сплав
  return gramsAlloy * (probe / MAIN_PURITY);
}

function alloyFromPure999(pure999, probe){
  // сколько грамм сплава нужно, чтобы получить столько же чистого 999.9
  return pure999 * (MAIN_PURITY / probe);
}

function pricePerGramForProbe(probe){
  if (state.goldPerGram999 == null) return null;
  // цена сплава = цена 999.9 * доля чистого
  return state.goldPerGram999 * (probe / MAIN_PURITY);
}

function updatePricesText(){
  for (const r of rows){
    const el = document.getElementById(`sub-${r.probe}`);
    const p = pricePerGramForProbe(r.probe);
    if (!el) continue;
    el.textContent = (p == null) ? "— € / 1g" : `${fmtMoneyEUR(p)} / 1g`;
  }
}

function updateAll(){
  const g = getActiveGrams();
  const pure999 = pure999FromAlloy(g, state.activeProbe);

  // пересчёт веса в других пробах
  const items = Array.from(listEl.querySelectorAll(".item"));
  for (const item of items){
    const probe = parseFloat(item.dataset.probe);
    const input = item.querySelector(".massInput");
    if (!input) continue;

    if (probe === state.activeProbe){
      // активное — оставляем ввод как есть
      continue;
    }

    if (g === 0){
      input.value = "";
      continue;
    }

    const eq = alloyFromPure999(pure999, probe);
    input.value = fmtNumber(eq);
  }

  // нижний блок (всегда на 24K/999.9)
  const price999 = state.goldPerGram999;
  pricePerGEl.textContent = (price999 == null) ? "—" : `${fmtMoneyEUR(price999)} / 1g`;

  if (g === 0){
    pureWeightEl.textContent = "—";
    totalPriceEl.textContent = "—";
  } else {
    const pureWeight = alloyFromPure999(pure999, MAIN_PURITY); // это фактически граммы 999.9
    pureWeightEl.textContent = fmtGram(pureWeight);

    if (price999 == null){
      totalPriceEl.textContent = "—";
    } else {
      const total = pureWeight * price999;
      totalPriceEl.textContent = fmtMoneyEUR(total);
    }
  }

  // buy gold block
  buySpotEl.textContent = (price999 == null) ? "—" : `${fmtMoneyEUR(price999)} / 1g`;
  buyUpdatedEl.textContent = state.lastUpdated ? fmtDateTime(state.lastUpdated) : "—";

  updatePricesText();
  liveUpdateEl.textContent = state.lastUpdated ? fmtDateTime(state.lastUpdated) : "—";
}

async function loadGoldPrice(){
  // Кладём кеш — чтобы в WebView не было пусто при временном фейле
  const cached = safeJsonParse(localStorage.getItem("fg_cache_price999"));
  const cachedTs = localStorage.getItem("fg_cache_ts");
  if (cached && typeof cached === "number" && isFinite(cached)){
    state.goldPerGram999 = cached;
    if (cachedTs) state.lastUpdated = new Date(parseInt(cachedTs, 10));
    updateAll();
  }

  try{
    const res = await fetch("https://api.edelmetalle.de/public.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Price HTTP " + res.status);
    const data = await res.json();

    // gold_eur — цена золота в EUR за унцию (troy ounce)
    const goldEurPerOunce = Number(data.gold_eur);
    if (!isFinite(goldEurPerOunce) || goldEurPerOunce <= 0) throw new Error("Bad gold_eur");

    const eurPerGram = goldEurPerOunce / OUNCE_TO_GRAM;

    state.goldPerGram999 = eurPerGram;
    state.lastUpdated = data.timestamp ? new Date(Number(data.timestamp) * 1000) : new Date();

    localStorage.setItem("fg_cache_price999", JSON.stringify(state.goldPerGram999));
    localStorage.setItem("fg_cache_ts", String(state.lastUpdated.getTime()));

    updateAll();
  } catch (e){
    // если упало — не стираем кеш, просто оставляем как есть
    updateAll();
  }
}

/* -------- Tabs -------- */

function setTab(tab){
  const isCalc = tab === "calc";
  tabCalc.classList.toggle("active", isCalc);
  tabBuy.classList.toggle("active", !isCalc);
  viewCalc.classList.toggle("active", isCalc);
  viewBuy.classList.toggle("active", !isCalc);
}

/* -------- Reset -------- */

function resetAll(){
  state.activeProbe = 999.9;
  state.activeInput = "";
  renderList();
  updateAll();
}

/* -------- Terms modal -------- */

function openTerms(){
  termsModal.classList.add("show");
  termsModal.setAttribute("aria-hidden", "false");
}

function closeTerms(){
  termsModal.classList.remove("show");
  termsModal.setAttribute("aria-hidden", "true");
}

/* -------- Contacts -------- */

function buildLinks(){
  // Telegram deep link
  tgBtn.href = `https://t.me/${encodeURIComponent(TELEGRAM_USERNAME)}`;

  // WhatsApp
  const wa = WHATSAPP_NUMBER.replace(/[^\d+]/g, "");
  waBtn.href = `https://wa.me/${wa.replace("+","")}`;
}

/* -------- utils -------- */

function safeJsonParse(s){
  try{ return JSON.parse(s); } catch { return null; }
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* -------- init -------- */

(function init(){
  renderList();
  buildLinks();

  tabCalc.addEventListener("click", () => setTab("calc"));
  tabBuy.addEventListener("click", () => setTab("buy"));
  resetBtn.addEventListener("click", resetAll);

  termsBtn.addEventListener("click", openTerms);
  termsOverlay.addEventListener("click", closeTerms);
  termsClose.addEventListener("click", closeTerms);
  termsOk.addEventListener("click", closeTerms);

  // старт
  updateAll();
  loadGoldPrice();

  // автообновление
  setInterval(loadGoldPrice, 60 * 1000);

  // service worker (если у тебя он есть)
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
})();
