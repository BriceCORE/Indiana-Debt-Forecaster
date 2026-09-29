const overviewState = {
  data: null,
  year: 2027,
  lane: "all",
  rank: "capacity",
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
  return money.format(Number(value) || 0);
}

function formatCompactMoney(value) {
  const amount = Number(value) || 0;
  const absolute = Math.abs(amount);
  if (absolute >= 1_000_000_000) return `${oneDecimal.format(amount / 1_000_000_000)}B`;
  if (absolute >= 1_000_000) return `${oneDecimal.format(amount / 1_000_000)}M`;
  if (absolute >= 1_000) return `${oneDecimal.format(amount / 1_000)}K`;
  return formatMoney(amount);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dropFor(schedule, year) {
  return Math.max(0, Number(schedule[String(year - 1)] || 0) - Number(schedule[String(year)] || 0));
}

function driversFor(district, year) {
  return district.issues
    .map((issue) => {
      const prior = Number(issue.annualPayments?.[String(year - 1)] || 0);
      const current = Number(issue.annualPayments?.[String(year)] || 0);
      return { ...issue, drop: Math.max(0, prior - current) };
    })
    .filter((issue) => issue.drop > 0)
    .sort((a, b) => b.drop - a.drop || a.name.localeCompare(b.name));
}

function districtSignals(year) {
  return overviewState.data.districts.map((district) => {
    const ordinary = dropFor(district.schedules.ordinary, year);
    const referendum = dropFor(district.schedules.referendum, year);
    const pension = dropFor(district.schedules.pension, year);
    const identified = ordinary + referendum + pension;
    const laneValue = overviewState.lane === "ordinary"
      ? ordinary
      : overviewState.lane === "referendum"
        ? referendum
        : identified;
    const levelCapacity = Number(district.capacityMatrix.Base?.[String(year)]?.["20"]?.level || 0);
    return {
      district,
      ordinary,
      referendum,
      pension,
      identified,
      laneValue,
      drivers: driversFor(district, year),
      levelCapacity,
      eligible: district.opportunityEligible !== false,
      rankValue: overviewState.rank === "capacity" ? levelCapacity : laneValue,
    };
  }).sort((a, b) => b.rankValue - a.rankValue || b.levelCapacity - a.levelCapacity || b.identified - a.identified || a.district.name.localeCompare(b.district.name));
}

function candidateSignals(signals) {
  return signals.filter((signal) => signal.eligible && signal.rankValue > 0);
}

function districtLink(signal) {
  const params = new URLSearchParams({
    district: signal.district.id,
    year: String(overviewState.year),
  });
  return `./index.html?${params.toString()}`;
}

function renderYearStrip() {
  $("#year-strip").innerHTML = Array.from({ length: 10 }, (_, index) => 2027 + index).map((year) => `
    <button type="button" data-year="${year}" class="${year === overviewState.year ? "active" : ""}" aria-pressed="${year === overviewState.year}">${year}</button>
  `).join("");
  $$("#year-strip button").forEach((button) => {
    button.addEventListener("click", () => {
      overviewState.year = Number(button.dataset.year);
      syncUrl();
      render();
    });
  });
}

function selectedLaneLabel() {
  if (overviewState.lane === "ordinary") return "ordinary";
  if (overviewState.lane === "referendum") return "referendum";
  return "identified";
}

function renderMetrics(signals) {
  const ordinaryTotal = signals.reduce((sum, signal) => sum + signal.ordinary, 0);
  const referendumTotal = signals.reduce((sum, signal) => sum + signal.referendum, 0);
  const identifiedTotal = signals.reduce((sum, signal) => sum + signal.identified, 0);
  const selectedTotal = signals.reduce((sum, signal) => sum + signal.laneValue, 0);
  const ordinaryDistricts = signals.filter((signal) => signal.ordinary > 0).length;
  const referendumDistricts = signals.filter((signal) => signal.referendum > 0).length;
  const rolloffDistricts = signals.filter((signal) => signal.identified > 0).length;

  if (overviewState.rank === "capacity") {
    const eligible = signals.filter((signal) => signal.eligible);
    const top = eligible.find((signal) => signal.levelCapacity > 0);
    const material = eligible.filter((signal) => signal.levelCapacity >= 5_000_000);
    $("#primary-metric-label").textContent = "Largest Base 20-year level capacity";
    $("#rolloff-total").textContent = formatCompactMoney(top?.levelCapacity || 0);
    $("#rolloff-total-note").textContent = top
      ? `${top.district.shortName} · debt service begins ${overviewState.year}`
      : `No modeled capacity beginning in ${overviewState.year}`;
    $("#material-metric-label").textContent = "Districts above $5M";
    $("#material-districts").textContent = String(material.length);
    $("#material-metric-note").textContent = "Modeled Base 20-year level capacity";
    $("#ordinary-metric-label").textContent = "Identified roll-off";
    $("#ordinary-total").textContent = formatCompactMoney(identifiedTotal);
    $("#ordinary-note").textContent = `${rolloffDistricts} district${rolloffDistricts === 1 ? "" : "s"} with a ${overviewState.year} scheduled reduction`;
    $("#referendum-total").textContent = formatCompactMoney(referendumTotal);
    $("#referendum-note").textContent = `${referendumDistricts} district${referendumDistricts === 1 ? "" : "s"} with a voter-approved reduction`;
    return;
  }

  const material = signals.filter((signal) => signal.laneValue >= 250_000);
  $("#primary-metric-label").textContent = "Identified roll-off";
  $("#rolloff-total").textContent = formatCompactMoney(selectedTotal);
  $("#rolloff-total-note").textContent = `${overviewState.year} ${selectedLaneLabel()} roll-off across the current coverage`;
  $("#material-metric-label").textContent = "Districts above $250K";
  $("#material-districts").textContent = String(material.length);
  $("#material-metric-note").textContent = "Material scheduled reductions in the selected lane";
  $("#ordinary-metric-label").textContent = "Ordinary openings";
  $("#ordinary-total").textContent = formatCompactMoney(ordinaryTotal);
  $("#ordinary-note").textContent = `${ordinaryDistricts} district${ordinaryDistricts === 1 ? "" : "s"} with an ordinary reduction`;
  $("#referendum-total").textContent = formatCompactMoney(referendumTotal);
  $("#referendum-note").textContent = `${referendumDistricts} district${referendumDistricts === 1 ? "" : "s"} with a voter-approved reduction`;
}

function renderBars(signals) {
  const candidates = candidateSignals(signals).slice(0, 10);
  const maxValue = Math.max(...candidates.map((signal) => signal.rankValue), 1);
  const lane = selectedLaneLabel();
  const capacityMode = overviewState.rank === "capacity";
  $("#ranking-title").textContent = capacityMode
    ? `${overviewState.year} · Largest Base 20-year level capacity`
    : `${overviewState.year} · Largest ${lane} roll-offs`;
  $("#ranking-status").textContent = capacityMode
    ? "Base scenario · 20-year · complete schedules"
    : "Debt timing signal · complete schedules";
  $("#overview-legend").innerHTML = capacityMode
    ? '<span><i class="capacity-key"></i>Modeled Base 20-year level capacity</span><span class="legend-note">Roll-off remains visible beside each result</span>'
    : '<span><i class="ordinary-key"></i>Ordinary</span><span><i class="referendum-key"></i>Referendum</span><span><i class="pension-key"></i>Pension</span>';
  $("#opportunity-bars").innerHTML = candidates.length ? candidates.map((signal, index) => {
    const ordinaryWidth = capacityMode || overviewState.lane === "referendum" ? 0 : signal.ordinary / maxValue * 100;
    const referendumWidth = capacityMode || overviewState.lane === "ordinary" ? 0 : signal.referendum / maxValue * 100;
    const pensionWidth = !capacityMode && overviewState.lane === "all" ? signal.pension / maxValue * 100 : 0;
    const capacityWidth = capacityMode ? signal.levelCapacity / maxValue * 100 : 0;
    const primaryValue = capacityMode ? signal.levelCapacity : signal.laneValue;
    const supportingValue = capacityMode
      ? `${formatCompactMoney(signal.identified)} roll-off`
      : `${formatCompactMoney(signal.levelCapacity)} capacity`;
    const ariaMeasure = capacityMode ? "Base 20-year level capacity" : `${lane} roll-off`;
    return `
      <a class="opportunity-bar-row" href="${escapeHtml(districtLink(signal))}">
        <span class="bar-rank">${index + 1}</span>
        <span class="bar-district"><strong>${escapeHtml(signal.district.shortName)}</strong><small>${escapeHtml(signal.district.county)} County</small></span>
        <span class="bar-track" aria-label="${escapeHtml(signal.district.name)} ${formatMoney(primaryValue)} ${escapeHtml(ariaMeasure)}">
          <i class="capacity" style="width:${capacityWidth}%"></i>
          <i class="ordinary" style="width:${ordinaryWidth}%"></i>
          <i class="referendum" style="width:${referendumWidth}%"></i>
          <i class="pension" style="width:${pensionWidth}%"></i>
        </span>
        <span class="bar-value"><strong>${escapeHtml(formatCompactMoney(primaryValue))}</strong><small>${escapeHtml(supportingValue)}</small></span>
      </a>`;
  }).join("") : `<div class="overview-empty">No ${capacityMode ? "modeled capacity" : "scheduled reductions"} appears for the selected year.</div>`;
}

function renderReading(signals) {
  const candidates = candidateSignals(signals);
  const top = candidates[0];
  $("#signal-count").textContent = String(candidates.length);
  $("#overview-planning-window").textContent = `${Math.max(2026, overviewState.year - 3)}–${Math.max(2026, overviewState.year - 1)}`;
  if (!top) {
    $("#top-signal-title").textContent = "No material signal";
    $("#top-signal").innerHTML = `<strong>No ${overviewState.rank === "capacity" ? "modeled capacity" : "roll-off"} appears in this view.</strong><p>Choose another opportunity year${overviewState.rank === "rolloff" ? " or roll-off lane" : ""}.</p>`;
    return;
  }
  const primaryLane = top.referendum > top.ordinary ? "referendum" : "ordinary";
  $("#top-signal-title").textContent = top.district.shortName;
  if (overviewState.rank === "capacity") {
    const rolloffReading = top.identified > 0
      ? `${formatCompactMoney(top.identified)} of identified debt service rolls off in ${overviewState.year}.`
      : `No scheduled debt-service reduction is identified in ${overviewState.year}.`;
    const driverReading = top.drivers[0]
      ? ` The leading schedule change is ${top.drivers[0].name} at ${formatCompactMoney(top.drivers[0].drop)}.`
      : "";
    $("#top-signal").innerHTML = `
      <strong>${escapeHtml(formatCompactMoney(top.levelCapacity))} Base 20-year level capacity</strong>
      <p>${escapeHtml(rolloffReading)}${escapeHtml(driverReading)}</p>
      <a class="signal-link" href="${escapeHtml(districtLink(top))}">Open district forecast</a>`;
    return;
  }
  $("#top-signal").innerHTML = `
    <strong>${escapeHtml(formatCompactMoney(top.laneValue))} ${escapeHtml(selectedLaneLabel())} roll-off</strong>
    <p>The largest component is ${escapeHtml(primaryLane)} debt. ${top.drivers[0] ? `The leading schedule change is ${escapeHtml(top.drivers[0].name)} at ${escapeHtml(formatCompactMoney(top.drivers[0].drop))}.` : "Review the district schedule for the underlying obligations."}</p>
    <a class="signal-link" href="${escapeHtml(districtLink(top))}">Open district forecast</a>`;
}

function renderTable(signals) {
  const candidates = candidateSignals(signals);
  $("#candidate-count").textContent = `${candidates.length} district${candidates.length === 1 ? "" : "s"}`;
  $("#table-title").textContent = overviewState.rank === "capacity"
    ? `${overviewState.year} opportunity list · Base 20-year level capacity`
    : `${overviewState.year} opportunity list · ${titleCase(selectedLaneLabel())} roll-off`;
  $("#opportunity-body").innerHTML = candidates.length ? candidates.map((signal) => {
    const drivers = signal.drivers.slice(0, 3);
    const identifiedValue = escapeHtml(formatCompactMoney(signal.identified));
    const capacityValue = escapeHtml(formatCompactMoney(signal.levelCapacity));
    return `
      <tr>
        <td><strong>${escapeHtml(signal.district.name)}</strong><span>${escapeHtml(signal.district.county)} County</span></td>
        <td><div class="driver-list">${drivers.length ? drivers.map((driver) => `<span><b>${escapeHtml(driver.name)}</b><small>${escapeHtml(formatCompactMoney(driver.drop))} reduction · ${escapeHtml(titleCase(driver.bucket))}</small></span>`).join("") : "<span>No single obligation fully explains the aggregate change.</span>"}</div></td>
        <td class="numeric">${escapeHtml(formatCompactMoney(signal.ordinary))}</td>
        <td class="numeric">${escapeHtml(formatCompactMoney(signal.referendum))}</td>
        <td class="numeric">${overviewState.rank === "rolloff" ? `<strong>${identifiedValue}</strong>` : identifiedValue}</td>
        <td class="numeric">${overviewState.rank === "capacity" ? `<strong>${capacityValue}</strong>` : capacityValue}</td>
        <td><span class="confidence-label ${escapeHtml(signal.district.reconciliation.confidence.toLowerCase())}">${escapeHtml(signal.district.reconciliation.confidence)}</span></td>
        <td><a class="row-link" href="${escapeHtml(districtLink(signal))}">View</a></td>
      </tr>`;
  }).join("") : `<tr><td colspan="8" class="overview-empty">No districts have ${overviewState.rank === "capacity" ? "modeled capacity" : "a scheduled reduction"} in this view.</td></tr>`;
}

function syncUrl() {
  const params = new URLSearchParams({
    year: String(overviewState.year),
    lane: overviewState.lane,
    rank: overviewState.rank,
  });
  window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
}

function render() {
  const signals = districtSignals(overviewState.year);
  renderYearStrip();
  $$("#overview-rank button").forEach((button) => {
    const active = button.dataset.rank === overviewState.rank;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $$("#overview-lane button").forEach((button) => {
    const active = button.dataset.lane === overviewState.lane;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = overviewState.rank === "capacity";
  });
  $("#overview-lane-control").classList.toggle("is-disabled", overviewState.rank === "capacity");
  $("#overview-lane-control").setAttribute("aria-disabled", String(overviewState.rank === "capacity"));
  renderMetrics(signals);
  renderBars(signals);
  renderReading(signals);
  renderTable(signals);
}

async function init() {
  try {
    const response = await fetch("./site-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    overviewState.data = await response.json();
    const params = new URLSearchParams(window.location.search);
    const requestedYear = Number(params.get("year"));
    const requestedLane = params.get("lane");
    const requestedRank = params.get("rank");
    if (Number.isFinite(requestedYear) && requestedYear >= 2027 && requestedYear <= 2036) {
      overviewState.year = requestedYear;
    }
    if (["all", "ordinary", "referendum"].includes(requestedLane)) {
      overviewState.lane = requestedLane;
    }
    if (["capacity", "rolloff"].includes(requestedRank)) {
      overviewState.rank = requestedRank;
    }

    $("#scope-label").textContent = `${overviewState.data.metadata.scope} · ${overviewState.data.metadata.districtCount} districts`;
    $("#as-of").textContent = `Debt snapshot ${overviewState.data.metadata.debtSnapshot} · ${overviewState.data.metadata.parsedScheduleCount} of ${overviewState.data.metadata.capturedIssueCount} schedules parsed · Model ${overviewState.data.metadata.asOf}`;
    $("#coverage-count").textContent = `${overviewState.data.metadata.districtCount} districts`;
    $("#coverage-status").textContent = overviewState.data.metadata.coverageStatus ?? "Statewide";
    $$("#overview-rank button").forEach((button) => {
      button.addEventListener("click", () => {
        overviewState.rank = button.dataset.rank;
        syncUrl();
        render();
      });
    });
    $$("#overview-lane button").forEach((button) => {
      button.addEventListener("click", () => {
        overviewState.lane = button.dataset.lane;
        syncUrl();
        render();
      });
    });
    syncUrl();
    render();
    $("#loading-state").remove();
  } catch (error) {
    const loading = $("#loading-state");
    loading.classList.add("error");
    loading.textContent = "The opportunity data could not be loaded. Please refresh the page.";
    console.error(error);
  }
}

init();
