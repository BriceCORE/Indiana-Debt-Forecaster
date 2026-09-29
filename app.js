const state = {
  data: null,
  districtId: "LAKE CENTRAL SCHOOL CORPORATION",
  scenario: "Base",
  term: "20",
  structure: "level",
  startYear: 2033,
  showAllIssues: false,
  inspectedYear: null,
  focusIssueId: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const oneDecimal = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

function formatMoney(value) {
  if (!Number.isFinite(Number(value))) return "n.a.";
  return money.format(Number(value));
}

function formatCompactMoney(value) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${oneDecimal.format(amount / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${oneDecimal.format(amount / 1_000_000)}M`;
  if (abs >= 1_000) return `${oneDecimal.format(amount / 1_000)}K`;
  return formatMoney(amount);
}

function formatPercent(value, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

function formatTaxRate(value) {
  return `$${Number(value || 0).toFixed(4)}`;
}

function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function district() {
  return state.data.districts.find((item) => item.id === state.districtId) ?? state.data.districts[0];
}

function capacityFor(item, scenario = state.scenario, structure = state.structure) {
  return item.capacityMatrix[scenario][String(state.startYear)][state.term][structure];
}

function setText(selector, value) {
  const node = $(selector);
  if (node) node.textContent = value;
}

function setActive(selector, key, value) {
  $$(selector).forEach((button) => {
    const active = button.dataset[key] === String(value);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function configureControls() {
  const search = $("#district-search");
  const results = $("#district-results");
  const countySelect = $("#county-select");
  const districtSelect = $("#district-select");
  const sortedDistricts = [...state.data.districts]
    .sort((a, b) => a.name.localeCompare(b.name));
  const counties = [...new Set(sortedDistricts.map((item) => item.county))]
    .sort((a, b) => a.localeCompare(b));
  const params = new URLSearchParams(window.location.search);
  const requestedDistrict = params.get("district");
  const requestedYear = Number(params.get("year"));
  let matches = [];
  let activeIndex = -1;

  if (requestedDistrict && state.data.districts.some((item) => item.id === requestedDistrict)) {
    state.districtId = requestedDistrict;
  }
  if (!state.data.districts.some((item) => item.id === state.districtId)) {
    state.districtId = state.data.districts[0].id;
  }

  function syncUrl() {
    const next = new URLSearchParams(window.location.search);
    next.set("district", state.districtId);
    next.set("year", String(state.startYear));
    window.history.replaceState({}, "", `${window.location.pathname}?${next.toString()}`);
  }

  function closeResults() {
    results.hidden = true;
    search.setAttribute("aria-expanded", "false");
    search.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  function paintActiveResult() {
    results.querySelectorAll(".district-result").forEach((button, index) => {
      const active = index === activeIndex;
      button.classList.toggle("active", active);
      if (active) {
        search.setAttribute("aria-activedescendant", button.id);
        button.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function renderDistrictOptions(county, selectedId = "") {
    const countyDistricts = county
      ? sortedDistricts.filter((item) => item.county === county)
      : [];
    districtSelect.innerHTML = `
      <option value="">${county ? "Choose a school" : "Choose a county first"}</option>
      ${countyDistricts.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}`;
    districtSelect.disabled = !county;
    if (countyDistricts.some((item) => item.id === selectedId)) {
      districtSelect.value = selectedId;
    }
  }

  function syncBrowseControls(item) {
    countySelect.value = item.county;
    renderDistrictOptions(item.county, item.id);
  }

  function chooseDistrict(item) {
    state.districtId = item.id;
    state.startYear = Math.max(2027, Math.min(2036, item.drops.total.year || item.defaultStartYear));
    state.showAllIssues = false;
    state.inspectedYear = null;
    state.focusIssueId = null;
    search.value = item.name;
    syncBrowseControls(item);
    $("#start-year").value = String(state.startYear);
    closeResults();
    syncUrl();
    render();
  }

  function renderResults(query) {
    const normalized = query.trim().toLowerCase();
    matches = sortedDistricts.filter((item) => {
      if (!normalized) return true;
      return item.name.toLowerCase().includes(normalized)
        || item.shortName.toLowerCase().includes(normalized)
        || item.county.toLowerCase().includes(normalized);
    }).slice(0, 12);
    activeIndex = matches.length ? 0 : -1;
    results.innerHTML = matches.length ? matches.map((item, index) => `
      <button
        type="button"
        id="district-result-${index}"
        class="district-result${item.id === state.districtId ? " selected" : ""}"
        role="option"
        aria-selected="${item.id === state.districtId}"
        data-district-id="${escapeHtml(item.id)}"
      >
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.county)} County</span>
      </button>
    `).join("") : '<p class="district-empty">No districts match that search.</p>';
    results.hidden = false;
    search.setAttribute("aria-expanded", "true");
    results.querySelectorAll(".district-result").forEach((button) => {
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        const item = state.data.districts.find((districtItem) => districtItem.id === button.dataset.districtId);
        if (item) chooseDistrict(item);
      });
    });
    paintActiveResult();
  }

  const initial = district();
  countySelect.innerHTML = `
    <option value="">Choose a county</option>
    ${counties.map((county) => `<option value="${escapeHtml(county)}">${escapeHtml(county)}</option>`).join("")}`;
  state.startYear = Number.isFinite(requestedYear) && requestedYear >= 2027 && requestedYear <= 2036
    ? requestedYear
    : Math.max(2027, Math.min(2036, initial.drops.total.year || initial.defaultStartYear));
  search.value = initial.name;
  syncBrowseControls(initial);
  $("#start-year").value = String(state.startYear);
  syncUrl();

  countySelect.addEventListener("change", () => {
    const current = district();
    const selectedCounty = countySelect.value;
    const selectedId = current.county === selectedCounty ? current.id : "";
    renderDistrictOptions(selectedCounty, selectedId);
  });

  districtSelect.addEventListener("change", () => {
    const item = state.data.districts.find((districtItem) => districtItem.id === districtSelect.value);
    if (item) chooseDistrict(item);
  });

  search.addEventListener("focus", () => {
    search.select();
    renderResults(search.value);
  });
  search.addEventListener("input", () => renderResults(search.value));
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeResults();
      search.value = district().name;
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.hidden) renderResults(search.value);
      if (!matches.length) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      activeIndex = (activeIndex + direction + matches.length) % matches.length;
      paintActiveResult();
      return;
    }
    if (event.key === "Enter" && !results.hidden && activeIndex >= 0) {
      event.preventDefault();
      chooseDistrict(matches[activeIndex]);
    }
  });
  search.addEventListener("blur", () => {
    window.setTimeout(() => {
      closeResults();
      search.value = district().name;
    }, 100);
  });

  $("#start-year").addEventListener("input", (event) => {
    state.startYear = Number(event.target.value);
    syncUrl();
    render();
  });

  $$("#scenario-control button").forEach((button) => {
    button.addEventListener("click", () => {
      state.scenario = button.dataset.scenario;
      render();
    });
  });

  $$("#term-control button").forEach((button) => {
    button.addEventListener("click", () => {
      state.term = button.dataset.term;
      render();
    });
  });

  $$("#structure-control button").forEach((button) => {
    button.addEventListener("click", () => {
      state.structure = button.dataset.structure;
      render();
    });
  });

  $("#show-issues").addEventListener("click", () => {
    state.showAllIssues = !state.showAllIssues;
    renderIssues(district());
  });
}

function renderMetrics(item) {
  const selected = capacityFor(item);
  const counterpartStructure = state.structure === "level" ? "wrapped" : "level";
  const counterpart = capacityFor(item, state.scenario, counterpartStructure);
  const annual = item.scenarioForecasts[state.scenario].annual[String(state.startYear)];
  const structureLabel = state.structure === "level" ? "level-service" : "annual-wrap";
  const counterpartLabel = counterpartStructure === "level" ? "Level-service" : "Annual-wrap";

  setText("#capacity-label", `${state.scenario} ${state.term}-year ${structureLabel} capacity`);
  setText("#capacity-value", formatCompactMoney(selected));
  setText("#capacity-compare", `${counterpartLabel}: ${formatCompactMoney(counterpart)} under the same assumptions`);
  setText("#selected-year-label", state.startYear);
  setText("#start-year-output", state.startYear);
  setText("#annual-space-value", formatCompactMoney(annual.available));
  setText("#annual-space-rate", `Ordinary rate held at ${formatTaxRate(annual.targetRate)} per $100 of AV`);
  setText("#ordinary-drop-value", formatCompactMoney(item.drops.ordinary.amount));
  setText("#ordinary-drop-year", item.drops.ordinary.amount > 0 ? `Opening occurs in ${item.drops.ordinary.year}` : "No scheduled opening through 2036");
  setText("#referendum-drop-value", formatCompactMoney(item.drops.referendum.amount));
  setText("#referendum-drop-year", item.drops.referendum.amount > 0 ? `Voter-approved lane in ${item.drops.referendum.year}` : "No referendum opening through 2036");
  setText("#confidence-value", item.reconciliation.confidence);
  const sourceReviewCount = Number(item.sourceQuality?.missing_schedule_count || 0)
    + Number(item.sourceQuality?.failed_capture_count || 0);
  setText(
    "#confidence-detail",
    sourceReviewCount > 0
      ? `${sourceReviewCount} obligation schedule${sourceReviewCount === 1 ? "" : "s"} need source review; capacity is excluded from the statewide ranking`
      : `${formatPercent(item.reconciliation.ordinaryGapPercent)} gap between 2027 Gateway ordinary payments and the DLGF estimate`,
  );
}

function renderSignal(item) {
  const ordinary = item.drops.ordinary;
  const referendum = item.drops.referendum;
  const total = item.drops.total;
  const referendumDominates = referendum.amount > Math.max(ordinary.amount * 1.25, 250_000)
    && Math.abs(referendum.year - total.year) <= 1;
  const planningStart = Math.max(2026, state.startYear - 2);
  let title;
  let message;

  if (referendumDominates) {
    title = "The headline drop is referendum-backed";
    message = `The ${total.year}–${total.year + 1} total schedule reduction is driven mainly by voter-approved debt. It may support a replacement referendum, but it does not automatically become ordinary debt-service capacity.`;
  } else if (ordinary.amount >= 500_000) {
    title = "The ordinary schedule creates a usable opening";
    message = `The largest modeled ordinary reduction is ${formatCompactMoney(ordinary.amount)} in ${ordinary.year}. Begin project and financing conversations before the drop, then test the full annual schedule rather than relying on one year.`;
  } else {
    title = "Capacity develops gradually";
    message = "There is no single large ordinary-debt reduction in the near-term schedule. Assessed-value growth and smaller payment step-downs create the opportunity over several years.";
  }

  $("#signal-box").innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>`;
  setText("#planning-window", `${planningStart}–${state.startYear}`);
  setText("#interest-rate", formatPercent(item.scenarioForecasts[state.scenario].interestRate, 2));
  setText("#av-growth", formatPercent(item.scenarioForecasts[state.scenario].growth, 2));
  setText("#av-cagr", formatPercent(item.avCagr, 2));
  for (const scenario of ["Conservative", "Base", "Growth"]) {
    setText(`#${scenario.toLowerCase()}-capacity`, formatCompactMoney(capacityFor(item, scenario)));
  }
}

