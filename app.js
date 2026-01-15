// app.js (shared logic for both pages)

const STORAGE_KEY_FORM = "azmortgage_v3";
const STORAGE_KEY_CALC = "az_calc_values";

// ---------- Helpers ----------
function money(x){
  return x.toLocaleString("en-US", { style:"currency", currency:"USD" });
}

function calcMonthlyPI(P, annualRate, years){
  const r = (annualRate / 100) / 12;
  const n = Math.round(years * 12);
  if (r === 0) return P / n;
  const pow = Math.pow(1 + r, n);
  return P * (r * pow) / (pow - 1);
}

// ---------- INDEX PAGE ----------
function initIndexPage(){
  const loanEl = document.getElementById("loanAmount");
  const rateEl = document.getElementById("interestRate");
  const termEl = document.getElementById("termYears");
  const termCustomEl = document.getElementById("termCustom");

  const submitBtn = document.getElementById("submitBtn");
  const breakdownBtn = document.getElementById("breakdownBtn");
  const clearBtn = document.getElementById("clearBtn");

  const miniPI = document.getElementById("miniPI");

  function saveForm(){
    const data = {
      loanAmount: loanEl.value,
      interestRate: rateEl.value,
      termYears: termEl.value,
      termCustom: termCustomEl.value
    };
    localStorage.setItem(STORAGE_KEY_FORM, JSON.stringify(data));
  }

  function loadForm(){
    const raw = localStorage.getItem(STORAGE_KEY_FORM);
    if(!raw) return;
    try{
      const d = JSON.parse(raw);
      if(d.loanAmount != null) loanEl.value = d.loanAmount;
      if(d.interestRate != null) rateEl.value = d.interestRate;
      if(d.termYears != null) termEl.value = d.termYears;
      if(d.termCustom != null) termCustomEl.value = d.termCustom;
    }catch(e){
      localStorage.removeItem(STORAGE_KEY_FORM);
    }
  }

  function readInputs(){
    const P = loanEl.valueAsNumber;
    const annualRate = rateEl.valueAsNumber;

    const customYears = termCustomEl.valueAsNumber;
    const yearsFromSelect = Number(termEl.value);
    const years = (Number.isFinite(customYears) && customYears > 0) ? customYears : yearsFromSelect;

    if(!Number.isFinite(P) || P <= 0) return {ok:false, msg:"Enter a valid Loan Amount."};
    if(!Number.isFinite(annualRate) || annualRate < 0) return {ok:false, msg:"Enter a valid Interest Rate."};
    if(!Number.isFinite(years) || years <= 0) return {ok:false, msg:"Select a term OR type a custom term in years."};

    return {ok:true, P, annualRate, years};
  }

  // custom overrides dropdown
  termCustomEl.addEventListener("input", () => {
    if(termCustomEl.value.trim() !== "") termEl.value = "";
    saveForm();
  });

  // dropdown clears custom
  termEl.addEventListener("change", () => {
    if(termEl.value !== "") termCustomEl.value = "";
    saveForm();
  });

  // save on change (persist after refresh)
  ["input","change"].forEach(evt => {
    [loanEl, rateEl, termEl, termCustomEl].forEach(el => el.addEventListener(evt, saveForm));
  });

  loadForm();

  submitBtn.addEventListener("click", () => {
    const v = readInputs();
    if(!v.ok){ alert(v.msg); return; }
    const monthly = calcMonthlyPI(v.P, v.annualRate, v.years);
    miniPI.textContent = `${money(monthly)} /mo`;
    saveForm();
  });

  breakdownBtn.addEventListener("click", () => {
    const v = readInputs();
    if(!v.ok){ alert(v.msg); return; }
    localStorage.setItem(STORAGE_KEY_CALC, JSON.stringify(v));
    saveForm();
    window.location.href = "./breakdown.html";
  });

  clearBtn.addEventListener("click", () => {
    loanEl.value = "";
    rateEl.value = "";
    termEl.value = "";
    termCustomEl.value = "";
    miniPI.textContent = "$0.00 /mo";
    localStorage.removeItem(STORAGE_KEY_FORM);
    localStorage.removeItem(STORAGE_KEY_CALC);
  });
}

