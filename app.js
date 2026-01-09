/* =========================
   Fine Gold — EUR only
   Prices source: https://api.edelmetalle.de/public.json
   (gold_eur is per troy ounce; convert to EUR/gram)
   Anti-cache + UI safe (won't crash if some elements are missing)
========================= */

const TELEGRAM_USERNAME = "fine_gold_riga"; // без @

// ⚠️ Напоминание перед публикацией:
// если потом добавишь WhatsApp/звонок — поменяй номера в коде (CALL_NUMBER / WHATSAPP_NUMBER).

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
  activeInput: "",         // строка (чтобы не ломать ввод)
  goldPerGram999: null,    // EUR per gram of 999.9
  lastUpdated: null,
};

const $ = (id) => document.getElementById(id); // может вернуть null — это ок

// calc view
const listEl = $("list");
const pricePerGEl = $("pricePerG");
const pureWeightEl = $("pureWeight");
const totalPriceEl = $("totalPrice");
const liveUpdateEl = $("liveUpdate");

// buy view (может отсутствовать — не падаем)
const buySpotEl = $("buySpot");
const buyUpdatedEl = $("buyUpdated");

// tabs
const tabCalc = $("tabCalc");
const tabBuy  = $("tabBuy");
const viewCalc = $("viewCalc");
const viewBuy  = $("viewBuy");

// controls
const resetBtn = $("resetBtn");

// terms
const termsBtn = $("termsBtn");
const termsModal = $("termsModal");
const termsOverlay = $("termsOverlay");
const termsClose = $("termsClose");
const termsOk = $("termsOk");

// contact buttons
const tgBtn = $("tgBtn");
// waBtn может быть удалён — не используем

function fmtMoneyEUR(x){
  if (x == null || !isFinite(x)) return "—";
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
  return new Intl.DateTimeFormat("de-DE", {
    day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  }).format(d);
}

/* -------- UI rendering -------- */

function renderList(){
  if (!listEl) return;

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

  const items = Array.from(listEl.querySelectorAll(".item"));
  for (const item of items){
    const probe = parseFloat(item.dataset.probe);
    const input = item.querySelector(".massInput");

    item.addEventListener("click", (e) => {
      if (e.target && e.target.classList && e.target.classList.contains("massInput")) return;
      setActiveProbe(probe);
    });

    input.addEventListener("focus", () => setActiveProbe(probe));

    input.addEventListener("input", () => {
      if (probe !== state.activeProbe) return;
      state.activeInput = input.value; // строка
      updateAll();
    });
  }
}

function setActiveProbe(probe){
  state.activeProbe = probe;
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
  return gramsAlloy * (probe / MAIN_PURITY);
}

function alloyFromPure999(pure999, probe){
  return pure999 * (MAIN_PURITY / probe);
}

function pricePerGramForProbe(probe){
  if (state.goldPerGram999 == null) return null;
  return state.goldPerGram999 * (probe / MAIN_PURITY);
}

function updatePricesText(){
  for (const r of rows){
    const el = document.getElementById(`sub-${r.probe}`);
    if (!el) continue;
    const p = pricePerGramForProbe(r.probe);
    el.textContent = (p == null) ? "— € / 1g" : `${fmtMoneyEUR(p)} / 1g`;
  }
}

