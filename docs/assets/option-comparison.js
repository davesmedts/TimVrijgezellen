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
  const rows = [...table.querySelectorAll("tbody tr[data-item]")];
  const categoryRows = [...table.querySelectorAll("tbody tr.comparison-category")];
  const status = document.querySelector("[data-option-status]");
  const addButton = document.querySelector("[data-add-option]");
  const resetButton = document.querySelector("[data-reset-options]");

  const items = rows.map((row) => ({
    id: row.dataset.item,
    minimum: Number(row.dataset.min),
    maximum: Number(row.dataset.max),
    price: row.dataset.price || "",
    label: (row.querySelector("th")?.textContent || row.dataset.item).trim(),
    standard: row.dataset.default === "true",
    group: row.dataset.exclusiveGroup || "",
  }));

  const basisSelection = () => items.filter((item) => item.standard).map((item) => item.id);

  // Binnen een optie mag per wisselgroep (bv. basis versus premium partyboot)
  // maar één post aangevinkt staan.
  const withoutConflicts = (ids) => {
    const picked = [];
    const usedGroups = new Set();
    for (const id of ids) {
      const item = items.find((entry) => entry.id === id);
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
    const options = saved.options
      .filter((option) => option && typeof option.name === "string")
      .map((option) => ({
        name: option.name,
        selected: new Set(
          withoutConflicts(
            (Array.isArray(option.selected) ? option.selected : []).filter((id) =>
              items.some((item) => item.id === id)
            )
          )
        ),
      }));
    if (options.length === 0) return null;
    return { options, counter: Number(saved.counter) || options.length };
  };

  let state = {
    options: [{ name: "Basis optie", selected: new Set(basisSelection()) }],
    counter: 0,
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
          options: state.options.map((option) => ({ name: option.name, selected: [...option.selected] })),
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
    for (const item of items) {
      if (!option.selected.has(item.id)) continue;
      minimum += item.minimum;
      maximum += item.maximum;
    }
    const groupMinimum = minimum * participantCount;
    const groupMaximum = maximum * participantCount;
    const cell = footRow.cells[index + 1];
    if (!cell) return;
    const strong = document.createElement("strong");
    strong.textContent = `${formatRange(groupMinimum / payerCount, groupMaximum / payerCount)} per betalende gast`;
    const small = document.createElement("small");
    small.textContent = `${formatRange(groupMinimum, groupMaximum)} groepskosten voor ${participantCount} deelnemers`;
    cell.replaceChildren(strong, small);
  }

  function render() {
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

    for (const categoryRow of categoryRows) {
      const cell = categoryRow.querySelector("th");
      if (cell) cell.colSpan = state.options.length + 1;
    }
  }

  addButton?.addEventListener("click", () => {
    state.counter += 1;
    const basis = state.options[0];
    state.options.push({ name: `Optie ${state.counter}`, selected: new Set(basis.selected) });
    save();
    render();
    const added = state.options[state.options.length - 1];
    announce(`${added.name} toegevoegd als kopie van ${basis.name}.`);
  });

  resetButton?.addEventListener("click", () => {
    state = {
      options: [{ name: "Basis optie", selected: new Set(basisSelection()) }],
      counter: 0,
    };
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Herstellen lukt ook zonder opslag.
    }
    render();
    announce("De basisoptie is hersteld.");
  });

  if (addButton) addButton.hidden = false;
  if (resetButton) resetButton.hidden = false;
  render();
  save();
})();
