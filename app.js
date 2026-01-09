/* Fine Gold — app.js (EUR only)
   Fix: robust number parsing + no-cache API fetch to stop "—" prices.
*/

"use strict";

/* =========================
   CONTACT (before publish)
   ========================= */
// IMPORTANT: before Google Play публикации поменяй номера:
const CALL_NUMBER = "";          // например: +371XXXXXXXX
const WHATSAPP_NUMBER = "";      // например: +371XXXXXXXX

// Telegram (без номера телефона)
const TELEGRAM_USERNAME = "fine_gold_riga"; // https://t.me/fine_gold_riga

/* =========================
   API
   ========================= */
const GOLD_API_URL = "https://api.edelmetalle.de/public.json";

/* =========================
   Helpers
   ========================= */
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function fmtMoneyEUR(value, decimals = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " EUR";
}

function fmtMoneyEURCompact(value, decimals = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " €";
}

function fmtGram(value, decimals = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " g";
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function parseNumberAny(v){
  // принимает число или строку вида "2,345.67" или "2.345,67"
  if (typeof v === "number") return v;
  if (typeof v !== "string") return NaN;
  let s = v.trim();
  if (!s) return NaN;

  // убираем пробелы и неразрывные пробелы
  s = s.replace(/[\s\u00A0]/g, "");

  // если есть и ',' и '.', считаем последний разделителем дробной части
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot){
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const dec = lastComma > lastDot ? "," : ".";
    const thou = dec === "," ? "." : ",";
    s = s.split(thou).join("");          // убрать разделитель тысяч
    s = s.replace(dec, ".");             // десятичный в точку
  } else if (hasComma && !hasDot){
    // только запятая -> десятичный
    s = s.replace(",", ".");
  } else {
    // только точка или вообще нет -> ок
  }

  // убираем всё кроме цифр, точки и минуса
  s = s.replace(/[^0-9.\-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/* =========================
   Math (gold)
   ========================= */
const PROBES = [
  { probe: 999.9, karat: "24K", label: "999.9°", id: "p999" },
  { probe: 958,   karat: "23K", label: "958°",   id: "p958" },
  { probe: 750,   karat: "18K", label: "750°",   id: "p750" },
  { probe: 585,   karat: "14K", label: "585°",   id: "p585" },
  { probe: 417,   karat: "10K", label: "417°",   id: "p417" },
  { probe: 375,   karat: "9K",  label: "375°",   id: "p375" },
];

function pureFromAlloy(alloyMass, probe) {
  // сколько чистого золота (24K) в граммах
  return alloyMass * (probe / 999.9);
}

function alloyFromPure(pureMass, probe) {
  // сколько грамм сплава нужно для такого pure
  return pureMass * 999.9 / probe;
}

function pricePerGramForProbe(spotEurPerG_24k, probe) {
  return spotEurPerG_24k * (probe / 999.9);
}

/* =========================
   State
   ========================= */
const state = {
  activeView: "calc",          // calc | buy
  activeProbe: 999.9,          // selected input row
  spotEurPerG_24k: null,       // EUR per 1g (24K/999.9)
  updatedAt: null,             // Date
  massByProbe: new Map(),      // probe -> grams input
};

/* =========================
   DOM refs
   ========================= */
const dom = {
  views: {
    calc: $("#viewCalc"),
    buy:  $("#viewBuy"),
  },
  tabs: {
    calc: $("#tabCalc"),
    buy:  $("#tabBuy"),
  },
  items: $all(".item"),
  inputs: $all(".massInput"),
  subvalues: $all(".subvalue"),

  // summary (calc)
  sumPrice1g: $("#sumPrice1g"),
  sumWeight: $("#sumWeight"),
  sumTotal: $("#sumTotal"),
  liveUpdate: $("#liveUpdate"),

  // buy gold screen
  buySpot: $("#buySpot"),
  buyUpdated: $("#buyUpdated"),

  // reset
  resetBtn: $("#resetBtn"),

  // terms
  termsBtn: $("#termsBtn"),
  termsModal: $("#termsModal"),
  termsClose: $("#termsClose"),

  // contacts
  tgBtn: $("#btnTelegram"),
  waBtn: $("#btnWhatsApp"),
  callBtn: $("#btnCall"),
};

/* =========================
   View / UI
   ========================= */
function setActiveView(view) {
  state.activeView = view;

  if (dom.views.calc) dom.views.calc.classList.toggle("active", view === "calc");
  if (dom.views.buy)  dom.views.buy.classList.toggle("active", view === "buy");

  if (dom.tabs.calc) dom.tabs.calc.classList.toggle("active", view === "calc");
  if (dom.tabs.buy)  dom.tabs.buy.classList.toggle("active", view === "buy");
}

function setActiveProbe(probe) {
  state.activeProbe = probe;

  dom.items.forEach((el) => {
    const p = Number(el.dataset.probe);
    el.classList.toggle("active", p === probe);
  });
}

function getInputByProbe(probe) {
  return dom.inputs.find(i => Number(i.dataset.probe) === probe);
}

function getSubvalueByProbe(probe) {
  return dom.subvalues.find(s => Number(s.dataset.probe) === probe);
}

function readMassFromInput(inputEl) {
  const raw = (inputEl.value || "").trim();
  if (!raw) return null;

  // allow comma
  const n = parseNumberAny(raw);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function writeMassToInput(inputEl, value) {
  if (value == null) {
    inputEl.value = "";
    return;
  }
  // keep user-friendly
  inputEl.value = String(Math.round(value * 100) / 100);
}

function updateAll() {
  // prices for each probe
  PROBES.forEach(({ probe }) => {
    const sub = getSubvalueByProbe(probe);
    if (!sub) return;

    if (!Number.isFinite(state.spotEurPerG_24k)) {
      sub.textContent = "— € / 1 g";
      return;
    }

    const perG = pricePerGramForProbe(state.spotEurPerG_24k, probe);
    sub.textContent = fmtMoneyEURCompact(perG, 2) + " / 1 g";
  });

  // calc summary
  const activeMass = state.massByProbe.get(state.activeProbe) ?? null;

  if (dom.sumPrice1g) {
    if (!Number.isFinite(state.spotEurPerG_24k)) dom.sumPrice1g.textContent = "—";
    else dom.sumPrice1g.textContent = fmtMoneyEUR(state.spotEurPerG_24k, 2);
  }

  if (dom.sumWeight) {
    dom.sumWeight.textContent = activeMass == null ? "—" : fmtGram(activeMass, 2);
  }

  if (dom.sumTotal) {
    if (activeMass == null || !Number.isFinite(state.spotEurPerG_24k)) {
      dom.sumTotal.textContent = "—";
    } else {
      // total for 24K equivalent: for selected probe we calculate pure grams and multiply by 24K €/g
      const pureG = pureFromAlloy(activeMass, state.activeProbe);
      const total = pureG * state.spotEurPerG_24k;
      dom.sumTotal.textContent = fmtMoneyEUR(total, 2);
    }
  }

  // live update
  if (dom.liveUpdate) {
    if (!state.updatedAt) dom.liveUpdate.textContent = "—";
    else dom.liveUpdate.textContent = state.updatedAt.toLocaleString();
  }

  // buy view
  if (dom.buySpot) {
    dom.buySpot.textContent = Number.isFinite(state.spotEurPerG_24k)
      ? fmtMoneyEUR(state.spotEurPerG_24k, 2)
      : "—";
  }
  if (dom.buyUpdated) {
    dom.buyUpdated.textContent = state.updatedAt ? state.updatedAt.toLocaleString() : "—";
  }
}

/* =========================
   Reset
   ========================= */
function resetAll() {
  state.massByProbe.clear();
  dom.inputs.forEach(i => writeMassToInput(i, null));
  setActiveProbe(999.9);
  updateAll();
}

/* =========================
   API load (IMPORTANT FIX)
   ========================= */
async function loadGoldPrice() {
  try {
    // ✅ анти-кэш: ts + no-store
    const res = await fetch(`https://api.edelmetalle.de/public.json?ts=${Date.now()}`, { cache: "no-store" });

    if (!res.ok) throw new Error("HTTP " + res.status);

    const text = await res.text();
    const data = safeJsonParse(text);
    if (!data) throw new Error("Bad JSON");

    // API: gold_eur = EUR per ounce (часто строка)
    const goldEurPerOunce = parseNumberAny(data.gold_eur);
    if (!Number.isFinite(goldEurPerOunce)) throw new Error("Bad gold_eur");

    // 1 oz = 31.1034768 g
    const eurPerG_9999 = goldEurPerOunce / 31.1034768;

    state.spotEurPerG_24k = eurPerG_9999;
    state.updatedAt = new Date();

    updateAll();
  } catch (e) {
    // если не получилось — оставляем старое значение (не затираем),
    // но обновим время/индикаторы при первом старте как "—"
    if (state.spotEurPerG_24k == null) {
      state.spotEurPerG_24k = null;
      state.updatedAt = null;
      updateAll();
    }
    console.warn("loadGoldPrice failed:", e);
  }
}

/* =========================
   Input logic
   ========================= */
function onMassInputFocus(e) {
  const probe = Number(e.target.dataset.probe);
  if (Number.isFinite(probe)) setActiveProbe(probe);
}

function onMassInputChange(e) {
  const input = e.target;
  const probe = Number(input.dataset.probe);

  setActiveProbe(probe);

  const mass = readMassFromInput(input);
  if (mass == null) {
    state.massByProbe.delete(probe);
    updateAll();
    return;
  }

  // store current probe
  state.massByProbe.set(probe, mass);

  // propagate other probes so user sees equivalents (alloy masses for same pure gold)
  const pureG = pureFromAlloy(mass, probe);

  PROBES.forEach(({ probe: p }) => {
    if (p === probe) return;
    const otherInput = getInputByProbe(p);
    if (!otherInput) return;

    const alloyMass = alloyFromPure(pureG, p);
    writeMassToInput(otherInput, alloyMass);
    state.massByProbe.set(p, alloyMass);
  });

  updateAll();
}

/* =========================
   Terms modal
   ========================= */
function openTerms() {
  if (!dom.termsModal) return;
  dom.termsModal.classList.add("open");
}
function closeTerms() {
  if (!dom.termsModal) return;
  dom.termsModal.classList.remove("open");
}

/* =========================
   Contacts
   ========================= */
function setupContacts() {
  if (dom.tgBtn) {
    dom.tgBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(`https://t.me/${TELEGRAM_USERNAME}`, "_blank");
    });
  }

  // WhatsApp (пока можно оставить, но номер позже)
  if (dom.waBtn) {
    dom.waBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!WHATSAPP_NUMBER) {
        alert("WhatsApp number will be added later.");
        return;
      }
      const n = WHATSAPP_NUMBER.replace(/[^\d+]/g, "");
      window.open(`https://wa.me/${n.replace("+", "")}`, "_blank");
    });
  }

  // Call (если не хочешь светить номер — оставь пустым)
  if (dom.callBtn) {
    dom.callBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!CALL_NUMBER) {
        alert("Call number will be added later.");
        return;
      }
      window.location.href = `tel:${CALL_NUMBER}`;
    });
  }
}

/* =========================
   Init
   ========================= */
function init() {
  // tabs
  if (dom.tabs.calc) dom.tabs.calc.addEventListener("click", () => setActiveView("calc"));
  if (dom.tabs.buy)  dom.tabs.buy.addEventListener("click", () => setActiveView("buy"));

  // make all rows visible active style by default in CSS (already)
  setActiveView("calc");
  setActiveProbe(999.9);

  // inputs
  dom.inputs.forEach((i) => {
    i.addEventListener("focus", onMassInputFocus);
    i.addEventListener("input", onMassInputChange);
  });

  // reset
  if (dom.resetBtn) dom.resetBtn.addEventListener("click", resetAll);

  // terms
  if (dom.termsBtn) dom.termsBtn.addEventListener("click", openTerms);
  if (dom.termsClose) dom.termsClose.addEventListener("click", closeTerms);
  if (dom.termsModal) {
    dom.termsModal.addEventListener("click", (e) => {
      if (e.target === dom.termsModal) closeTerms();
    });
  }

  setupContacts();

  // first draw
  updateAll();

  // load price now + every minute
  loadGoldPrice();
  setInterval(loadGoldPrice, 60 * 1000);
}

document.addEventListener("DOMContentLoaded", init);