function svgText(x, y, content, attrs = "") {
  return `<text x="${x}" y="${y}" ${attrs}>${escapeHtml(content)}</text>`;
}

function issuesForYear(item, year) {
  return item.issues
    .map((issue) => {
      const amount = Number(issue.annualPayments?.[String(year)] || 0);
      const nextAmount = Number(issue.annualPayments?.[String(year + 1)] || 0);
      return {
        ...issue,
        amount,
        nextAmount,
        reduction: Math.max(0, amount - nextAmount),
      };
    })
    .filter((issue) => issue.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

function issueChangeLabel(issue, year) {
  if (issue.nextAmount === 0) return `Final scheduled year · falls off in ${year + 1}`;
  if (issue.reduction > 0) return `Steps down ${formatCompactMoney(issue.reduction)} in ${year + 1}`;
  if (issue.nextAmount > issue.amount) return `Increases ${formatCompactMoney(issue.nextAmount - issue.amount)} in ${year + 1}`;
  return `Continues in ${year + 1}`;
}

function renderChartInspector(item) {
  const inspector = $("#chart-inspector");
  if (!state.inspectedYear) {
    inspector.hidden = true;
    inspector.innerHTML = "";
    return;
  }

  const year = state.inspectedYear;
  const issues = issuesForYear(item, year);
  const total = issues.reduce((sum, issue) => sum + issue.amount, 0);
  const ending = issues.filter((issue) => issue.nextAmount === 0);
  inspector.innerHTML = `
    <div class="inspector-heading">
      <div>
        <p class="section-kicker">Pinned schedule</p>
        <h3>${year} · ${escapeHtml(formatMoney(total))} across ${issues.length} obligation${issues.length === 1 ? "" : "s"}</h3>
        <p>${ending.length ? `${ending.length} obligation${ending.length === 1 ? "" : "s"} reach${ending.length === 1 ? "es" : ""} their final scheduled year.` : `No obligations finish in ${year}.`}</p>
      </div>
      <button type="button" class="inspector-close" aria-label="Close the pinned year breakdown">Close</button>
    </div>
    <div class="issue-payment-list">
      ${issues.length ? issues.map((issue) => `
        <button type="button" class="issue-payment-row" data-issue-id="${escapeHtml(issue.id)}" title="Find this obligation in the table below">
          <i class="${escapeHtml(issue.bucket)}" aria-hidden="true"></i>
          <span class="issue-payment-copy">
            <strong>${escapeHtml(issue.name)}</strong>
            <span>${escapeHtml(titleCase(issue.bucket))} · ${escapeHtml(issueChangeLabel(issue, year))}</span>
          </span>
          <span class="issue-payment-amount">${escapeHtml(formatCompactMoney(issue.amount))}</span>
        </button>
      `).join("") : '<p class="supporting-copy">No scheduled debt service is reported for this year.</p>'}
    </div>`;
  inspector.hidden = false;

  inspector.querySelector(".inspector-close").addEventListener("click", () => {
    state.inspectedYear = null;
    state.focusIssueId = null;
    renderDebtChart(item);
  });
  inspector.querySelectorAll(".issue-payment-row").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusIssueId = button.dataset.issueId;
      state.showAllIssues = true;
      renderIssues(item);
      const row = $$("#issues-body tr").find((candidate) => candidate.dataset.issueId === state.focusIssueId);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.focus({ preventScroll: true });
      }
    });
  });
}