function updateAll(){
  // ВАЖНО: никаких падений, даже если часть элементов удалена из HTML
  try{
    const g = getActiveGrams();
    const pure999 = pure999FromAlloy(g, state.activeProbe);

    // пересчёт веса в других пробах
    if (listEl){
      const items = Array.from(listEl.querySelectorAll(".item"));
      for (const item of items){
        const probe = parseFloat(item.dataset.probe);
        const input = item.querySelector(".massInput");
        if (!input) continue;

        if (probe === state.activeProbe) continue;

        if (g === 0){
          input.value = "";
          continue;
        }

        const eq = alloyFromPure999(pure999, probe);
        input.value = fmtNumber(eq);
      }
    }

    // нижний блок (всегда 24K / 999.9)
    const price999 = state.goldPerGram999;

    if (pricePerGEl){
      pricePerGEl.textContent = (price999 == null) ? "—" : `${fmtMoneyEUR(price999)} / 1g`;
    }

    if (g === 0){
      if (pureWeightEl) pureWeightEl.textContent = "—";
      if (totalPriceEl) totalPriceEl.textContent = "—";
    } else {
      const pureWeight = alloyFromPure999(pure999, MAIN_PURITY);

      if (pureWeightEl) pureWeightEl.textContent = fmtGram(pureWeight);

      if (totalPriceEl){
        if (price999 == null){
          totalPriceEl.textContent = "—";
        } else {
          totalPriceEl.textContent = fmtMoneyEUR(pureWeight * price999);
        }
      }
    }

    // buy gold block (если есть)
    if (buySpotEl) buySpotEl.textContent = (price999 == null) ? "—" : `${fmtMoneyEUR(price999)} / 1g`;
    if (buyUpdatedEl) buyUpdatedEl.textContent = state.lastUpdated ? fmtDateTime(state.lastUpdated) : "—";

    updatePricesText();

    if (liveUpdateEl) liveUpdateEl.textContent = state.lastUpdated ? fmtDateTime(state.lastUpdated) : "—";
  } catch (err){
    // если вдруг что-то пошло не так — хотя бы не “убиваем” приложение
    console.error("updateAll error:", err);
  }
}

async function loadGoldPrice(){
  // берём кеш, чтобы не было пусто при временном фейле
  const cached = safeJsonParse(localStorage.getItem("fg_cache_price999"));
  const cachedTs = localStorage.getItem("fg_cache_ts");
  if (cached && typeof cached === "number" && isFinite(cached)){
    state.goldPerGram999 = cached;
    if (cachedTs) state.lastUpdated = new Date(parseInt(cachedTs, 10));
    updateAll();
  }

  try{
    // анти-кэш: параметр + cache: "no-store"
    const url = `https://api.edelmetalle.de/public.json?t=${Date.now()}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Price HTTP " + res.status);
    const data = await res.json();

    const goldEurPerOunce = Number(data.gold_eur);
    if (!isFinite(goldEurPerOunce) || goldEurPerOunce <= 0) throw new Error("Bad gold_eur");

    const eurPerGram = goldEurPerOunce / OUNCE_TO_GRAM;

    state.goldPerGram999 = eurPerGram;
    state.lastUpdated = data.timestamp ? new Date(Number(data.timestamp) * 1000) : new Date();

    localStorage.setItem("fg_cache_price999", JSON.stringify(state.goldPerGram999));
    localStorage.setItem("fg_cache_ts", String(state.lastUpdated.getTime()));

    updateAll();
  } catch (e){
    // не стираем кеш — просто оставляем как есть
    console.warn("loadGoldPrice failed:", e);
    updateAll();
  }
}

/* -------- Tabs -------- */

function setTab(tab){
  const isCalc = tab === "calc";
  if (tabCalc) tabCalc.classList.toggle("active", isCalc);
  if (tabBuy)  tabBuy.classList.toggle("active", !isCalc);
  if (viewCalc) viewCalc.classList.toggle("active", isCalc);
  if (viewBuy)  viewBuy.classList.toggle("active", !isCalc);
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
  if (!termsModal) return;
  termsModal.classList.add("show");
  termsModal.setAttribute("aria-hidden", "false");
}

function closeTerms(){
  if (!termsModal) return;
  termsModal.classList.remove("show");
  termsModal.setAttribute("aria-hidden", "true");
}

/* -------- Contacts -------- */

function buildLinks(){
  if (tgBtn){
    tgBtn.href = `https://t.me/${encodeURIComponent(TELEGRAM_USERNAME)}`;
  }
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

  if (tabCalc) tabCalc.addEventListener("click", () => setTab("calc"));
  if (tabBuy)  tabBuy.addEventListener("click", () => setTab("buy"));
  if (resetBtn) resetBtn.addEventListener("click", resetAll);

  if (termsBtn) termsBtn.addEventListener("click", openTerms);
  if (termsOverlay) termsOverlay.addEventListener("click", closeTerms);
  if (termsClose) termsClose.addEventListener("click", closeTerms);
  if (termsOk) termsOk.addEventListener("click", closeTerms);

  updateAll();
  loadGoldPrice();

  // автообновление цены
  setInterval(loadGoldPrice, 60 * 1000);

  // ❗ ВАЖНО: service worker отключаем, чтобы не было “старых” файлов из кеша
  // (если он был — он часто и вызывает путаницу версии)
})();
