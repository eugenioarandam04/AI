const VIEW_NAMES = [
  "home",
  "lease-analysis",
  "credit-calculator",
  "credit-comparator",
  "default-interest",
  "damages-estimator",
  "about"
];

const COMPARATOR_FREQUENCIES = {
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1
};

const DEFAULT_INTEREST_DAYS = {
  daily: 1,
  monthly: 30,
  quarterly: 90,
  annual: 365
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initFieldValidationUX();
  initExpandableHandlers();
  bindModuleForms();
  bindResetButtons();
  const initialView = getViewFromHash();
  activateView(initialView, false);
});

// Navigation controller

function initNavigation() {
  queryAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => activateView(button.dataset.viewTarget));
  });

  queryAll("[data-go-view]").forEach((button) => {
    button.addEventListener("click", () => activateView(button.dataset.goView));
  });

  window.addEventListener("hashchange", () => {
    activateView(getViewFromHash(), false);
  });
}

function activateView(viewName, updateHash = true) {
  const nextView = VIEW_NAMES.includes(viewName) ? viewName : "home";

  queryAll("[data-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === nextView);
  });

  queryAll("[data-view-target]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === nextView);
  });

  if (updateHash) {
    history.replaceState(null, "", `#${nextView}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function getViewFromHash() {
  const rawHash = window.location.hash.replace("#", "").trim();
  return VIEW_NAMES.includes(rawHash) ? rawHash : "home";
}

// Validation helpers

function initFieldValidationUX() {
  queryAll("input, select").forEach((field) => {
    const eventName = field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, () => clearFieldState(field));
  });
}

function bindResetButtons() {
  queryAll("[data-reset-module]").forEach((button) => {
    button.addEventListener("click", () => resetModule(button.dataset.resetModule));
  });
}

function resetModule(moduleKey) {
  const config = {
    lease: { formId: "lease-form", errorId: "lease-error", resultId: "lease-results" },
    credit: { formId: "credit-form", errorId: "credit-error", resultId: "credit-results" },
    compare: { formId: "compare-form", errorId: "compare-error", resultId: "compare-results" },
    default: { formId: "default-form", errorId: "default-error", resultId: "default-results" },
    damages: {
      formId: "damages-form",
      errorId: "damages-error",
      resultId: "damages-results",
      warningId: "damages-warning"
    }
  }[moduleKey];

  if (!config) {
    return;
  }

  const form = byId(config.formId);
  if (form) {
    form.reset();
    queryAll(".is-invalid", form).forEach(clearFieldState);
  }

  hideBox(config.errorId);
  hideBox(config.resultId);

  if (config.warningId) {
    hideBox(config.warningId);
  }

  const resultScope = byId(config.resultId);
  if (resultScope) {
    queryAll(".explanation-panel, .deep-explanation", resultScope).forEach((panel) => {
      panel.hidden = true;
    });
    queryAll(".info-toggle", resultScope).forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
  }
}

function clearFieldState(field) {
  field.classList.remove("is-invalid");
  field.removeAttribute("aria-invalid");
}

function markInvalid(field) {
  field.classList.add("is-invalid");
  field.setAttribute("aria-invalid", "true");
}

function showFormError(errorId, message) {
  const box = byId(errorId);
  if (!box) {
    return;
  }

  box.textContent = `${message} Please correct the highlighted fields.`;
  box.hidden = false;
}

function hideBox(id) {
  const box = byId(id);
  if (box) {
    box.hidden = true;
    if (box.classList.contains("form-feedback") || box.classList.contains("warning-card")) {
      box.textContent = "";
    }
  }
}

function readNumberField(id, label, errors, options = {}) {
  const field = byId(id);
  const rawValue = field.value.trim();
  const min = options.min ?? 0;
  const mustBePositive = options.mustBePositive ?? false;
  const integer = options.integer ?? false;

  if (rawValue === "") {
    markInvalid(field);
    errors.push(`${label} is required.`);
    return null;
  }

  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue)) {
    markInvalid(field);
    errors.push(`${label} must be a valid number.`);
    return null;
  }

  if (mustBePositive && numericValue <= 0) {
    markInvalid(field);
    errors.push(`${label} must be greater than zero.`);
    return null;
  }

  if (numericValue < min) {
    markInvalid(field);
    errors.push(`${label} cannot be negative.`);
    return null;
  }

  if (integer && !Number.isInteger(numericValue)) {
    markInvalid(field);
    errors.push(`${label} must be a whole number.`);
    return null;
  }

  return numericValue;
}

function readSelectField(id, label, errors) {
  const field = byId(id);
  const value = field.value.trim();

  if (!value) {
    markInvalid(field);
    errors.push(`${label} is required.`);
    return "";
  }

  return value;
}

// Formatting helpers

function formatCurrency(value) {
  return currencyFormatter.format(roundCurrency(value));
}

function formatNumber(value) {
  return numberFormatter.format(value);
}

function formatPercent(value, digits = 2) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(value)}%`;
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function joinWithAnd(items) {
  if (!items.length) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function toTitleCase(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function frequencyLabel(value) {
  return {
    monthly: "month",
    quarterly: "quarter",
    semiannual: "six months",
    annual: "year",
    daily: "day"
  }[value] || value;
}

// Expandable explanation handlers

function initExpandableHandlers() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button.info-toggle");
    if (!button) {
      return;
    }

    event.preventDefault();

    const targetId = button.dataset.target;
    const panel = byId(targetId);

    if (!panel) {
      return;
    }

    const nextState = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(nextState));
    panel.hidden = !nextState;

    if (nextState) {
      requestAnimationFrame(() => {
        panel.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      });
    }
  });
}

// Rendering helpers

function renderMetrics(containerId, metrics) {
  byId(containerId).innerHTML = metrics.map((metric) => `
    <article class="metric-card">
      <span class="metric-label">${metric.label}</span>
      <span class="metric-value">${metric.value}</span>
      <span class="metric-note">${metric.note}</span>
    </article>
  `).join("");
}

function renderParagraphs(containerId, paragraphs) {
  byId(containerId).innerHTML = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
}

function renderDeepExplanation(containerId, paragraphs) {
  byId(containerId).innerHTML = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
}

function renderInsightCards(containerId, items) {
  byId(containerId).innerHTML = items.map((item, index) => {
    const panelId = `${containerId}-panel-${index}`;
    const toneClass = item.tone === "positive" ? "is-positive" : item.tone === "warning" ? "is-warning" : "is-neutral";

    return `
      <article class="insight-card ${toneClass}">
        <div class="insight-head">
          <div>
            <h5 class="insight-title">${item.title}</h5>
            <p class="insight-summary">${item.summary}</p>
          </div>
          <button class="info-toggle" type="button" data-target="${panelId}" aria-expanded="false" aria-label="Open explanation for ${item.title}">ℹ️</button>
        </div>

        <div class="insight-impact">
          <strong>What this means for you</strong>
          <span>${item.userImpact}</span>
        </div>

        <div class="explanation-panel" id="${panelId}" hidden>
          <p><strong>Meaning.</strong> ${item.meaning}</p>
          <p><strong>Implication.</strong> ${item.implication}</p>
          <p><strong>User impact.</strong> ${item.userImpact}</p>
        </div>
      </article>
    `;
  }).join("");
}