function renderDebtChart(item) {
  const svg = $("#debt-chart");
  const chartYears = Array.from({ length: 20 }, (_, index) => 2026 + index);
  const width = 1060;
  const height = 390;
  const margin = { top: 30, right: 24, bottom: 50, left: 76 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const scenario = item.scenarioForecasts[state.scenario];
  const totals = chartYears.map((year) => Number(item.schedules.total[String(year)] || 0));
  const targets = chartYears.map((year) => year === 2026
    ? Number(item.current.ordinaryDebtLevy || 0)
    : Number(scenario.annual[String(year)]?.targetLevy || 0));
  const maxValue = Math.max(...totals, ...targets, 1) * 1.12;
  const slot = innerWidth / chartYears.length;
  const barWidth = Math.max(11, slot * 0.56);
  const y = (value) => margin.top + innerHeight - (Number(value || 0) / maxValue) * innerHeight;
  const x = (index) => margin.left + index * slot + slot / 2;
  const colors = { ordinary: "#008348", referendum: "#282828", pension: "#a5ccb7" };
  const parts = [];

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = maxValue * tick / 4;
    const py = y(value);
    parts.push(`<line x1="${margin.left}" y1="${py}" x2="${width - margin.right}" y2="${py}" stroke="#dde1df" stroke-width="1" />`);
    parts.push(svgText(margin.left - 12, py + 4, formatCompactMoney(value), 'text-anchor="end" fill="#6a6e6c" font-size="11"'));
  }

  const selectedIndex = chartYears.indexOf(state.startYear);
  if (selectedIndex >= 0) {
    const markerX = x(selectedIndex);
    parts.push(`<rect x="${markerX - slot / 2}" y="${margin.top}" width="${slot}" height="${innerHeight}" fill="#e8f3ed" />`);
    parts.push(`<line x1="${markerX}" y1="${margin.top - 6}" x2="${markerX}" y2="${margin.top + innerHeight}" stroke="#008348" stroke-width="2" stroke-dasharray="4 5" />`);
    parts.push(svgText(markerX, margin.top - 12, "service starts", 'text-anchor="middle" fill="#008348" font-size="11" font-weight="700"'));
  }

  chartYears.forEach((year, index) => {
    let cumulative = 0;
    for (const bucket of ["ordinary", "referendum", "pension"]) {
      const value = Number(item.schedules[bucket][String(year)] || 0);
      if (value <= 0) continue;
      const top = y(cumulative + value);
      const bottom = y(cumulative);
      parts.push(`<rect x="${x(index) - barWidth / 2}" y="${top}" width="${barWidth}" height="${Math.max(0, bottom - top)}" rx="2" fill="${colors[bucket]}" />`);
      cumulative += value;
    }
    if (index % 2 === 0 || year === state.startYear) {
      parts.push(svgText(x(index), height - 19, year, `text-anchor="middle" fill="${year === state.startYear ? "#008348" : "#6a6e6c"}" font-size="11" font-weight="${year === state.startYear ? 700 : 400}"`));
    }
    parts.push(`<rect class="hover-zone${state.inspectedYear === year ? " pinned" : ""}" data-year="${year}" x="${x(index) - slot / 2}" y="${margin.top}" width="${slot}" height="${innerHeight}" fill="transparent" tabindex="0" role="button" aria-pressed="${state.inspectedYear === year}" aria-label="${year} debt service details" />`);
  });

  const path = targets.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`).join(" ");
  parts.push(`<path d="${path}" fill="none" stroke="#000000" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />`);
  targets.forEach((value, index) => {
    if (index % 2 === 0) parts.push(`<circle cx="${x(index)}" cy="${y(value)}" r="3.2" fill="#ffffff" stroke="#000000" stroke-width="2" />`);
  });
  parts.push(svgText(18, margin.top + innerHeight / 2, "Annual debt service", 'transform="rotate(-90 18 190)" fill="#6a6e6c" font-size="11" font-weight="700"'));
  svg.innerHTML = parts.join("");

  const tooltip = $("#chart-tooltip");
  function showTooltip(event, year) {
    const ordinary = Number(item.schedules.ordinary[String(year)] || 0);
    const referendum = Number(item.schedules.referendum[String(year)] || 0);
    const pension = Number(item.schedules.pension[String(year)] || 0);
    const annual = year === 2026 ? null : scenario.annual[String(year)];
    const yearIssues = issuesForYear(item, year);
    const ending = yearIssues.filter((issue) => issue.nextAmount === 0);
    const visibleIssues = yearIssues.slice(0, 4);
    const hiddenCount = Math.max(0, yearIssues.length - visibleIssues.length);
    tooltip.innerHTML = `
      <strong>${year} · ${escapeHtml(formatMoney(ordinary + referendum + pension))}</strong>
      <span>Ordinary ${escapeHtml(formatCompactMoney(ordinary))} · Referendum ${escapeHtml(formatCompactMoney(referendum))} · Pension ${escapeHtml(formatCompactMoney(pension))}</span>
      <div class="tooltip-issues">
        ${visibleIssues.map((issue) => `
          <span class="tooltip-issue">
            <i class="${escapeHtml(issue.bucket)}" aria-hidden="true"></i>
            <span>${escapeHtml(issue.name)}</span>
            <b>${escapeHtml(formatCompactMoney(issue.amount))}</b>
          </span>
        `).join("")}
      </div>
      <span class="tooltip-foot">${hiddenCount ? `+${hiddenCount} more · ` : ""}${ending.length ? `${ending.length} end${ending.length === 1 ? "s" : ""} after ${year} · ` : ""}Click to inspect${annual ? ` · ${escapeHtml(formatCompactMoney(annual.available))} ordinary space` : ""}</span>`;
    tooltip.hidden = false;
    const wrap = svg.parentElement.getBoundingClientRect();
    const clientX = event.clientX || wrap.left + wrap.width / 2;
    const clientY = event.clientY || wrap.top + 90;
    tooltip.style.left = `${Math.min(wrap.width - 190, Math.max(4, clientX - wrap.left + 12))}px`;
    tooltip.style.top = `${Math.max(4, clientY - wrap.top - 24)}px`;
  }
  svg.querySelectorAll(".hover-zone").forEach((zone) => {
    const year = Number(zone.dataset.year);
    zone.addEventListener("mousemove", (event) => showTooltip(event, year));
    zone.addEventListener("focus", (event) => showTooltip(event, year));
    zone.addEventListener("mouseleave", () => { tooltip.hidden = true; });
    zone.addEventListener("blur", () => { tooltip.hidden = true; });
    zone.addEventListener("click", () => {
      state.inspectedYear = state.inspectedYear === year ? null : year;
      state.focusIssueId = null;
      tooltip.hidden = true;
      renderDebtChart(item);
    });
    zone.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      state.inspectedYear = state.inspectedYear === year ? null : year;
      state.focusIssueId = null;
      tooltip.hidden = true;
      renderDebtChart(item);
    });
  });

  renderChartInspector(item);

  const selectedAnnual = scenario.annual[String(state.startYear)];
  const note = item.drops.referendum.amount > item.drops.ordinary.amount * 1.25
    ? `${state.startYear} shows ${formatCompactMoney(selectedAnnual.available)} of projected ordinary levy space. The visually larger total-debt drop is mostly referendum-backed and needs its own approval path.`
    : `${state.startYear} shows ${formatCompactMoney(selectedAnnual.available)} of projected ordinary levy space before sizing a new issue.`;
  setText("#chart-note", note);
}

function renderTax(item) {
  setText("#total-rate", `${formatTaxRate(item.current.totalRate)} / $100`);
  setText("#ordinary-rate", `${formatTaxRate(item.current.ordinaryDebtRate)} / $100`);
  setText("#referendum-rate", `${formatTaxRate(item.current.referendumDebtRate)} / $100`);
  setText("#operating-rate", `${formatTaxRate(item.current.operatingReferendumRate)} / $100`);
  setText("#total-loss", `${formatCompactMoney(item.tax.totalCircuitBreaker)} (${formatPercent(item.tax.totalCircuitBreakerPercent)})`);
  setText("#ordinary-loss", formatCompactMoney(item.tax.ordinaryCircuitBreaker));
  setText("#protection-chip", item.tax.ordinaryProtected ? "Ordinary debt protected" : "Protection needs review");

  const values = {
    ordinary: item.tax.ordinaryCircuitBreaker,
    referendum: item.tax.referendumDebtCircuitBreaker,
    operations: item.tax.operationsCircuitBreaker,
  };
  const known = values.ordinary + values.referendum + values.operations;
  values.other = Math.max(0, item.tax.totalCircuitBreaker - known);
  const total = Math.max(item.tax.totalCircuitBreaker, 1);
  $("#loss-bar").innerHTML = Object.entries(values).map(([key, value]) => (
    `<span class="loss-${key}" style="width:${Math.max(0, value / total * 100)}%" title="${titleCase(key)}: ${formatMoney(value)}"></span>`
  )).join("");

  const protection = item.tax.ordinaryProtected
    ? "DLGF marks the ordinary debt fund as protected, so the unitwide circuit-breaker percentage should not be applied directly to ordinary debt capacity."
    : "The ordinary debt fund is not marked protected in the current source, so its actual loss needs a district-specific review.";
  const referendum = item.tax.referendumExempt
    ? " The referendum debt fund is marked exempt from the 1%/2%/3% property-tax caps, though other credits can still affect collections."
    : " The referendum debt fund's exemption status needs review.";
  setText("#tax-explanation", `${protection}${referendum}`);
}

function renderHistory(item) {
  const rows = item.history;
  const width = 620;
  const height = 198;
  const margin = { top: 15, right: 48, bottom: 30, left: 45 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxAv = Math.max(...rows.map((row) => row.cnav), 1) * 1.08;
  const maxRate = Math.max(...rows.map((row) => row.ordinaryDebtRate), 0.05) * 1.15;
  const x = (index) => margin.left + index * (innerWidth / Math.max(1, rows.length - 1));
  const yAv = (value) => margin.top + innerHeight - value / maxAv * innerHeight;
  const yRate = (value) => margin.top + innerHeight - value / maxRate * innerHeight;
  const parts = [];
  for (let tick = 0; tick <= 3; tick += 1) {
    const py = margin.top + innerHeight - tick * innerHeight / 3;
    parts.push(`<line x1="${margin.left}" y1="${py}" x2="${width - margin.right}" y2="${py}" stroke="#dde1df" />`);
  }
  const barWidth = 36;
  rows.forEach((row, index) => {
    const py = yAv(row.cnav);
    parts.push(`<rect x="${x(index) - barWidth / 2}" y="${py}" width="${barWidth}" height="${margin.top + innerHeight - py}" rx="2" fill="#a5ccb7" />`);
    parts.push(svgText(x(index), height - 9, row.year, 'text-anchor="middle" fill="#6a6e6c" font-size="11"'));
  });
  const ratePath = rows.map((row, index) => `${index === 0 ? "M" : "L"}${x(index)},${yRate(row.ordinaryDebtRate)}`).join(" ");
  parts.push(`<path d="${ratePath}" fill="none" stroke="#008348" stroke-width="3" />`);
  rows.forEach((row, index) => {
    parts.push(`<circle cx="${x(index)}" cy="${yRate(row.ordinaryDebtRate)}" r="4" fill="#ffffff" stroke="#008348" stroke-width="2.5"><title>${row.year}: AV ${formatMoney(row.cnav)}, ordinary rate ${formatTaxRate(row.ordinaryDebtRate)}</title></circle>`);
  });
  parts.push(svgText(margin.left, 11, "Certified net AV", 'fill="#6a6e6c" font-size="10" font-weight="700"'));
  parts.push(svgText(width - margin.right, 11, "Ordinary rate", 'text-anchor="end" fill="#008348" font-size="10" font-weight="700"'));
  $("#history-chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${parts.join("")}</svg>`;
}

