(() => {
  const table = document.querySelector("[data-cost-comparison]");
  if (!table) return;

  const storageKey = "tim-cost-comparison-v1";
  const items = [...table.querySelectorAll("input[data-cost-item]")];
  const participantCount = Number(table.dataset.participants) || 13;
  const payerCount = Number(table.dataset.payers) || 12;
  const totals = [...table.querySelectorAll("[data-total-city]")];
  const status = document.querySelector("[data-cost-status]");
  const formatter = new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let selection = {};

  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) selection = saved;
  } catch {
    // The calculator remains usable if browser storage is blocked.
  }

  for (const item of items) {
    if (typeof selection[item.dataset.costItem] === "boolean") {
      item.checked = selection[item.dataset.costItem];
    }
  }

  // Een post kan meerdere wisselgroepen krijgen (spatie-gescheiden). Aanvinken
  // vervangt dan elke optie die minstens één van die groepen deelt.
  const groupsOf = (item) => (item.dataset.exclusiveGroup ?? "").split(/\s+/).filter(Boolean);
  const selectedAlternatives = new Set();
  for (const item of items) {
    const groups = groupsOf(item);
    if (!item.checked || groups.length === 0) continue;
    if (groups.some((group) => selectedAlternatives.has(group))) item.checked = false;
    else groups.forEach((group) => selectedAlternatives.add(group));
  }

  const formatAmount = (amount) => formatter.format(amount);
  const formatRange = (minimum, maximum) => {
    const low = formatAmount(minimum);
    const high = formatAmount(maximum);
    return minimum === maximum ? `€${low}` : `€${low}–${high}`;
  };

  function updateTotals(announce = false) {
    const sums = new Map(totals.map((total) => [total.dataset.totalCity, { minimum: 0, maximum: 0 }]));
    for (const item of items) {
      if (!item.checked) continue;
      const sum = sums.get(item.dataset.city);
      if (!sum) continue;
      sum.minimum += Number(item.dataset.min);
      sum.maximum += Number(item.dataset.max);
    }

    for (const total of totals) {
      const sum = sums.get(total.dataset.totalCity);
      if (!sum) continue;
      const groupMinimum = sum.minimum * participantCount;
      const groupMaximum = sum.maximum * participantCount;
      total.querySelector("[data-total-per-person]").textContent = `${formatRange(groupMinimum / payerCount, groupMaximum / payerCount)} per betalende gast`;
      total.querySelector("[data-total-group]").textContent = `${formatRange(groupMinimum, groupMaximum)} groepskosten voor ${participantCount} deelnemers ÷ ${payerCount} gasten`;
    }

    if (announce && status) status.textContent = "De geselecteerde ramingen zijn bijgewerkt.";
  }

  function saveSelection() {
    selection = Object.fromEntries(items.map((item) => [item.dataset.costItem, item.checked]));
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selection));
    } catch {
      // The current page still recalculates if storage is unavailable.
    }
  }

  for (const item of items) {
    item.addEventListener("change", () => {
      if (item.checked) {
        const active = new Set(groupsOf(item));
        if (active.size > 0) {
          for (const alternative of items) {
            if (alternative !== item && groupsOf(alternative).some((group) => active.has(group))) {
              alternative.checked = false;
            }
          }
        }
      }
      saveSelection();
      updateTotals(true);
    });
  }

  document.querySelector("[data-reset-costs]")?.addEventListener("click", () => {
    for (const item of items) item.checked = item.defaultChecked;
    selection = {};
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Reset still works for the current page when storage is unavailable.
    }
    updateTotals(true);
    status.textContent = "De basisselectie is hersteld.";
  });

  const tooltip = document.createElement("div");
  tooltip.className = "comparison-tooltip";
  tooltip.id = "comparison-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);

  let activeInfo = null;

  function showTooltip(button) {
    const text = button.dataset.tooltip;
    if (!text) return;
    if (activeInfo && activeInfo !== button) {
      activeInfo.removeAttribute("aria-describedby");
      activeInfo.dataset.pinned = "false";
      activeInfo.setAttribute("aria-expanded", "false");
    }
    activeInfo = button;
    tooltip.textContent = text;
    tooltip.hidden = false;
    button.setAttribute("aria-describedby", tooltip.id);

    const bounds = button.getBoundingClientRect();
    const tooltipBounds = tooltip.getBoundingClientRect();
    const horizontalPadding = 12;
    const left = Math.max(horizontalPadding, Math.min(bounds.left, window.innerWidth - tooltipBounds.width - horizontalPadding));
    let top = bounds.bottom + 8;
    if (top + tooltipBounds.height > window.innerHeight - horizontalPadding) {
      top = bounds.top - tooltipBounds.height - 8;
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(horizontalPadding, top)}px`;
  }

  function hideTooltip(button = activeInfo) {
    if (!button || button !== activeInfo || button.dataset.pinned === "true") return;
    button.removeAttribute("aria-describedby");
    tooltip.hidden = true;
    activeInfo = null;
  }

  const infoButtons = [...table.querySelectorAll(".cost-info[data-tooltip]")];
  for (const button of infoButtons) {
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") {
        button.dataset.dismissed = "false";
        showTooltip(button);
      }
    });
    button.addEventListener("pointerleave", () => hideTooltip(button));
    button.addEventListener("focus", () => {
      if (button.dataset.dismissed !== "true") showTooltip(button);
    });
    button.addEventListener("blur", () => {
      button.dataset.dismissed = "false";
      button.dataset.pinned = "false";
      button.setAttribute("aria-expanded", "false");
      hideTooltip(button);
    });
    button.addEventListener("click", () => {
      button.dataset.dismissed = "false";
      if (button.dataset.pinned === "true") {
        button.dataset.pinned = "false";
        button.setAttribute("aria-expanded", "false");
        hideTooltip(button);
      } else {
        for (const other of infoButtons) {
          other.removeAttribute("aria-describedby");
          other.dataset.pinned = "false";
          other.setAttribute("aria-expanded", "false");
        }
        button.dataset.pinned = "true";
        button.setAttribute("aria-expanded", "true");
        showTooltip(button);
      }
    });
  }

  document.addEventListener("pointerdown", (event) => {
    if (activeInfo && !event.target.closest(".cost-info")) {
      activeInfo.dataset.pinned = "false";
      activeInfo.setAttribute("aria-expanded", "false");
      hideTooltip(activeInfo);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !activeInfo) return;
    const button = activeInfo;
    button.dataset.pinned = "false";
    button.dataset.dismissed = "true";
    button.setAttribute("aria-expanded", "false");
    hideTooltip(button);
    button.focus();
  });
  window.addEventListener("resize", () => {
    if (activeInfo) showTooltip(activeInfo);
  });
  window.addEventListener("scroll", () => {
    if (activeInfo) showTooltip(activeInfo);
  }, true);

  updateTotals();
})();
