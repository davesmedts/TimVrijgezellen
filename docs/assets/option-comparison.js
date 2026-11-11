(() => {
  const table = document.querySelector("[data-option-comparison]");
  if (!table) return;

  const storageKey = "tim-keulen-opties-v1";
  const participantCount = Number(table.dataset.participants) || 13;
  const payerCount = Number(table.dataset.payers) || 12;
  const formatter = new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Eerst op centen afronden; een halve cent als 278,975 komt in binaire
  // drijvende komma net onder de grens uit en zou anders verkeerd tellen.
  const formatAmount = (amount) => formatter.format(Math.round((amount + 1e-9) * 100) / 100);
  const formatRange = (minimum, maximum) =>
    minimum === maximum ? `€${formatAmount(minimum)}` : `€${formatAmount(minimum)}–${formatAmount(maximum)}`;

  const headRow = table.tHead.rows[0];
  const footRow = table.tFoot.rows[0];
  let rows = [...table.querySelectorAll("tbody tr[data-item]")];
  const spanningRows = [...table.querySelectorAll("tbody tr.comparison-category, tbody tr.option-add-activity-row")];
  const addActivityButtons = [...table.querySelectorAll("[data-add-activity]")];
  const status = document.querySelector("[data-option-status]");
  const addButton = document.querySelector("[data-add-option]");
  const resetButton = document.querySelector("[data-reset-options]");

  // Op desktop verschijnt de uitleg bij hover; op mobiel en met toetsenbord werkt klikken ook.
  // Zonder JavaScript blijft het details-element gewoon uitklapbaar.
  const parkingInfo = table.querySelector("[data-item='parkeren'] .option-info");
  const parkingButton = parkingInfo?.querySelector("summary");
  const parkingText = parkingInfo?.querySelector("span")?.textContent.trim();
  if (parkingButton && parkingText) {
    const tooltip = document.createElement("div");
    tooltip.className = "comparison-tooltip";
    tooltip.id = "option-parking-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.textContent = parkingText;
    tooltip.hidden = true;
    document.body.append(tooltip);
    let pinned = false;
    let hovering = false;
    let focused = false;
    parkingButton.setAttribute("aria-expanded", "false");

    const hide = () => {
      tooltip.hidden = true;
      parkingButton.removeAttribute("aria-describedby");
      parkingButton.setAttribute("aria-expanded", "false");
    };
    const show = () => {
      const bounds = parkingButton.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight) return hide();
      tooltip.hidden = false;
      parkingButton.setAttribute("aria-describedby", tooltip.id);
      parkingButton.setAttribute("aria-expanded", "true");
      const tip = tooltip.getBoundingClientRect();
      const padding = 12;
      const left = Math.max(padding, Math.min(bounds.left, window.innerWidth - tip.width - padding));
      let top = bounds.bottom + 8;
      if (top + tip.height > window.innerHeight - padding) top = bounds.top - tip.height - 8;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${Math.max(padding, top)}px`;
    };

    parkingButton.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      hovering = true;
      show();
    });
    parkingButton.addEventListener("pointerleave", () => {
      hovering = false;
      if (!pinned && !focused) hide();
    });
    parkingButton.addEventListener("focus", () => { focused = true; show(); });
    parkingButton.addEventListener("blur", () => {
      focused = false;
      pinned = false;
      if (!hovering) hide();
    });
    parkingButton.addEventListener("click", (event) => {
      event.preventDefault();
      pinned = !pinned;
      if (pinned) show();
      else hide();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!parkingInfo.contains(event.target)) { pinned = false; hide(); }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !tooltip.hidden) { pinned = false; hide(); }
    });
    window.addEventListener("resize", () => { if (!tooltip.hidden) show(); });
    window.addEventListener("scroll", () => { if (!tooltip.hidden) show(); }, true);
  }

  const baseItems = rows.map((row) => ({
    id: row.dataset.item,
    minimum: Number(row.dataset.min),
    maximum: Number(row.dataset.max),
    price: row.dataset.price || "",
    label: (row.dataset.label || row.querySelector("th")?.textContent || row.dataset.item).trim(),
    standard: row.dataset.default === "true",
    group: row.dataset.exclusiveGroup || "",
  }));

  let items = baseItems;
  const basisSelection = () => baseItems.filter((item) => item.standard).map((item) => item.id);

  // Een handmatig ingevoerde prijs is per deelnemer. Zowel komma als punt is toegestaan.
  const parsePrice = (value) => {
    const text = String(value ?? "").trim();
    if (!/^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(text)) return null;
    const amount = Number(text.replace(",", "."));
    return Number.isFinite(amount) && amount <= 100000000 ? amount : null;
  };

  // Binnen een optie mag per wisselgroep maar één post aangevinkt staan.
  const withoutConflicts = (ids, knownItems) => {
    const picked = [];
    const usedGroups = new Set();
    for (const id of ids) {
      const item = knownItems.find((entry) => entry.id === id);
      if (!item) continue;
      if (item.group) {
        if (usedGroups.has(item.group)) continue;
        usedGroups.add(item.group);
      }
      picked.push(id);
    }
    return picked;
  };

  const sanitize = (saved) => {
    if (!saved || !Array.isArray(saved.options) || saved.options.length === 0) return null;
    const seen = new Set();
    const customItems = (Array.isArray(saved.customItems) ? saved.customItems : [])
      .filter((item) => {
        if (!item || typeof item.id !== "string" || !/^custom-\d+$/.test(item.id) || seen.has(item.id) || !["zaterdag", "zondag"].includes(item.day)) return false;
        seen.add(item.id);
        return true;
      })
      .map((item) => ({ id: item.id, day: item.day, label: typeof item.label === "string" ? item.label.slice(0, 100) : "", custom: true }));
    const knownItems = [...baseItems, ...customItems];
    const options = saved.options
      .filter((option) => option && typeof option.name === "string")
      .map((option) => ({
        name: option.name,
        selected: new Set(
          withoutConflicts(
            Array.isArray(option.selected) ? option.selected : [], knownItems
          )
        ),
        prices: Object.fromEntries(customItems.map((item) => [item.id, typeof option.prices?.[item.id] === "string" ? option.prices[item.id].slice(0, 30) : ""])),
      }));
    if (options.length === 0) return null;
    const counter = Number.isSafeInteger(saved.counter) && saved.counter >= 0 ? saved.counter : options.length;
    const itemCounter = Math.max(0, ...customItems.map((item) => Number(item.id.slice(7)) || 0));
    return { options, counter, itemCounter, customItems };
  };

  let state = {
    options: [{ name: "Basis optie", selected: new Set(basisSelection()), prices: {} }],
    counter: 0,
    itemCounter: 0,
    customItems: [],
  };
  try {
    const saved = sanitize(JSON.parse(window.localStorage.getItem(storageKey) ?? "null"));
    if (saved) state = saved;
  } catch {
    // Zonder browseropslag blijft de vergelijker op de basisoptie staan.
  }

  function save() {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          counter: state.counter,
          customItems: state.customItems,
          options: state.options.map((option) => ({ name: option.name, selected: [...option.selected], prices: option.prices })),
        })
      );
    } catch {
      // De huidige pagina blijft rekenen zonder opslag.
    }
  }

  function announce(message) {
    if (status) status.textContent = message;
  }

  function updateTotal(index) {
    const option = state.options[index];
    if (!option) return;
    let minimum = 0;
    let maximum = 0;
    const missing = [];
    for (const item of items) {
      if (!option.selected.has(item.id)) continue;
      if (item.custom) {
        const price = parsePrice(option.prices[item.id]);
        if (price === null) {
          missing.push(item.label.trim() || "naamloze activiteit");
          continue;
        }
        minimum += price;
        maximum += price;
      } else {
        minimum += item.minimum;
        maximum += item.maximum;
      }
    }
    const groupMinimum = minimum * participantCount;
    const groupMaximum = maximum * participantCount;
    const cell = footRow.cells[index + 1];
    if (!cell) return;
    const strong = document.createElement("strong");
    strong.textContent = `${formatRange(groupMinimum / payerCount, groupMaximum / payerCount)} per betalende gast`;
    const small = document.createElement("small");
    small.textContent = `${formatRange(groupMinimum, groupMaximum)} groepskosten voor ${participantCount} deelnemers`;
    if (missing.length) small.textContent += ` · Niet meegerekend: ${missing.join(", ")} (vul een geldige prijs in)`;
    cell.replaceChildren(strong, small);
  }

  function render() {
    // Houd invoervelden bruikbaar bij meerdere opties; op smalle schermen scrollt de tabel.
    table.style.minWidth = `${150 + state.options.length * 140}px`;
    table.querySelectorAll("tr.option-custom-row").forEach((row) => row.remove());
    for (const item of state.customItems) {
      const marker = table.querySelector(`[data-add-activity="${item.day}"]`)?.closest("tr");
      if (!marker) continue;
      const row = document.createElement("tr");
      row.className = "option-custom-row";
      row.dataset.item = item.id;
      const heading = document.createElement("th");
      heading.scope = "row";
      const wrap = document.createElement("div");
      wrap.className = "option-activity-heading";
      const name = document.createElement("input");
      name.type = "text";
      name.className = "option-activity-name";
      name.maxLength = 100;
      name.placeholder = "Naam activiteit";
      name.value = item.label;
      name.setAttribute("aria-label", `Naam activiteit ${item.day}`);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "option-remove";
      remove.textContent = "Verwijder";
      const updateLabels = () => {
        const label = item.label.trim() || `nieuwe activiteit ${item.day}`;
        remove.setAttribute("aria-label", `Verwijder ${label}`);
        state.options.forEach((option, index) => {
          const cell = row.cells[index + 1];
          cell?.querySelector('input[type="checkbox"]')?.setAttribute("aria-label", `Selecteer ${label} voor ${option.name}`);
          cell?.querySelector(".option-activity-price")?.setAttribute("aria-label", `Prijs per deelnemer voor ${label}, ${option.name}`);
        });
      };
      name.addEventListener("input", () => {
        item.label = name.value;
        updateLabels();
        state.options.forEach((_, index) => updateTotal(index));
        save();
      });
      remove.addEventListener("click", () => {
        state.customItems = state.customItems.filter((entry) => entry.id !== item.id);
        state.options.forEach((option) => {
          option.selected.delete(item.id);
          delete option.prices[item.id];
        });
        save();
        render();
        announce(`${item.label.trim() || "Activiteit"} verwijderd.`);
        table.querySelector(`[data-add-activity="${item.day}"]`)?.focus();
      });
      updateLabels();
      wrap.append(name, remove);
      heading.append(wrap);
      row.append(heading);
      marker.before(row);
    }
    rows = [...table.querySelectorAll("tbody tr[data-item]")];
    items = rows.map((row) => baseItems.find((item) => item.id === row.dataset.item) || state.customItems.find((item) => item.id === row.dataset.item));
    while (headRow.cells.length > 1) headRow.deleteCell(-1);
    while (footRow.cells.length > 1) footRow.deleteCell(-1);
    for (const row of rows) {
      while (row.cells.length > 1) row.deleteCell(-1);
    }

    state.options.forEach((option, index) => {
      const head = document.createElement("th");
      head.scope = "col";
      const wrap = document.createElement("div");
      wrap.className = "option-column-head";

      const name = document.createElement("input");
      name.className = "option-name";
      name.type = "text";
      name.value = option.name;
      name.setAttribute("aria-label", `Naam van optie ${index + 1}`);
      name.addEventListener("change", () => {
        option.name = name.value.trim() || `Optie ${index + 1}`;
        name.value = option.name;
        save();
        announce(`Kolom hernoemd naar ${option.name}.`);
      });
      wrap.append(name);

      if (state.options.length > 1) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "option-remove";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Verwijder ${option.name}`);
        remove.addEventListener("click", () => {
          const removed = state.options.splice(index, 1)[0];
          save();
          render();
          announce(`${removed.name} verwijderd.`);
        });
        wrap.append(remove);
      }

      head.append(wrap);
      headRow.append(head);

      rows.forEach((row, rowIndex) => {
        const item = items[rowIndex];
        const cell = document.createElement("td");
        cell.className = "cost-cell";
        if (item.custom) {
          const wrapper = document.createElement("div");
          wrapper.className = "option-activity-cost";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = option.selected.has(item.id);
          const label = item.label.trim() || `nieuwe activiteit ${item.day}`;
          checkbox.setAttribute("aria-label", `Selecteer ${label} voor ${option.name}`);
          const currency = document.createElement("span");
          currency.textContent = "€";
          currency.setAttribute("aria-hidden", "true");
          const price = document.createElement("input");
          price.type = "text";
          price.inputMode = "decimal";
          price.className = "option-activity-price";
          price.maxLength = 30;
          price.placeholder = "0,00";
          price.value = option.prices[item.id] ?? "";
          price.setAttribute("aria-label", `Prijs per deelnemer voor ${label}, ${option.name}`);
          const validate = () => {
            const invalid = parsePrice(price.value) === null && (checkbox.checked || price.value.trim() !== "");
            price.setAttribute("aria-invalid", String(invalid));
          };
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) option.selected.add(item.id);
            else option.selected.delete(item.id);
            validate();
            save();
            updateTotal(index);
            announce(`Totaal van ${option.name} bijgewerkt.`);
          });
          price.addEventListener("input", () => {
            option.prices[item.id] = price.value;
            validate();
            save();
            updateTotal(index);
          });
          price.addEventListener("change", () => {
            announce(parsePrice(price.value) === null && checkbox.checked ? `Vul een geldige prijs in voor ${item.label.trim() || "de activiteit"}.` : `Totaal van ${option.name} bijgewerkt.`);
          });
          validate();
          wrapper.append(checkbox, currency, price);
          cell.append(wrapper);
          row.append(cell);
          return;
        }
        const label = document.createElement("label");
        label.className = "cost-choice";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = option.selected.has(item.id);
        input.setAttribute("aria-label", `${item.label} voor ${option.name}`);
        input.addEventListener("change", () => {
          if (input.checked) {
            option.selected.add(item.id);
            if (item.group) {
              items.forEach((other, otherIndex) => {
                if (other.id === item.id || other.group !== item.group) return;
                option.selected.delete(other.id);
                const otherInput = rows[otherIndex].cells[index + 1]?.querySelector("input");
                if (otherInput) otherInput.checked = false;
              });
            }
          } else {
            option.selected.delete(item.id);
          }
          save();
          updateTotal(index);
          announce(`Totaal van ${option.name} bijgewerkt.`);
        });
        const price = document.createElement("span");
        price.textContent = item.price;
        label.append(input, price);
        cell.append(label);
        row.append(cell);
      });

      const total = document.createElement("td");
      total.className = "destination-total";
      footRow.append(total);
      updateTotal(index);
    });

    for (const spanningRow of spanningRows) {
      const cell = spanningRow.querySelector("th");
      if (cell) cell.colSpan = state.options.length + 1;
    }
  }

  addButton?.addEventListener("click", () => {
    state.counter += 1;
    const basis = state.options[0];
    state.options.push({ name: `Optie ${state.counter}`, selected: new Set(basis.selected), prices: { ...basis.prices } });
    save();
    render();
    const added = state.options[state.options.length - 1];
    announce(`${added.name} toegevoegd als kopie van ${basis.name}.`);
  });

  resetButton?.addEventListener("click", () => {
    state = {
      options: [{ name: "Basis optie", selected: new Set(basisSelection()), prices: { ...state.options[0].prices } }],
      counter: 0,
      itemCounter: state.itemCounter,
      customItems: state.customItems,
    };
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Herstellen lukt ook zonder opslag.
    }
    render();
    save();
    announce("De basisoptie is hersteld; eigen activiteiten zijn bewaard.");
  });

  addActivityButtons.forEach((button) => {
    const day = button.dataset.addActivity;
    if (!["zaterdag", "zondag"].includes(day)) return;
    button.closest("tr").hidden = false;
    button.addEventListener("click", () => {
      state.itemCounter += 1;
      const item = { id: `custom-${state.itemCounter}`, day, label: "", custom: true };
      state.customItems.push(item);
      save();
      render();
      announce(`Activiteit voor ${day} toegevoegd. Vul een naam en prijs in.`);
      table.querySelector(`[data-item="${item.id}"] .option-activity-name`)?.focus();
    });
  });

  if (addButton) addButton.hidden = false;
  if (resetButton) resetButton.hidden = false;
  render();
  save();
})();