function renderIssues(item) {
  const issues = state.showAllIssues ? item.issues : item.issues.slice(0, 10);
  $("#issues-body").innerHTML = issues.map((issue) => {
    const finalDate = issue.finalPaymentDate || "n.a.";
    const refunding = String(issue.refundsPriorDebt).toLowerCase() === "yes";
    return `<tr data-issue-id="${escapeHtml(issue.id)}" tabindex="-1" class="${issue.id === state.focusIssueId ? "issue-highlight" : ""}">
      <td>${escapeHtml(issue.name)}</td>
      <td>${escapeHtml(issue.purpose || "Purpose not reported")}</td>
      <td><span class="bucket-chip ${escapeHtml(issue.bucket)}">${escapeHtml(titleCase(issue.bucket))}</span></td>
      <td>${refunding ? '<span class="yes-chip">Replaces prior debt</span>' : "No"}</td>
      <td class="numeric">${escapeHtml(formatCompactMoney(issue.remainingScheduledService))}</td>
      <td>${escapeHtml(finalDate)}</td>
    </tr>`;
  }).join("");
  setText("#issue-count", `${item.issues.length} active schedules`);
  $("#show-issues").textContent = state.showAllIssues ? "Show fewer" : "Show all";
  $("#show-issues").hidden = item.issues.length <= 10;
}

