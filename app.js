// CONFIG
const PRICE_24K = 123.48;
const TELEGRAM_URL = "https://t.me/fine_gold_riga";

// PROBES
const PROBES = [
  { label: "999.9° 24K", value: 999.9 },
  { label: "958° 23K", value: 958 },
  { label: "750° 18K", value: 750 },
  { label: "585° 14K", value: 585 },
  { label: "417° 10K", value: 417 },
  { label: "375° 9K", value: 375 },
];

// ELEMENTS
const rowsEl = document.getElementById("rows");
const price1gEl = document.getElementById("price1g");
const weightEl = document.getElementById("weight");
const totalEl = document.getElementById("total");
const updateTime = document.getElementById("updateTime");

const calcBtn = document.getElementById("calcBtn");
const buyBtn = document.getElementById("buyBtn");
const calcSection = document.getElementById("calc-section");
const buySection = document.getElementById("buy-section");

const helpBtn = document.getElementById("helpBtn");
const termsModal = document.getElementById("termsModal");
const closeTerms = document.getElementById("closeTerms");

document.getElementById("resetBtn").onclick = resetAll;

// RENDER ROWS
PROBES.forEach(p => {
  const div = document.createElement("div");
  div.className = "row";
  div.innerHTML = `
    <strong>${p.label}</strong><br>
    <input type="number" min="0" placeholder="g" data-probe="${p.value}">
    <span class="price">— EUR / 1g</span>
  `;
  rowsEl.appendChild(div);
});

document.querySelectorAll("input").forEach(i => {
  i.addEventListener("input", calculate);
});

function calculate() {
  let totalWeight = 0;

  document.querySelectorAll("input").forEach(i => {
    const g = Number(i.value);
    const probe = Number(i.dataset.probe);
    if (g > 0) {
      totalWeight += g * (probe / 999.9);
      i.nextElementSibling.textContent =
        (PRICE_24K * (probe / 999.9)).toFixed(2) + " EUR / 1g";
    }
  });

  price1gEl.textContent = PRICE_24K.toFixed(2) + " EUR";
  weightEl.textContent = totalWeight.toFixed(2) + " g";
  totalEl.textContent = (totalWeight * PRICE_24K).toFixed(2) + " EUR";
  updateTime.textContent = "Live update: " + new Date().toLocaleString();
}

function resetAll() {
  document.querySelectorAll("input").forEach(i => i.value = "");
  document.querySelectorAll(".price").forEach(p => p.textContent = "— EUR / 1g");
  price1gEl.textContent = "—";
  weightEl.textContent = "—";
  totalEl.textContent = "—";
  updateTime.textContent = "Live update: —";
}

// NAV
buyBtn.onclick = () => {
  calcSection.classList.add("hidden");
  buySection.classList.remove("hidden");
  calcBtn.classList.remove("active");
  buyBtn.classList.add("active");
};

calcBtn.onclick = () => {
  buySection.classList.add("hidden");
  calcSection.classList.remove("hidden");
  buyBtn.classList.remove("active");
  calcBtn.classList.add("active");
};

// TERMS
helpBtn.onclick = () => termsModal.classList.remove("hidden");
closeTerms.onclick = () => termsModal.classList.add("hidden");