// ---------- BREAKDOWN PAGE ----------
function animateDonut(monthlyPI, principal1, interest1){
  const total = principal1 + interest1;
  const radius = 62;
  const C = 2 * Math.PI * radius;

  const sP = total > 0 ? (principal1 / total) : 0;
  const sI = total > 0 ? (interest1 / total) : 0;

  const lenP = sP * C;
  const lenI = sI * C;

  const arcP = document.getElementById("arcPrincipal");
  const arcI = document.getElementById("arcInterest");

  arcP.setAttribute("stroke-dasharray", `0 ${C}`);
  arcP.setAttribute("stroke-dashoffset", `0`);
  arcI.setAttribute("stroke-dasharray", `0 ${C}`);
  arcI.setAttribute("stroke-dashoffset", `0`);

  document.getElementById("donutPI").textContent = `${money(monthlyPI)}/mo`;
  document.getElementById("pctPrincipal").textContent = `${Math.round(sP*100)}%`;
  document.getElementById("pctInterest").textContent = `${Math.round(sI*100)}%`;
  document.getElementById("valPrincipal").textContent = money(principal1);
  document.getElementById("valInterest").textContent = money(interest1);
  document.getElementById("valMonthlyPI").textContent = money(monthlyPI);

  requestAnimationFrame(() => {
    arcP.setAttribute("stroke-dasharray", `${lenP} ${Math.max(0, C - lenP)}`);
    arcP.setAttribute("stroke-dashoffset", `0`);

    arcI.setAttribute("stroke-dasharray", `${lenI} ${Math.max(0, C - lenI)}`);
    arcI.setAttribute("stroke-dashoffset", `${-lenP}`);
  });
}

function renderAmort12(P, annualRate, years){
  const body = document.getElementById("amortBody");
  body.innerHTML = "";

  const r = (annualRate / 100) / 12;
  const n = Math.round(years * 12);
  const payment = calcMonthlyPI(P, annualRate, years);

  let balance = P;

  for(let m=1; m<=12 && m<=n; m++){
    const interest = (r === 0) ? 0 : balance * r;
    const principal = payment - interest;
    balance = Math.max(0, balance - principal);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m}</td>
      <td class="right">${money(payment)}</td>
      <td class="right">${money(principal)}</td>
      <td class="right">${money(interest)}</td>
      <td class="right">${money(balance)}</td>
    `;
    body.appendChild(tr);
  }
}

function initBreakdownPage(){
  const raw = localStorage.getItem(STORAGE_KEY_CALC);
  if(!raw){
    alert("No values found. Please go back and enter loan, rate, and term.");
    window.location.href = "./index.html";
    return;
  }

  const v = JSON.parse(raw);
  const P = Number(v.P);
  const annualRate = Number(v.annualRate);
  const years = Number(v.years);

  const monthly = calcMonthlyPI(P, annualRate, years);
  const r = (annualRate / 100) / 12;

  const interest1 = (r === 0) ? 0 : P * r;
  const principal1 = monthly - interest1;

  animateDonut(monthly, principal1, interest1);
  renderAmort12(P, annualRate, years);

  // tabs
  const tabB = document.getElementById("tabBreakdown");
  const tabA = document.getElementById("tabAmort");
  const panelB = document.getElementById("panelBreakdown");
  const panelA = document.getElementById("panelAmort");

  function setTab(which){
    const isB = which === "b";
    tabB.classList.toggle("active", isB);
    tabA.classList.toggle("active", !isB);
    panelB.classList.toggle("show", isB);
    panelA.classList.toggle("show", !isB);
  }

  tabB.addEventListener("click", () => setTab("b"));
  tabA.addEventListener("click", () => setTab("a"));
}

// ---------- Decide which page we are on ----------
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if(page === "index") initIndexPage();
  if(page === "breakdown") initBreakdownPage();
});