function render() {
  const item = district();
  setActive("#scenario-control button", "scenario", state.scenario);
  setActive("#term-control button", "term", state.term);
  setActive("#structure-control button", "structure", state.structure);
  setText("#district-heading", `${item.shortName} scheduled service and rate capacity`);
  renderMetrics(item);
  renderSignal(item);
  renderDebtChart(item);
  renderTax(item);
  renderHistory(item);
  renderIssues(item);
}

async function init() {
  try {
    const response = await fetch("./site-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    state.data = await response.json();
    setText("#scope-label", `${state.data.metadata.scope} · ${state.data.metadata.districtCount} districts`);
    setText("#as-of", `Debt snapshot ${state.data.metadata.debtSnapshot} · ${state.data.metadata.parsedScheduleCount} of ${state.data.metadata.capturedIssueCount} schedules parsed · Model ${state.data.metadata.asOf}`);
    $("#gateway-source").href = state.data.sources.gateway_debt;
    $("#dlgf-source").href = state.data.sources.certified_reports;
    $("#guidance-source").href = state.data.sources.dlgfDebtGuidance;
    configureControls();
    render();
    $("#loading-state").remove();
  } catch (error) {
    const loading = $("#loading-state");
    loading.classList.add("error");
    loading.textContent = "The forecast data could not be loaded. Please refresh the page.";
    console.error(error);
  }
}

init();
