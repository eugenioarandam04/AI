const navButtons = document.querySelectorAll(".nav-btn");
const modules = document.querySelectorAll(".module");
const cardLinks = document.querySelectorAll(".card[data-target], .jump-btn[data-target]");
const resetButtons = document.querySelectorAll("[data-reset-target]");

document.addEventListener("DOMContentLoaded", () => {
  wireNavigation();
  wireCalculators();
  setAssistantOfflineState();
});

function wireNavigation() {
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => activateModule(btn.dataset.target));
  });

  cardLinks.forEach((card) => {
    card.addEventListener("click", () => activateModule(card.dataset.target));
  });

  resetButtons.forEach((button) => {
    button.addEventListener("click", () => hideElement(button.dataset.resetTarget));
  });
}

function activateModule(targetId) {
  navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.target === targetId));
  modules.forEach((module) => module.classList.toggle("active", module.id === targetId));
}

function hideElement(id) {
  const element = document.getElementById(id);
  if (element) {
    element.classList.remove("is-visible");
  }
}

function showElement(id) {
  const element = document.getElementById(id);
  if (element) {
    element.classList.add("is-visible");
  }
}

function wireCalculators() {
  document.getElementById("lease-submit").addEventListener("click", generateLeaseReport);
  document.getElementById("credit-submit").addEventListener("click", generateCreditReport);
  document.getElementById("moratory-submit").addEventListener("click", generateMoratoryReport);
}

function generateLeaseReport() {
  const rent = parseFloat(document.getElementById("lease-rent").value);
  const deposit = parseFloat(document.getElementById("lease-deposit").value);
  const term = parseFloat(document.getElementById("lease-term").value);
  const maint = parseFloat(document.getElementById("lease-maint").value);
  const negotiable = document.getElementById("lease-negotiable").value;
  const lateFee = parseFloat(document.getElementById("lease-late").value);
  const autoRenew = document.getElementById("lease-renew").value;
  const sublet = document.getElementById("lease-sublet").value;

  if ([rent, deposit, term, maint, lateFee].some((value) => Number.isNaN(value))) {
    window.alert("Please complete all numerical lease fields.");
    return;
  }

  const monthlyTotal = rent + maint;
  const upfrontCost = deposit + monthlyTotal;
  const pros = [];
  const cons = [];

  if (negotiable === "yes") pros.push("The term is negotiable, which increases flexibility if your plans change.");
  else cons.push("A strict term can trap you into paying for time you no longer need.");

  if (sublet === "yes") pros.push("Subletting is allowed, giving you a practical exit if you relocate or need cost-sharing.");
  else cons.push("A subletting ban limits your options in emergencies or sudden moves.");

  if (deposit > rent * 2) cons.push("The deposit is higher than two months of rent, which may be unusually demanding.");
  else pros.push("The deposit sits within a more typical range relative to the rent.");

  if (lateFee > rent * 0.1) cons.push("The late fee exceeds 10% of rent, which makes short delays disproportionately expensive.");
  else pros.push("The late fee appears more moderate and easier to manage.");

  if (autoRenew === "yes") cons.push("Automatic renewal means missing a notice deadline could extend the contract unexpectedly.");
  else pros.push("No automatic renewal gives you a cleaner off-ramp at the end of the term.");

  if (monthlyTotal > rent * 1.15) cons.push("Maintenance meaningfully raises the real monthly housing cost above base rent.");

  document.getElementById("lease-summary").textContent =
    `Estimated first-month cash requirement: $${upfrontCost.toFixed(2)}. Effective recurring monthly cost: $${monthlyTotal.toFixed(2)}.`;
  document.getElementById("lease-pros").innerHTML = pros.map((item) => `<li>${item}</li>`).join("");
  document.getElementById("lease-cons").innerHTML = cons.map((item) => `<li>${item}</li>`).join("");
  document.getElementById("lease-negotiations").innerHTML =
    "Ask for a grace period on late payment, a written early-termination formula, and clarity on maintenance responsibilities. If the deposit is heavy, propose phased payment or partial reduction tied to your payment history.";

  showElement("lease-report");
}

function generateCreditReport() {
  const amount = parseFloat(document.getElementById("credit-amount").value);
  const rate = parseFloat(document.getElementById("credit-rate").value);
  const payments = parseFloat(document.getElementById("credit-payments").value);
  const term = parseFloat(document.getElementById("credit-term").value);
  const type = document.getElementById("credit-type").value;

  if ([amount, rate, payments, term].some((value) => Number.isNaN(value))) {
    window.alert("Please complete all credit fields.");
    return;
  }

  let totalInterest = 0;
  let totalAmount = 0;

  if (type === "simple") {
    totalInterest = amount * (rate / 100) * term;
    totalAmount = amount + totalInterest;
  } else {
    totalAmount = amount * Math.pow(1 + rate / 100, term);
    totalInterest = totalAmount - amount;
  }

  const monthlyPayment = totalAmount / payments;
  const interestRatio = totalInterest / amount;

  document.getElementById("res-credit-total").textContent = totalAmount.toFixed(2);
  document.getElementById("res-credit-interest").textContent = totalInterest.toFixed(2);
  document.getElementById("res-credit-monthly").textContent = monthlyPayment.toFixed(2);

  let analysis =
    `You borrow $${amount.toFixed(2)} and repay about $${totalAmount.toFixed(2)} across ${payments} payments. `;

  if (interestRatio > 0.5) {
    analysis +=
      "This is a high-cost loan because interest exceeds half the principal. It deserves comparison shopping or a shorter repayment horizon if cash flow allows.";
  } else if (interestRatio > 0.25) {
    analysis +=
      "The borrowing cost is moderate but still material. Check whether the monthly payment stays comfortable alongside rent, utilities, and emergency savings.";
  } else {
    analysis +=
      "The interest burden is lighter relative to the principal, though the loan should still be tested against your monthly budget.";
  }

  document.getElementById("res-credit-analysis").textContent = analysis;
  showElement("credit-report");
}

function generateMoratoryReport() {
  const debt = parseFloat(document.getElementById("mor-debt").value);
  const rate = parseFloat(document.getElementById("mor-rate").value);
  const period = document.getElementById("mor-period").value;
  const days = parseFloat(document.getElementById("mor-days").value);

  if ([debt, rate, days].some((value) => Number.isNaN(value))) {
    window.alert("Please complete all default-interest fields.");
    return;
  }

  let periodDays = 30;
  if (period === "semester") periodDays = 180;
  if (period === "annually") periodDays = 365;

  const dailyRate = (rate / 100) / periodDays;
  const generatedInterest = debt * dailyRate * days;
  const totalDue = debt + generatedInterest;

  document.getElementById("res-mor-interest").textContent = generatedInterest.toFixed(2);
  document.getElementById("res-mor-total").textContent = totalDue.toFixed(2);
  document.getElementById("res-mor-explanation").innerHTML =
    `The stated rate is ${rate}% per ${period}. Converted into a daily rate, that becomes ${(dailyRate * 100).toFixed(4)}% per day.<br><br>` +
    `Applied to an original debt of $${debt.toFixed(2)} over ${days} days, the delayed payment adds $${generatedInterest.toFixed(2)} in default interest.`;

  showElement("moratory-report");
}

function setAssistantOfflineState() {
  const dot = document.getElementById("assistant-status-dot");
  const label = document.getElementById("assistant-status-label");
  const copy = document.getElementById("assistant-status-copy");
  dot.classList.remove("online");
  dot.classList.add("offline");
  label.textContent = "Assistant offline";
  copy.textContent = "This shareable version keeps the assistant disabled so the page can be distributed as static HTML.";
}