function renderDetailGrid(items) {
  return `
    <div class="detail-grid">
      ${items.map((item) => `
        <div class="detail-item">
          <strong>${item.label}</strong>
          <span>${item.value}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function showResults(resultId) {
  byId(resultId).hidden = false;
}

// Utility functions

function queryAll(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

function byId(id) {
  return document.getElementById(id);
}

function maxBy(items, selector) {
  return items.reduce((highest, current) => (selector(current) > selector(highest) ? current : highest));
}

function minBy(items, selector) {
  return items.reduce((lowest, current) => (selector(current) < selector(lowest) ? current : lowest));
}

function calculateCreditCore({ loan, annualRate, periods, periodsPerYear, type }) {
  const rateDecimal = annualRate / 100;
  let payment = 0;
  let totalCost = 0;
  let interest = 0;

  if (type === "simple") {
    interest = loan * rateDecimal * (periods / periodsPerYear);
    totalCost = loan + interest;
    payment = totalCost / periods;
  } else {
    const periodicRate = periodsPerYear === 0 ? 0 : rateDecimal / periodsPerYear;

    if (periodicRate === 0) {
      payment = loan / periods;
    } else {
      payment = loan * periodicRate / (1 - Math.pow(1 + periodicRate, -periods));
    }

    totalCost = payment * periods;
    interest = totalCost - loan;
  }

  return {
    payment,
    totalCost,
    interest
  };
}

// Each module logic

function bindModuleForms() {
  byId("lease-form").addEventListener("submit", handleLeaseSubmit);
  byId("credit-form").addEventListener("submit", handleCreditSubmit);
  byId("compare-form").addEventListener("submit", handleCompareSubmit);
  byId("default-form").addEventListener("submit", handleDefaultInterestSubmit);
  byId("damages-form").addEventListener("submit", handleDamagesSubmit);
}

function handleLeaseSubmit(event) {
  event.preventDefault();
  hideBox("lease-error");
  queryAll(".is-invalid", byId("lease-form")).forEach(clearFieldState);

  const errors = [];
  const rent = readNumberField("lease-rent", "Rent", errors, { mustBePositive: true });
  const deposit = readNumberField("lease-deposit", "Deposit", errors, { min: 0 });
  const term = readNumberField("lease-term", "Term", errors, { mustBePositive: true, integer: true });
  const maintenance = readNumberField("lease-maintenance", "Maintenance", errors, { min: 0 });
  const lateFee = readNumberField("lease-late-fee", "Late fee", errors, { min: 0 });
  const negotiability = readSelectField("lease-negotiability", "Negotiability", errors);
  const renewal = readSelectField("lease-renewal", "Renewal", errors);
  const subletting = readSelectField("lease-subletting", "Subletting", errors);

  if (errors.length) {
    showFormError("lease-error", errors[0]);
    hideBox("lease-results");
    return;
  }

  const monthlyCost = rent + maintenance;
  const upfrontCash = deposit + monthlyCost;
  const fullTermCost = monthlyCost * term + deposit;
  const firstYearCost = monthlyCost * Math.min(term, 12) + deposit;
  const depositMonths = deposit / rent;
  const maintenanceShare = rent === 0 ? 0 : maintenance / rent;
  const lateFeeShare = rent === 0 ? 0 : lateFee / rent;
  const flexibilityScore = [
    term <= 12,
    negotiability === "yes",
    renewal === "no",
    subletting === "yes"
  ].filter(Boolean).length;

  const flexibilityLabel = flexibilityScore >= 3 ? "High" : flexibilityScore === 2 ? "Moderate" : "Limited";
  const pros = [];
  const cons = [];
  const suggestions = [];

  if (depositMonths <= 1.5) {
    pros.push({
      tone: "positive",
      title: "Deposit level stays within a more common range",
      summary: `The deposit equals about ${formatNumber(depositMonths)} ${depositMonths === 1 ? "month" : "months"} of rent, which is less likely to create unusual upfront pressure.`,
      meaning: "A deposit that stays close to one or one and a half months of rent is generally easier to plan for and does not move an excessive amount of cash to the start of the lease.",
      implication: "A more proportionate deposit reduces the chance that the contract feels affordable month to month but becomes difficult to enter because too much cash is tied up immediately.",
      userImpact: `You would still need to part with ${formatCurrency(deposit)} at the beginning, but the deposit is not disproportionately large relative to the rent.`
    });
  } else {
    cons.push({
      tone: "warning",
      title: "Deposit creates a heavy upfront burden",
      summary: `The deposit equals about ${formatNumber(depositMonths)} months of rent, which is a large amount to lock away at the start.`,
      meaning: "A high deposit is money you cannot use for moving costs, repairs, furniture, or emergency needs while the lease is running.",
      implication: "Even if the rent itself seems manageable, a large deposit can make the lease more financially demanding and can increase friction if deductions are disputed at the end.",
      userImpact: `Before the tenancy properly starts, you would already need ${formatCurrency(deposit)} for the deposit alone, which may strain your available cash.`
    });
    suggestions.push({
      tone: "neutral",
      title: "Ask for a reduced or staged deposit",
      summary: "Request a lower deposit or a phased deposit payment if the landlord is open to negotiation.",
      meaning: "Deposit terms are sometimes negotiable even when rent is not, especially if you can offer references, stable income, or a clean payment history.",
      implication: "Reducing the deposit does not lower the rent, but it does lower the amount of cash that must be committed before you can comfortably settle in.",
      userImpact: "A smaller or split deposit can make the lease easier to enter without changing the monthly rent obligation."
    });
  }

  pros.push({
    tone: "positive",
    title: term <= 12 ? "Lease duration supports flexibility" : "Lease duration supports stability",
    summary: term <= 12
      ? `A ${formatNumber(term)}-month term gives you a clearer exit point if your circumstances change.`
      : `A ${formatNumber(term)}-month term can protect you from frequent renegotiation or early relocation pressure.`,
    meaning: term <= 12
      ? "A shorter or standard term tends to preserve mobility because you are not locked in for an extended period."
      : "A longer term can offer predictability because the lease continues without needing a new bargain too soon.",
    implication: term <= 12
      ? "Flexibility has value when work, study, or family plans may change."
      : "Stability has value when you want certainty on where you will live and how long the arrangement is set to run.",
    userImpact: term <= 12
      ? "You have a more natural opportunity to leave or renegotiate within a reasonable period."
      : "You gain continuity, but you should still be comfortable with the commitment because it lasts much longer."
  });

  cons.push({
    tone: "warning",
    title: term <= 12 ? "Shorter terms can bring earlier uncertainty" : "Longer terms can reduce your freedom to exit",
    summary: term <= 12
      ? "A shorter lease can expose you to earlier rent changes or a faster need to renegotiate."
      : "A longer lease can make it harder to leave without cost if your plans shift.",
    meaning: term <= 12
      ? "Flexibility usually comes with a tradeoff: you may need to revisit the whole arrangement sooner than you expect."
      : "Stability is helpful only if you are reasonably confident that you can stay for the full term or secure an agreed exit route.",
    implication: term <= 12
      ? "Even a tenant-friendly term may still create pressure if the landlord later raises rent or changes conditions."
      : "If you need to move before the end, a strict long term can leave you paying for time you no longer use.",
    userImpact: term <= 12
      ? "The current lease is easier to leave than a long one, but it may also return you to the negotiation table sooner."
      : "You should treat the term as a serious commitment and think carefully about job mobility, family changes, or relocation risk."
  });

  if (maintenanceShare <= 0.1) {
    pros.push({
      tone: "positive",
      title: "Maintenance does not heavily distort the advertised rent",
      summary: `Maintenance adds ${formatPercent(maintenanceShare * 100, 1)} of the base rent, which keeps the recurring cost relatively transparent.`,
      meaning: "When side charges stay modest relative to rent, the listed rent remains a more reliable indicator of what the lease will really cost each month.",
      implication: "This lowers the risk of a lease looking affordable on paper but becoming noticeably more expensive once recurring extras are added.",
      userImpact: `Your expected recurring outlay is about ${formatCurrency(monthlyCost)} per month, and maintenance is not the main factor driving that figure upward.`
    });
  } else {
    cons.push({
      tone: "warning",
      title: "Maintenance meaningfully increases the real monthly burden",
      summary: `Maintenance adds ${formatPercent(maintenanceShare * 100, 1)} on top of the rent, which widens the gap between the advertised rent and the actual monthly cost.`,
      meaning: "A lease should be assessed on the total recurring amount, not on rent alone. Higher maintenance charges can materially change affordability.",
      implication: "If maintenance is not clearly defined, the tenant may feel the financial weight without fully understanding what the extra payment covers.",
      userImpact: `Your practical monthly housing cost is ${formatCurrency(monthlyCost)}, not just ${formatCurrency(rent)}, so budgeting only around the rent would understate the commitment.`
    });
    suggestions.push({
      tone: "neutral",
      title: "Ask for a written maintenance breakdown",
      summary: "Request an itemized explanation of what the maintenance charge covers and whether it can change during the term.",
      meaning: "A written breakdown helps distinguish legitimate recurring services from vague or open-ended charges.",
      implication: "Clarity on maintenance limits the risk of paying extra for obligations that should remain with the landlord or should at least be transparent.",
      userImpact: "This can help you decide whether the stated monthly cost is fair and whether any cap or clarification should be negotiated before signing."
    });
  }

  if (negotiability === "yes") {
    pros.push({
      tone: "positive",
      title: "Negotiability gives you leverage before signature",
      summary: "The lease is marked as negotiable, which is valuable because it means terms may still be improved before they become binding.",
      meaning: "Negotiability is not itself a financial benefit, but it creates room to reshape difficult clauses rather than simply accept them.",
      implication: "When the landlord is willing to discuss terms, a tenant has a better chance of adjusting the deposit, late fee, notice periods, or repair responsibilities.",
      userImpact: "You are not limited to a take-it-or-leave-it position and can ask for changes that reduce risk before you commit."
    });
  } else {
    cons.push({
      tone: "warning",
      title: "Non-negotiable terms reduce your room to correct imbalances",
      summary: "A fixed lease leaves you with less opportunity to soften harsh clauses before signing.",
      meaning: "If the landlord will not negotiate, then expensive or restrictive terms are more likely to remain exactly as drafted.",
      implication: "This matters because several small disadvantages can combine into a significant long-term burden even when no single clause looks catastrophic by itself.",
      userImpact: "You should review the contract more carefully because once signed, your practical ability to improve it may be very limited."
    });
    suggestions.push({
      tone: "neutral",
      title: "Prioritize the clauses that matter most",
      summary: "If the landlord says the lease is fixed, ask at minimum about the most financially sensitive terms such as deposit, exit rights, and penalties.",
      meaning: "Even in a mostly fixed contract, one or two key terms are sometimes still open to clarification or minor adjustment.",
      implication: "Targeting the highest-impact clauses is often more productive than attempting to renegotiate every part of the lease.",
      userImpact: "A small improvement on one critical clause can do more for you than many low-impact edits."
    });
  }

  if (lateFee === 0) {
    pros.push({
      tone: "positive",
      title: "No late fee reduces penalty exposure",
      summary: "The lease does not add a separate late payment penalty, which avoids an extra financial sanction if a payment timing issue arises.",
      meaning: "Even responsible tenants can face occasional timing problems. The absence of a late fee prevents a small delay from immediately creating a second debt.",
      implication: "This does not remove your rent obligation, but it does lower the speed at which a short delay becomes financially worse.",
      userImpact: "A missed or delayed payment would still matter, but it would not automatically trigger an additional fixed cash penalty under the entered terms."
    });
  } else if (lateFeeShare <= 0.05) {
    pros.push({
      tone: "positive",
      title: "Late fee appears moderate relative to rent",
      summary: `The late fee is about ${formatPercent(lateFeeShare * 100, 1)} of the rent, which is noticeable but not unusually severe.`,
      meaning: "A moderate late fee still encourages timely payment without making a short delay disproportionately costly.",
      implication: "This kind of clause is still worth respecting, but it does not punish lateness as harshly as a large fixed penalty would.",
      userImpact: `If a payment issue happens, the additional charge of ${formatCurrency(lateFee)} is meaningful but less destabilizing than a very high penalty.`
    });
  } else {
    cons.push({
      tone: "warning",
      title: "Late fee is strong enough to magnify short delays",
      summary: `The late fee is about ${formatPercent(lateFeeShare * 100, 1)} of the rent, which can turn a short payment delay into a noticeably larger obligation.`,
      meaning: "A high late fee is not only a compliance tool; it changes the financial consequences of timing and can place extra pressure on a tenant who has a temporary cash-flow issue.",
      implication: "When the fee is large, one delayed payment can lead to a quick increase in what you owe, especially if other charges or interest also apply.",
      userImpact: `A single late payment could add ${formatCurrency(lateFee)} immediately, so punctuality becomes materially more expensive to miss.`
    });
    suggestions.push({
      tone: "neutral",
      title: "Request a grace period or a fee cap",
      summary: "Ask whether the lease can include a short grace period or a lower maximum late penalty.",
      meaning: "Grace periods acknowledge that not every delay reflects bad faith and can stop a one-day issue from becoming a penalty event.",
      implication: "A capped late fee limits financial escalation while still preserving the landlord's interest in timely payment.",
      userImpact: "This can reduce the cost of accidental or temporary delay without removing your obligation to pay on time."
    });
  }

  if (renewal === "yes") {
    pros.push({
      tone: "positive",
      title: "Renewal can preserve occupancy continuity",
      summary: "A renewal mechanism can help you remain in place without reopening the entire arrangement from scratch.",
      meaning: "Continuity can matter when moving would be disruptive, expensive, or uncertain.",
      implication: "If the lease renews on known terms, it can reduce the practical pressure of searching for new housing at the end of the current term.",
      userImpact: "You may have a smoother path to staying in the property if the arrangement continues and the renewal rules are followed correctly."
    });
    cons.push({
      tone: "warning",
      title: "Renewal can trap you if notice deadlines are missed",
      summary: "Automatic or built-in renewal can extend the lease when a tenant forgets to act within the required notice window.",
      meaning: "A renewal clause is not only a convenience tool; it can also become a lock-in device if the exit process is not clearly monitored.",
      implication: "The practical risk is not the renewal itself but the possibility of becoming bound for longer than expected because notice was late or unclear.",
      userImpact: "If you intend to leave, you would need to watch notice dates carefully so the contract does not continue unintentionally."
    });
    suggestions.push({
      tone: "neutral",
      title: "Confirm the renewal notice deadline in writing",
      summary: "Ask for a clear written statement of how and when notice must be given if you do not want the lease to continue.",
      meaning: "Notice mechanics are often more important than the renewal clause itself because they determine how easily you can avoid an unwanted extension.",
      implication: "Clear notice wording reduces the risk of future disagreement about whether the lease validly renewed.",
      userImpact: "This helps you retain practical control over the end of the tenancy."
    });
  } else {
    pros.push({
      tone: "positive",
      title: "No renewal gives you a defined endpoint",
      summary: "The lease ends on a known date, which can make departure planning simpler.",
      meaning: "A fixed endpoint is useful because it reduces the chance of the contract continuing by default without your active agreement.",
      implication: "This can strengthen your ability to leave at the planned time or renegotiate from a fresh position.",
      userImpact: "You have a cleaner exit path at the end of the term, which may help if you expect to move or reassess your housing options."
    });
    cons.push({
      tone: "warning",
      title: "No renewal may require a fresh bargain sooner",
      summary: "If you want to remain in the property after the term, you may need a new agreement rather than a straightforward continuation.",
      meaning: "A clear endpoint is helpful for mobility, but it can also create uncertainty for tenants who prefer continuity.",
      implication: "The landlord may use the end of term to revisit price or conditions, and you may have less assurance of staying on the same terms.",
      userImpact: "If you hope to stay long term, make sure you understand how future occupancy would be handled once this term ends."
    });
  }

  if (subletting === "yes") {
    pros.push({
      tone: "positive",
      title: "Subletting permission improves your exit options",
      summary: "The ability to sublet can give you a fallback route if you need to move before the term is over.",
      meaning: "Subletting can reduce the economic rigidity of a lease because it offers a way to share or transfer occupancy pressure.",
      implication: "This can matter if work, study, or family changes make it difficult to remain in the property for the entire term.",
      userImpact: "You may have more flexibility to reduce your loss if you need to relocate before the lease naturally ends."
    });
  } else {
    cons.push({
      tone: "warning",
      title: "No subletting removes an important safety valve",
      summary: "If you need to move early, you may not be able to offset the cost by placing someone else in the property.",
      meaning: "A ban on subletting makes the lease more rigid because it narrows your lawful options when your circumstances change.",
      implication: "Without subletting, early departure often becomes more expensive because the tenant remains tied to the contract or must rely on the landlord's discretion.",
      userImpact: "A sudden move could leave you carrying the remaining lease burden with fewer practical ways to limit the loss."
    });
    suggestions.push({
      tone: "neutral",
      title: "Ask for a limited right to sublet or assign",
      summary: "Request a clause allowing subletting or assignment with the landlord's reasonable consent.",
      meaning: "A qualified subletting clause gives the landlord oversight while still preserving a realistic exit route for the tenant.",
      implication: "This can reduce lock-in without forcing the landlord to accept uncontrolled occupancy changes.",
      userImpact: "If approved, the clause would make the lease significantly easier to manage if your circumstances change unexpectedly."
    });
  }

  if (upfrontCash <= monthlyCost * 2.25) {
    pros.push({
      tone: "positive",
      title: "Opening cash requirement is more manageable than a heavily front-loaded lease",
      summary: `The lease calls for about ${formatCurrency(upfrontCash)} at the start, which is substantial but not extreme relative to the monthly structure entered.`,
      meaning: "A lease becomes front-loaded when the early payment requirement is so large that the tenant faces significant pressure before the normal monthly pattern even begins.",
      implication: "A more contained entry cost can make the tenancy easier to start without immediately draining savings.",
      userImpact: "You still need to prepare for a meaningful first outlay, but the start of the lease is not dominated by unusually heavy front-end cash demands."
    });
  } else {
    cons.push({
      tone: "warning",
      title: "The lease is noticeably front-loaded",
      summary: `About ${formatCurrency(upfrontCash)} is required at the beginning, which makes entry into the lease considerably more expensive than an ordinary month.`,
      meaning: "Front-loaded leases can be hard to enter because the first month is not just rent; it also concentrates deposit and other charges immediately.",
      implication: "This matters in practice because a lease can fail financially before it starts if the opening cash requirement is too high.",
      userImpact: "Even if the ongoing monthly cost is workable, the first payment period may require a separate cash plan."
    });
  }

  if (suggestions.length < 3) {
    suggestions.push({
      tone: "neutral",
      title: "Ask for a move-in condition report",
      summary: "Request a written inventory or condition schedule before you receive possession.",
      meaning: "A condition report helps distinguish pre-existing issues from tenant-caused damage later in the lease.",
      implication: "This protects both the deposit and the clarity of end-of-lease deductions.",
      userImpact: "Clear move-in documentation can make it easier to recover your deposit when the tenancy ends."
    });
  }

  const mainConcerns = [];
  if (depositMonths > 1.5) mainConcerns.push("the deposit");
  if (maintenanceShare > 0.1) mainConcerns.push("maintenance");
  if (lateFeeShare > 0.05) mainConcerns.push("late fees");
  if (negotiability === "no") mainConcerns.push("the fixed drafting");
  if (subletting === "no") mainConcerns.push("limited exit flexibility");

  byId("lease-summary-text").textContent = `This lease requires about ${formatCurrency(upfrontCash)} at the start and about ${formatCurrency(monthlyCost)} each month. The flexibility profile looks ${flexibilityLabel.toLowerCase()}, and the main pressure points are ${mainConcerns.length ? joinWithAnd(mainConcerns) : "relatively contained under the entered terms"}.`;

  renderMetrics("lease-metrics", [
    {
      label: "Upfront cash",
      value: formatCurrency(upfrontCash),
      note: "First month plus deposit and maintenance"
    },
    {
      label: "Monthly cost",
      value: formatCurrency(monthlyCost),
      note: "Rent plus maintenance"
    },
    {
      label: "First-year cost",
      value: formatCurrency(firstYearCost),
      note: "Using the first 12 months or the full term if shorter"
    },
    {
      label: "Flexibility",
      value: flexibilityLabel,
      note: "Based on term, negotiability, renewal, and subletting"
    }
  ]);

  renderInsightCards("lease-pros-list", pros);
  renderInsightCards("lease-cons-list", cons);
  renderInsightCards("lease-suggestions-list", suggestions);

  byId("lease-breakdown").innerHTML = `
    ${renderDetailGrid([
      { label: "Deposit as rent multiple", value: `${formatNumber(depositMonths)} months of rent` },
      { label: "Maintenance share", value: formatPercent(maintenanceShare * 100, 1) },
      { label: "Late fee share", value: formatPercent(lateFeeShare * 100, 1) },
      { label: "Full-term base outlay", value: formatCurrency(fullTermCost) },
      { label: "Negotiability", value: toTitleCase(negotiability) },
      { label: "Subletting", value: toTitleCase(subletting) }
    ])}
    <p>This breakdown treats the lease as a cash-flow commitment rather than looking at rent in isolation. That matters because deposit, maintenance, and penalties often determine whether the lease is practical, even when the headline rent initially appears acceptable.</p>
  `;

  renderDeepExplanation("lease-deep-explanation", [
    `This lease review looks at three things together: price, flexibility, and exit risk. Price covers the obvious numbers such as rent, maintenance, and deposit. Flexibility covers whether the lease can adapt to life changes through negotiation, a manageable term, and subletting. Exit risk covers how easily the lease may continue, how expensive delay becomes, and whether cash is heavily tied up at the start.`,
    `The practical consequence is that a lease should not be judged by rent alone. In your case, the real recurring cost is ${formatCurrency(monthlyCost)} per month and the opening cash requirement is ${formatCurrency(upfrontCash)}. Those two figures tell you how much pressure arrives immediately and how much remains each month afterward.`,
    `For a non-lawyer, the most useful reading is this: a strong lease is not just cheaper, it is clearer, more flexible, and less punishing when something changes. If a clause increases lock-in, obscures the real cost, or creates strong penalties, it deserves attention before signature, not after a dispute begins.`
  ]);

  showResults("lease-results");
}

function handleCreditSubmit(event) {
  event.preventDefault();
  hideBox("credit-error");
  queryAll(".is-invalid", byId("credit-form")).forEach(clearFieldState);

  const errors = [];
  const loan = readNumberField("credit-loan", "Loan", errors, { mustBePositive: true });
  const rate = readNumberField("credit-rate", "Rate", errors, { min: 0 });
  const payments = readNumberField("credit-payments", "Payments", errors, { mustBePositive: true, integer: true });
  const term = readNumberField("credit-term", "Term", errors, { mustBePositive: true });
  const type = readSelectField("credit-type", "Type", errors);

  if (errors.length) {
    showFormError("credit-error", errors[0]);
    hideBox("credit-results");
    return;
  }

  const paymentsPerYear = payments / term;

  if (!Number.isFinite(paymentsPerYear) || paymentsPerYear <= 0) {
    showFormError("credit-error", "Payments and term must create a valid repayment schedule.");
    hideBox("credit-results");
    return;
  }

  const credit = calculateCreditCore({
    loan,
    annualRate: rate,
    periods: payments,
    periodsPerYear: paymentsPerYear,
    type
  });

  const interestRatio = loan === 0 ? 0 : credit.interest / loan;
  const totalMultiple = loan === 0 ? 0 : credit.totalCost / loan;
  const monthlyEquivalent = credit.payment * paymentsPerYear / 12;
  const paymentShare = loan === 0 ? 0 : credit.payment / loan;
  const periodicRate = paymentsPerYear === 0 ? 0 : rate / paymentsPerYear;

  const expensiveLabel = interestRatio >= 0.6 || rate >= 18
    ? "High-cost"
    : interestRatio >= 0.25 || rate >= 8
      ? "Moderate-cost"
      : "Relatively contained";

  const aggressiveLabel = paymentShare >= 0.08 || (term <= 2 && rate >= 10)
    ? "Aggressive"
    : paymentShare >= 0.045 || paymentsPerYear >= 12
      ? "Firm"
      : "Measured";

  byId("credit-summary-text").textContent = `Borrowing ${formatCurrency(loan)} under a ${type} structure would lead to about ${formatCurrency(credit.totalCost)} in total repayment across ${formatNumber(payments)} payments. The finance charge is ${formatCurrency(credit.interest)}, which equals about ${formatPercent(interestRatio * 100, 1)} of the amount borrowed.`;

  renderMetrics("credit-metrics", [
    {
      label: "Total cost",
      value: formatCurrency(credit.totalCost),
      note: "Principal plus finance charge"
    },
    {
      label: "Interest",
      value: formatCurrency(credit.interest),
      note: "The price of borrowing"
    },
    {
      label: "Payment",
      value: formatCurrency(credit.payment),
      note: "Per scheduled installment"
    },
    {
      label: "Cost multiple",
      value: `${formatNumber(totalMultiple)}x`,
      note: "How many dollars are repaid for each dollar borrowed"
    }
  ]);

  renderParagraphs("credit-expensive-text", [
    `${expensiveLabel} is the clearest description of this structure. Interest adds ${formatCurrency(credit.interest)} to a principal of ${formatCurrency(loan)}, so the real price of access to the money is substantial enough that the final repayment figure matters just as much as the original loan amount.`,
    interestRatio >= 0.25
      ? `Because the finance charge is material, the total repayment of ${formatCurrency(credit.totalCost)} should be treated as a serious long-term commitment rather than a simple short-term convenience. The higher the interest share, the more of your cash goes to financing rather than reducing the original amount borrowed.`
      : `The finance charge is comparatively lighter here, which means more of each dollar repaid is effectively returning principal rather than paying for the credit itself. Even so, interest still raises the total beyond the headline loan amount and should be budgeted deliberately.`
  ]);

  renderParagraphs("credit-aggressive-text", [
    `${aggressiveLabel} refers to payment pressure rather than legal invalidity. In this case the schedule produces payments of ${formatCurrency(credit.payment)} each time, which is about ${formatCurrency(monthlyEquivalent)} when converted into a monthly equivalent for easier comparison.`,
    aggressiveLabel === "Aggressive"
      ? "This structure looks aggressive because the repayment pace or the rate is strong enough to compress the burden into larger installments. That can make the loan harder to carry alongside rent, utilities, and everyday expenses, even if the total term is not especially long."
      : aggressiveLabel === "Firm"
        ? "This structure is not extreme, but it still asks for disciplined repayment. The payment pattern is steady rather than light, so a user should check that the installments fit comfortably within normal monthly cash flow."
        : "This structure looks more measured because the installment pattern does not heavily front-load repayment pressure. That does not make the credit free or riskless, but it makes the schedule easier to absorb than a sharply compressed loan."
  ]);

  byId("credit-breakdown").innerHTML = `
    ${renderDetailGrid([
      { label: "Loan amount", value: formatCurrency(loan) },
      { label: "Annual rate", value: formatPercent(rate, 2) },
      { label: "Payments per year", value: formatNumber(paymentsPerYear) },
      { label: "Periodic rate", value: formatPercent(periodicRate, 3) },
      { label: "Monthly equivalent payment", value: formatCurrency(monthlyEquivalent) },
      { label: "Interest type", value: toTitleCase(type) }
    ])}
    <p>${type === "simple"
      ? "Simple credit in this tool applies the annual rate to the principal over the chosen term and then spreads the result across the stated number of payments."
      : "Compound credit in this tool uses a standard amortizing payment structure, which means each payment covers both interest and part of the principal over the chosen number of periods."}</p>
  `;

  renderDeepExplanation("credit-deep-explanation", [
    `A credit result should always be read in two layers: how much extra the loan costs overall and how hard the repayment pattern feels while you are living with it. The total tells you the full financial price of the contract, while the payment tells you how that price is experienced over time.`,
    `For your inputs, the total repayment is ${formatCurrency(credit.totalCost)} and the scheduled payment is ${formatCurrency(credit.payment)}. That distinction matters because some loans look manageable when examined one payment at a time but become expensive when the total interest is considered, while others feel heavy each month even if the total finance cost is relatively moderate.`,
    `In practical terms, a moderate credit structure is one where both the total finance charge and the installment pace remain proportionate. An aggressive structure is one where high interest, short repayment time, or both combine to make the obligation feel sharp and difficult to absorb within ordinary budgeting.`
  ]);

  showResults("credit-results");
}

function handleCompareSubmit(event) {
  event.preventDefault();
  hideBox("compare-error");
  queryAll(".is-invalid", byId("compare-form")).forEach(clearFieldState);

  const errors = [];
  const optionA = readComparatorOption("a", "Option A", errors);
  const optionB = readComparatorOption("b", "Option B", errors);

  if (errors.length) {
    showFormError("compare-error", errors[0]);
    hideBox("compare-results");
    return;
  }

  const options = [optionA, optionB];
  const cheapest = minBy(options, (item) => item.totalCost);
  const lowestPayment = minBy(options, (item) => item.monthlyEquivalent);
  const highestInterest = maxBy(options, (item) => item.interest);
  const hiddenCostLeader = maxBy(options, (item) => item.fixedCharges);
  const similarPrincipal = Math.abs(optionA.loan - optionB.loan) / Math.max(optionA.loan, optionB.loan) <= 0.05;
  const recommendation = chooseComparatorRecommendation(optionA, optionB, cheapest, lowestPayment, similarPrincipal);

  const similarPoints = [];
  similarPoints.push(similarPrincipal
    ? "Both options finance roughly the same principal, so comparing total cost is meaningful."
    : "The loan amounts differ, so total cost should be read alongside cost per borrowed dollar.");
  similarPoints.push(optionA.type === optionB.type
    ? `Both use ${optionA.type} interest logic, which makes the comparison easier because the finance method is aligned.`
    : "The options use different interest methods, which changes how the borrowing cost accumulates and is repaid.");
  similarPoints.push(optionA.frequency === optionB.frequency
    ? `Both rely on the same payment rhythm, with installments due every ${frequencyLabel(optionA.frequency)}.`
    : "The payment frequencies differ, so a lower scheduled installment may simply reflect a slower rhythm rather than a genuinely cheaper obligation.");

  const differencePoints = [];
  differencePoints.push(`${optionA.label} costs ${formatCurrency(optionA.totalCost)}, while ${optionB.label} costs ${formatCurrency(optionB.totalCost)}.`);
  differencePoints.push(`${optionA.label} has a monthly-equivalent burden of ${formatCurrency(optionA.monthlyEquivalent)}, compared with ${formatCurrency(optionB.monthlyEquivalent)} for ${optionB.label}.`);
  differencePoints.push(`${optionA.label} carries ${formatCurrency(optionA.fixedCharges)} in fees and extras, while ${optionB.label} carries ${formatCurrency(optionB.fixedCharges)}.`);

  byId("compare-summary-text").textContent = `${cheapest.label} is the cheapest overall at ${formatCurrency(cheapest.totalCost)}, while ${lowestPayment.label} offers the lower monthly-equivalent burden at ${formatCurrency(lowestPayment.monthlyEquivalent)}. ${highestInterest.label} generates the highest interest load, and ${hiddenCostLeader.label} carries the largest fixed charges.`;

  byId("compare-table-body").innerHTML = options.map((option) => `
    <tr>
      <td><strong>${option.label}</strong></td>
      <td>${formatCurrency(option.totalCost)}</td>
      <td>${formatCurrency(option.interest)}</td>
      <td>${formatCurrency(option.payment)} / ${frequencyLabel(option.frequency)}<br><span class="metric-note">Monthly equivalent: ${formatCurrency(option.monthlyEquivalent)}</span></td>
      <td>${formatCurrency(option.fixedCharges)}</td>
    </tr>
  `).join("");

  const maxTotal = Math.max(optionA.totalCost, optionB.totalCost);
  byId("compare-bars").innerHTML = options.map((option) => `
    <div class="bar-row">
      <div class="bar-topline">
        <span>${option.label}</span>
        <span>${formatCurrency(option.totalCost)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${(option.totalCost / maxTotal) * 100}%"></div>
      </div>
    </div>
  `).join("");

  byId("compare-findings").innerHTML = [
    {
      title: "Cheapest overall",
      body: `${cheapest.label} produces the lowest total cost, which matters most when your main goal is to minimize how much you repay over the full life of the credit.`
    },
    {
      title: "Lowest payment",
      body: `${lowestPayment.label} creates the lighter monthly-equivalent burden, which may feel easier in day-to-day budgeting even if it is not the cheapest option overall.`
    },
    {
      title: "Highest interest",
      body: `${highestInterest.label} creates the largest finance charge, showing where the pure price of borrowing is most concentrated.`
    },
    {
      title: "Hidden costs",
      body: `${hiddenCostLeader.label} carries the largest fees and extras at ${formatCurrency(hiddenCostLeader.fixedCharges)}, which means part of the real cost comes from charges beyond interest.`
    }
  ].map((item) => `
    <div class="analysis-chip">
      <strong>${item.title}</strong>
      <span>${item.body}</span>
    </div>
  `).join("");

  renderParagraphs("compare-interpretation", [
    `Similarities: ${similarPoints.join(" ")}`,
    `Differences: ${differencePoints.join(" ")} This shows that lower periodic payments do not automatically mean the cheaper contract. A loan may feel lighter each month because repayment is stretched over a longer period or because costs are shifted into fees and extras.`,
    `Recommendation: ${recommendation.label} looks better overall because ${recommendation.reason} ${lowestPayment.label !== cheapest.label ? `The lower payment offered by ${lowestPayment.label} appears to be buying breathing room at the cost of a higher full-term burden.` : "Here, the cheaper option and the lower-payment option point in the same direction, which makes the decision more straightforward."}`
  ]);

  byId("compare-breakdown").innerHTML = `
    ${renderDetailGrid([
      { label: `${optionA.label} cost per borrowed dollar`, value: `${formatNumber(optionA.costRatio)}x` },
      { label: `${optionB.label} cost per borrowed dollar`, value: `${formatNumber(optionB.costRatio)}x` },
      { label: `${optionA.label} scheduled payments`, value: formatNumber(optionA.periods) },
      { label: `${optionB.label} scheduled payments`, value: formatNumber(optionB.periods) },
      { label: `${optionA.label} fee ratio`, value: formatPercent(optionA.feeRatio * 100, 1) },
      { label: `${optionB.label} fee ratio`, value: formatPercent(optionB.feeRatio * 100, 1) }
    ])}
    <p>The comparison separates three drivers of cost: the rate itself, the length and frequency of repayment, and fixed charges such as fees and extras. That separation matters because two loans can advertise similar rates while still producing very different real burdens once term and add-on costs are included.</p>
  `;

  renderDeepExplanation("compare-deep-explanation", [
    "A sound comparison is not just a ranking exercise. It should tell you what is actually driving the gap between the options. In most cases the difference comes from one or more of four factors: interest rate, repayment length, payment rhythm, and non-interest charges.",
    `In your comparison, ${cheapest.label} wins on total repayment, while ${lowestPayment.label} wins on monthly-equivalent pressure. Those two winners are not always the same because slower repayment can make installments feel lighter while still increasing overall cost.`,
    "For a non-lawyer, the useful lesson is this: a lower headline payment is only a partial advantage. The better option is the one whose overall cost, fee load, and repayment pace best match your priorities without hiding long-term expense inside a seemingly comfortable schedule."
  ]);

  showResults("compare-results");
}

function readComparatorOption(key, label, errors) {
  const loan = readNumberField(`compare-${key}-loan`, `${label} loan`, errors, { mustBePositive: true });
  const rate = readNumberField(`compare-${key}-rate`, `${label} rate`, errors, { min: 0 });
  const term = readNumberField(`compare-${key}-term`, `${label} term`, errors, { mustBePositive: true });
  const fees = readNumberField(`compare-${key}-fees`, `${label} fees`, errors, { min: 0 });
  const extras = readNumberField(`compare-${key}-extras`, `${label} extras`, errors, { min: 0 });
  const frequency = readSelectField(`compare-${key}-frequency`, `${label} frequency`, errors);
  const type = readSelectField(`compare-${key}-type`, `${label} type`, errors);

  const periodsPerYear = COMPARATOR_FREQUENCIES[frequency];
  const periods = term * periodsPerYear;
  const base = calculateCreditCore({
    loan,
    annualRate: rate,
    periods,
    periodsPerYear,
    type
  });

  const fixedCharges = fees + extras;
  const totalCost = base.totalCost + fixedCharges;
  const payment = totalCost / periods;
  const monthlyEquivalent = totalCost / (term * 12);
  const costRatio = totalCost / loan;
  const feeRatio = fixedCharges / loan;

  return {
    label,
    loan,
    rate,
    term,
    fees,
    extras,
    frequency,
    type,
    periods,
    periodsPerYear,
    fixedCharges,
    interest: base.interest,
    totalCost,
    payment,
    monthlyEquivalent,
    costRatio,
    feeRatio
  };
}

function chooseComparatorRecommendation(optionA, optionB, cheapest, lowestPayment, similarPrincipal) {
  const costGapRatio = Math.abs(optionA.totalCost - optionB.totalCost) / Math.max(optionA.totalCost, optionB.totalCost);

  if (similarPrincipal) {
    if (cheapest.label === lowestPayment.label) {
      return {
        label: cheapest.label,
        reason: "it achieves both the lower full-term cost and the lower monthly-equivalent burden for roughly the same amount borrowed."
      };
    }

    if (costGapRatio <= 0.08) {
      return {
        label: lowestPayment.label,
        reason: "it delivers the lighter payment pattern while the total-cost penalty remains relatively limited compared with the alternative."
      };
    }

    return {
      label: cheapest.label,
      reason: "its lower total repayment creates a clearer economic advantage, and the payment difference is not strong enough to outweigh that saving."
    };
  }

  const lowerCostRatio = optionA.costRatio <= optionB.costRatio ? optionA : optionB;
  return {
    label: lowerCostRatio.label,
    reason: "it gives the better cost-per-borrowed-dollar result, which is the fairer way to compare options when the principal amounts are not the same."
  };
}

function handleDefaultInterestSubmit(event) {
  event.preventDefault();
  hideBox("default-error");
  queryAll(".is-invalid", byId("default-form")).forEach(clearFieldState);

  const errors = [];
  const days = readNumberField("default-days", "Days", errors, { mustBePositive: true, integer: true });
  const rate = readNumberField("default-rate", "Rate", errors, { min: 0 });
  const frequency = readSelectField("default-frequency", "Frequency", errors);
  const debt = readNumberField("default-debt", "Debt", errors, { mustBePositive: true });

  if (errors.length) {
    showFormError("default-error", errors[0]);
    hideBox("default-results");
    return;
  }

  const periodDays = DEFAULT_INTEREST_DAYS[frequency];
  const dailyRate = (rate / 100) / periodDays;
  const interest = debt * dailyRate * days;
  const total = debt + interest;
  const dailyCost = debt * dailyRate;

  byId("default-summary-text").textContent = `A debt of ${formatCurrency(debt)} delayed for ${formatNumber(days)} days at ${formatPercent(rate, 2)} per ${frequencyLabel(frequency)} generates about ${formatCurrency(interest)} in default interest, taking the total amount due to ${formatCurrency(total)}.`;

  renderMetrics("default-metrics", [
    {
      label: "Interest",
      value: formatCurrency(interest),
      note: "Delay-generated amount"
    },
    {
      label: "Total due",
      value: formatCurrency(total),
      note: "Original debt plus default interest"
    },
    {
      label: "Daily increase",
      value: formatCurrency(dailyCost),
      note: "Approximate cost of each additional day"
    },
    {
      label: "Daily rate",
      value: formatPercent(dailyRate * 100, 4),
      note: "Converted from the selected frequency"
    }
  ]);

  renderParagraphs("default-growth-text", [
    `Default interest grows because the stated rate is converted into a daily cost and then applied for every day the debt remains unpaid. In this case, the rate becomes about ${formatPercent(dailyRate * 100, 4)} per day.`,
    "That means time itself becomes expensive. The longer the debt stays outstanding, the more days exist for the creditor to claim additional compensation for the delay."
  ]);

  renderParagraphs("default-impact-text", [
    `The delay adds ${formatCurrency(interest)} to an original debt of ${formatCurrency(debt)}. Even when the rate looks modest in percentage terms, the practical effect is that non-payment quietly increases the amount that must eventually be found and paid.`,
    `At roughly ${formatCurrency(dailyCost)} per day, each extra day of delay keeps the debt moving in the wrong direction. This matters most when cash flow is already tight, because delay can make settlement more difficult rather than easier.`
  ]);

  byId("default-breakdown").innerHTML = `
    ${renderDetailGrid([
      { label: "Original debt", value: formatCurrency(debt) },
      { label: "Days in delay", value: formatNumber(days) },
      { label: "Rate frequency", value: toTitleCase(frequency) },
      { label: "Rate converted to daily", value: formatPercent(dailyRate * 100, 4) },
      { label: "Added interest", value: formatCurrency(interest) },
      { label: "Total due", value: formatCurrency(total) }
    ])}
    <p>This educational estimate uses a straightforward simple-interest approach to show how delay increases the amount owed over time. It does not replace the wording of any contract or statute that may apply to a real dispute.</p>
  `;

  renderDeepExplanation("default-deep-explanation", [
    "Default interest is important because it translates delay into money. The underlying idea is simple: once a debt should have been paid but was not, the creditor may claim an additional amount to reflect the time value of money and the cost of non-compliance.",
    `In your calculation, the debt increases from ${formatCurrency(debt)} to ${formatCurrency(total)} over ${formatNumber(days)} days. That growth is not random; it results from applying the selected rate across time. The longer the delay, the larger the additional amount becomes.`,
    "For users without legal training, the practical takeaway is direct: postponing payment rarely freezes the problem. Delay often increases the amount due, can harden negotiations, and may reduce the chance of resolving the matter cheaply and quickly."
  ]);

  showResults("default-results");
}

function handleDamagesSubmit(event) {
  event.preventDefault();
  hideBox("damages-error");
  hideBox("damages-warning");
  queryAll(".is-invalid", byId("damages-form")).forEach(clearFieldState);

  const errors = [];
  const directLoss = readNumberField("damages-direct", "Direct loss", errors, { min: 0 });
  const lostProfit = readNumberField("damages-profit", "Lost profit", errors, { min: 0 });

  if (errors.length) {
    showFormError("damages-error", errors[0]);
    hideBox("damages-results");
    return;
  }

  const causation = byId("damages-causation").checked;
  const foreseeable = byId("damages-foreseeable").checked;
  const quantifiable = byId("damages-quantifiable").checked;
  const evidence = byId("damages-evidence").checked;

  const totalDamages = directLoss + lostProfit;
  const conditionsMet = [causation, foreseeable, quantifiable, evidence].filter(Boolean).length;

  let readiness = "Very weak";
  if (causation && foreseeable && quantifiable && evidence) {
    readiness = "Strong";
  } else if (causation && conditionsMet >= 3) {
    readiness = "Cautious";
  } else if (conditionsMet >= 2) {
    readiness = "Weak";
  }

  const missingConditions = [];
  if (!causation) missingConditions.push("causation");
  if (!foreseeable) missingConditions.push("foreseeability");
  if (!quantifiable) missingConditions.push("quantifiability");
  if (!evidence) missingConditions.push("evidence");

  if (!causation) {
    const warning = byId("damages-warning");
    warning.hidden = false;
    warning.textContent = "Warning: causation is not established. That means the tool can still total the economic loss you entered, but the legal basis for recovering that loss is currently very vulnerable because the losses may not be linked clearly enough to the event or breach.";
  } else if (missingConditions.length) {
    const warning = byId("damages-warning");
    warning.hidden = false;
    warning.textContent = `Warning: the estimate may not be fully recoverable because ${joinWithAnd(missingConditions)} ${missingConditions.length === 1 ? "is" : "are"} missing. The number shown below is educational and indicative, not a confirmed recoverable award.`;
  }

  byId("damages-summary-text").textContent = `The losses entered total ${formatCurrency(totalDamages)}, made up of ${formatCurrency(directLoss)} in direct loss and ${formatCurrency(lostProfit)} in lost profit. Based on the legal conditions selected, the current claim posture looks ${readiness.toLowerCase()}.`;

  renderMetrics("damages-metrics", [
    {
      label: "Total damages",
      value: formatCurrency(totalDamages),
      note: "Indicative educational estimate"
    },
    {
      label: "Direct damages",
      value: formatCurrency(directLoss),
      note: "Immediate measurable loss"
    },
    {
      label: "Consequential damages",
      value: formatCurrency(lostProfit),
      note: "Lost profit used as the consequential element"
    },
    {
      label: "Claim readiness",
      value: readiness,
      note: "Based on the conditions you selected"
    }
  ]);

  renderParagraphs("damages-explanation-text", [
    `Direct damages cover immediate financial harm, such as money already spent, value already lost, or an amount needed to repair or replace something. Here that component is ${formatCurrency(directLoss)}.`,
    `Consequential damages in this tool are represented by lost profit, shown here as ${formatCurrency(lostProfit)}. This type of damage is often more difficult because it depends on proving what would likely have happened if the harmful event had not occurred.`,
    `The legal relevance of the checkboxes is critical. Not every loss is automatically recoverable. Causation links the loss to the event, foreseeability limits recovery to losses that were reasonably predictable, quantifiability asks whether the loss can be measured, and evidence supports the story with documents or proof.`
  ]);

  renderParagraphs("damages-impact-text", [
    missingConditions.length
      ? `What this means for you is that the figure of ${formatCurrency(totalDamages)} should be treated as an estimate of harm, not as a guaranteed recoverable sum. Missing ${joinWithAnd(missingConditions)} weakens the claim because courts and counterparties usually look for both economic loss and legal support before they accept a damages figure.`
      : `What this means for you is that the entered figure of ${formatCurrency(totalDamages)} has the core ingredients of a more supportable damages claim. That still does not guarantee recovery, but it does mean the estimate is backed by the main conditions that usually matter most.`,
    !causation
      ? "Without causation, the damages story is fundamentally unstable. Even large losses may fail if they cannot be tied clearly enough to the breach, wrongful act, or event being relied on."
      : "Even where causation exists, losses still need to be framed carefully. A well-supported damages position usually combines a clear timeline, evidence, and a reasoned explanation of why the numbers are fair and connected to the event."
  ]);

  byId("damages-breakdown").innerHTML = `
    ${renderDetailGrid([
      { label: "Direct loss", value: formatCurrency(directLoss) },
      { label: "Lost profit", value: formatCurrency(lostProfit) },
      { label: "Total entered loss", value: formatCurrency(totalDamages) },
      { label: "Claim readiness", value: readiness }
    ])}
    <div class="status-grid">
      ${renderConditionRow("Causation exists", causation, "Links the loss to the event or breach.")}
      ${renderConditionRow("Foreseeable", foreseeable, "Shows the type of loss was reasonably predictable.")}
      ${renderConditionRow("Quantifiable", quantifiable, "Shows the loss can be measured rather than guessed.")}
      ${renderConditionRow("Evidence exists", evidence, "Supports the claim with documents, records, or proof.")}
    </div>
    <p>This module gives an indicative educational estimate only. It totals entered losses and highlights common legal filters, but it cannot determine what a court, insurer, or opposing party would actually accept in a real case.</p>
  `;

  renderDeepExplanation("damages-deep-explanation", [
    "Damages are not simply a matter of adding up money and asking to be paid. The law usually asks whether the loss was caused by the relevant event, whether it was a foreseeable type of loss, whether it can be measured with some reliability, and whether there is evidence to prove it.",
    `In your estimate, the total entered loss is ${formatCurrency(totalDamages)}. That number is informative because it shows the scale of the economic harm, but its legal usefulness depends on the surrounding conditions. The more boxes that are missing, the more the figure starts to represent a complaint about loss rather than a well-supported damages claim.`,
    "For non-lawyers, the practical message is especially important: not every financial setback automatically becomes recoverable damages. The amount is only one part of the picture. Documentation, causation, and legal limits often determine whether the estimate remains persuasive when challenged."
  ]);

  showResults("damages-results");
}

function renderConditionRow(label, met, note) {
  return `
    <div class="status-row">
      <div>
        <strong>${label}</strong>
        <span>${note}</span>
      </div>
      <span class="status-pill ${met ? "is-met" : "is-missing"}">${met ? "Met" : "Missing"}</span>
    </div>
  `;
}
