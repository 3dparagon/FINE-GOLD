const OZ = 31.1034768;

const probes = [
  {p:958,k:'23K'},
  {p:750,k:'18K'},
  {p:585,k:'14K'},
  {p:417,k:'10K'},
  {p:375,k:'9K'}
];

const list = document.getElementById('list');
const mainInput = document.getElementById('mainInput');
const mainPrice = document.getElementById('mainPrice');
const pricePerGram = document.getElementById('pricePerGram');
const eq999 = document.getElementById('eq999');
const totalPrice = document.getElementById('totalPrice');
const liveStamp = document.getElementById('liveStamp');

let currency = 'EUR';
let price999 = null;
let activeProbe = 999.9;

function fmt(n){return n.toLocaleString('ru-RU',{minimumFractionDigits:2});}

function render(){
  list.innerHTML = '';
  probes.forEach(r=>{
    const d=document.createElement('div');
    d.className='item';
    d.dataset.p=r.p;
    d.innerHTML=`
      <div class="left">
        <span class="probe">${r.p}°</span>
        <span class="karat">${r.k}</span>
      </div>
      <div class="right">
        <input type="number" step="0.01" value="0.00">
        <span class="unit">g</span>
        <div class="priceRow">— EUR / 1 g</div>
      </div>`;
    list.appendChild(d);

    const input=d.querySelector('input');
    d.onclick=()=>activate(r.p,input);
    input.oninput=()=>calc(r.p,parseFloat(input.value)||0);
  });
}

function activate(p,input){
  activeProbe=p;
  document.querySelectorAll('.item').forEach(i=>i.classList.remove('active'));
  input.closest('.item').classList.add('active');
  input.focus();
}

async function loadPrice(){
  const url=`https://data-asg.goldprice.org/dbXRates/${currency}`;
  const r=await fetch(url);
  const j=await r.json();
  price999=j.items[0].xauPrice/OZ;
  liveStamp.textContent=new Date().toLocaleString();
}

function calc(fromP,m){
  if(!price999)return;
  const pure=m*fromP/999.9;
  eq999.textContent=fmt(pure)+' g';
  pricePerGram.textContent=fmt(price999)+' '+currency;
  totalPrice.textContent=fmt(pure*price999)+' '+currency;
}

document.getElementById('eurBtn').onclick=()=>{currency='EUR';loadPrice();}
document.getElementById('usdBtn').onclick=()=>{currency='USD';loadPrice();}
document.getElementById('resetBtn').onclick=()=>{
  document.querySelectorAll('input').forEach(i=>i.value='0.00');
  eq999.textContent='0.00 g';
  totalPrice.textContent='—';
};

render();
loadPrice();
